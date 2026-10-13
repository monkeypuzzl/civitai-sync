import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { getConfig, updateConfig, getDownloadStatus, startDownload, abortDownload, connectProgress, rebuildIndex, unlockKey, refreshUser, getModelCacheStatus, refreshModelCache, abortModelCacheRefresh } from '../api.js';
import { notifyCorpusChange } from '../lib/nav-tabs.js';
import { useDocumentTitle } from '../lib/page-title.js';
import { OpenFolderButton } from './OpenFolderButton.jsx';
import { TimeText } from './TimeText.jsx';
import { applyGenerationSelection, generationDownloadModes, selectionFromConfig } from '../lib/generation-download-modes.js';
import { calendarDaysAgo, relativeTime } from '../lib/format.js';

const POST_MODES = [
  { value: 'latest', label: 'Latest', desc: 'Most recent posts not yet saved' },
  { value: 'all', label: 'All', desc: 'Download all posts' }
];

function generationClick (value) {
  return value === 'missing-all' ? 'all' : value;
}

function generationButtonOn (selection, value) {
  if (value === 'latest') return selection.run === 'latest';
  if (value === 'missing-all') return selection.run === 'all';
  return selection.run === 'reactions' && selection.reactions.includes(value);
}

function FilesNotSavedLine ({ downloadMedia }) {
  if (downloadMedia !== false) return null;
  return <p class="files-not-saved">Files are not saved.</p>;
}

function formatElapsed (ms) {
  if (!ms || ms < 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function plural (n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function formatActivity (activity, { itemNoun = 'item' } = {}) {
  if (!activity) return '';
  const { phase, index, total } = activity;
  const of = (index && total) ? ` ${index} of ${total}` : '';
  switch (phase) {
    case 'checking': return `checking ${itemNoun}${of}`;
    case 'saving': return `saving ${itemNoun}${of}`;
    case 'enriching': return `enriching ${itemNoun}${of}`;
    case 'media': return `image${of}`;
    default: return '';
  }
}

export function DownloadView () {
  useDocumentTitle({ place: 'download' });

  const [config, setConfig] = useState(null);
  const [genOverride, setGenOverride] = useState(null);
  const [postModeOverride, setPostModeOverride] = useState(null);
  const [downloadActive, setDownloadActive] = useState(false);
  const [downloadType, setDownloadType] = useState(null);
  const [downloadStartedAt, setDownloadStartedAt] = useState(null);
  const [progress, setProgress] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState(null);
  const [unlocking, setUnlocking] = useState(false);
  const [modelCache, setModelCache] = useState(null);
  const [modelCacheError, setModelCacheError] = useState(null);
  const disconnectSSE = useRef(null);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    getConfig().then(setConfig).catch(() => {});
    getDownloadStatus().then(status => {
      if (status.active) {
        setDownloadActive(true);
        setDownloadType(status.type);
      }
    }).catch(() => {});
    getModelCacheStatus().then(setModelCache).catch(() => {});
    refreshUser()
      .then(() => getConfig().then(setConfig).catch(() => {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const disconnect = connectProgress((event) => {
      if (event.type === 'connected') {
        if (event.active) {
          setDownloadActive(true);
          setDownloadType(event.downloadType);
          if (!downloadStartedAt) setDownloadStartedAt(Date.now());
        }
        return;
      }

      // Model-cache events flow on the same SSE channel under their own
      // discriminator. Update the model-cache panel; don't touch the
      // download state.
      if (event.type === 'model-cache') {
        if (event.final) {
          // Re-read /status to capture totals + lastRefreshedAt.
          getModelCacheStatus().then(setModelCache).catch(() => {});
        } else if (event.versionsDone) {
          // Version counts are done. Cancel stays up while this account's
          // models are listed. That phase has no progress line.
          setModelCache(prev => ({
            ...(prev || {}),
            isRunning: true,
            activeTrigger: event.trigger || 'manual',
            activeProgress: null
          }));
        } else if (event.status === 'running') {
          setModelCache(prev => ({
            ...(prev || {}),
            isRunning: true,
            activeTrigger: event.trigger || prev?.activeTrigger || null,
            activeProgress: {
              total: event.total || 0,
              fetched: event.fetched || 0,
              tombstoned: event.tombstoned || 0,
              preserved: event.preserved || 0,
              errors: event.errors || 0,
              elapsed: 0
            }
          }));
        }
        return;
      }

      if (event.final) {
        setDownloadActive(false);
        setDownloadStartedAt(null);
        setLastResult({ ...event });
        setProgress(null);
        setPostModeOverride(null);
        getConfig().then(setConfig).catch(() => {});
        notifyCorpusChange();
        return;
      }

      if (event.status === 'downloading') {
        setProgress(event);
        setDownloadActive(true);
        setDownloadType(event.type);
      }
    });

    disconnectSSE.current = disconnect;
    return disconnect;
  }, []);

  const postsNeedGenerationData = config?.postsNeedGenerationData === true;
  const postMode = postModeOverride ?? (
    postsNeedGenerationData ? 'all' : (config?.postDownload === 'all' ? 'all' : 'latest')
  );
  const genSelection = genOverride ?? selectionFromConfig({
    generationDownload: config?.generationDownload,
    generationReactions: config?.generationReactions
  });

  const handleStartGen = useCallback(async () => {
    setError(null);
    setLastResult(null);
    const arm = () => {
      setDownloadActive(true);
      setDownloadType('generations');
      setDownloadStartedAt(Date.now());
      setProgress({});
    };
    if (genSelection.run === 'reactions' && genSelection.reactions.length > 0) {
      let saved;
      try {
        saved = await updateConfig({ generationReactions: genSelection.reactions });
      } catch {
        setError('Could not connect to server');
        return;
      }
      if (!saved || !saved.ok) {
        setError((saved && saved.error) || 'Could not save reactions');
        return;
      }
      setConfig(prev => (prev ? { ...prev, generationReactions: genSelection.reactions } : prev));
      const result = await startDownload('generations', 'missing-tags');
      if (result.error) {
        setError(result.error);
      } else {
        arm();
      }
      return;
    }
    const mode = genSelection.run === 'all' ? 'missing-all' : 'latest';
    const result = await startDownload('generations', mode);
    if (result.error) {
      setError(result.error);
    } else {
      arm();
    }
  }, [genSelection]);

  const handleStartPosts = useCallback(async () => {
    setError(null);
    setLastResult(null);
    const result = await startDownload('posts', postMode);
    if (result.error) {
      setError(result.error);
    } else {
      setDownloadActive(true);
      setDownloadType('posts');
      setDownloadStartedAt(Date.now());
      setProgress({});
    }
  }, [postMode]);

  const handleStartComics = useCallback(async () => {
    setError(null);
    setLastResult(null);
    const result = await startDownload('comics');
    if (result.error) {
      setError(result.error);
    } else {
      setDownloadActive(true);
      setDownloadType('comics');
      setDownloadStartedAt(Date.now());
      setProgress({});
    }
  }, []);

  const handleStartModel3ds = useCallback(async () => {
    setError(null);
    setLastResult(null);
    const result = await startDownload('model3ds');
    if (result.error) {
      setError(result.error);
    } else {
      setDownloadActive(true);
      setDownloadType('model3ds');
      setDownloadStartedAt(Date.now());
      setProgress({});
    }
  }, []);

  const handleAbort = useCallback(async () => {
    await abortDownload();
  }, []);

  const handleRebuild = useCallback(async () => {
    setRebuilding(true);
    await rebuildIndex().catch(() => {});
    notifyCorpusChange();
    setRebuilding(false);
  }, []);

  const handleModelCacheRefresh = useCallback(async () => {
    setModelCacheError(null);
    const r = await refreshModelCache(true).catch(err => ({ error: String(err) }));
    if (r && r.error) {
      setModelCacheError(r.error);
    }
    // Optimistic state nudge so the button flips to "Refreshing…" immediately.
    // The next SSE event will overwrite this with authoritative state.
    if (r && r.ok) {
      setModelCache(prev => ({ ...(prev || {}), isRunning: true, activeTrigger: 'manual' }));
    }
  }, []);

  const handleModelCacheAbort = useCallback(async () => {
    await abortModelCacheRefresh().catch(() => {});
  }, []);

  const handleUnlock = useCallback(async () => {
    if (!unlockPassword) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      const result = await unlockKey(unlockPassword);
      if (result.ok) {
        setUnlockPassword('');
        getConfig().then(setConfig).catch(() => {});
      } else {
        setUnlockError(result.error || 'Wrong password');
      }
    } catch {
      setUnlockError('Could not connect to server');
    }
    setUnlocking(false);
  }, [unlockPassword]);

  async function handleFilesChoice (downloadMedia) {
    if (!config || config.downloadMedia === downloadMedia) return;
    const result = await updateConfig({ downloadMedia });
    if (result.ok) {
      setConfig(prev => ({ ...prev, downloadMedia }));
    }
  }

  async function handleDomainChange (newDomain) {
    if (!config || !config.allowAltDomain) return;
    if (!(config.availableDomains || []).includes(newDomain)) return;
    if (newDomain === config.domain) return;
    const result = await updateConfig({ domain: newDomain });
    if (result.ok) {
      // Re-read the full config so the effective domain (gated by
      // allowAltDomain in getCivitaiDomain) matches the server's view.
      getConfig().then(setConfig).catch(() => {});
    }
  }

  if (!config) {
    return (
      <main class="property-loading">
        <h1 class="visually-hidden">Download</h1>
        <div class="spinner" />
      </main>
    );
  }

  const needsUnlock = config.keyEncrypted && !config.keyUnlocked;
  const canDownload = config.hasKey && !needsUnlock;
  const downloadFromTitle = `Download from ${config.domain || 'civitai.com'}`;

  return (
    <main class="main-content property-sheet">
      <h1 class="visually-hidden">Download</h1>
      {/* Unlock encrypted key */}
      {needsUnlock && (
        <section class="property-group unlock-section">
          <h2 class="property-heading">Unlock API Key</h2>
          <p class="unlock-desc">Your API key is encrypted. Enter your password to unlock it for this session.</p>
          <div class="property-controls">
            <label class="visually-hidden" for="download-password">Password</label>
            <input
              id="download-password"
              type="password"
              class="unlock-input"
              placeholder="Password"
              value={unlockPassword}
              onInput={e => setUnlockPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
              disabled={unlocking}
            />
            <button class="action-btn" onClick={handleUnlock} disabled={unlocking || !unlockPassword}>
              {unlocking ? 'Unlocking\u2026' : 'Unlock'}
            </button>
          </div>
          {unlockError && <div class="property-error">{unlockError}</div>}
        </section>
      )}

      {/* Download Generations */}
      <section class="property-group">
        <h2 class="property-heading">Download Generations</h2>
        <LastDownloadInfo
          isoDate={config.lastDownloadGenerations}
          warnDays={25}
          expireDays={30}
          online={online}
        />
        <FilesNotSavedLine downloadMedia={config.downloadMedia} />
        <div class="property-controls">
          <div class="mode-selector">
            <fieldset class="mode-cluster">
              <legend class="visually-hidden">Download type</legend>
              {generationDownloadModes().filter(m => m.value === 'latest' || m.value === 'missing-all').map(m => (
                <label key={m.value} class="mode-btn" title={m.desc}>
                  <input
                    type="radio"
                    name="download-generations-type"
                    value={m.value}
                    checked={generationButtonOn(genSelection, m.value)}
                    disabled={downloadActive && (m.value === 'latest' || m.value === 'missing-all')}
                    onChange={() => setGenOverride(applyGenerationSelection(genSelection, generationClick(m.value)))}
                  />
                  {m.label}
                </label>
              ))}
            </fieldset>
            <span class="mode-break" aria-hidden="true" />
            <fieldset class="mode-cluster">
              <legend class="visually-hidden">By tag</legend>
              {generationDownloadModes().filter(m => m.value === 'favorite' || m.value === 'feedback:liked').map(m => (
                <label key={m.value} class="mode-btn" title={m.desc}>
                  <input
                    type="checkbox"
                    value={m.value}
                    checked={generationButtonOn(genSelection, m.value)}
                    onChange={() => setGenOverride(applyGenerationSelection(genSelection, generationClick(m.value)))}
                  />
                  {m.label}
                </label>
              ))}
            </fieldset>
          </div>
          {downloadActive && downloadType === 'generations' ? (
            <button class="action-btn stop-btn" onClick={handleAbort}>Stop</button>
          ) : (
            <button class="action-btn" onClick={handleStartGen} disabled={downloadActive || !online || !canDownload} title={downloadFromTitle}>
              Download
            </button>
          )}
        </div>
        {downloadActive && downloadType === 'generations' && (
          <ProgressBar progress={progress || {}} type="generations" startedAt={downloadStartedAt} />
        )}
      </section>

      {/* Download Posts */}
      <section class="property-group">
        <h2 class="property-heading">Download Posts</h2>
        <LastDownloadInfo
          isoDate={config.lastDownloadPosts}
          online={online}
        />
        {postsNeedGenerationData && (
          <div class="last-download-info">
            <span class="last-download-warning">
              Some posts are missing generation parameters. Choose All, then Download.
            </span>
          </div>
        )}
        <FilesNotSavedLine downloadMedia={config.downloadMedia} />
        <div class="property-controls">
          <fieldset class="mode-selector">
            <legend class="visually-hidden">Download posts</legend>
            {POST_MODES.map(m => (
              <label
                key={m.value}
                class="mode-btn"
                title={m.value === 'all' && postsNeedGenerationData
                  ? 'Fills generation parameters on posts already saved'
                  : m.desc}
              >
                <input
                  type="radio"
                  name="download-posts"
                  value={m.value}
                  checked={postMode === m.value}
                  disabled={downloadActive}
                  onChange={() => setPostModeOverride(m.value)}
                />
                {m.label}
              </label>
            ))}
          </fieldset>
          {downloadActive && downloadType === 'posts' ? (
            <button class="action-btn stop-btn" onClick={handleAbort}>Stop</button>
          ) : (
            <button class="action-btn" onClick={handleStartPosts} disabled={downloadActive || !online || !canDownload} title={downloadFromTitle}>
              Download
            </button>
          )}
        </div>
        {downloadActive && downloadType === 'posts' && (
          <ProgressBar progress={progress || {}} type="posts" startedAt={downloadStartedAt} />
        )}
      </section>

      {/* Download Comics */}
      <section class="property-group">
        <h2 class="property-heading">Download Comics</h2>
        <LastDownloadInfo
          isoDate={config.lastDownloadComics}
          online={online}
        />
        <FilesNotSavedLine downloadMedia={config.downloadMedia} />
        <div class="property-controls">
          {downloadActive && downloadType === 'comics' ? (
            <button class="action-btn stop-btn" onClick={handleAbort}>Stop</button>
          ) : (
            <button class="action-btn" onClick={handleStartComics} disabled={downloadActive || !online || !canDownload} title={downloadFromTitle}>
              Download
            </button>
          )}
        </div>
        {downloadActive && downloadType === 'comics' && (
          <ProgressBar progress={progress || {}} type="comics" startedAt={downloadStartedAt} />
        )}
      </section>

      <section class="property-group">
        <h2 class="property-heading">Download 3D</h2>
        <LastDownloadInfo
          isoDate={config.lastDownloadModel3ds}
          online={online}
        />
        <FilesNotSavedLine downloadMedia={config.downloadMedia} />
        <div class="property-controls">
          {downloadActive && downloadType === 'model3ds' ? (
            <button class="action-btn stop-btn" onClick={handleAbort}>Stop</button>
          ) : (
            <button class="action-btn" onClick={handleStartModel3ds} disabled={downloadActive || !online || !canDownload} title={downloadFromTitle}>
              Download
            </button>
          )}
        </div>
        {downloadActive && downloadType === 'model3ds' && (
          <ProgressBar progress={progress || {}} type="model3ds" startedAt={downloadStartedAt} />
        )}
      </section>

      {/* Folders */}
      <section class="property-group">
        <h2 class="property-heading">Folders</h2>
        <dl>
          <div class="property">
            <dt class="property-name">Media</dt>
            <dd class="property-value-row">
              <div class="property-value mono">{config.mediaPath}</div>
              <OpenFolderButton path={config.mediaPath} />
            </dd>
          </div>
          <div class="property">
            <dt class="property-name">Data</dt>
            <dd class="property-value-row">
              <div class="property-value mono">{config.dataPath}</div>
              <OpenFolderButton path={config.dataPath} />
            </dd>
          </div>
        </dl>
      </section>

      {/* Files */}
      <section class="property-group">
        <h2 class="property-heading">Files</h2>
        <div class="property">
          <fieldset class="mode-selector">
            <legend class="visually-hidden">Files</legend>
            <label class="mode-btn">
              <input
                type="radio"
                name="download-files"
                value="true"
                checked={config.downloadMedia !== false}
                onChange={() => handleFilesChoice(true)}
              />
              Media and data
            </label>
            <label class="mode-btn">
              <input
                type="radio"
                name="download-files"
                value="false"
                checked={config.downloadMedia === false}
                onChange={() => handleFilesChoice(false)}
              />
              Data only
            </label>
          </fieldset>
        </div>
      </section>

      {/* Last result */}
      {lastResult && <ResultBanner result={lastResult} />}

      {/* Error */}
      {error && <div class="property-error">{error}</div>}

      {/* Civitai domain */}
      {config.allowAltDomain && (config.availableDomains || []).length > 1 && (
        <section class="property-group">
          <h2 class="property-heading">Civitai domain</h2>
          <div class="property">
            <fieldset class="mode-selector">
              <legend class="visually-hidden">Civitai domain</legend>
              {(config.availableDomains || []).map(domain => (
                <label
                  key={domain}
                  class="mode-btn"
                  title={`Use ${domain} for API calls and links`}
                >
                  <input
                    type="radio"
                    name="civitai-domain"
                    value={domain}
                    checked={config.domain === domain}
                    onChange={() => handleDomainChange(domain)}
                  />
                  {domain}
                </label>
              ))}
            </fieldset>
          </div>
        </section>
      )}

      <div class="property-pair">
        <ModelCacheSection
          modelCache={modelCache}
          downloadActive={downloadActive}
          error={modelCacheError}
          hasKey={config.hasKey}
          username={config.username}
          rebuilding={rebuilding}
          onRefresh={handleModelCacheRefresh}
          onAbort={handleModelCacheAbort}
          onRebuild={handleRebuild}
        />

        <section class="property-group">
          <h2 class="property-heading">Civitai-Sync</h2>
          <dl>
            <div class="property">
              <dt class="property-name">Version</dt>
              <dd class="property-value">{config.version || 'unknown'}</dd>
              <dd class="property-value">
                <a
                  class="meta-action"
                  href={`https://${config.domain || 'civitai.com'}/models/526058`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open Civitai-Sync on Civitai"
                >{'\uD83D\uDD17 On Civitai'}</a>
                <a
                  class="meta-action"
                  href={`https://${config.domain || 'civitai.com'}/articles/5676`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open Discussion page for Civitai-Sync on Civitai"
                >{'\uD83D\uDD17 Discussion'}</a>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}

function ApiKeyProperty ({ hasKey, username }) {
  return (
    <div class="property">
      <dt class="property-name">API key</dt>
      <dd class="property-value">{hasKey ? `Configured${username ? ` · ${username}` : ''}` : 'Not set'}</dd>
    </div>
  );
}

function RebuildIndexButton ({ rebuilding, onRebuild }) {
  return (
    <button class="action-btn secondary-btn" onClick={onRebuild} disabled={rebuilding}>
      {rebuilding ? 'Rebuilding\u2026' : 'Rebuild index'}
    </button>
  );
}

function ModelCacheSection ({ modelCache, downloadActive, error, hasKey, username, rebuilding, onRefresh, onAbort, onRebuild }) {
  if (!modelCache) {
    return (
      <section class="property-group">
        <h2 class="property-heading">Account</h2>
        <dl>
          <ApiKeyProperty hasKey={hasKey} username={username} />
        </dl>
        <div class="property"><div class="property-value">Loading{'\u2026'}</div></div>
        <div class="property-actions">
          <RebuildIndexButton rebuilding={rebuilding} onRebuild={onRebuild} />
        </div>
      </section>
    );
  }

  const {
    totalCached = 0,
    totalTombstones = 0,
    totalPermanent = 0,
    lastRefreshedAt,
    isRunning,
    activeTrigger,
    activeProgress
  } = modelCache;

  const refreshed = relativeTime(lastRefreshedAt);
  let cachedPhrase = `${totalCached.toLocaleString()} cached`;
  if (totalTombstones > 0) cachedPhrase += ` (${totalTombstones.toLocaleString()} unavailable)`;
  if (totalPermanent > 0) cachedPhrase += ` (${totalPermanent.toLocaleString()} retired)`;
  const triggerLabel = activeTrigger === 'manual' ? 'manual refresh'
    : activeTrigger === 'after-download' ? 'after-download refresh'
    : 'refresh';

  return (
    <section class="property-group">
      <h2 class="property-heading">Account</h2>

      <dl>
        <ApiKeyProperty hasKey={hasKey} username={username} />

        <div class="property">
          <dt class="property-name">Models &amp; resources</dt>
          <dd class="property-value">
            {`${cachedPhrase}. `}
            {refreshed ? (
              <span title={new Date(lastRefreshedAt).toLocaleString()}>
                Last refreshed <TimeText at={lastRefreshedAt}>{refreshed}</TimeText>.
              </span>
            ) : 'Last refreshed never.'}
          </dd>
        </div>

        {isRunning && activeProgress && (
          <div class="property">
            <dt class="property-name">Status</dt>
            <dd class="property-value">
              Refreshing ({triggerLabel}):
              {' '}{activeProgress.fetched + activeProgress.tombstoned + activeProgress.preserved + activeProgress.errors}
              {' / '}{activeProgress.total}
            </dd>
          </div>
        )}
      </dl>

      {error && <div class="property-error">{error}</div>}

      <div class="property-actions">
        {isRunning ? (
          <button class="action-btn secondary-btn" onClick={onAbort}>Cancel refresh</button>
        ) : (
          <button
            class="action-btn secondary-btn"
            onClick={onRefresh}
            disabled={downloadActive}
            title={downloadActive ? 'Disabled while a download is in progress' : 'Re-fetch cached model versions, then this account\'s models'}
          >
            Refresh models
          </button>
        )}
        <RebuildIndexButton rebuilding={rebuilding} onRebuild={onRebuild} />
      </div>
    </section>
  );
}

function ProgressBar ({ progress, type, startedAt }) {
  const isGen = type === 'generations';
  const isComics = type === 'comics';
  const isModel3ds = type === 'model3ds';
  const newCount = isGen
    ? (progress.generationsNew || 0)
    : isComics
      ? (progress.comicsNew || 0)
      : isModel3ds
        ? (progress.model3dsNew || 0)
        : (progress.postsNew || 0);
  const newLabel = isGen ? 'new generation' : isComics ? 'new comic' : 'new post';
  const images = isModel3ds ? 0 : (progress.imagesSaved || 0);
  const videos = (isComics || isModel3ds) ? 0 : (progress.videosSaved || 0);
  const audio = (isComics || isModel3ds) ? 0 : (progress.audioSaved || 0);
  const model3d = isGen ? (progress.model3dSaved || 0) : 0;
  const filesSaved = isModel3ds ? (progress.filesSaved || 0) : 0;
  const itemNoun = isGen ? 'item' : isComics ? 'comic' : isModel3ds ? '3D' : 'post';
  const activityText = formatActivity(progress.activity, { itemNoun });

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = formatElapsed(startedAt ? now - startedAt : (progress.elapsed || 0));

  const parts = [];
  if (newCount > 0) parts.push(isModel3ds ? `${newCount} new 3D` : plural(newCount, newLabel));
  if (images > 0) parts.push(plural(images, 'image'));
  if (videos > 0) parts.push(plural(videos, 'video'));
  if (audio > 0) parts.push(plural(audio, 'audio file'));
  if (model3d > 0) parts.push(`${model3d} 3D`);
  if (filesSaved > 0) parts.push(plural(filesSaved, 'file'));

  return (
    <div class="progress-bar">
      <div class="progress-indicator">
        <div class="progress-pulse" />
        <span class="progress-status">Downloading{activityText ? ` \u00B7 ${activityText}` : '\u2026'}</span>
      </div>
      <div class="progress-details">
        {parts.length > 0 && <span class="progress-counts">{parts.join(' \u00B7 ')}</span>}
        <span class="progress-elapsed">{elapsed}</span>
      </div>
    </div>
  );
}

function LastDownloadInfo ({ isoDate, warnDays, expireDays, online }) {
  const days = calendarDaysAgo(isoDate);
  const text = relativeTime(isoDate);

  return (
    <div class="last-download-info">
      {!online && <span class="offline-badge">Offline</span>}
      {days != null ? (
        <span class={
          expireDays && days >= expireDays ? 'last-download-expired'
            : warnDays && days >= warnDays ? 'last-download-warning'
              : 'last-download-ok'
        }>
          Last downloaded <TimeText at={isoDate}>{text}</TimeText>
          {expireDays && days >= expireDays && ' — generations may have expired!'}
          {warnDays && days >= warnDays && days < expireDays && ' — download soon to avoid expiry'}
        </span>
      ) : (
        <span class="last-download-never">Never downloaded</span>
      )}
    </div>
  );
}

function ResultBanner ({ result }) {
  const isAborted = result.status === 'aborted';
  const isError = result.status === 'error';
  const isGen = result.type === 'generations';
  const isComics = result.type === 'comics';
  const isModel3ds = result.type === 'model3ds';
  const newCount = isGen
    ? (result.generationsNew || 0)
    : isComics
      ? (result.comicsNew || 0)
      : isModel3ds
        ? (result.model3dsNew || 0)
        : (result.postsNew || 0);
  const newLabel = isGen ? 'new generation' : isComics ? 'new comic' : 'new post';
  const images = isModel3ds ? 0 : (result.imagesSaved || 0);
  const videos = (isComics || isModel3ds) ? 0 : (result.videosSaved || 0);
  const audio = (isComics || isModel3ds) ? 0 : (result.audioSaved || 0);
  const model3d = isGen ? (result.model3dSaved || 0) : 0;
  const filesSaved = isModel3ds ? (result.filesSaved || 0) : 0;
  const elapsed = formatElapsed(result.elapsed);

  const hasData = newCount > 0 || images > 0 || videos > 0 || audio > 0 || model3d > 0 || filesSaved > 0;

  let statusClass = 'success';
  let statusText = 'Download complete';
  if (isAborted) { statusClass = 'warning'; statusText = 'Download stopped'; }
  if (isError) { statusClass = 'error'; statusText = 'Download failed'; }
  if (!hasData && !isAborted && !isError) statusText = 'Up to date';

  const parts = [];
  if (newCount > 0) parts.push(isModel3ds ? `${newCount} new 3D` : plural(newCount, newLabel));
  if (images > 0) parts.push(plural(images, 'image'));
  if (videos > 0) parts.push(plural(videos, 'video'));
  if (audio > 0) parts.push(plural(audio, 'audio file'));
  if (model3d > 0) parts.push(`${model3d} 3D`);
  if (filesSaved > 0) parts.push(plural(filesSaved, 'file'));

  const errorMsg = isError && result.message ? result.message : null;

  return (
    <div class={`result-banner ${statusClass}`}>
      <span class="result-status">{statusText}</span>
      {errorMsg && <span class="result-error-msg">{errorMsg}</span>}
      {parts.length > 0 && <span class="result-counts">{parts.join(' \u00B7 ')}</span>}
      <span class="result-elapsed">{elapsed}</span>
    </div>
  );
}
