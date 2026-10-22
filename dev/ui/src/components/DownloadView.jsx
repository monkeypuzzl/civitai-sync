import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { getConfig, updateConfig, getDownloadStatus, getStats, startDownloadQueue, saveDownloadModes, abortDownload, connectProgress, rebuildIndex, unlockKey, refreshUser, getModelCacheStatus, refreshModelCache, abortModelCacheRefresh, saveApiKey, deleteApiKey, protectApiKey, unprotectApiKey } from '../api.js';
import { notifyCorpusChange } from '../lib/nav-tabs.js';
import { useDocumentTitle } from '../lib/page-title.js';
import { OpenFolderButton } from './OpenFolderButton.jsx';
import { TimeText } from './TimeText.jsx';
import { applyGenerationSelection, generationDownloadModes, selectionFromConfig } from '../lib/generation-download-modes.js';
import { calendarDaysAgo, relativeTime } from '../lib/format.js';
import { downloadAccountVisibility } from '../lib/download-account.js';
import { accountMismatchParagraphs, accountMismatchText } from '../lib/account-mismatch.js';
import { DOWNLOAD_TYPE_LABELS, DOWNLOAD_TYPE_ORDER } from '../../../../src/downloadQueue.mjs';
import { downloadNotice, downloadStatusLine, nextDownloadClause, resolveDownloadTypes, snapshotFromStatus } from '../lib/download-run.js';
import { loadUiPrefs, readDownloadAdvancedOpen, readDownloadAuto, readDownloadEvery, readDownloadRecheck, readDownloadTypes, rememberDownloadAdvancedOpen, rememberDownloadAuto, rememberDownloadEvery, rememberDownloadRecheck, rememberDownloadTypes } from '../lib/sticky-ui.js';
import { DOWNLOAD_PERIODS, periodLabel } from '../../../../src/autoDownload.mjs';
import { applyRecheck, recheckShown } from '../lib/download-recheck.js';
import { downloadOptionsVisibility } from '../lib/download-options-visibility.js';
import { createModePersist, rememberedModes } from '../lib/download-mode-persist.js';

async function saveModesBody (body) {
  const result = await saveDownloadModes(body);
  if (!result || result.ok !== true) throw new Error('download modes were not saved');
}

const POST_MODES = [
  { value: 'latest', label: 'Latest', desc: 'Download the newest posts. Updates a post on those pages when its data is newer.' },
  { value: 'all', label: 'All', desc: 'Download all posts' }
];

const COMIC_MODES = [
  { value: 'latest', label: 'Latest', desc: 'Opens a comic when its shell is newer.' },
  { value: 'all', label: 'All', desc: 'Download all comics. Any missing will be saved.' }
];

const MODEL3D_MODES = [
  { value: 'latest', label: 'Latest', desc: 'Download the newest published 3D. Drafts and unpublished are read through.' },
  { value: 'all', label: 'All', desc: 'Download all 3D. Any missing will be saved.' }
];

const RECHECK_TITLE = 'Re-reads metadata (prompt, tags, model, workflow) for all published media, updating the saved data.';

const LAST_DOWNLOAD_KEY = {
  generations: 'lastDownloadGenerations',
  posts: 'lastDownloadPosts',
  comics: 'lastDownloadComics',
  model3ds: 'lastDownloadModel3ds'
};

function postModeTitle (mode, needUpdate) {
  if (!needUpdate) return null;
  if (mode === 'all') return 'Download All to update the posts.';
  if (mode === 'latest') return 'Updates posts from the last 30 days. Older posts stay until All.';
  return null;
}

function generationClick (value) {
  return value === 'missing-all' ? 'all' : value;
}

function generationButtonOn (selection, value) {
  if (value === 'latest') return selection.run === 'latest';
  if (value === 'missing-all') return selection.run === 'all';
  return selection.run === 'reactions' && selection.reactions.includes(value);
}

function selectionFromQueueMode (mode, reactions) {
  if (mode === 'missing-all') return { run: 'all', reactions: [] };
  if (mode === 'missing-tags') return { run: 'reactions', reactions: reactions || [] };
  return { run: 'latest', reactions: [] };
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

function errorResult (results) {
  if (!Array.isArray(results)) return null;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i] && results[i].status === 'error') return results[i];
  }
  return null;
}

export function DownloadView () {
  useDocumentTitle({ place: 'download' });

  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(undefined);
  const [chosen, setChosen] = useState(null);
  const [genOverride, setGenOverride] = useState(null);
  const [postModeOverride, setPostModeOverride] = useState(null);
  const [comicsModeOverride, setComicsModeOverride] = useState(null);
  const [model3dsModeOverride, setModel3dsModeOverride] = useState(null);
  const [recheck, setRecheck] = useState(false);
  const [autoOn, setAutoOn] = useState(false);
  const [every, setEvery] = useState('1h');
  const [autoPhase, setAutoPhase] = useState('idle');
  const [dueAt, setDueAt] = useState(null);
  const [prefsReady, setPrefsReady] = useState(false);
  const [advancedPref, setAdvancedPref] = useState(readDownloadAdvancedOpen);
  const [keyMenuOpen, setKeyMenuOpen] = useState(false);
  const [run, setRun] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState(null);
  const [unlocking, setUnlocking] = useState(false);
  const [keyValue, setKeyValue] = useState('');
  const [keyPassword, setKeyPassword] = useState('');
  const [keyConfirm, setKeyConfirm] = useState('');
  const [encryptKey, setEncryptKey] = useState(false);
  const [keyError, setKeyError] = useState(null);
  const [savingKey, setSavingKey] = useState(false);
  const [updatingKey, setUpdatingKey] = useState(false);
  const [mismatch, setMismatch] = useState(null);
  const [deleteAsk, setDeleteAsk] = useState(false);
  const [protectOpen, setProtectOpen] = useState(false);
  const [unprotectOpen, setUnprotectOpen] = useState(false);
  const [modelCache, setModelCache] = useState(null);
  const [modelCacheError, setModelCacheError] = useState(null);
  const [now, setNow] = useState(Date.now());
  const disconnectSSE = useRef(null);
  const clickLock = useRef(false);
  const retainedStatus = useRef(null);
  const modePersistRef = useRef(null);
  if (!modePersistRef.current) {
    modePersistRef.current = createModePersist({ save: saveModesBody });
  }

  function persistRemembered (patch = {}, { enabled = autoOn } = {}) {
    if (!enabled) return;
    const has = (key) => Object.prototype.hasOwnProperty.call(patch, key);
    modePersistRef.current.submit(rememberedModes({
      genOverride: has('genOverride') ? patch.genOverride : genOverride,
      config,
      postModeOverride: has('postModeOverride') ? patch.postModeOverride : postModeOverride,
      comicsModeOverride: has('comicsModeOverride') ? patch.comicsModeOverride : comicsModeOverride,
      model3dsModeOverride: has('model3dsModeOverride') ? patch.model3dsModeOverride : model3dsModeOverride
    }));
  }

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
    getStats().then(setStats).catch(() => setStats(null));
    getDownloadStatus().then(status => {
      const snapshot = snapshotFromStatus(status);
      if (snapshot) setRun(snapshot);
      if (status && status.auto) {
        setAutoPhase(status.auto.phase || 'idle');
        setDueAt(status.auto.dueAt || null);
      }
    }).catch(() => {});
    loadUiPrefs().then(() => {
      setAutoOn(readDownloadAuto());
      setEvery(readDownloadEvery());
      setRecheck(readDownloadRecheck());
      setPrefsReady(true);
    }).catch(() => { setPrefsReady(true); });
    getModelCacheStatus().then(setModelCache).catch(() => {});
    refreshUser()
      .then(result => {
        if (result && result.kind === 'blocked') {
          setMismatch({
            libraryUsername: result.libraryUsername,
            keyUsername: result.keyUsername
          });
        }
        return getConfig().then(setConfig).catch(() => {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (chosen !== null || !config || stats === undefined) return;
    const totals = stats ? {
      generations: stats.totalGenerations,
      posts: stats.totalPosts,
      comics: stats.totalComics,
      model3ds: stats.totalModel3ds
    } : null;
    setChosen(resolveDownloadTypes({ saved: readDownloadTypes(), totals }));
  }, [config, stats, chosen]);

  useEffect(() => {
    const disconnect = connectProgress((event) => {
      if (event.type === 'auto') {
        setAutoPhase(event.phase || 'idle');
        setDueAt(event.dueAt || null);
        return;
      }

      if (event.type === 'connected') {
        if (event.auto) {
          setAutoPhase(event.auto.phase || 'idle');
          setDueAt(event.auto.dueAt || null);
        }
        if (event.queue) {
          setRun(event.queue);
          setSubmitting(false);
        } else if (event.active && event.downloadType) {
          setRun(snapshotFromStatus({
            active: true,
            type: event.downloadType,
            elapsed: 0,
            progress: null
          }));
          setSubmitting(false);
        }
        return;
      }

      if (event.type === 'model-cache') {
        if (event.final) {
          getModelCacheStatus().then(setModelCache).catch(() => {});
        } else if (event.versionsDone) {
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

      if (event.queue) {
        setRun(event.queue);
        setSubmitting(false);
        return;
      }

      if (event.final) {
        setSubmitting(false);
        setRun(prev => {
          if (!prev) return prev;
          return { ...prev, closed: true, current: null, pending: [], progress: null };
        });
      }
    });

    disconnectSSE.current = disconnect;
    return disconnect;
  }, []);

  const resultCount = run && Array.isArray(run.results) ? run.results.length : 0;
  useEffect(() => {
    if (!resultCount) return;
    getConfig().then(setConfig).catch(() => {});
    getStats().then(setStats).catch(() => {});
    notifyCorpusChange();
  }, [resultCount]);

  useEffect(() => {
    if (!mismatch || !actionError) return;
    const text = accountMismatchText(mismatch.libraryUsername, mismatch.keyUsername);
    if (actionError === text) setActionError(null);
  }, [mismatch, actionError]);

  useEffect(() => {
    if (!run || !run.spec || !Array.isArray(run.results)) return;
    for (const result of run.results) {
      if (!result || result.status !== 'complete' || result.errors) continue;
      const spec = run.spec[result.type];
      const mode = spec && spec.mode;
      if (result.type === 'generations' && mode === 'missing-all') {
        setGenOverride({ run: 'latest', reactions: [] });
      }
      if (result.type === 'posts' && mode === 'all') setPostModeOverride('latest');
      if (result.type === 'comics' && mode === 'all') setComicsModeOverride('latest');
      if (result.type === 'model3ds' && mode === 'all') setModel3dsModeOverride('latest');
    }
    if (run.spec.recheck !== true) return;
    const watched = (run.types || []).filter(id => id === 'posts' || id === 'comics');
    if (!watched.length) return;
    const finished = watched.every(id => run.results.some(item => item && item.type === id));
    if (!finished) return;
    const allClean = watched.every(id => run.results.some(item => (
      item && item.type === id && item.status === 'complete' && !item.errors
    )));
    if (allClean) setRecheck(false);
  }, [run]);

  const line = downloadStatusLine(run);
  useEffect(() => {
    if (!line || !line.live) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [line && line.live]);

  const postsNeedGenerationData = config?.postsNeedGenerationData === true;
  const postsNeedImageResources = config?.postsNeedImageResources === true;
  const postsNeedGenerationResponse = config?.postsNeedGenerationResponse === true;
  const postsNeedUpdate = postsNeedGenerationData || postsNeedImageResources || postsNeedGenerationResponse;
  const postMode = postModeOverride ?? (
    postsNeedUpdate ? 'all' : (config?.postDownload === 'all' ? 'all' : 'latest')
  );
  const comicsMode = comicsModeOverride ?? (config?.comicDownload === 'all' ? 'all' : 'latest');
  const model3dsMode = model3dsModeOverride ?? (config?.model3dDownload === 'all' ? 'all' : 'latest');
  const rememberedBase = () => rememberedModes({
    genOverride, config, postModeOverride, comicsModeOverride, model3dsModeOverride
  });
  const chooseContainer = (id, mode) => {
    const base = rememberedBase();
    const next = applyRecheck({
      modes: { posts: base.body.postDownload, comics: base.body.comicDownload },
      selected,
      recheck
    }, `${id}-${mode}`);
    if (id === 'posts') setPostModeOverride(next.modes.posts);
    if (id === 'comics') setComicsModeOverride(next.modes.comics);
    setRecheck(next.recheck);
    persistRemembered({
      postModeOverride: id === 'posts' ? next.modes.posts : postModeOverride,
      comicsModeOverride: id === 'comics' ? next.modes.comics : comicsModeOverride
    });
  };
  const chooseRecheck = () => {
    const base = rememberedBase();
    const next = applyRecheck({
      modes: { posts: base.body.postDownload, comics: base.body.comicDownload },
      selected,
      recheck
    }, 'recheck');
    setPostModeOverride(next.modes.posts);
    setComicsModeOverride(next.modes.comics);
    setRecheck(next.recheck);
    persistRemembered({
      postModeOverride: next.modes.posts,
      comicsModeOverride: next.modes.comics
    });
  };
  const genSelection = genOverride ?? selectionFromConfig({
    generationDownload: config?.generationDownload,
    generationReactions: config?.generationReactions
  });

  const running = submitting || Boolean(run && !run.closed);
  const selected = running && run && Array.isArray(run.types) && run.types.length
    ? run.types
    : (chosen || []);

  const genSpecMode = run && run.spec && run.spec.generations && run.spec.generations.mode;
  const postsSpecMode = run && run.spec && run.spec.posts && run.spec.posts.mode;
  const comicsSpecMode = run && run.spec && run.spec.comics && run.spec.comics.mode;
  const model3dsSpecMode = run && run.spec && run.spec.model3ds && run.spec.model3ds.mode;
  const cleanPortion = (type) => {
    const result = run && Array.isArray(run.results) && run.results.find(item => item && item.type === type);
    return !!(result && result.status === 'complete' && !result.errors);
  };
  const shownGen = cleanPortion('generations') && genSpecMode === 'missing-all'
    ? { run: 'latest', reactions: [] }
    : running && genSpecMode
      ? selectionFromQueueMode(genSpecMode, config?.generationReactions)
      : genSelection;
  const shownPostMode = cleanPortion('posts') && postsSpecMode === 'all'
    ? 'latest'
    : running && postsSpecMode
      ? postsSpecMode
      : postMode;
  const shownComicsMode = cleanPortion('comics') && comicsSpecMode === 'all'
    ? 'latest'
    : running && comicsSpecMode
      ? comicsSpecMode
      : comicsMode;
  const shownModel3dsMode = cleanPortion('model3ds') && model3dsSpecMode === 'all'
    ? 'latest'
    : running && model3dsSpecMode
      ? model3dsSpecMode
      : model3dsMode;
  const watchedRecheck = run && run.spec && run.spec.recheck === true
    ? (run.types || []).filter(id => id === 'posts' || id === 'comics')
    : [];
  const recheckResultsIn = watchedRecheck.length > 0 && watchedRecheck.every(id => (
    run.results && run.results.some(item => item && item.type === id)
  ));
  const recheckAllClean = recheckResultsIn && watchedRecheck.every(id => (
    run.results.some(item => item && item.type === id && item.status === 'complete' && !item.errors)
  ));
  const shownRecheck = running && run && run.spec && run.spec.recheck === true
    ? !recheckAllClean
    : recheck;

  const handleDownload = useCallback(async () => {
    if (clickLock.current) return;
    clickLock.current = true;
    setActionError(null);
    setRun(null);
    setSubmitting(true);
    try {
      const types = DOWNLOAD_TYPE_ORDER.filter(id => (chosen || []).includes(id));
      if (!types.length) return;
      if (genSelection.run === 'reactions' && genSelection.reactions.length > 0) {
        let saved;
        try {
          saved = await updateConfig({ generationReactions: genSelection.reactions });
        } catch {
          setActionError('Could not connect to server');
          return;
        }
        if (!saved || !saved.ok) {
          setActionError((saved && saved.error) || 'Could not save reactions');
          return;
        }
        setConfig(prev => (prev ? { ...prev, generationReactions: genSelection.reactions } : prev));
      }
      const body = { types, auto: autoOn === true };
      if (types.includes('generations')) {
        const mode = genSelection.run === 'all'
          ? 'missing-all'
          : genSelection.run === 'reactions'
            ? 'missing-tags'
            : 'latest';
        body.generations = { mode };
      }
      if (types.includes('posts')) body.posts = { mode: postMode };
      if (types.includes('comics')) body.comics = { mode: comicsMode };
      if (types.includes('model3ds')) body.model3ds = { mode: model3dsMode };
      const sendRecheck = recheckShown({
        selected: types,
        modes: { posts: postMode, comics: comicsMode },
        totalPosts: stats?.totalPosts || 0,
        totalComics: stats?.totalComics || 0
      }) && recheck;
      if (sendRecheck) body.recheck = true;
      rememberDownloadTypes(types);
      const result = await startDownloadQueue(body);
      if (result && result.error) {
        setActionError(result.error);
        return;
      }
      if (result && result.queue) setRun(result.queue);
    } finally {
      setSubmitting(false);
      clickLock.current = false;
    }
  }, [chosen, genSelection, postMode, comicsMode, model3dsMode, recheck, stats, autoOn]);

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

  const clearKeyForm = useCallback(() => {
    setKeyValue('');
    setKeyPassword('');
    setKeyConfirm('');
    setEncryptKey(false);
    setKeyError(null);
    setUpdatingKey(false);
  }, []);

  // The click that closes a task must finish before the replacement is
  // mounted. Otherwise the browser delivers that click to the control that
  // appears in the same place, and an action button's old transition
  // animates the new control's size.
  const afterClick = (event, apply) => {
    event.preventDefault();
    event.stopPropagation();
    setTimeout(apply, 0);
  };

  const cancelProtect = useCallback(() => {
    setProtectOpen(false);
    setUnprotectOpen(false);
    setKeyPassword('');
    setKeyConfirm('');
    setKeyError(null);
  }, []);

  const openUpdate = useCallback(() => {
    setProtectOpen(false);
    setUnprotectOpen(false);
    setDeleteAsk(false);
    setKeyValue('');
    setKeyPassword('');
    setKeyConfirm('');
    setEncryptKey(false);
    setKeyError(null);
    setUpdatingKey(true);
  }, []);

  const openProtect = useCallback(() => {
    setUpdatingKey(false);
    setUnprotectOpen(false);
    setDeleteAsk(false);
    setKeyPassword('');
    setKeyConfirm('');
    setKeyError(null);
    setProtectOpen(true);
  }, []);

  const openUnprotect = useCallback(() => {
    setUpdatingKey(false);
    setProtectOpen(false);
    setDeleteAsk(false);
    setKeyPassword('');
    setKeyConfirm('');
    setKeyError(null);
    setUnprotectOpen(true);
  }, []);

  const handleSaveKey = useCallback(async () => {
    setSavingKey(true);
    setKeyError(null);
    const body = { key: keyValue };
    if (encryptKey) {
      body.password = keyPassword;
      body.confirmPassword = keyConfirm;
    }
    try {
      const result = await saveApiKey(body);
      if (!result || !result.ok) {
        setKeyError((result && result.message) || 'Could not save the API key.');
        return;
      }
      if (result.kind === 'blocked') {
        setMismatch({
          libraryUsername: result.libraryUsername,
          keyUsername: result.keyUsername
        });
      } else {
        setMismatch(null);
      }
      clearKeyForm();
      getConfig().then(setConfig).catch(() => {});
    } catch {
      setKeyError('Could not connect to server');
    } finally {
      setSavingKey(false);
    }
  }, [keyValue, encryptKey, keyPassword, keyConfirm, clearKeyForm]);

  const handleDeleteKey = useCallback(async () => {
    const result = await deleteApiKey().catch(() => null);
    if (!result || !result.ok) return;
    setKeyMenuOpen(false);
    setDeleteAsk(false);
    setMismatch(null);
    setProtectOpen(false);
    setUnprotectOpen(false);
    getConfig().then(setConfig).catch(() => {});
  }, []);

  const handleProtect = useCallback(async () => {
    if (!keyPassword || keyPassword !== keyConfirm) return;
    setKeyError(null);
    const result = await protectApiKey({ password: keyPassword, confirmPassword: keyConfirm }).catch(() => null);
    if (!result || !result.ok) {
      setKeyError((result && result.message) || 'Could not encrypt key');
      return;
    }
    setKeyPassword('');
    setKeyConfirm('');
    setProtectOpen(false);
    getConfig().then(setConfig).catch(() => {});
  }, [keyPassword, keyConfirm]);

  const handleUnprotect = useCallback(async () => {
    if (!keyPassword) return;
    setKeyError(null);
    const result = await unprotectApiKey({ password: keyPassword }).catch(() => null);
    if (!result || !result.ok) {
      setKeyError((result && result.message) || 'Wrong password');
      return;
    }
    setKeyPassword('');
    setUnprotectOpen(false);
    getConfig().then(setConfig).catch(() => {});
  }, [keyPassword]);

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
      getConfig().then(setConfig).catch(() => {});
    }
  }

  useEffect(() => {
    if (running) return;
    const shown = recheckShown({
      selected: chosen || [],
      modes: { posts: postMode, comics: comicsMode },
      totalPosts: stats?.totalPosts || 0,
      totalComics: stats?.totalComics || 0
    });
    if (!shown && recheck) setRecheck(false);
  }, [running, chosen, postMode, comicsMode, stats, recheck]);

  function toggleType (id) {
    if (running) return;
    const current = chosen || [];
    const has = current.includes(id);
    const next = DOWNLOAD_TYPE_ORDER.filter(item => (
      has ? current.includes(item) && item !== id : current.includes(item) || item === id
    ));
    if (has && current.length === 1 && autoOn) {
      setAutoOn(false);
      rememberDownloadAuto(false);
    }
    setChosen(next);
    if (autoOn && next.length) rememberDownloadTypes(next);
    if ((id === 'posts' || id === 'comics') && !has && recheck) {
      if (id === 'posts') setPostModeOverride('all');
      if (id === 'comics') setComicsModeOverride('all');
      persistRemembered(id === 'posts' ? { postModeOverride: 'all' } : { comicsModeOverride: 'all' });
    }
  }

  function chooseGeneration (value) {
    if (running) return;
    const next = applyGenerationSelection(shownGen, generationClick(value));
    setGenOverride(next);
    persistRemembered({ genOverride: next });
  }

  function chooseModel3ds (mode) {
    if (running) return;
    setModel3dsModeOverride(mode);
    persistRemembered({ model3dsModeOverride: mode });
  }

  const recheckArmed = useRef(false);
  useEffect(() => {
    if (!prefsReady || !autoOn) {
      recheckArmed.current = false;
      return;
    }
    if (!recheckArmed.current) {
      recheckArmed.current = true;
      return;
    }
    rememberDownloadRecheck(recheck);
  }, [prefsReady, autoOn, recheck]);

  const [clauseNow, setClauseNow] = useState(() => Date.now());
  useEffect(() => {
    if (autoPhase !== 'waiting' || !dueAt) return undefined;
    setClauseNow(Date.now());
    const id = setInterval(() => setClauseNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [autoPhase, dueAt]);

  function toggleAuto () {
    const next = !autoOn;
    setAutoOn(next);
    rememberDownloadAuto(next);
    if (next) persistRemembered({}, { enabled: true });
  }

  function changeEvery (id) {
    const next = DOWNLOAD_PERIODS.some(period => period.id === id) ? id : '1h';
    setEvery(next);
    rememberDownloadEvery(next);
  }

  const keyMenuAvailable = !!(
    config
    && config.hasKey
    && !(config.keyEncrypted && !config.keyUnlocked)
    && !mismatch
  );

  useEffect(() => {
    if (!keyMenuAvailable) setKeyMenuOpen(false);
  }, [keyMenuAvailable]);

  if (!config || stats === undefined || chosen === null || !prefsReady) {
    return (
      <main class="property-loading">
        <h1 class="visually-hidden">Download</h1>
        <div class="spinner" />
      </main>
    );
  }

  const needsUnlock = config.keyEncrypted && !config.keyUnlocked;
  const containerCounts = stats ? {
    generations: stats.totalGenerations,
    posts: stats.totalPosts,
    comics: stats.totalComics,
    model3ds: stats.totalModel3ds
  } : null;
  const accountView = downloadAccountVisibility({
    hasKey: !!config.hasKey,
    needsUnlock,
    mismatch: !!mismatch,
    stats,
    containerCounts
  });
  const canDownload = config.hasKey && !needsUnlock && !accountView.mismatch;
  const offer = downloadOptionsVisibility({
    selected,
    recheck: recheckShown({
      selected,
      modes: { posts: shownPostMode, comics: shownComicsMode },
      totalPosts: stats?.totalPosts || 0,
      totalComics: stats?.totalComics || 0
    }),
    domainOffered: !!(config.allowAltDomain && (config.availableDomains || []).length > 1)
  });
  const passwordsDiffer = encryptKey && keyPassword && keyConfirm && keyPassword !== keyConfirm;
  const saveDisabled = savingKey || !keyValue.trim() || (encryptKey && (!keyPassword || keyPassword !== keyConfirm));
  const downloadFromTitle = `Download from ${config.domain || 'civitai.com'}`;
  const failed = !running ? errorResult(run && run.results) : null;
  const errorMessage = failed
    ? (failed.message || '')
    : (!running && actionError ? actionError : null);
  const notice = downloadNotice({
    running,
    errorMessage,
    online,
    generationsOn: selected.includes('generations'),
    generationDays: calendarDaysAgo(config.lastDownloadGenerations),
    postsOn: selected.includes('posts'),
    postsNeedUpdate
  });
  // Download clears `run` before the next snapshot arrives. Keep the last
  // paint for that wait so `.download-status` stays mounted.
  const nextElapsed = !line
    ? ''
    : line.live
      ? formatElapsed(line.startedAt ? now - line.startedAt : 0)
      : formatElapsed(run && run.elapsed);
  const hasStatus = !!(line || notice);
  if (hasStatus) retainedStatus.current = { line, notice, elapsed: nextElapsed };
  else if (!submitting) retainedStatus.current = null;
  const statusPaint = hasStatus
    ? retainedStatus.current
    : (submitting && retainedStatus.current) || null;
  const statusLine = statusPaint ? statusPaint.line : null;
  const statusNotice = statusPaint ? statusPaint.notice : null;
  const elapsedText = statusPaint ? statusPaint.elapsed : '';

  return (
    <main class="main-content property-sheet">
      <h1 class="visually-hidden">Download</h1>
      {(accountView.setup || (updatingKey && (needsUnlock || accountView.mismatch))) && (
        <section class="property-group">
          <h2 class="property-heading">{accountView.setup ? 'API key' : 'Update API key'}</h2>
          <KeyEntryForm
            domain={config.domain}
            showIntro={accountView.setup}
            keyValue={keyValue}
            setKeyValue={setKeyValue}
            encryptKey={encryptKey}
            setEncryptKey={setEncryptKey}
            keyPassword={keyPassword}
            setKeyPassword={setKeyPassword}
            keyConfirm={keyConfirm}
            setKeyConfirm={setKeyConfirm}
            passwordsDiffer={passwordsDiffer}
            keyError={keyError}
            saveDisabled={saveDisabled}
            onSave={handleSaveKey}
            onCancel={updatingKey ? (event) => afterClick(event, clearKeyForm) : null}
          />
        </section>
      )}
      {accountView.mismatch && !updatingKey && (
        <section class="property-group key-form">
          <h2 class="property-heading">API key</h2>
          {accountMismatchParagraphs(mismatch.libraryUsername, mismatch.keyUsername).map(paragraph => (
            <p class="unlock-desc" key={paragraph}>{emphasizeNames(paragraph, [mismatch.libraryUsername, mismatch.keyUsername])}</p>
          ))}
          <button class="action-btn" onClick={openUpdate}>Update API key</button>
        </section>
      )}
      {accountView.unlock && !updatingKey && (
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
          <button class="action-btn secondary-btn" onClick={openUpdate}>Update API key</button>
        </section>
      )}

      <section class="property-group">
        <div class="property-controls">
          <fieldset class="mode-selector">
            <legend class="visually-hidden">Download</legend>
            <fieldset class="mode-cluster">
              <legend class="visually-hidden">Download types</legend>
              {DOWNLOAD_TYPE_ORDER.map(id => (
                <label key={id} class="mode-btn">
                  <input
                    type="checkbox"
                    checked={selected.includes(id)}
                    disabled={running}
                    onChange={() => toggleType(id)}
                  />
                  {DOWNLOAD_TYPE_LABELS[id]}
                </label>
              ))}
            </fieldset>
            <span class="mode-break" aria-hidden="true" />
            <fieldset class="mode-cluster">
              <legend class="visually-hidden">Auto download</legend>
              <label class="mode-btn" title={`Auto download every ${periodLabel(every)}`}>
                <input
                  type="checkbox"
                  checked={autoOn}
                  onChange={toggleAuto}
                />
                Auto
              </label>
            </fieldset>
          </fieldset>
          {running ? (
            <button class="action-btn stop-btn" onClick={handleAbort}>Stop</button>
          ) : (
            <button
              class="action-btn"
              onClick={handleDownload}
              disabled={!online || !canDownload || selected.length === 0}
              title={downloadFromTitle}
            >
              Download
            </button>
          )}
        </div>

        {autoOn && (
          <div class="download-every">
            <label for="download-every">Every</label>
            <select
              id="download-every"
              class="facet-select"
              value={every}
              onChange={event => changeEvery(event.target.value)}
            >
              {DOWNLOAD_PERIODS.map(period => (
                <option key={period.id} value={period.id}>{period.label}</option>
              ))}
            </select>
            {autoPhase === 'waiting' && dueAt && (() => {
              const clause = nextDownloadClause(dueAt, clauseNow);
              if (!clause) return null;
              if (clause.kind === 'now') return <span class="download-every-next">Next download now</span>;
              if (clause.kind === 'minutes') {
                return <span class="download-every-next">{`Next download in ${clause.minutes} mins`}</span>;
              }
              const when = new Date(clause.at);
              const clock = when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
              return <span class="download-every-next">{`Next download at ${clock}`}</span>;
            })()}
          </div>
        )}

        {(statusLine || statusNotice) && (
          <div class="download-status" aria-live="polite">
            {statusLine && (
              <div class="progress-bar">
                <div class="progress-details download-status-clauses">
                  {statusLine.live && <div class="progress-pulse" />}
                  {statusLine.clauses.map(clause => (
                    <span key={clause.type} class={clause.active ? 'download-clause-active' : 'download-clause'}>
                      {clause.label}
                      {clause.activity ? ` \u00B7 ${clause.activity}` : ''}
                      {clause.counts ? ` \u00B7 ${clause.counts}` : ''}
                      {clause.mark ? (
                        <>
                          {' \u00B7 '}
                          <span class={
                            clause.mark === 'failed' ? 'download-mark-failed'
                              : clause.mark === 'stopped' ? 'download-mark-stopped'
                                : ''
                          }>{clause.mark}</span>
                        </>
                      ) : null}
                    </span>
                  ))}
                  <span class="progress-elapsed">{elapsedText}</span>
                </div>
              </div>
            )}
            {statusNotice && <p class={`download-notice ${statusNotice.tone}`}>{statusNotice.text}</p>}
          </div>
        )}
      </section>

      {offer.section && (
        <section class="property-group download-options">
          <h2 class="property-heading">Download options</h2>
          {selected.map(id => (
            <DownloadOptionRow
              key={id}
              id={id}
              config={config}
              running={running}
              postsNeedUpdate={postsNeedUpdate}
              shownGen={shownGen}
              chooseGeneration={chooseGeneration}
              shownPostMode={shownPostMode}
              shownComicsMode={shownComicsMode}
              shownModel3dsMode={shownModel3dsMode}
              chooseContainer={chooseContainer}
              chooseModel3ds={chooseModel3ds}
            />
          ))}
          <details
            class="download-advanced"
            open={shownRecheck || advancedPref}
            onToggle={(event) => {
              if (shownRecheck) return;
              const open = event.currentTarget.open;
              setAdvancedPref(open);
              rememberDownloadAdvancedOpen(open);
            }}
          >
            <summary onClick={(event) => { if (shownRecheck) event.preventDefault(); }}>
              {`Advanced ${shownRecheck || advancedPref ? '\u25BC' : '\u25B8'}`}
            </summary>
            {offer.recheck && (
              <div class="download-option-row">
                <div class="property-name download-option-label" aria-hidden="true" />
                <div class="mode-selector">
                  <label class="mode-btn" title={RECHECK_TITLE}>
                    <input
                      type="checkbox"
                      checked={shownRecheck}
                      disabled={running}
                      onChange={chooseRecheck}
                    />
                    Recheck metadata
                  </label>
                </div>
              </div>
            )}
            {offer.files && (
              <div class="download-option-row">
                <div class="property-name download-option-label">Files</div>
                <fieldset class="mode-selector">
                  <legend class="visually-hidden">Files</legend>
                  <label class="mode-btn" title="Media files and data (prompts, generation settings, etc) are saved">
                    <input
                      type="radio"
                      name="download-files"
                      value="true"
                      checked={config.downloadMedia !== false}
                      onChange={() => handleFilesChoice(true)}
                    />
                    Media and data
                  </label>
                  <label class="mode-btn" title="Data is saved, media files are not">
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
            )}
            {offer.domain && (
              <div class="download-option-row">
                <div class="property-name download-option-label">Civitai domain</div>
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
            )}
          </details>
        </section>
      )}

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

      {config.hasKey ? (
      <div class="property-pair">
        <ModelCacheSection
          modelCache={modelCache}
          downloadActive={running}
          error={modelCacheError}
          hasKey={config.hasKey}
          username={config.username}
          rebuilding={rebuilding}
          showModels={accountView.modelsLine}
          showRefresh={accountView.refreshModels}
          showRebuild={accountView.rebuildIndex}
          onRefresh={handleModelCacheRefresh}
          onAbort={handleModelCacheAbort}
          onRebuild={handleRebuild}
          accountActions={!needsUnlock && !accountView.mismatch && (
            updatingKey ? (
              <KeyEntryForm
                key="update"
                domain={config.domain}
                showIntro={false}
                keyValue={keyValue}
                setKeyValue={setKeyValue}
                encryptKey={encryptKey}
                setEncryptKey={setEncryptKey}
                keyPassword={keyPassword}
                setKeyPassword={setKeyPassword}
                keyConfirm={keyConfirm}
                setKeyConfirm={setKeyConfirm}
                passwordsDiffer={passwordsDiffer}
                keyError={keyError}
                saveDisabled={saveDisabled}
                onSave={handleSaveKey}
                onCancel={(event) => afterClick(event, clearKeyForm)}
              />
            ) : protectOpen ? (
              <div key="protect" class="key-form">
                <div class="property-controls">
                  <label class="visually-hidden" for="protect-password">Password</label>
                  <input id="protect-password" type="password" class="unlock-input" autocomplete="new-password" placeholder="Password" value={keyPassword} onInput={e => setKeyPassword(e.target.value)} />
                  <label class="visually-hidden" for="protect-confirm">Repeat password</label>
                  <input id="protect-confirm" type="password" class="unlock-input" autocomplete="new-password" placeholder="Repeat password" value={keyConfirm} onInput={e => setKeyConfirm(e.target.value)} />
                </div>
                {keyPassword && keyConfirm && keyPassword !== keyConfirm && <div class="property-error">Passwords do not match.</div>}
                {keyError && <div class="property-error">{keyError}</div>}
                <div class="property-controls">
                  <button class="action-btn" onClick={handleProtect} disabled={!keyPassword || keyPassword !== keyConfirm}>Encrypt</button>
                  <button class="action-btn secondary-btn" onMouseDown={event => event.preventDefault()} onClick={(event) => afterClick(event, cancelProtect)}>Cancel</button>
                </div>
              </div>
            ) : unprotectOpen ? (
              <div key="unprotect" class="key-form">
                <div class="property-controls">
                  <label class="visually-hidden" for="unprotect-password">Password</label>
                  <input id="unprotect-password" type="password" class="unlock-input" placeholder="Password" value={keyPassword} onInput={e => setKeyPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleUnprotect(); }} />
                  <button class="action-btn" onClick={handleUnprotect} disabled={!keyPassword}>Remove password</button>
                  <button class="action-btn secondary-btn" onMouseDown={event => event.preventDefault()} onClick={(event) => afterClick(event, cancelProtect)}>Cancel</button>
                </div>
                {keyError && <div class="property-error">{keyError}</div>}
              </div>
            ) : deleteAsk ? (
              <div key="delete" class="key-confirm">
                <p class="unlock-desc">Delete the saved API key? Downloaded files stay.</p>
                <button type="button" class="text-btn danger" onClick={handleDeleteKey}>Delete</button>
                <button type="button" class="text-btn" onMouseDown={event => event.preventDefault()} onClick={(event) => afterClick(event, () => setDeleteAsk(false))}>Cancel</button>
              </div>
            ) : (
              <details
                key="menu"
                class="key-change"
                open={keyMenuOpen}
                onToggle={(event) => setKeyMenuOpen(event.currentTarget.open)}
              >
                <summary>{`Change API key ${keyMenuOpen ? '\u25BC' : '\u25B8'}`}</summary>
                <div class="property-actions">
                  <button class="action-btn secondary-btn" onClick={openUpdate}>Update API key</button>
                  {!config.keyEncrypted && (
                    <button class="action-btn secondary-btn" onClick={openProtect}>Add password protection</button>
                  )}
                  {config.keyEncrypted && (
                    <button class="action-btn secondary-btn" onClick={openUnprotect}>Remove password protection</button>
                  )}
                  <button class="action-btn secondary-btn" onClick={() => { setDeleteAsk(true); setKeyError(null); }}>Delete API key</button>
                </div>
              </details>
            )
          )}
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
      ) : (
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
      )}
    </main>
  );
}

function DownloadOptionRow ({
  id,
  config,
  running,
  postsNeedUpdate,
  shownGen,
  chooseGeneration,
  shownPostMode,
  shownComicsMode,
  shownModel3dsMode,
  chooseContainer,
  chooseModel3ds
}) {
  return (
    <div class="download-option-row">
      <div class="property-name download-option-label">{DOWNLOAD_TYPE_LABELS[id]}</div>
      {id === 'generations' && (
        <div class="mode-selector">
          <fieldset class="mode-cluster">
            <legend class="visually-hidden">Download type</legend>
            {generationDownloadModes().filter(m => m.value === 'latest' || m.value === 'missing-all').map(m => (
              <label key={m.value} class="mode-btn" title={m.desc}>
                <input
                  type="radio"
                  name="download-generations-type"
                  value={m.value}
                  checked={generationButtonOn(shownGen, m.value)}
                  disabled={running}
                  onChange={() => chooseGeneration(m.value)}
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
                  checked={generationButtonOn(shownGen, m.value)}
                  disabled={running}
                  onChange={() => chooseGeneration(m.value)}
                />
                {m.label}
              </label>
            ))}
          </fieldset>
        </div>
      )}
      {id === 'posts' && (
        <div class="mode-selector">
          <fieldset class="mode-cluster">
            <legend class="visually-hidden">Download posts</legend>
            {POST_MODES.map(m => (
              <label
                key={m.value}
                class="mode-btn"
                title={postModeTitle(m.value, postsNeedUpdate) || m.desc}
              >
                <input
                  type="radio"
                  name="download-posts"
                  value={m.value}
                  checked={shownPostMode === m.value}
                  disabled={running}
                  onChange={() => chooseContainer('posts', m.value)}
                />
                {m.label}
              </label>
            ))}
          </fieldset>
        </div>
      )}
      {id === 'comics' && (
        <div class="mode-selector">
          <fieldset class="mode-cluster">
            <legend class="visually-hidden">Download comics</legend>
            {COMIC_MODES.map(m => (
              <label key={m.value} class="mode-btn" title={m.desc}>
                <input
                  type="radio"
                  name="download-comics"
                  value={m.value}
                  checked={shownComicsMode === m.value}
                  disabled={running}
                  onChange={() => chooseContainer('comics', m.value)}
                />
                {m.label}
              </label>
            ))}
          </fieldset>
        </div>
      )}
      {id === 'model3ds' && (
        <div class="mode-selector">
          <fieldset class="mode-cluster">
            <legend class="visually-hidden">Download 3D</legend>
            {MODEL3D_MODES.map(m => (
              <label key={m.value} class="mode-btn" title={m.desc}>
                <input
                  type="radio"
                  name="download-model3ds"
                  value={m.value}
                  checked={shownModel3dsMode === m.value}
                  disabled={running}
                  onChange={() => chooseModel3ds(m.value)}
                />
                {m.label}
              </label>
            ))}
          </fieldset>
        </div>
      )}
      <div class="download-option-when">
        <LastDownloadInfo
          isoDate={config[LAST_DOWNLOAD_KEY[id]]}
          warnDays={id === 'generations' ? 25 : undefined}
          expireDays={id === 'generations' ? 30 : undefined}
        />
      </div>
    </div>
  );
}

function ApiKeyProperty ({ hasKey, username, children }) {
  return (
    <div class="property">
      <dt class="property-name">API key</dt>
      <dd class="property-value">{hasKey ? `Configured${username ? ` · ${username}` : ''}` : 'Not set'}</dd>
      {children}
    </div>
  );
}

function emphasizeNames (text, names) {
  const list = [...new Set((names || []).filter(name => name))].sort((a, b) => b.length - a.length);
  if (!list.length) return text;
  const pattern = new RegExp(list.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  const nodes = [];
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(<strong key={`${match.index}-${match[0]}`}>{match[0]}</strong>);
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function KeyEntryForm ({
  domain,
  showIntro,
  keyValue,
  setKeyValue,
  encryptKey,
  setEncryptKey,
  keyPassword,
  setKeyPassword,
  keyConfirm,
  setKeyConfirm,
  passwordsDiffer,
  keyError,
  saveDisabled,
  onSave,
  onCancel
}) {
  return (
    <div class="key-form">
      {showIntro && (
        <p class="unlock-desc">
          Create an API key in your{' '}
          <a href={`https://${domain || 'civitai.com'}/user/account/security`} target="_blank" rel="noopener noreferrer">Civitai account settings</a>.
        </p>
      )}
      <div class="property-controls">
        <label class="visually-hidden" for="download-api-key">API key</label>
        <input
          id="download-api-key"
          type="password"
          class="unlock-input"
          autocomplete="off"
          placeholder="API key"
          value={keyValue}
          onInput={e => setKeyValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !saveDisabled) onSave(); }}
        />
      </div>
      <div class="property-controls">
        <label class="switch">
          <input
            type="checkbox"
            role="switch"
            checked={encryptKey}
            onChange={e => setEncryptKey(e.target.checked)}
          />
          <span class="switch-track" aria-hidden="true" />
          Add password protection
        </label>
      </div>
      {encryptKey && (
        <div class="property-controls">
          <label class="visually-hidden" for="download-key-password">Password</label>
          <input id="download-key-password" type="password" class="unlock-input" autocomplete="new-password" placeholder="Password" value={keyPassword} onInput={e => setKeyPassword(e.target.value)} />
          <label class="visually-hidden" for="download-key-confirm">Repeat password</label>
          <input id="download-key-confirm" type="password" class="unlock-input" autocomplete="new-password" placeholder="Repeat password" value={keyConfirm} onInput={e => setKeyConfirm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !saveDisabled) onSave(); }} />
        </div>
      )}
      {passwordsDiffer && <div class="property-error">Passwords do not match.</div>}
      {keyError && <div class="property-error">{keyError}</div>}
      <div class="property-controls">
        <button class="action-btn" onClick={onSave} disabled={saveDisabled}>Save API key</button>
        {onCancel && (
          <button class="action-btn secondary-btn" onMouseDown={event => event.preventDefault()} onClick={onCancel}>Cancel</button>
        )}
      </div>
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

function ModelCacheSection ({ modelCache, downloadActive, error, hasKey, username, rebuilding, showModels, showRefresh, showRebuild, accountActions, onRefresh, onAbort, onRebuild }) {
  if (!modelCache) {
    return (
      <section class="property-group">
        <h2 class="property-heading">Account</h2>
        <dl>
          <ApiKeyProperty hasKey={hasKey} username={username}>{accountActions}</ApiKeyProperty>
        </dl>
        {showModels && <div class="property"><div class="property-value">Loading{'\u2026'}</div></div>}
        {showRebuild && (
          <div class="property-actions">
            <RebuildIndexButton rebuilding={rebuilding} onRebuild={onRebuild} />
          </div>
        )}
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
        <ApiKeyProperty hasKey={hasKey} username={username}>{accountActions}</ApiKeyProperty>

        {showModels && <div class="property">
          <dt class="property-name">Models &amp; resources</dt>
          <dd class="property-value">
            {`${cachedPhrase}. `}
            {refreshed ? (
              <span title={new Date(lastRefreshedAt).toLocaleString()}>
                Last refreshed <TimeText at={lastRefreshedAt}>{refreshed}</TimeText>.
              </span>
            ) : 'Last refreshed never.'}
          </dd>
        </div>}

        {showModels && isRunning && activeProgress && (
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

      {(showRefresh || showRebuild) && (
      <div class="property-actions">
        {showRefresh && (isRunning ? (
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
        ))}
        {showRebuild && <RebuildIndexButton rebuilding={rebuilding} onRebuild={onRebuild} />}
      </div>
      )}
    </section>
  );
}

function LastDownloadInfo ({ isoDate, warnDays, expireDays }) {
  const days = calendarDaysAgo(isoDate);
  const text = relativeTime(isoDate);
  const tone = days == null
    ? 'last-download-never'
    : expireDays && days >= expireDays
      ? 'last-download-expired'
      : warnDays && days >= warnDays
        ? 'last-download-warning'
        : 'last-download-ok';

  return (
    <div class="last-download-info">
      {days != null ? (
        <span class={tone}>
          Last downloaded <TimeText at={isoDate}>{text}</TimeText>
        </span>
      ) : (
        <span class="last-download-never">Never downloaded</span>
      )}
    </div>
  );
}
