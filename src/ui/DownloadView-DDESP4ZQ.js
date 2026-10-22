import {
  DOWNLOAD_PERIODS,
  DOWNLOAD_TYPE_LABELS,
  DOWNLOAD_TYPE_ORDER,
  canonicalizeDownloadTypes,
  loadUiPrefs,
  periodLabel,
  readDownloadAdvancedOpen,
  readDownloadAuto,
  readDownloadEvery,
  readDownloadRecheck,
  readDownloadTypes,
  rememberDownloadAdvancedOpen,
  rememberDownloadAuto,
  rememberDownloadEvery,
  rememberDownloadRecheck,
  rememberDownloadTypes
} from "./chunk-XSOBLT75.js";
import {
  OpenFolderButton
} from "./chunk-JTARL5PA.js";
import {
  TimeText
} from "./chunk-OJSJHKVX.js";
import {
  notifyCorpusChange
} from "./chunk-CPLX52FD.js";
import {
  A,
  abortDownload,
  abortModelCacheRefresh,
  calendarDaysAgo,
  connectProgress,
  d,
  deleteApiKey,
  getConfig,
  getDownloadStatus,
  getModelCacheStatus,
  getStats,
  k,
  protectApiKey,
  q,
  rebuildIndex,
  refreshModelCache,
  refreshUser,
  relativeTime,
  saveApiKey,
  saveDownloadModes,
  startDownloadQueue,
  u,
  unlockKey,
  unprotectApiKey,
  updateConfig,
  useDocumentTitle,
  y
} from "./chunk-OGIWOTNU.js";

// dev/ui/src/lib/generation-download-modes.js
var REACTION_ORDER = ["favorite", "feedback:liked"];
var GENERATION_DOWNLOAD_MODES = [
  {
    value: "latest",
    label: "Latest",
    desc: "Most recent generations not yet saved; missing files on those jobs too"
  },
  {
    value: "missing-all",
    label: "All",
    desc: "All generations in last 30 days, including missing files"
  },
  {
    value: "favorite",
    label: "Favorited",
    desc: "Favorited generations in the last 30 days, including missing files"
  },
  {
    value: "feedback:liked",
    label: "Liked",
    desc: "Liked generations in the last 30 days, including missing files"
  }
];
function canonicalReactions(source) {
  const list = Array.isArray(source) ? source : [];
  return REACTION_ORDER.filter((id) => list.includes(id));
}
function generationDownloadModes() {
  return GENERATION_DOWNLOAD_MODES;
}
function applyGenerationSelection(state, clicked) {
  if (clicked === "latest" || clicked === "all") {
    return { run: clicked, reactions: [] };
  }
  const lit = state && state.run === "reactions" ? canonicalReactions(state.reactions) : [];
  const next = lit.includes(clicked) ? lit.filter((id) => id !== clicked) : lit.concat(clicked);
  const reactions = canonicalReactions(next);
  if (!reactions.length) return { run: "latest", reactions: [] };
  return { run: "reactions", reactions };
}
function selectionFromConfig({ generationDownload, generationReactions } = {}) {
  if (generationDownload === "all") return { run: "all", reactions: [] };
  if (generationDownload === "reactions") {
    const reactions = canonicalReactions(generationReactions);
    if (!reactions.length) return { run: "latest", reactions: [] };
    return { run: "reactions", reactions };
  }
  return { run: "latest", reactions: [] };
}

// dev/ui/src/lib/download-account.js
function countsOf(containerCounts) {
  const source = containerCounts || {};
  return ["generations", "posts", "comics", "model3ds"].some((key) => Number(source[key]) > 0);
}
function downloadAccountVisibility({
  hasKey = false,
  needsUnlock = false,
  mismatch = false,
  stats = null,
  containerCounts = null
} = {}) {
  const failed = stats == null;
  const hasCorpus = !failed && countsOf(containerCounts);
  const rebuild = failed || hasCorpus;
  return {
    setup: !hasKey && !mismatch,
    unlock: !!hasKey && !!needsUnlock && !mismatch,
    mismatch: !!mismatch,
    modelsLine: !!hasKey && !mismatch && hasCorpus,
    refreshModels: !!hasKey && !needsUnlock && !mismatch && hasCorpus,
    rebuildIndex: !!rebuild && !!hasKey || !hasKey && failed
  };
}

// dev/ui/src/lib/account-mismatch.js
var STEM = /^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/;
function accountMismatchParagraphs(libraryUsername, keyUsername) {
  const library = libraryUsername || "this";
  const keyName = keyUsername || "another";
  const first = `This library is for the ${library} account. This API key is for the ${keyName} account. Downloads stay off until this library has a key for ${library}.`;
  if (typeof keyUsername !== "string" || !STEM.test(keyUsername)) {
    return [
      first,
      `To use the ${keyName} account, open a separate config with its own folders.`
    ];
  }
  return [
    first,
    `To use the ${keyName} account, open a separate config. It starts with its own folders, data-${keyUsername} and media-${keyUsername}. In a terminal, \`civitai-sync explorer ${keyUsername}\` starts a new Explorer. \`civitai-sync ${keyUsername}\` starts a new CLI.`
  ];
}
function accountMismatchText(libraryUsername, keyUsername) {
  return accountMismatchParagraphs(libraryUsername, keyUsername).join("\n\n");
}

// dev/ui/src/lib/download-run.js
function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
function count(source, key) {
  const n = source && Number(source[key]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function formatActivity(activity) {
  const phase = activity && activity.phase;
  if (phase === "media" || phase === "input-media") return "saving";
  return "checking";
}
function countsFor(type, source) {
  if (!source) return null;
  const parts = [];
  if (type === "generations") {
    const fresh = count(source, "generationsNew");
    if (fresh) parts.push(`${fresh} new`);
    const updated = count(source, "generationsUpdated");
    if (updated) parts.push(`${updated} updated`);
    const images = count(source, "imagesSaved");
    if (images) parts.push(plural(images, "image"));
    const videos = count(source, "videosSaved");
    if (videos) parts.push(plural(videos, "video"));
    const audio = count(source, "audioSaved");
    if (audio) parts.push(plural(audio, "audio file"));
    const meshes = count(source, "model3dSaved");
    if (meshes) parts.push(`${meshes} 3D`);
  } else if (type === "posts") {
    const fresh = count(source, "postsNew");
    if (fresh) parts.push(`${fresh} new`);
    const updated = count(source, "postsUpdated");
    if (updated) parts.push(`${updated} updated`);
    const images = count(source, "imagesSaved");
    if (images) parts.push(plural(images, "image"));
    const videos = count(source, "videosSaved");
    if (videos) parts.push(plural(videos, "video"));
    const audio = count(source, "audioSaved");
    if (audio) parts.push(plural(audio, "audio file"));
  } else if (type === "comics") {
    const fresh = count(source, "comicsNew");
    if (fresh) parts.push(`${fresh} new`);
    const updated = count(source, "comicsUpdated");
    if (updated) parts.push(`${updated} updated`);
    const images = count(source, "imagesSaved");
    if (images) parts.push(plural(images, "image"));
  } else if (type === "model3ds") {
    const fresh = count(source, "model3dsNew");
    if (fresh) parts.push(`${fresh} new`);
    const updated = count(source, "model3dsUpdated");
    if (updated) parts.push(`${updated} updated`);
    const files = count(source, "filesSaved");
    if (files) parts.push(plural(files, "file"));
  }
  return parts.length ? parts.join(" \xB7 ") : null;
}
function activityFor(type, progress) {
  return formatActivity(progress && progress.activity);
}
function resolveDownloadTypes({ saved, totals } = {}) {
  const stored = canonicalizeDownloadTypes(saved);
  if (stored.length) return stored;
  if (!totals || typeof totals !== "object") return DOWNLOAD_TYPE_ORDER.slice();
  const selected = DOWNLOAD_TYPE_ORDER.filter((id) => Number(totals[id]) > 0);
  return selected.length ? selected : DOWNLOAD_TYPE_ORDER.slice();
}
function downloadNotice({
  running = false,
  errorMessage = null,
  online = true,
  generationsOn = false,
  generationDays = null,
  postsOn = false,
  postsNeedUpdate = false
} = {}) {
  if (running) return null;
  if (errorMessage != null) {
    return { tone: "error", text: errorMessage || "Download failed." };
  }
  if (!online) return { tone: "warning", text: "Offline" };
  if (generationsOn && generationDays != null && generationDays >= 30) {
    return { tone: "warning", text: "Generations may have expired." };
  }
  if (postsOn && postsNeedUpdate) {
    return { tone: "warning", text: "Additional data is needed. Download All to update the posts." };
  }
  if (generationsOn && generationDays != null && generationDays >= 25) {
    return { tone: "warning", text: "Download soon to avoid expiry." };
  }
  return null;
}
var HOUR_MS = 60 * 60 * 1e3;
function nextDownloadClause(dueAt, now = Date.now()) {
  const due = Number(dueAt);
  const at = Number(now);
  if (!Number.isFinite(due) || !Number.isFinite(at)) return null;
  if (due <= at) return { kind: "now" };
  const remaining = due - at;
  if (remaining < HOUR_MS) {
    return { kind: "minutes", minutes: Math.max(1, Math.ceil(remaining / 6e4)) };
  }
  return { kind: "clock", at: due };
}
function downloadStatusLine(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const types = Array.isArray(snapshot.types) ? snapshot.types : [];
  const results = Array.isArray(snapshot.results) ? snapshot.results : [];
  const current = snapshot.current || null;
  if (!current && results.length === 0) return null;
  const clauses = [];
  for (const type of types) {
    const result = results.find((item) => item && item.type === type);
    if (result) {
      const counts = countsFor(type, result);
      let mark = null;
      if (result.status === "aborted") mark = "stopped";
      else if (result.status === "error") mark = "failed";
      else if (!counts) mark = "up to date";
      clauses.push({
        type,
        label: DOWNLOAD_TYPE_LABELS[type] || type,
        active: false,
        activity: null,
        counts,
        mark
      });
    } else if (type === current) {
      clauses.push({
        type,
        label: DOWNLOAD_TYPE_LABELS[type] || type,
        active: true,
        activity: activityFor(type, snapshot.progress),
        counts: countsFor(type, snapshot.progress),
        mark: null
      });
    }
  }
  if (!clauses.length) return null;
  const live = current != null && !results.some((item) => item && item.type === current);
  return { live, startedAt: snapshot.startedAt || null, clauses };
}
function snapshotFromStatus(status) {
  if (!status || typeof status !== "object") return null;
  if (status.queue) return status.queue;
  if (!status.active || !status.type) return null;
  const elapsed = Number(status.elapsed) || 0;
  return {
    types: [status.type],
    pending: [],
    current: status.type,
    startedAt: Date.now() - elapsed,
    results: [],
    progress: status.progress || null,
    spec: {},
    closed: false,
    elapsed
  };
}

// dev/ui/src/lib/download-recheck.js
var RECHECK_TYPES = ["posts", "comics"];
function modeOf(modes, id) {
  return modes && modes[id] === "all" ? "all" : "latest";
}
function recheckShown({ selected, modes, totalPosts, totalComics }) {
  const on = new Set(Array.isArray(selected) ? selected : []);
  const posts = on.has("posts") && modeOf(modes, "posts") === "all" && (totalPosts || 0) > 0;
  const comics = on.has("comics") && modeOf(modes, "comics") === "all" && (totalComics || 0) > 0;
  return posts || comics;
}
function applyRecheck(state, clicked) {
  const modes = {
    posts: modeOf(state && state.modes, "posts"),
    comics: modeOf(state && state.modes, "comics")
  };
  const selected = new Set(Array.isArray(state && state.selected) ? state.selected : []);
  let recheck = !!(state && state.recheck);
  if (clicked === "recheck") {
    if (recheck) return { modes, selected: [...selected], recheck: false };
    if (selected.has("posts")) modes.posts = "all";
    if (selected.has("comics")) modes.comics = "all";
    return { modes, selected: [...selected], recheck: true };
  }
  if (clicked === "posts-latest" || clicked === "comics-latest") {
    const id = clicked === "posts-latest" ? "posts" : "comics";
    modes[id] = "latest";
    return { modes, selected: [...selected], recheck: false };
  }
  if (clicked === "posts-all" || clicked === "comics-all") {
    const id = clicked === "posts-all" ? "posts" : "comics";
    modes[id] = "all";
    return { modes, selected: [...selected], recheck };
  }
  if (clicked === "select-posts" || clicked === "select-comics") {
    const id = clicked === "select-posts" ? "posts" : "comics";
    if (selected.has(id)) selected.delete(id);
    else {
      selected.add(id);
      if (recheck) modes[id] = "all";
    }
    return { modes, selected: RECHECK_TYPES.filter((type) => selected.has(type)), recheck };
  }
  return { modes, selected: [...selected], recheck };
}

// dev/ui/src/lib/download-options-visibility.js
function downloadOptionsVisibility({
  selected,
  recheck = false,
  domainOffered = false
} = {}) {
  const files = Array.isArray(selected) && selected.length > 0;
  const domain = domainOffered === true;
  const showRecheck = recheck === true;
  const advanced = files || domain || showRecheck;
  return {
    section: advanced,
    advanced,
    files,
    recheck: showRecheck,
    domain
  };
}

// dev/ui/src/lib/download-mode-persist.js
var REACTION_ORDER2 = ["favorite", "feedback:liked"];
function canonicalReactions2(source) {
  const list = Array.isArray(source) ? source : [];
  return REACTION_ORDER2.filter((id) => list.includes(id));
}
function rowMode(override, stored) {
  if (override === "all" || override === "latest") return override;
  return stored === "all" ? "all" : "latest";
}
function rememberedModes({
  genOverride = null,
  config = null,
  postModeOverride = null,
  comicsModeOverride = null,
  model3dsModeOverride = null
} = {}) {
  const generation = genOverride ?? selectionFromConfig({
    generationDownload: config && config.generationDownload,
    generationReactions: config && config.generationReactions
  });
  const generationDownload = generation.run === "all" ? "all" : generation.run === "reactions" ? "reactions" : "latest";
  const generationReactions = generation.run === "reactions" ? canonicalReactions2(generation.reactions) : [];
  const postDownload = rowMode(postModeOverride, config && config.postDownload);
  const comicDownload = rowMode(comicsModeOverride, config && config.comicDownload);
  const model3dDownload = rowMode(model3dsModeOverride, config && config.model3dDownload);
  const body = {
    generationDownload,
    generationReactions,
    postDownload,
    comicDownload,
    model3dDownload
  };
  const stamp = [
    generationDownload,
    generationReactions.join(","),
    postDownload,
    comicDownload,
    model3dDownload
  ].join("|");
  return { stamp, body };
}
function createModePersist({ save }) {
  let acked = null;
  let failed = null;
  let pending = null;
  let inflight = false;
  let inflightStamp = null;
  async function pump() {
    if (inflight) return;
    inflight = true;
    try {
      while (pending) {
        const job = pending;
        pending = null;
        if (job.stamp === acked || job.stamp === failed) continue;
        inflightStamp = job.stamp;
        try {
          await save(job.body);
          acked = job.stamp;
          if (failed === job.stamp) failed = null;
        } catch {
          if (!pending || pending.stamp === job.stamp) failed = job.stamp;
        } finally {
          inflightStamp = null;
        }
      }
    } finally {
      inflight = false;
    }
  }
  return {
    submit(snapshot) {
      if (!snapshot || typeof snapshot.stamp !== "string") return;
      if (snapshot.stamp === acked || snapshot.stamp === failed) return;
      if (inflightStamp === snapshot.stamp && (!pending || pending.stamp === snapshot.stamp)) return;
      if (pending && pending.stamp === snapshot.stamp) return;
      pending = snapshot;
      pump();
    }
  };
}

// dev/ui/src/components/DownloadView.jsx
async function saveModesBody(body) {
  const result = await saveDownloadModes(body);
  if (!result || result.ok !== true) throw new Error("download modes were not saved");
}
var POST_MODES = [
  { value: "latest", label: "Latest", desc: "Download the newest posts. Updates a post on those pages when its data is newer." },
  { value: "all", label: "All", desc: "Download all posts" }
];
var COMIC_MODES = [
  { value: "latest", label: "Latest", desc: "Opens a comic when its shell is newer." },
  { value: "all", label: "All", desc: "Download all comics. Any missing will be saved." }
];
var MODEL3D_MODES = [
  { value: "latest", label: "Latest", desc: "Download the newest published 3D. Drafts and unpublished are read through." },
  { value: "all", label: "All", desc: "Download all 3D. Any missing will be saved." }
];
var RECHECK_TITLE = "Re-reads metadata (prompt, tags, model, workflow) for all published media, updating the saved data.";
var LAST_DOWNLOAD_KEY = {
  generations: "lastDownloadGenerations",
  posts: "lastDownloadPosts",
  comics: "lastDownloadComics",
  model3ds: "lastDownloadModel3ds"
};
function postModeTitle(mode, needUpdate) {
  if (!needUpdate) return null;
  if (mode === "all") return "Download All to update the posts.";
  if (mode === "latest") return "Updates posts from the last 30 days. Older posts stay until All.";
  return null;
}
function generationClick(value) {
  return value === "missing-all" ? "all" : value;
}
function generationButtonOn(selection, value) {
  if (value === "latest") return selection.run === "latest";
  if (value === "missing-all") return selection.run === "all";
  return selection.run === "reactions" && selection.reactions.includes(value);
}
function selectionFromQueueMode(mode, reactions) {
  if (mode === "missing-all") return { run: "all", reactions: [] };
  if (mode === "missing-tags") return { run: "reactions", reactions: reactions || [] };
  return { run: "latest", reactions: [] };
}
function formatElapsed(ms) {
  if (!ms || ms < 0) return "0:00";
  const total = Math.floor(ms / 1e3);
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function errorResult(results) {
  if (!Array.isArray(results)) return null;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i] && results[i].status === "error") return results[i];
  }
  return null;
}
function DownloadView() {
  useDocumentTitle({ place: "download" });
  const [config, setConfig] = d(null);
  const [stats, setStats] = d(void 0);
  const [chosen, setChosen] = d(null);
  const [genOverride, setGenOverride] = d(null);
  const [postModeOverride, setPostModeOverride] = d(null);
  const [comicsModeOverride, setComicsModeOverride] = d(null);
  const [model3dsModeOverride, setModel3dsModeOverride] = d(null);
  const [recheck, setRecheck] = d(false);
  const [autoOn, setAutoOn] = d(false);
  const [every, setEvery] = d("1h");
  const [autoPhase, setAutoPhase] = d("idle");
  const [dueAt, setDueAt] = d(null);
  const [prefsReady, setPrefsReady] = d(false);
  const [advancedPref, setAdvancedPref] = d(readDownloadAdvancedOpen);
  const [keyMenuOpen, setKeyMenuOpen] = d(false);
  const [run, setRun] = d(null);
  const [submitting, setSubmitting] = d(false);
  const [actionError, setActionError] = d(null);
  const [rebuilding, setRebuilding] = d(false);
  const [online, setOnline] = d(navigator.onLine);
  const [unlockPassword, setUnlockPassword] = d("");
  const [unlockError, setUnlockError] = d(null);
  const [unlocking, setUnlocking] = d(false);
  const [keyValue, setKeyValue] = d("");
  const [keyPassword, setKeyPassword] = d("");
  const [keyConfirm, setKeyConfirm] = d("");
  const [encryptKey, setEncryptKey] = d(false);
  const [keyError, setKeyError] = d(null);
  const [savingKey, setSavingKey] = d(false);
  const [updatingKey, setUpdatingKey] = d(false);
  const [mismatch, setMismatch] = d(null);
  const [deleteAsk, setDeleteAsk] = d(false);
  const [protectOpen, setProtectOpen] = d(false);
  const [unprotectOpen, setUnprotectOpen] = d(false);
  const [modelCache, setModelCache] = d(null);
  const [modelCacheError, setModelCacheError] = d(null);
  const [now, setNow] = d(Date.now());
  const disconnectSSE = A(null);
  const clickLock = A(false);
  const retainedStatus = A(null);
  const modePersistRef = A(null);
  if (!modePersistRef.current) {
    modePersistRef.current = createModePersist({ save: saveModesBody });
  }
  function persistRemembered(patch = {}, { enabled = autoOn } = {}) {
    if (!enabled) return;
    const has = (key) => Object.prototype.hasOwnProperty.call(patch, key);
    modePersistRef.current.submit(rememberedModes({
      genOverride: has("genOverride") ? patch.genOverride : genOverride,
      config,
      postModeOverride: has("postModeOverride") ? patch.postModeOverride : postModeOverride,
      comicsModeOverride: has("comicsModeOverride") ? patch.comicsModeOverride : comicsModeOverride,
      model3dsModeOverride: has("model3dsModeOverride") ? patch.model3dsModeOverride : model3dsModeOverride
    }));
  }
  y(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  y(() => {
    getConfig().then(setConfig).catch(() => {
    });
    getStats().then(setStats).catch(() => setStats(null));
    getDownloadStatus().then((status) => {
      const snapshot = snapshotFromStatus(status);
      if (snapshot) setRun(snapshot);
      if (status && status.auto) {
        setAutoPhase(status.auto.phase || "idle");
        setDueAt(status.auto.dueAt || null);
      }
    }).catch(() => {
    });
    loadUiPrefs().then(() => {
      setAutoOn(readDownloadAuto());
      setEvery(readDownloadEvery());
      setRecheck(readDownloadRecheck());
      setPrefsReady(true);
    }).catch(() => {
      setPrefsReady(true);
    });
    getModelCacheStatus().then(setModelCache).catch(() => {
    });
    refreshUser().then((result) => {
      if (result && result.kind === "blocked") {
        setMismatch({
          libraryUsername: result.libraryUsername,
          keyUsername: result.keyUsername
        });
      }
      return getConfig().then(setConfig).catch(() => {
      });
    }).catch(() => {
    });
  }, []);
  y(() => {
    if (chosen !== null || !config || stats === void 0) return;
    const totals = stats ? {
      generations: stats.totalGenerations,
      posts: stats.totalPosts,
      comics: stats.totalComics,
      model3ds: stats.totalModel3ds
    } : null;
    setChosen(resolveDownloadTypes({ saved: readDownloadTypes(), totals }));
  }, [config, stats, chosen]);
  y(() => {
    const disconnect = connectProgress((event) => {
      if (event.type === "auto") {
        setAutoPhase(event.phase || "idle");
        setDueAt(event.dueAt || null);
        return;
      }
      if (event.type === "connected") {
        if (event.auto) {
          setAutoPhase(event.auto.phase || "idle");
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
      if (event.type === "model-cache") {
        if (event.final) {
          getModelCacheStatus().then(setModelCache).catch(() => {
          });
        } else if (event.versionsDone) {
          setModelCache((prev) => ({
            ...prev || {},
            isRunning: true,
            activeTrigger: event.trigger || "manual",
            activeProgress: null
          }));
        } else if (event.status === "running") {
          setModelCache((prev) => ({
            ...prev || {},
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
        setRun((prev) => {
          if (!prev) return prev;
          return { ...prev, closed: true, current: null, pending: [], progress: null };
        });
      }
    });
    disconnectSSE.current = disconnect;
    return disconnect;
  }, []);
  const resultCount = run && Array.isArray(run.results) ? run.results.length : 0;
  y(() => {
    if (!resultCount) return;
    getConfig().then(setConfig).catch(() => {
    });
    getStats().then(setStats).catch(() => {
    });
    notifyCorpusChange();
  }, [resultCount]);
  y(() => {
    if (!mismatch || !actionError) return;
    const text = accountMismatchText(mismatch.libraryUsername, mismatch.keyUsername);
    if (actionError === text) setActionError(null);
  }, [mismatch, actionError]);
  y(() => {
    if (!run || !run.spec || !Array.isArray(run.results)) return;
    for (const result of run.results) {
      if (!result || result.status !== "complete" || result.errors) continue;
      const spec = run.spec[result.type];
      const mode = spec && spec.mode;
      if (result.type === "generations" && mode === "missing-all") {
        setGenOverride({ run: "latest", reactions: [] });
      }
      if (result.type === "posts" && mode === "all") setPostModeOverride("latest");
      if (result.type === "comics" && mode === "all") setComicsModeOverride("latest");
      if (result.type === "model3ds" && mode === "all") setModel3dsModeOverride("latest");
    }
    if (run.spec.recheck !== true) return;
    const watched = (run.types || []).filter((id) => id === "posts" || id === "comics");
    if (!watched.length) return;
    const finished = watched.every((id) => run.results.some((item) => item && item.type === id));
    if (!finished) return;
    const allClean = watched.every((id) => run.results.some((item) => item && item.type === id && item.status === "complete" && !item.errors));
    if (allClean) setRecheck(false);
  }, [run]);
  const line = downloadStatusLine(run);
  y(() => {
    if (!line || !line.live) return void 0;
    const id = setInterval(() => setNow(Date.now()), 1e3);
    return () => clearInterval(id);
  }, [line && line.live]);
  const postsNeedGenerationData = config?.postsNeedGenerationData === true;
  const postsNeedImageResources = config?.postsNeedImageResources === true;
  const postsNeedGenerationResponse = config?.postsNeedGenerationResponse === true;
  const postsNeedUpdate = postsNeedGenerationData || postsNeedImageResources || postsNeedGenerationResponse;
  const postMode = postModeOverride ?? (postsNeedUpdate ? "all" : config?.postDownload === "all" ? "all" : "latest");
  const comicsMode = comicsModeOverride ?? (config?.comicDownload === "all" ? "all" : "latest");
  const model3dsMode = model3dsModeOverride ?? (config?.model3dDownload === "all" ? "all" : "latest");
  const rememberedBase = () => rememberedModes({
    genOverride,
    config,
    postModeOverride,
    comicsModeOverride,
    model3dsModeOverride
  });
  const chooseContainer = (id, mode) => {
    const base = rememberedBase();
    const next = applyRecheck({
      modes: { posts: base.body.postDownload, comics: base.body.comicDownload },
      selected,
      recheck
    }, `${id}-${mode}`);
    if (id === "posts") setPostModeOverride(next.modes.posts);
    if (id === "comics") setComicsModeOverride(next.modes.comics);
    setRecheck(next.recheck);
    persistRemembered({
      postModeOverride: id === "posts" ? next.modes.posts : postModeOverride,
      comicsModeOverride: id === "comics" ? next.modes.comics : comicsModeOverride
    });
  };
  const chooseRecheck = () => {
    const base = rememberedBase();
    const next = applyRecheck({
      modes: { posts: base.body.postDownload, comics: base.body.comicDownload },
      selected,
      recheck
    }, "recheck");
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
  const selected = running && run && Array.isArray(run.types) && run.types.length ? run.types : chosen || [];
  const genSpecMode = run && run.spec && run.spec.generations && run.spec.generations.mode;
  const postsSpecMode = run && run.spec && run.spec.posts && run.spec.posts.mode;
  const comicsSpecMode = run && run.spec && run.spec.comics && run.spec.comics.mode;
  const model3dsSpecMode = run && run.spec && run.spec.model3ds && run.spec.model3ds.mode;
  const cleanPortion = (type) => {
    const result = run && Array.isArray(run.results) && run.results.find((item) => item && item.type === type);
    return !!(result && result.status === "complete" && !result.errors);
  };
  const shownGen = cleanPortion("generations") && genSpecMode === "missing-all" ? { run: "latest", reactions: [] } : running && genSpecMode ? selectionFromQueueMode(genSpecMode, config?.generationReactions) : genSelection;
  const shownPostMode = cleanPortion("posts") && postsSpecMode === "all" ? "latest" : running && postsSpecMode ? postsSpecMode : postMode;
  const shownComicsMode = cleanPortion("comics") && comicsSpecMode === "all" ? "latest" : running && comicsSpecMode ? comicsSpecMode : comicsMode;
  const shownModel3dsMode = cleanPortion("model3ds") && model3dsSpecMode === "all" ? "latest" : running && model3dsSpecMode ? model3dsSpecMode : model3dsMode;
  const watchedRecheck = run && run.spec && run.spec.recheck === true ? (run.types || []).filter((id) => id === "posts" || id === "comics") : [];
  const recheckResultsIn = watchedRecheck.length > 0 && watchedRecheck.every((id) => run.results && run.results.some((item) => item && item.type === id));
  const recheckAllClean = recheckResultsIn && watchedRecheck.every((id) => run.results.some((item) => item && item.type === id && item.status === "complete" && !item.errors));
  const shownRecheck = running && run && run.spec && run.spec.recheck === true ? !recheckAllClean : recheck;
  const handleDownload = q(async () => {
    if (clickLock.current) return;
    clickLock.current = true;
    setActionError(null);
    setRun(null);
    setSubmitting(true);
    try {
      const types = DOWNLOAD_TYPE_ORDER.filter((id) => (chosen || []).includes(id));
      if (!types.length) return;
      if (genSelection.run === "reactions" && genSelection.reactions.length > 0) {
        let saved;
        try {
          saved = await updateConfig({ generationReactions: genSelection.reactions });
        } catch {
          setActionError("Could not connect to server");
          return;
        }
        if (!saved || !saved.ok) {
          setActionError(saved && saved.error || "Could not save reactions");
          return;
        }
        setConfig((prev) => prev ? { ...prev, generationReactions: genSelection.reactions } : prev);
      }
      const body = { types, auto: autoOn === true };
      if (types.includes("generations")) {
        const mode = genSelection.run === "all" ? "missing-all" : genSelection.run === "reactions" ? "missing-tags" : "latest";
        body.generations = { mode };
      }
      if (types.includes("posts")) body.posts = { mode: postMode };
      if (types.includes("comics")) body.comics = { mode: comicsMode };
      if (types.includes("model3ds")) body.model3ds = { mode: model3dsMode };
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
  const handleAbort = q(async () => {
    await abortDownload();
  }, []);
  const handleRebuild = q(async () => {
    setRebuilding(true);
    await rebuildIndex().catch(() => {
    });
    notifyCorpusChange();
    setRebuilding(false);
  }, []);
  const handleModelCacheRefresh = q(async () => {
    setModelCacheError(null);
    const r = await refreshModelCache(true).catch((err) => ({ error: String(err) }));
    if (r && r.error) {
      setModelCacheError(r.error);
    }
    if (r && r.ok) {
      setModelCache((prev) => ({ ...prev || {}, isRunning: true, activeTrigger: "manual" }));
    }
  }, []);
  const handleModelCacheAbort = q(async () => {
    await abortModelCacheRefresh().catch(() => {
    });
  }, []);
  const handleUnlock = q(async () => {
    if (!unlockPassword) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      const result = await unlockKey(unlockPassword);
      if (result.ok) {
        setUnlockPassword("");
        getConfig().then(setConfig).catch(() => {
        });
      } else {
        setUnlockError(result.error || "Wrong password");
      }
    } catch {
      setUnlockError("Could not connect to server");
    }
    setUnlocking(false);
  }, [unlockPassword]);
  const clearKeyForm = q(() => {
    setKeyValue("");
    setKeyPassword("");
    setKeyConfirm("");
    setEncryptKey(false);
    setKeyError(null);
    setUpdatingKey(false);
  }, []);
  const afterClick = (event, apply) => {
    event.preventDefault();
    event.stopPropagation();
    setTimeout(apply, 0);
  };
  const cancelProtect = q(() => {
    setProtectOpen(false);
    setUnprotectOpen(false);
    setKeyPassword("");
    setKeyConfirm("");
    setKeyError(null);
  }, []);
  const openUpdate = q(() => {
    setProtectOpen(false);
    setUnprotectOpen(false);
    setDeleteAsk(false);
    setKeyValue("");
    setKeyPassword("");
    setKeyConfirm("");
    setEncryptKey(false);
    setKeyError(null);
    setUpdatingKey(true);
  }, []);
  const openProtect = q(() => {
    setUpdatingKey(false);
    setUnprotectOpen(false);
    setDeleteAsk(false);
    setKeyPassword("");
    setKeyConfirm("");
    setKeyError(null);
    setProtectOpen(true);
  }, []);
  const openUnprotect = q(() => {
    setUpdatingKey(false);
    setProtectOpen(false);
    setDeleteAsk(false);
    setKeyPassword("");
    setKeyConfirm("");
    setKeyError(null);
    setUnprotectOpen(true);
  }, []);
  const handleSaveKey = q(async () => {
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
        setKeyError(result && result.message || "Could not save the API key.");
        return;
      }
      if (result.kind === "blocked") {
        setMismatch({
          libraryUsername: result.libraryUsername,
          keyUsername: result.keyUsername
        });
      } else {
        setMismatch(null);
      }
      clearKeyForm();
      getConfig().then(setConfig).catch(() => {
      });
    } catch {
      setKeyError("Could not connect to server");
    } finally {
      setSavingKey(false);
    }
  }, [keyValue, encryptKey, keyPassword, keyConfirm, clearKeyForm]);
  const handleDeleteKey = q(async () => {
    const result = await deleteApiKey().catch(() => null);
    if (!result || !result.ok) return;
    setKeyMenuOpen(false);
    setDeleteAsk(false);
    setMismatch(null);
    setProtectOpen(false);
    setUnprotectOpen(false);
    getConfig().then(setConfig).catch(() => {
    });
  }, []);
  const handleProtect = q(async () => {
    if (!keyPassword || keyPassword !== keyConfirm) return;
    setKeyError(null);
    const result = await protectApiKey({ password: keyPassword, confirmPassword: keyConfirm }).catch(() => null);
    if (!result || !result.ok) {
      setKeyError(result && result.message || "Could not encrypt key");
      return;
    }
    setKeyPassword("");
    setKeyConfirm("");
    setProtectOpen(false);
    getConfig().then(setConfig).catch(() => {
    });
  }, [keyPassword, keyConfirm]);
  const handleUnprotect = q(async () => {
    if (!keyPassword) return;
    setKeyError(null);
    const result = await unprotectApiKey({ password: keyPassword }).catch(() => null);
    if (!result || !result.ok) {
      setKeyError(result && result.message || "Wrong password");
      return;
    }
    setKeyPassword("");
    setUnprotectOpen(false);
    getConfig().then(setConfig).catch(() => {
    });
  }, [keyPassword]);
  async function handleFilesChoice(downloadMedia) {
    if (!config || config.downloadMedia === downloadMedia) return;
    const result = await updateConfig({ downloadMedia });
    if (result.ok) {
      setConfig((prev) => ({ ...prev, downloadMedia }));
    }
  }
  async function handleDomainChange(newDomain) {
    if (!config || !config.allowAltDomain) return;
    if (!(config.availableDomains || []).includes(newDomain)) return;
    if (newDomain === config.domain) return;
    const result = await updateConfig({ domain: newDomain });
    if (result.ok) {
      getConfig().then(setConfig).catch(() => {
      });
    }
  }
  y(() => {
    if (running) return;
    const shown = recheckShown({
      selected: chosen || [],
      modes: { posts: postMode, comics: comicsMode },
      totalPosts: stats?.totalPosts || 0,
      totalComics: stats?.totalComics || 0
    });
    if (!shown && recheck) setRecheck(false);
  }, [running, chosen, postMode, comicsMode, stats, recheck]);
  function toggleType(id) {
    if (running) return;
    const current = chosen || [];
    const has = current.includes(id);
    const next = DOWNLOAD_TYPE_ORDER.filter((item) => has ? current.includes(item) && item !== id : current.includes(item) || item === id);
    if (has && current.length === 1 && autoOn) {
      setAutoOn(false);
      rememberDownloadAuto(false);
    }
    setChosen(next);
    if (autoOn && next.length) rememberDownloadTypes(next);
    if ((id === "posts" || id === "comics") && !has && recheck) {
      if (id === "posts") setPostModeOverride("all");
      if (id === "comics") setComicsModeOverride("all");
      persistRemembered(id === "posts" ? { postModeOverride: "all" } : { comicsModeOverride: "all" });
    }
  }
  function chooseGeneration(value) {
    if (running) return;
    const next = applyGenerationSelection(shownGen, generationClick(value));
    setGenOverride(next);
    persistRemembered({ genOverride: next });
  }
  function chooseModel3ds(mode) {
    if (running) return;
    setModel3dsModeOverride(mode);
    persistRemembered({ model3dsModeOverride: mode });
  }
  const recheckArmed = A(false);
  y(() => {
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
  const [clauseNow, setClauseNow] = d(() => Date.now());
  y(() => {
    if (autoPhase !== "waiting" || !dueAt) return void 0;
    setClauseNow(Date.now());
    const id = setInterval(() => setClauseNow(Date.now()), 3e4);
    return () => clearInterval(id);
  }, [autoPhase, dueAt]);
  function toggleAuto() {
    const next = !autoOn;
    setAutoOn(next);
    rememberDownloadAuto(next);
    if (next) persistRemembered({}, { enabled: true });
  }
  function changeEvery(id) {
    const next = DOWNLOAD_PERIODS.some((period) => period.id === id) ? id : "1h";
    setEvery(next);
    rememberDownloadEvery(next);
  }
  const keyMenuAvailable = !!(config && config.hasKey && !(config.keyEncrypted && !config.keyUnlocked) && !mismatch);
  y(() => {
    if (!keyMenuAvailable) setKeyMenuOpen(false);
  }, [keyMenuAvailable]);
  if (!config || stats === void 0 || chosen === null || !prefsReady) {
    return /* @__PURE__ */ u("main", { class: "property-loading", children: [
      /* @__PURE__ */ u("h1", { class: "visually-hidden", children: "Download" }),
      /* @__PURE__ */ u("div", { class: "spinner" })
    ] });
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
  const saveDisabled = savingKey || !keyValue.trim() || encryptKey && (!keyPassword || keyPassword !== keyConfirm);
  const downloadFromTitle = `Download from ${config.domain || "civitai.com"}`;
  const failed = !running ? errorResult(run && run.results) : null;
  const errorMessage = failed ? failed.message || "" : !running && actionError ? actionError : null;
  const notice = downloadNotice({
    running,
    errorMessage,
    online,
    generationsOn: selected.includes("generations"),
    generationDays: calendarDaysAgo(config.lastDownloadGenerations),
    postsOn: selected.includes("posts"),
    postsNeedUpdate
  });
  const nextElapsed = !line ? "" : line.live ? formatElapsed(line.startedAt ? now - line.startedAt : 0) : formatElapsed(run && run.elapsed);
  const hasStatus = !!(line || notice);
  if (hasStatus) retainedStatus.current = { line, notice, elapsed: nextElapsed };
  else if (!submitting) retainedStatus.current = null;
  const statusPaint = hasStatus ? retainedStatus.current : submitting && retainedStatus.current || null;
  const statusLine = statusPaint ? statusPaint.line : null;
  const statusNotice = statusPaint ? statusPaint.notice : null;
  const elapsedText = statusPaint ? statusPaint.elapsed : "";
  return /* @__PURE__ */ u("main", { class: "main-content property-sheet", children: [
    /* @__PURE__ */ u("h1", { class: "visually-hidden", children: "Download" }),
    (accountView.setup || updatingKey && (needsUnlock || accountView.mismatch)) && /* @__PURE__ */ u("section", { class: "property-group", children: [
      /* @__PURE__ */ u("h2", { class: "property-heading", children: accountView.setup ? "API key" : "Update API key" }),
      /* @__PURE__ */ u(
        KeyEntryForm,
        {
          domain: config.domain,
          showIntro: accountView.setup,
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
          onSave: handleSaveKey,
          onCancel: updatingKey ? (event) => afterClick(event, clearKeyForm) : null
        }
      )
    ] }),
    accountView.mismatch && !updatingKey && /* @__PURE__ */ u("section", { class: "property-group key-form", children: [
      /* @__PURE__ */ u("h2", { class: "property-heading", children: "API key" }),
      accountMismatchParagraphs(mismatch.libraryUsername, mismatch.keyUsername).map((paragraph) => /* @__PURE__ */ u("p", { class: "unlock-desc", children: emphasizeNames(paragraph, [mismatch.libraryUsername, mismatch.keyUsername]) }, paragraph)),
      /* @__PURE__ */ u("button", { class: "action-btn", onClick: openUpdate, children: "Update API key" })
    ] }),
    accountView.unlock && !updatingKey && /* @__PURE__ */ u("section", { class: "property-group unlock-section", children: [
      /* @__PURE__ */ u("h2", { class: "property-heading", children: "Unlock API Key" }),
      /* @__PURE__ */ u("p", { class: "unlock-desc", children: "Your API key is encrypted. Enter your password to unlock it for this session." }),
      /* @__PURE__ */ u("div", { class: "property-controls", children: [
        /* @__PURE__ */ u("label", { class: "visually-hidden", for: "download-password", children: "Password" }),
        /* @__PURE__ */ u(
          "input",
          {
            id: "download-password",
            type: "password",
            class: "unlock-input",
            placeholder: "Password",
            value: unlockPassword,
            onInput: (e) => setUnlockPassword(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") handleUnlock();
            },
            disabled: unlocking
          }
        ),
        /* @__PURE__ */ u("button", { class: "action-btn", onClick: handleUnlock, disabled: unlocking || !unlockPassword, children: unlocking ? "Unlocking\u2026" : "Unlock" })
      ] }),
      unlockError && /* @__PURE__ */ u("div", { class: "property-error", children: unlockError }),
      /* @__PURE__ */ u("button", { class: "action-btn secondary-btn", onClick: openUpdate, children: "Update API key" })
    ] }),
    /* @__PURE__ */ u("section", { class: "property-group", children: [
      /* @__PURE__ */ u("div", { class: "property-controls", children: [
        /* @__PURE__ */ u("fieldset", { class: "mode-selector", children: [
          /* @__PURE__ */ u("legend", { class: "visually-hidden", children: "Download" }),
          /* @__PURE__ */ u("fieldset", { class: "mode-cluster", children: [
            /* @__PURE__ */ u("legend", { class: "visually-hidden", children: "Download types" }),
            DOWNLOAD_TYPE_ORDER.map((id) => /* @__PURE__ */ u("label", { class: "mode-btn", children: [
              /* @__PURE__ */ u(
                "input",
                {
                  type: "checkbox",
                  checked: selected.includes(id),
                  disabled: running,
                  onChange: () => toggleType(id)
                }
              ),
              DOWNLOAD_TYPE_LABELS[id]
            ] }, id))
          ] }),
          /* @__PURE__ */ u("span", { class: "mode-break", "aria-hidden": "true" }),
          /* @__PURE__ */ u("fieldset", { class: "mode-cluster", children: [
            /* @__PURE__ */ u("legend", { class: "visually-hidden", children: "Auto download" }),
            /* @__PURE__ */ u("label", { class: "mode-btn", title: `Auto download every ${periodLabel(every)}`, children: [
              /* @__PURE__ */ u(
                "input",
                {
                  type: "checkbox",
                  checked: autoOn,
                  onChange: toggleAuto
                }
              ),
              "Auto"
            ] })
          ] })
        ] }),
        running ? /* @__PURE__ */ u("button", { class: "action-btn stop-btn", onClick: handleAbort, children: "Stop" }) : /* @__PURE__ */ u(
          "button",
          {
            class: "action-btn",
            onClick: handleDownload,
            disabled: !online || !canDownload || selected.length === 0,
            title: downloadFromTitle,
            children: "Download"
          }
        )
      ] }),
      autoOn && /* @__PURE__ */ u("div", { class: "download-every", children: [
        /* @__PURE__ */ u("label", { for: "download-every", children: "Every" }),
        /* @__PURE__ */ u(
          "select",
          {
            id: "download-every",
            class: "facet-select",
            value: every,
            onChange: (event) => changeEvery(event.target.value),
            children: DOWNLOAD_PERIODS.map((period) => /* @__PURE__ */ u("option", { value: period.id, children: period.label }, period.id))
          }
        ),
        autoPhase === "waiting" && dueAt && (() => {
          const clause = nextDownloadClause(dueAt, clauseNow);
          if (!clause) return null;
          if (clause.kind === "now") return /* @__PURE__ */ u("span", { class: "download-every-next", children: "Next download now" });
          if (clause.kind === "minutes") {
            return /* @__PURE__ */ u("span", { class: "download-every-next", children: `Next download in ${clause.minutes} mins` });
          }
          const when = new Date(clause.at);
          const clock = when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          return /* @__PURE__ */ u("span", { class: "download-every-next", children: `Next download at ${clock}` });
        })()
      ] }),
      (statusLine || statusNotice) && /* @__PURE__ */ u("div", { class: "download-status", "aria-live": "polite", children: [
        statusLine && /* @__PURE__ */ u("div", { class: "progress-bar", children: /* @__PURE__ */ u("div", { class: "progress-details download-status-clauses", children: [
          statusLine.live && /* @__PURE__ */ u("div", { class: "progress-pulse" }),
          statusLine.clauses.map((clause) => /* @__PURE__ */ u("span", { class: clause.active ? "download-clause-active" : "download-clause", children: [
            clause.label,
            clause.activity ? ` \xB7 ${clause.activity}` : "",
            clause.counts ? ` \xB7 ${clause.counts}` : "",
            clause.mark ? /* @__PURE__ */ u(k, { children: [
              " \xB7 ",
              /* @__PURE__ */ u("span", { class: clause.mark === "failed" ? "download-mark-failed" : clause.mark === "stopped" ? "download-mark-stopped" : "", children: clause.mark })
            ] }) : null
          ] }, clause.type)),
          /* @__PURE__ */ u("span", { class: "progress-elapsed", children: elapsedText })
        ] }) }),
        statusNotice && /* @__PURE__ */ u("p", { class: `download-notice ${statusNotice.tone}`, children: statusNotice.text })
      ] })
    ] }),
    offer.section && /* @__PURE__ */ u("section", { class: "property-group download-options", children: [
      /* @__PURE__ */ u("h2", { class: "property-heading", children: "Download options" }),
      selected.map((id) => /* @__PURE__ */ u(
        DownloadOptionRow,
        {
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
        },
        id
      )),
      /* @__PURE__ */ u(
        "details",
        {
          class: "download-advanced",
          open: shownRecheck || advancedPref,
          onToggle: (event) => {
            if (shownRecheck) return;
            const open = event.currentTarget.open;
            setAdvancedPref(open);
            rememberDownloadAdvancedOpen(open);
          },
          children: [
            /* @__PURE__ */ u("summary", { onClick: (event) => {
              if (shownRecheck) event.preventDefault();
            }, children: `Advanced ${shownRecheck || advancedPref ? "\u25BC" : "\u25B8"}` }),
            offer.recheck && /* @__PURE__ */ u("div", { class: "download-option-row", children: [
              /* @__PURE__ */ u("div", { class: "property-name download-option-label", "aria-hidden": "true" }),
              /* @__PURE__ */ u("div", { class: "mode-selector", children: /* @__PURE__ */ u("label", { class: "mode-btn", title: RECHECK_TITLE, children: [
                /* @__PURE__ */ u(
                  "input",
                  {
                    type: "checkbox",
                    checked: shownRecheck,
                    disabled: running,
                    onChange: chooseRecheck
                  }
                ),
                "Recheck metadata"
              ] }) })
            ] }),
            offer.files && /* @__PURE__ */ u("div", { class: "download-option-row", children: [
              /* @__PURE__ */ u("div", { class: "property-name download-option-label", children: "Files" }),
              /* @__PURE__ */ u("fieldset", { class: "mode-selector", children: [
                /* @__PURE__ */ u("legend", { class: "visually-hidden", children: "Files" }),
                /* @__PURE__ */ u("label", { class: "mode-btn", title: "Media files and data (prompts, generation settings, etc) are saved", children: [
                  /* @__PURE__ */ u(
                    "input",
                    {
                      type: "radio",
                      name: "download-files",
                      value: "true",
                      checked: config.downloadMedia !== false,
                      onChange: () => handleFilesChoice(true)
                    }
                  ),
                  "Media and data"
                ] }),
                /* @__PURE__ */ u("label", { class: "mode-btn", title: "Data is saved, media files are not", children: [
                  /* @__PURE__ */ u(
                    "input",
                    {
                      type: "radio",
                      name: "download-files",
                      value: "false",
                      checked: config.downloadMedia === false,
                      onChange: () => handleFilesChoice(false)
                    }
                  ),
                  "Data only"
                ] })
              ] })
            ] }),
            offer.domain && /* @__PURE__ */ u("div", { class: "download-option-row", children: [
              /* @__PURE__ */ u("div", { class: "property-name download-option-label", children: "Civitai domain" }),
              /* @__PURE__ */ u("fieldset", { class: "mode-selector", children: [
                /* @__PURE__ */ u("legend", { class: "visually-hidden", children: "Civitai domain" }),
                (config.availableDomains || []).map((domain) => /* @__PURE__ */ u(
                  "label",
                  {
                    class: "mode-btn",
                    title: `Use ${domain} for API calls and links`,
                    children: [
                      /* @__PURE__ */ u(
                        "input",
                        {
                          type: "radio",
                          name: "civitai-domain",
                          value: domain,
                          checked: config.domain === domain,
                          onChange: () => handleDomainChange(domain)
                        }
                      ),
                      domain
                    ]
                  },
                  domain
                ))
              ] })
            ] })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ u("section", { class: "property-group", children: [
      /* @__PURE__ */ u("h2", { class: "property-heading", children: "Folders" }),
      /* @__PURE__ */ u("dl", { children: [
        /* @__PURE__ */ u("div", { class: "property", children: [
          /* @__PURE__ */ u("dt", { class: "property-name", children: "Media" }),
          /* @__PURE__ */ u("dd", { class: "property-value-row", children: [
            /* @__PURE__ */ u("div", { class: "property-value mono", children: config.mediaPath }),
            /* @__PURE__ */ u(OpenFolderButton, { path: config.mediaPath })
          ] })
        ] }),
        /* @__PURE__ */ u("div", { class: "property", children: [
          /* @__PURE__ */ u("dt", { class: "property-name", children: "Data" }),
          /* @__PURE__ */ u("dd", { class: "property-value-row", children: [
            /* @__PURE__ */ u("div", { class: "property-value mono", children: config.dataPath }),
            /* @__PURE__ */ u(OpenFolderButton, { path: config.dataPath })
          ] })
        ] })
      ] })
    ] }),
    config.hasKey ? /* @__PURE__ */ u("div", { class: "property-pair", children: [
      /* @__PURE__ */ u(
        ModelCacheSection,
        {
          modelCache,
          downloadActive: running,
          error: modelCacheError,
          hasKey: config.hasKey,
          username: config.username,
          rebuilding,
          showModels: accountView.modelsLine,
          showRefresh: accountView.refreshModels,
          showRebuild: accountView.rebuildIndex,
          onRefresh: handleModelCacheRefresh,
          onAbort: handleModelCacheAbort,
          onRebuild: handleRebuild,
          accountActions: !needsUnlock && !accountView.mismatch && (updatingKey ? /* @__PURE__ */ u(
            KeyEntryForm,
            {
              domain: config.domain,
              showIntro: false,
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
              onSave: handleSaveKey,
              onCancel: (event) => afterClick(event, clearKeyForm)
            },
            "update"
          ) : protectOpen ? /* @__PURE__ */ u("div", { class: "key-form", children: [
            /* @__PURE__ */ u("div", { class: "property-controls", children: [
              /* @__PURE__ */ u("label", { class: "visually-hidden", for: "protect-password", children: "Password" }),
              /* @__PURE__ */ u("input", { id: "protect-password", type: "password", class: "unlock-input", autocomplete: "new-password", placeholder: "Password", value: keyPassword, onInput: (e) => setKeyPassword(e.target.value) }),
              /* @__PURE__ */ u("label", { class: "visually-hidden", for: "protect-confirm", children: "Repeat password" }),
              /* @__PURE__ */ u("input", { id: "protect-confirm", type: "password", class: "unlock-input", autocomplete: "new-password", placeholder: "Repeat password", value: keyConfirm, onInput: (e) => setKeyConfirm(e.target.value) })
            ] }),
            keyPassword && keyConfirm && keyPassword !== keyConfirm && /* @__PURE__ */ u("div", { class: "property-error", children: "Passwords do not match." }),
            keyError && /* @__PURE__ */ u("div", { class: "property-error", children: keyError }),
            /* @__PURE__ */ u("div", { class: "property-controls", children: [
              /* @__PURE__ */ u("button", { class: "action-btn", onClick: handleProtect, disabled: !keyPassword || keyPassword !== keyConfirm, children: "Encrypt" }),
              /* @__PURE__ */ u("button", { class: "action-btn secondary-btn", onMouseDown: (event) => event.preventDefault(), onClick: (event) => afterClick(event, cancelProtect), children: "Cancel" })
            ] })
          ] }, "protect") : unprotectOpen ? /* @__PURE__ */ u("div", { class: "key-form", children: [
            /* @__PURE__ */ u("div", { class: "property-controls", children: [
              /* @__PURE__ */ u("label", { class: "visually-hidden", for: "unprotect-password", children: "Password" }),
              /* @__PURE__ */ u("input", { id: "unprotect-password", type: "password", class: "unlock-input", placeholder: "Password", value: keyPassword, onInput: (e) => setKeyPassword(e.target.value), onKeyDown: (e) => {
                if (e.key === "Enter") handleUnprotect();
              } }),
              /* @__PURE__ */ u("button", { class: "action-btn", onClick: handleUnprotect, disabled: !keyPassword, children: "Remove password" }),
              /* @__PURE__ */ u("button", { class: "action-btn secondary-btn", onMouseDown: (event) => event.preventDefault(), onClick: (event) => afterClick(event, cancelProtect), children: "Cancel" })
            ] }),
            keyError && /* @__PURE__ */ u("div", { class: "property-error", children: keyError })
          ] }, "unprotect") : deleteAsk ? /* @__PURE__ */ u("div", { class: "key-confirm", children: [
            /* @__PURE__ */ u("p", { class: "unlock-desc", children: "Delete the saved API key? Downloaded files stay." }),
            /* @__PURE__ */ u("button", { type: "button", class: "text-btn danger", onClick: handleDeleteKey, children: "Delete" }),
            /* @__PURE__ */ u("button", { type: "button", class: "text-btn", onMouseDown: (event) => event.preventDefault(), onClick: (event) => afterClick(event, () => setDeleteAsk(false)), children: "Cancel" })
          ] }, "delete") : /* @__PURE__ */ u(
            "details",
            {
              class: "key-change",
              open: keyMenuOpen,
              onToggle: (event) => setKeyMenuOpen(event.currentTarget.open),
              children: [
                /* @__PURE__ */ u("summary", { children: `Change API key ${keyMenuOpen ? "\u25BC" : "\u25B8"}` }),
                /* @__PURE__ */ u("div", { class: "property-actions", children: [
                  /* @__PURE__ */ u("button", { class: "action-btn secondary-btn", onClick: openUpdate, children: "Update API key" }),
                  !config.keyEncrypted && /* @__PURE__ */ u("button", { class: "action-btn secondary-btn", onClick: openProtect, children: "Add password protection" }),
                  config.keyEncrypted && /* @__PURE__ */ u("button", { class: "action-btn secondary-btn", onClick: openUnprotect, children: "Remove password protection" }),
                  /* @__PURE__ */ u("button", { class: "action-btn secondary-btn", onClick: () => {
                    setDeleteAsk(true);
                    setKeyError(null);
                  }, children: "Delete API key" })
                ] })
              ]
            },
            "menu"
          ))
        }
      ),
      /* @__PURE__ */ u("section", { class: "property-group", children: [
        /* @__PURE__ */ u("h2", { class: "property-heading", children: "Civitai-Sync" }),
        /* @__PURE__ */ u("dl", { children: /* @__PURE__ */ u("div", { class: "property", children: [
          /* @__PURE__ */ u("dt", { class: "property-name", children: "Version" }),
          /* @__PURE__ */ u("dd", { class: "property-value", children: config.version || "unknown" }),
          /* @__PURE__ */ u("dd", { class: "property-value", children: [
            /* @__PURE__ */ u(
              "a",
              {
                class: "meta-action",
                href: `https://${config.domain || "civitai.com"}/models/526058`,
                target: "_blank",
                rel: "noopener noreferrer",
                title: "Open Civitai-Sync on Civitai",
                children: "\u{1F517} On Civitai"
              }
            ),
            /* @__PURE__ */ u(
              "a",
              {
                class: "meta-action",
                href: `https://${config.domain || "civitai.com"}/articles/5676`,
                target: "_blank",
                rel: "noopener noreferrer",
                title: "Open Discussion page for Civitai-Sync on Civitai",
                children: "\u{1F517} Discussion"
              }
            )
          ] })
        ] }) })
      ] })
    ] }) : /* @__PURE__ */ u("section", { class: "property-group", children: [
      /* @__PURE__ */ u("h2", { class: "property-heading", children: "Civitai-Sync" }),
      /* @__PURE__ */ u("dl", { children: /* @__PURE__ */ u("div", { class: "property", children: [
        /* @__PURE__ */ u("dt", { class: "property-name", children: "Version" }),
        /* @__PURE__ */ u("dd", { class: "property-value", children: config.version || "unknown" }),
        /* @__PURE__ */ u("dd", { class: "property-value", children: [
          /* @__PURE__ */ u(
            "a",
            {
              class: "meta-action",
              href: `https://${config.domain || "civitai.com"}/models/526058`,
              target: "_blank",
              rel: "noopener noreferrer",
              title: "Open Civitai-Sync on Civitai",
              children: "\u{1F517} On Civitai"
            }
          ),
          /* @__PURE__ */ u(
            "a",
            {
              class: "meta-action",
              href: `https://${config.domain || "civitai.com"}/articles/5676`,
              target: "_blank",
              rel: "noopener noreferrer",
              title: "Open Discussion page for Civitai-Sync on Civitai",
              children: "\u{1F517} Discussion"
            }
          )
        ] })
      ] }) })
    ] })
  ] });
}
function DownloadOptionRow({
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
  return /* @__PURE__ */ u("div", { class: "download-option-row", children: [
    /* @__PURE__ */ u("div", { class: "property-name download-option-label", children: DOWNLOAD_TYPE_LABELS[id] }),
    id === "generations" && /* @__PURE__ */ u("div", { class: "mode-selector", children: [
      /* @__PURE__ */ u("fieldset", { class: "mode-cluster", children: [
        /* @__PURE__ */ u("legend", { class: "visually-hidden", children: "Download type" }),
        generationDownloadModes().filter((m) => m.value === "latest" || m.value === "missing-all").map((m) => /* @__PURE__ */ u("label", { class: "mode-btn", title: m.desc, children: [
          /* @__PURE__ */ u(
            "input",
            {
              type: "radio",
              name: "download-generations-type",
              value: m.value,
              checked: generationButtonOn(shownGen, m.value),
              disabled: running,
              onChange: () => chooseGeneration(m.value)
            }
          ),
          m.label
        ] }, m.value))
      ] }),
      /* @__PURE__ */ u("span", { class: "mode-break", "aria-hidden": "true" }),
      /* @__PURE__ */ u("fieldset", { class: "mode-cluster", children: [
        /* @__PURE__ */ u("legend", { class: "visually-hidden", children: "By tag" }),
        generationDownloadModes().filter((m) => m.value === "favorite" || m.value === "feedback:liked").map((m) => /* @__PURE__ */ u("label", { class: "mode-btn", title: m.desc, children: [
          /* @__PURE__ */ u(
            "input",
            {
              type: "checkbox",
              value: m.value,
              checked: generationButtonOn(shownGen, m.value),
              disabled: running,
              onChange: () => chooseGeneration(m.value)
            }
          ),
          m.label
        ] }, m.value))
      ] })
    ] }),
    id === "posts" && /* @__PURE__ */ u("div", { class: "mode-selector", children: /* @__PURE__ */ u("fieldset", { class: "mode-cluster", children: [
      /* @__PURE__ */ u("legend", { class: "visually-hidden", children: "Download posts" }),
      POST_MODES.map((m) => /* @__PURE__ */ u(
        "label",
        {
          class: "mode-btn",
          title: postModeTitle(m.value, postsNeedUpdate) || m.desc,
          children: [
            /* @__PURE__ */ u(
              "input",
              {
                type: "radio",
                name: "download-posts",
                value: m.value,
                checked: shownPostMode === m.value,
                disabled: running,
                onChange: () => chooseContainer("posts", m.value)
              }
            ),
            m.label
          ]
        },
        m.value
      ))
    ] }) }),
    id === "comics" && /* @__PURE__ */ u("div", { class: "mode-selector", children: /* @__PURE__ */ u("fieldset", { class: "mode-cluster", children: [
      /* @__PURE__ */ u("legend", { class: "visually-hidden", children: "Download comics" }),
      COMIC_MODES.map((m) => /* @__PURE__ */ u("label", { class: "mode-btn", title: m.desc, children: [
        /* @__PURE__ */ u(
          "input",
          {
            type: "radio",
            name: "download-comics",
            value: m.value,
            checked: shownComicsMode === m.value,
            disabled: running,
            onChange: () => chooseContainer("comics", m.value)
          }
        ),
        m.label
      ] }, m.value))
    ] }) }),
    id === "model3ds" && /* @__PURE__ */ u("div", { class: "mode-selector", children: /* @__PURE__ */ u("fieldset", { class: "mode-cluster", children: [
      /* @__PURE__ */ u("legend", { class: "visually-hidden", children: "Download 3D" }),
      MODEL3D_MODES.map((m) => /* @__PURE__ */ u("label", { class: "mode-btn", title: m.desc, children: [
        /* @__PURE__ */ u(
          "input",
          {
            type: "radio",
            name: "download-model3ds",
            value: m.value,
            checked: shownModel3dsMode === m.value,
            disabled: running,
            onChange: () => chooseModel3ds(m.value)
          }
        ),
        m.label
      ] }, m.value))
    ] }) }),
    /* @__PURE__ */ u("div", { class: "download-option-when", children: /* @__PURE__ */ u(
      LastDownloadInfo,
      {
        isoDate: config[LAST_DOWNLOAD_KEY[id]],
        warnDays: id === "generations" ? 25 : void 0,
        expireDays: id === "generations" ? 30 : void 0
      }
    ) })
  ] });
}
function ApiKeyProperty({ hasKey, username, children }) {
  return /* @__PURE__ */ u("div", { class: "property", children: [
    /* @__PURE__ */ u("dt", { class: "property-name", children: "API key" }),
    /* @__PURE__ */ u("dd", { class: "property-value", children: hasKey ? `Configured${username ? ` \xB7 ${username}` : ""}` : "Not set" }),
    children
  ] });
}
function emphasizeNames(text, names) {
  const list = [...new Set((names || []).filter((name) => name))].sort((a, b) => b.length - a.length);
  if (!list.length) return text;
  const pattern = new RegExp(list.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  const nodes = [];
  let last = 0;
  let match;
  while (match = pattern.exec(text)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(/* @__PURE__ */ u("strong", { children: match[0] }, `${match.index}-${match[0]}`));
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
function KeyEntryForm({
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
  return /* @__PURE__ */ u("div", { class: "key-form", children: [
    showIntro && /* @__PURE__ */ u("p", { class: "unlock-desc", children: [
      "Create an API key in your",
      " ",
      /* @__PURE__ */ u("a", { href: `https://${domain || "civitai.com"}/user/account/security`, target: "_blank", rel: "noopener noreferrer", children: "Civitai account settings" }),
      "."
    ] }),
    /* @__PURE__ */ u("div", { class: "property-controls", children: [
      /* @__PURE__ */ u("label", { class: "visually-hidden", for: "download-api-key", children: "API key" }),
      /* @__PURE__ */ u(
        "input",
        {
          id: "download-api-key",
          type: "password",
          class: "unlock-input",
          autocomplete: "off",
          placeholder: "API key",
          value: keyValue,
          onInput: (e) => setKeyValue(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter" && !saveDisabled) onSave();
          }
        }
      )
    ] }),
    /* @__PURE__ */ u("div", { class: "property-controls", children: /* @__PURE__ */ u("label", { class: "switch", children: [
      /* @__PURE__ */ u(
        "input",
        {
          type: "checkbox",
          role: "switch",
          checked: encryptKey,
          onChange: (e) => setEncryptKey(e.target.checked)
        }
      ),
      /* @__PURE__ */ u("span", { class: "switch-track", "aria-hidden": "true" }),
      "Add password protection"
    ] }) }),
    encryptKey && /* @__PURE__ */ u("div", { class: "property-controls", children: [
      /* @__PURE__ */ u("label", { class: "visually-hidden", for: "download-key-password", children: "Password" }),
      /* @__PURE__ */ u("input", { id: "download-key-password", type: "password", class: "unlock-input", autocomplete: "new-password", placeholder: "Password", value: keyPassword, onInput: (e) => setKeyPassword(e.target.value) }),
      /* @__PURE__ */ u("label", { class: "visually-hidden", for: "download-key-confirm", children: "Repeat password" }),
      /* @__PURE__ */ u("input", { id: "download-key-confirm", type: "password", class: "unlock-input", autocomplete: "new-password", placeholder: "Repeat password", value: keyConfirm, onInput: (e) => setKeyConfirm(e.target.value), onKeyDown: (e) => {
        if (e.key === "Enter" && !saveDisabled) onSave();
      } })
    ] }),
    passwordsDiffer && /* @__PURE__ */ u("div", { class: "property-error", children: "Passwords do not match." }),
    keyError && /* @__PURE__ */ u("div", { class: "property-error", children: keyError }),
    /* @__PURE__ */ u("div", { class: "property-controls", children: [
      /* @__PURE__ */ u("button", { class: "action-btn", onClick: onSave, disabled: saveDisabled, children: "Save API key" }),
      onCancel && /* @__PURE__ */ u("button", { class: "action-btn secondary-btn", onMouseDown: (event) => event.preventDefault(), onClick: onCancel, children: "Cancel" })
    ] })
  ] });
}
function RebuildIndexButton({ rebuilding, onRebuild }) {
  return /* @__PURE__ */ u("button", { class: "action-btn secondary-btn", onClick: onRebuild, disabled: rebuilding, children: rebuilding ? "Rebuilding\u2026" : "Rebuild index" });
}
function ModelCacheSection({ modelCache, downloadActive, error, hasKey, username, rebuilding, showModels, showRefresh, showRebuild, accountActions, onRefresh, onAbort, onRebuild }) {
  if (!modelCache) {
    return /* @__PURE__ */ u("section", { class: "property-group", children: [
      /* @__PURE__ */ u("h2", { class: "property-heading", children: "Account" }),
      /* @__PURE__ */ u("dl", { children: /* @__PURE__ */ u(ApiKeyProperty, { hasKey, username, children: accountActions }) }),
      showModels && /* @__PURE__ */ u("div", { class: "property", children: /* @__PURE__ */ u("div", { class: "property-value", children: [
        "Loading",
        "\u2026"
      ] }) }),
      showRebuild && /* @__PURE__ */ u("div", { class: "property-actions", children: /* @__PURE__ */ u(RebuildIndexButton, { rebuilding, onRebuild }) })
    ] });
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
  const triggerLabel = activeTrigger === "manual" ? "manual refresh" : activeTrigger === "after-download" ? "after-download refresh" : "refresh";
  return /* @__PURE__ */ u("section", { class: "property-group", children: [
    /* @__PURE__ */ u("h2", { class: "property-heading", children: "Account" }),
    /* @__PURE__ */ u("dl", { children: [
      /* @__PURE__ */ u(ApiKeyProperty, { hasKey, username, children: accountActions }),
      showModels && /* @__PURE__ */ u("div", { class: "property", children: [
        /* @__PURE__ */ u("dt", { class: "property-name", children: "Models & resources" }),
        /* @__PURE__ */ u("dd", { class: "property-value", children: [
          `${cachedPhrase}. `,
          refreshed ? /* @__PURE__ */ u("span", { title: new Date(lastRefreshedAt).toLocaleString(), children: [
            "Last refreshed ",
            /* @__PURE__ */ u(TimeText, { at: lastRefreshedAt, children: refreshed }),
            "."
          ] }) : "Last refreshed never."
        ] })
      ] }),
      showModels && isRunning && activeProgress && /* @__PURE__ */ u("div", { class: "property", children: [
        /* @__PURE__ */ u("dt", { class: "property-name", children: "Status" }),
        /* @__PURE__ */ u("dd", { class: "property-value", children: [
          "Refreshing (",
          triggerLabel,
          "):",
          " ",
          activeProgress.fetched + activeProgress.tombstoned + activeProgress.preserved + activeProgress.errors,
          " / ",
          activeProgress.total
        ] })
      ] })
    ] }),
    error && /* @__PURE__ */ u("div", { class: "property-error", children: error }),
    (showRefresh || showRebuild) && /* @__PURE__ */ u("div", { class: "property-actions", children: [
      showRefresh && (isRunning ? /* @__PURE__ */ u("button", { class: "action-btn secondary-btn", onClick: onAbort, children: "Cancel refresh" }) : /* @__PURE__ */ u(
        "button",
        {
          class: "action-btn secondary-btn",
          onClick: onRefresh,
          disabled: downloadActive,
          title: downloadActive ? "Disabled while a download is in progress" : "Re-fetch cached model versions, then this account's models",
          children: "Refresh models"
        }
      )),
      showRebuild && /* @__PURE__ */ u(RebuildIndexButton, { rebuilding, onRebuild })
    ] })
  ] });
}
function LastDownloadInfo({ isoDate, warnDays, expireDays }) {
  const days = calendarDaysAgo(isoDate);
  const text = relativeTime(isoDate);
  const tone = days == null ? "last-download-never" : expireDays && days >= expireDays ? "last-download-expired" : warnDays && days >= warnDays ? "last-download-warning" : "last-download-ok";
  return /* @__PURE__ */ u("div", { class: "last-download-info", children: days != null ? /* @__PURE__ */ u("span", { class: tone, children: [
    "Last downloaded ",
    /* @__PURE__ */ u(TimeText, { at: isoDate, children: text })
  ] }) : /* @__PURE__ */ u("span", { class: "last-download-never", children: "Never downloaded" }) });
}
export {
  DownloadView
};
