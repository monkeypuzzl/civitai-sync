import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { getConfig, updateConfig, getDownloadStatus, startDownload, abortDownload, connectProgress, rebuildIndex, unlockKey, refreshUser } from '../api.js';

const MEDIA_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'favorite', label: 'Favorites' },
  { value: 'feedback:liked', label: 'Liked' },
  { value: 'feedback:disliked', label: 'Disliked' }
];

const TAG_LABELS = {
  all: 'All',
  favorite: 'Favorited',
  'feedback:liked': 'Liked',
  'feedback:disliked': 'Disliked'
};

function tagModeLabel (mediaTypes) {
  if (!mediaTypes || !mediaTypes.length) return 'By tag';
  const tags = mediaTypes.filter(t => t !== 'all');
  if (!tags.length) return 'By tag';
  return tags.map(t => TAG_LABELS[t] || t).join('/');
}

const GEN_MODES_BASE = [
  { value: 'latest', label: 'Latest', desc: 'Most recent generations not yet saved' },
  { value: 'oldest', label: 'Oldest', desc: 'Resume from oldest saved generation' },
  { value: 'missing-tags', label: null, desc: 'Tag-filtered generations (last 30 days)' },
  { value: 'missing-all', label: 'All', desc: 'All generations in last 30 days' }
];

const POST_MODES = [
  { value: 'latest', label: 'Latest', desc: 'Most recent posts not yet saved' },
  { value: 'all', label: 'All', desc: 'Download all posts' }
];

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

function formatDaysAgo (isoDate) {
  if (!isoDate) return null;
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return { text: 'today', days };
  if (days === 1) return { text: 'yesterday', days };
  return { text: `${days} days ago`, days };
}

export function SettingsView () {
  const [config, setConfig] = useState(null);
  const [genMode, setGenMode] = useState('latest');
  const [postMode, setPostMode] = useState('latest');
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
    // Trigger at most one user-data refresh per server lifetime (dedup
    // enforced server-side). After it resolves, re-read config to surface any
    // changes to username / allowAltDomain / domain.
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

      if (event.final) {
        setDownloadActive(false);
        setDownloadStartedAt(null);
        setLastResult({ ...event });
        setProgress(null);
        getConfig().then(setConfig).catch(() => {});
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

  const handleStartGen = useCallback(async () => {
    setError(null);
    setLastResult(null);
    const result = await startDownload('generations', genMode);
    if (result.error) {
      setError(result.error);
    } else {
      setDownloadActive(true);
      setDownloadType('generations');
      setDownloadStartedAt(Date.now());
      setProgress({});
    }
  }, [genMode]);

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

  const handleAbort = useCallback(async () => {
    await abortDownload();
  }, []);

  const handleRebuild = useCallback(async () => {
    setRebuilding(true);
    await rebuildIndex().catch(() => {});
    setRebuilding(false);
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

  async function handleMediaTypeToggle (type) {
    if (!config) return;
    let types = [...(config.generationMediaTypes || [])];
    if (types.includes(type)) {
      types = types.filter(t => t !== type);
    } else {
      types.push(type);
    }
    if (!types.length) types = ['all'];
    types.sort();
    const result = await updateConfig({ generationMediaTypes: types });
    if (result.ok) {
      setConfig(prev => ({ ...prev, generationMediaTypes: types }));
    }
  }

  async function handleExcludeImagesToggle () {
    if (!config) return;
    const newValue = !config.excludeImages;
    const result = await updateConfig({ excludeImages: newValue });
    if (result.ok) {
      setConfig(prev => ({ ...prev, excludeImages: newValue }));
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
    return <div class="settings-loading"><div class="spinner" /></div>;
  }

  const needsUnlock = config.keyEncrypted && !config.keyUnlocked;
  const canDownload = config.hasKey && !needsUnlock;

  return (
    <div class="main-content settings-view">
      {/* Unlock encrypted key */}
      {needsUnlock && (
        <section class="settings-section unlock-section">
          <h2 class="settings-heading">Unlock API Key</h2>
          <p class="unlock-desc">Your API key is encrypted. Enter your password to unlock it for this session.</p>
          <div class="settings-row">
            <input
              type="password"
              class="unlock-input"
              placeholder="Password"
              value={unlockPassword}
              onInput={e => setUnlockPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
              disabled={unlocking}
            />
            <button class="action-btn download-btn" onClick={handleUnlock} disabled={unlocking || !unlockPassword}>
              {unlocking ? 'Unlocking\u2026' : 'Unlock'}
            </button>
          </div>
          {unlockError && <div class="settings-error">{unlockError}</div>}
        </section>
      )}

      {/* Download Generations */}
      <section class="settings-section">
        <h2 class="settings-heading">Download Generations</h2>
        <LastDownloadInfo
          isoDate={config.lastDownloadGenerations}
          warnDays={25}
          expireDays={30}
          online={online}
        />
        <div class="settings-row">
          <div class="mode-selector">
            {GEN_MODES_BASE.map(m => (
              <button
                key={m.value}
                class={`mode-btn${genMode === m.value ? ' active' : ''}`}
                onClick={() => setGenMode(m.value)}
                disabled={downloadActive}
                title={m.desc}
              >
                {m.label || tagModeLabel(config.generationMediaTypes)}
              </button>
            ))}
          </div>
          {downloadActive && downloadType === 'generations' ? (
            <button class="action-btn stop-btn" onClick={handleAbort}>Stop</button>
          ) : (
            <button class="action-btn download-btn" onClick={handleStartGen} disabled={downloadActive || !online || !canDownload}>
              Download
            </button>
          )}
        </div>
        {downloadActive && downloadType === 'generations' && (
          <ProgressBar progress={progress || {}} type="generations" startedAt={downloadStartedAt} />
        )}
      </section>

      {/* Download Posts */}
      <section class="settings-section">
        <h2 class="settings-heading">Download Posts</h2>
        <LastDownloadInfo
          isoDate={config.lastDownloadPosts}
          online={online}
        />
        <div class="settings-row">
          <div class="mode-selector">
            {POST_MODES.map(m => (
              <button
                key={m.value}
                class={`mode-btn${postMode === m.value ? ' active' : ''}`}
                onClick={() => setPostMode(m.value)}
                disabled={downloadActive}
                title={m.desc}
              >
                {m.label}
              </button>
            ))}
          </div>
          {downloadActive && downloadType === 'posts' ? (
            <button class="action-btn stop-btn" onClick={handleAbort}>Stop</button>
          ) : (
            <button class="action-btn download-btn" onClick={handleStartPosts} disabled={downloadActive || !online || !canDownload}>
              Download
            </button>
          )}
        </div>
        {downloadActive && downloadType === 'posts' && (
          <ProgressBar progress={progress || {}} type="posts" startedAt={downloadStartedAt} />
        )}
      </section>

      {/* Last result */}
      {lastResult && <ResultBanner result={lastResult} />}

      {/* Error */}
      {error && <div class="settings-error">{error}</div>}

      {/* Media Options */}
      <section class="settings-section">
        <h2 class="settings-heading">Media Options</h2>
        <div class="settings-field">
          <label class="settings-label">Generation media directories</label>
          <div class="checkbox-group">
            {MEDIA_TYPES.map(t => (
              <label key={t.value} class="checkbox-label">
                <input
                  type="checkbox"
                  checked={(config.generationMediaTypes || []).includes(t.value)}
                  onChange={() => handleMediaTypeToggle(t.value)}
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>
        <div class="settings-field">
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={config.excludeImages}
              onChange={handleExcludeImagesToggle}
            />
            Data only (skip image downloads)
          </label>
        </div>
      </section>

      {/* Civitai domain */}
      {config.allowAltDomain && (config.availableDomains || []).length > 1 && (
        <section class="settings-section">
          <h2 class="settings-heading">Civitai domain</h2>
          <div class="settings-field">
            <div class="mode-selector">
              {(config.availableDomains || []).map(domain => (
                <button
                  key={domain}
                  class={`mode-btn${config.domain === domain ? ' active' : ''}`}
                  onClick={() => handleDomainChange(domain)}
                  title={`Use ${domain} for API calls and links`}
                >
                  {domain}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Paths */}
      <section class="settings-section">
        <h2 class="settings-heading">Paths</h2>
        <div class="settings-field">
          <label class="settings-label">Data path</label>
          <div class="settings-value mono">{config.dataPath}</div>
        </div>
        <div class="settings-field">
          <label class="settings-label">Media path</label>
          <div class="settings-value mono">{config.mediaPath}</div>
        </div>
      </section>

      {/* Info */}
      <section class="settings-section">
        <h2 class="settings-heading">Info</h2>
        <div class="settings-field">
          <label class="settings-label">Version</label>
          <div class="settings-value">{config.version || 'unknown'}</div>
        </div>
        <div class="settings-field">
          <label class="settings-label">API key</label>
          <div class="settings-value">{config.hasKey ? 'Configured' : 'Not set'}</div>
        </div>
        {config.username && (
          <div class="settings-field">
            <label class="settings-label">Username</label>
            <div class="settings-value">{config.username}</div>
          </div>
        )}
        <div class="settings-actions">
          <button class="action-btn secondary-btn" onClick={handleRebuild} disabled={rebuilding}>
            {rebuilding ? 'Rebuilding\u2026' : 'Rebuild index'}
          </button>
        </div>
      </section>
    </div>
  );
}

function ProgressBar ({ progress, type, startedAt }) {
  const isGen = type === 'generations';
  const newCount = isGen ? (progress.generationsNew || 0) : (progress.postsNew || 0);
  const newLabel = isGen ? 'new generation' : 'new post';
  const images = progress.imagesSaved || 0;
  const videos = progress.videosSaved || 0;
  const itemNoun = isGen ? 'item' : 'post';
  const activityText = formatActivity(progress.activity, { itemNoun });

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = formatElapsed(startedAt ? now - startedAt : (progress.elapsed || 0));

  const parts = [];
  if (newCount > 0) parts.push(plural(newCount, newLabel));
  if (images > 0) parts.push(plural(images, 'image'));
  if (videos > 0) parts.push(plural(videos, 'video'));

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
  const info = formatDaysAgo(isoDate);

  return (
    <div class="last-download-info">
      {!online && <span class="offline-badge">Offline</span>}
      {info ? (
        <span class={
          expireDays && info.days >= expireDays ? 'last-download-expired'
            : warnDays && info.days >= warnDays ? 'last-download-warning'
              : 'last-download-ok'
        }>
          Last downloaded {info.text}
          {expireDays && info.days >= expireDays && ' — generations may have expired!'}
          {warnDays && info.days >= warnDays && info.days < expireDays && ' — download soon to avoid expiry'}
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
  const newCount = isGen ? (result.generationsNew || 0) : (result.postsNew || 0);
  const newLabel = isGen ? 'new generation' : 'new post';
  const images = result.imagesSaved || 0;
  const videos = result.videosSaved || 0;
  const elapsed = formatElapsed(result.elapsed);

  const hasData = newCount > 0 || images > 0 || videos > 0;

  let statusClass = 'success';
  let statusText = 'Download complete';
  if (isAborted) { statusClass = 'warning'; statusText = 'Download stopped'; }
  if (isError) { statusClass = 'error'; statusText = 'Download failed'; }
  if (!hasData && !isAborted && !isError) statusText = 'Up to date';

  const parts = [];
  if (newCount > 0) parts.push(plural(newCount, newLabel));
  if (images > 0) parts.push(plural(images, 'image'));
  if (videos > 0) parts.push(plural(videos, 'video'));

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
