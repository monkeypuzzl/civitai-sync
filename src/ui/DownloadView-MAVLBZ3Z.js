import {
  OpenFolderButton
} from "./chunk-W7BMSFDW.js";
import {
  notifyCorpusChange
} from "./chunk-XWICPOXM.js";
import {
  TimeText,
  calendarDaysAgo,
  relativeTime
} from "./chunk-INNL2V6Q.js";
import "./chunk-Z6L3MMX7.js";
import {
  A,
  abortDownload,
  abortModelCacheRefresh,
  connectProgress,
  d,
  getConfig,
  getDownloadStatus,
  getModelCacheStatus,
  q,
  rebuildIndex,
  refreshModelCache,
  refreshUser,
  startDownload,
  u,
  unlockKey,
  updateConfig,
  useDocumentTitle,
  y
} from "./chunk-QDJYYBZC.js";

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

// dev/ui/src/components/DownloadView.jsx
var POST_MODES = [
  { value: "latest", label: "Latest", desc: "Most recent posts not yet saved" },
  { value: "all", label: "All", desc: "Download all posts" }
];
function generationClick(value) {
  return value === "missing-all" ? "all" : value;
}
function generationButtonOn(selection, value) {
  if (value === "latest") return selection.run === "latest";
  if (value === "missing-all") return selection.run === "all";
  return selection.run === "reactions" && selection.reactions.includes(value);
}
function FilesNotSavedLine({ downloadMedia }) {
  if (downloadMedia !== false) return null;
  return /* @__PURE__ */ u("p", { class: "files-not-saved", children: "Files are not saved." });
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
function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
function formatActivity(activity, { itemNoun = "item" } = {}) {
  if (!activity) return "";
  const { phase, index, total } = activity;
  const of = index && total ? ` ${index} of ${total}` : "";
  switch (phase) {
    case "checking":
      return `checking ${itemNoun}${of}`;
    case "saving":
      return `saving ${itemNoun}${of}`;
    case "enriching":
      return `enriching ${itemNoun}${of}`;
    case "media":
      return `image${of}`;
    default:
      return "";
  }
}
function DownloadView() {
  useDocumentTitle({ place: "download" });
  const [config, setConfig] = d(null);
  const [genOverride, setGenOverride] = d(null);
  const [postModeOverride, setPostModeOverride] = d(null);
  const [downloadActive, setDownloadActive] = d(false);
  const [downloadType, setDownloadType] = d(null);
  const [downloadStartedAt, setDownloadStartedAt] = d(null);
  const [progress, setProgress] = d(null);
  const [lastResult, setLastResult] = d(null);
  const [error, setError] = d(null);
  const [rebuilding, setRebuilding] = d(false);
  const [online, setOnline] = d(navigator.onLine);
  const [unlockPassword, setUnlockPassword] = d("");
  const [unlockError, setUnlockError] = d(null);
  const [unlocking, setUnlocking] = d(false);
  const [modelCache, setModelCache] = d(null);
  const [modelCacheError, setModelCacheError] = d(null);
  const disconnectSSE = A(null);
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
    getDownloadStatus().then((status) => {
      if (status.active) {
        setDownloadActive(true);
        setDownloadType(status.type);
      }
    }).catch(() => {
    });
    getModelCacheStatus().then(setModelCache).catch(() => {
    });
    refreshUser().then(() => getConfig().then(setConfig).catch(() => {
    })).catch(() => {
    });
  }, []);
  y(() => {
    const disconnect = connectProgress((event) => {
      if (event.type === "connected") {
        if (event.active) {
          setDownloadActive(true);
          setDownloadType(event.downloadType);
          if (!downloadStartedAt) setDownloadStartedAt(Date.now());
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
      if (event.final) {
        setDownloadActive(false);
        setDownloadStartedAt(null);
        setLastResult({ ...event });
        setProgress(null);
        setPostModeOverride(null);
        getConfig().then(setConfig).catch(() => {
        });
        notifyCorpusChange();
        return;
      }
      if (event.status === "downloading") {
        setProgress(event);
        setDownloadActive(true);
        setDownloadType(event.type);
      }
    });
    disconnectSSE.current = disconnect;
    return disconnect;
  }, []);
  const postsNeedGenerationData = config?.postsNeedGenerationData === true;
  const postMode = postModeOverride ?? (postsNeedGenerationData ? "all" : config?.postDownload === "all" ? "all" : "latest");
  const genSelection = genOverride ?? selectionFromConfig({
    generationDownload: config?.generationDownload,
    generationReactions: config?.generationReactions
  });
  const handleStartGen = q(async () => {
    setError(null);
    setLastResult(null);
    const arm = () => {
      setDownloadActive(true);
      setDownloadType("generations");
      setDownloadStartedAt(Date.now());
      setProgress({});
    };
    if (genSelection.run === "reactions" && genSelection.reactions.length > 0) {
      let saved;
      try {
        saved = await updateConfig({ generationReactions: genSelection.reactions });
      } catch {
        setError("Could not connect to server");
        return;
      }
      if (!saved || !saved.ok) {
        setError(saved && saved.error || "Could not save reactions");
        return;
      }
      setConfig((prev) => prev ? { ...prev, generationReactions: genSelection.reactions } : prev);
      const result2 = await startDownload("generations", "missing-tags");
      if (result2.error) {
        setError(result2.error);
      } else {
        arm();
      }
      return;
    }
    const mode = genSelection.run === "all" ? "missing-all" : "latest";
    const result = await startDownload("generations", mode);
    if (result.error) {
      setError(result.error);
    } else {
      arm();
    }
  }, [genSelection]);
  const handleStartPosts = q(async () => {
    setError(null);
    setLastResult(null);
    const result = await startDownload("posts", postMode);
    if (result.error) {
      setError(result.error);
    } else {
      setDownloadActive(true);
      setDownloadType("posts");
      setDownloadStartedAt(Date.now());
      setProgress({});
    }
  }, [postMode]);
  const handleStartComics = q(async () => {
    setError(null);
    setLastResult(null);
    const result = await startDownload("comics");
    if (result.error) {
      setError(result.error);
    } else {
      setDownloadActive(true);
      setDownloadType("comics");
      setDownloadStartedAt(Date.now());
      setProgress({});
    }
  }, []);
  const handleStartModel3ds = q(async () => {
    setError(null);
    setLastResult(null);
    const result = await startDownload("model3ds");
    if (result.error) {
      setError(result.error);
    } else {
      setDownloadActive(true);
      setDownloadType("model3ds");
      setDownloadStartedAt(Date.now());
      setProgress({});
    }
  }, []);
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
  if (!config) {
    return /* @__PURE__ */ u("main", { class: "property-loading", children: [
      /* @__PURE__ */ u("h1", { class: "visually-hidden", children: "Download" }),
      /* @__PURE__ */ u("div", { class: "spinner" })
    ] });
  }
  const needsUnlock = config.keyEncrypted && !config.keyUnlocked;
  const canDownload = config.hasKey && !needsUnlock;
  const downloadFromTitle = `Download from ${config.domain || "civitai.com"}`;
  return /* @__PURE__ */ u("main", { class: "main-content property-sheet", children: [
    /* @__PURE__ */ u("h1", { class: "visually-hidden", children: "Download" }),
    needsUnlock && /* @__PURE__ */ u("section", { class: "property-group unlock-section", children: [
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
      unlockError && /* @__PURE__ */ u("div", { class: "property-error", children: unlockError })
    ] }),
    /* @__PURE__ */ u("section", { class: "property-group", children: [
      /* @__PURE__ */ u("h2", { class: "property-heading", children: "Download Generations" }),
      /* @__PURE__ */ u(
        LastDownloadInfo,
        {
          isoDate: config.lastDownloadGenerations,
          warnDays: 25,
          expireDays: 30,
          online
        }
      ),
      /* @__PURE__ */ u(FilesNotSavedLine, { downloadMedia: config.downloadMedia }),
      /* @__PURE__ */ u("div", { class: "property-controls", children: [
        /* @__PURE__ */ u("div", { class: "mode-selector", children: [
          /* @__PURE__ */ u("fieldset", { class: "mode-cluster", children: [
            /* @__PURE__ */ u("legend", { class: "visually-hidden", children: "Download type" }),
            generationDownloadModes().filter((m) => m.value === "latest" || m.value === "missing-all").map((m) => /* @__PURE__ */ u("label", { class: "mode-btn", title: m.desc, children: [
              /* @__PURE__ */ u(
                "input",
                {
                  type: "radio",
                  name: "download-generations-type",
                  value: m.value,
                  checked: generationButtonOn(genSelection, m.value),
                  disabled: downloadActive && (m.value === "latest" || m.value === "missing-all"),
                  onChange: () => setGenOverride(applyGenerationSelection(genSelection, generationClick(m.value)))
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
                  checked: generationButtonOn(genSelection, m.value),
                  onChange: () => setGenOverride(applyGenerationSelection(genSelection, generationClick(m.value)))
                }
              ),
              m.label
            ] }, m.value))
          ] })
        ] }),
        downloadActive && downloadType === "generations" ? /* @__PURE__ */ u("button", { class: "action-btn stop-btn", onClick: handleAbort, children: "Stop" }) : /* @__PURE__ */ u("button", { class: "action-btn", onClick: handleStartGen, disabled: downloadActive || !online || !canDownload, title: downloadFromTitle, children: "Download" })
      ] }),
      downloadActive && downloadType === "generations" && /* @__PURE__ */ u(ProgressBar, { progress: progress || {}, type: "generations", startedAt: downloadStartedAt })
    ] }),
    /* @__PURE__ */ u("section", { class: "property-group", children: [
      /* @__PURE__ */ u("h2", { class: "property-heading", children: "Download Posts" }),
      /* @__PURE__ */ u(
        LastDownloadInfo,
        {
          isoDate: config.lastDownloadPosts,
          online
        }
      ),
      postsNeedGenerationData && /* @__PURE__ */ u("div", { class: "last-download-info", children: /* @__PURE__ */ u("span", { class: "last-download-warning", children: "Some posts are missing generation parameters. Choose All, then Download." }) }),
      /* @__PURE__ */ u(FilesNotSavedLine, { downloadMedia: config.downloadMedia }),
      /* @__PURE__ */ u("div", { class: "property-controls", children: [
        /* @__PURE__ */ u("fieldset", { class: "mode-selector", children: [
          /* @__PURE__ */ u("legend", { class: "visually-hidden", children: "Download posts" }),
          POST_MODES.map((m) => /* @__PURE__ */ u(
            "label",
            {
              class: "mode-btn",
              title: m.value === "all" && postsNeedGenerationData ? "Fills generation parameters on posts already saved" : m.desc,
              children: [
                /* @__PURE__ */ u(
                  "input",
                  {
                    type: "radio",
                    name: "download-posts",
                    value: m.value,
                    checked: postMode === m.value,
                    disabled: downloadActive,
                    onChange: () => setPostModeOverride(m.value)
                  }
                ),
                m.label
              ]
            },
            m.value
          ))
        ] }),
        downloadActive && downloadType === "posts" ? /* @__PURE__ */ u("button", { class: "action-btn stop-btn", onClick: handleAbort, children: "Stop" }) : /* @__PURE__ */ u("button", { class: "action-btn", onClick: handleStartPosts, disabled: downloadActive || !online || !canDownload, title: downloadFromTitle, children: "Download" })
      ] }),
      downloadActive && downloadType === "posts" && /* @__PURE__ */ u(ProgressBar, { progress: progress || {}, type: "posts", startedAt: downloadStartedAt })
    ] }),
    /* @__PURE__ */ u("section", { class: "property-group", children: [
      /* @__PURE__ */ u("h2", { class: "property-heading", children: "Download Comics" }),
      /* @__PURE__ */ u(
        LastDownloadInfo,
        {
          isoDate: config.lastDownloadComics,
          online
        }
      ),
      /* @__PURE__ */ u(FilesNotSavedLine, { downloadMedia: config.downloadMedia }),
      /* @__PURE__ */ u("div", { class: "property-controls", children: downloadActive && downloadType === "comics" ? /* @__PURE__ */ u("button", { class: "action-btn stop-btn", onClick: handleAbort, children: "Stop" }) : /* @__PURE__ */ u("button", { class: "action-btn", onClick: handleStartComics, disabled: downloadActive || !online || !canDownload, title: downloadFromTitle, children: "Download" }) }),
      downloadActive && downloadType === "comics" && /* @__PURE__ */ u(ProgressBar, { progress: progress || {}, type: "comics", startedAt: downloadStartedAt })
    ] }),
    /* @__PURE__ */ u("section", { class: "property-group", children: [
      /* @__PURE__ */ u("h2", { class: "property-heading", children: "Download 3D" }),
      /* @__PURE__ */ u(
        LastDownloadInfo,
        {
          isoDate: config.lastDownloadModel3ds,
          online
        }
      ),
      /* @__PURE__ */ u(FilesNotSavedLine, { downloadMedia: config.downloadMedia }),
      /* @__PURE__ */ u("div", { class: "property-controls", children: downloadActive && downloadType === "model3ds" ? /* @__PURE__ */ u("button", { class: "action-btn stop-btn", onClick: handleAbort, children: "Stop" }) : /* @__PURE__ */ u("button", { class: "action-btn", onClick: handleStartModel3ds, disabled: downloadActive || !online || !canDownload, title: downloadFromTitle, children: "Download" }) }),
      downloadActive && downloadType === "model3ds" && /* @__PURE__ */ u(ProgressBar, { progress: progress || {}, type: "model3ds", startedAt: downloadStartedAt })
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
    /* @__PURE__ */ u("section", { class: "property-group", children: [
      /* @__PURE__ */ u("h2", { class: "property-heading", children: "Files" }),
      /* @__PURE__ */ u("div", { class: "property", children: /* @__PURE__ */ u("fieldset", { class: "mode-selector", children: [
        /* @__PURE__ */ u("legend", { class: "visually-hidden", children: "Files" }),
        /* @__PURE__ */ u("label", { class: "mode-btn", children: [
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
        /* @__PURE__ */ u("label", { class: "mode-btn", children: [
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
      ] }) })
    ] }),
    lastResult && /* @__PURE__ */ u(ResultBanner, { result: lastResult }),
    error && /* @__PURE__ */ u("div", { class: "property-error", children: error }),
    config.allowAltDomain && (config.availableDomains || []).length > 1 && /* @__PURE__ */ u("section", { class: "property-group", children: [
      /* @__PURE__ */ u("h2", { class: "property-heading", children: "Civitai domain" }),
      /* @__PURE__ */ u("div", { class: "property", children: /* @__PURE__ */ u("fieldset", { class: "mode-selector", children: [
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
      ] }) })
    ] }),
    /* @__PURE__ */ u("div", { class: "property-pair", children: [
      /* @__PURE__ */ u(
        ModelCacheSection,
        {
          modelCache,
          downloadActive,
          error: modelCacheError,
          hasKey: config.hasKey,
          username: config.username,
          rebuilding,
          onRefresh: handleModelCacheRefresh,
          onAbort: handleModelCacheAbort,
          onRebuild: handleRebuild
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
    ] })
  ] });
}
function ApiKeyProperty({ hasKey, username }) {
  return /* @__PURE__ */ u("div", { class: "property", children: [
    /* @__PURE__ */ u("dt", { class: "property-name", children: "API key" }),
    /* @__PURE__ */ u("dd", { class: "property-value", children: hasKey ? `Configured${username ? ` \xB7 ${username}` : ""}` : "Not set" })
  ] });
}
function RebuildIndexButton({ rebuilding, onRebuild }) {
  return /* @__PURE__ */ u("button", { class: "action-btn secondary-btn", onClick: onRebuild, disabled: rebuilding, children: rebuilding ? "Rebuilding\u2026" : "Rebuild index" });
}
function ModelCacheSection({ modelCache, downloadActive, error, hasKey, username, rebuilding, onRefresh, onAbort, onRebuild }) {
  if (!modelCache) {
    return /* @__PURE__ */ u("section", { class: "property-group", children: [
      /* @__PURE__ */ u("h2", { class: "property-heading", children: "Account" }),
      /* @__PURE__ */ u("dl", { children: /* @__PURE__ */ u(ApiKeyProperty, { hasKey, username }) }),
      /* @__PURE__ */ u("div", { class: "property", children: /* @__PURE__ */ u("div", { class: "property-value", children: [
        "Loading",
        "\u2026"
      ] }) }),
      /* @__PURE__ */ u("div", { class: "property-actions", children: /* @__PURE__ */ u(RebuildIndexButton, { rebuilding, onRebuild }) })
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
      /* @__PURE__ */ u(ApiKeyProperty, { hasKey, username }),
      /* @__PURE__ */ u("div", { class: "property", children: [
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
      isRunning && activeProgress && /* @__PURE__ */ u("div", { class: "property", children: [
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
    /* @__PURE__ */ u("div", { class: "property-actions", children: [
      isRunning ? /* @__PURE__ */ u("button", { class: "action-btn secondary-btn", onClick: onAbort, children: "Cancel refresh" }) : /* @__PURE__ */ u(
        "button",
        {
          class: "action-btn secondary-btn",
          onClick: onRefresh,
          disabled: downloadActive,
          title: downloadActive ? "Disabled while a download is in progress" : "Re-fetch cached model versions, then this account's models",
          children: "Refresh models"
        }
      ),
      /* @__PURE__ */ u(RebuildIndexButton, { rebuilding, onRebuild })
    ] })
  ] });
}
function ProgressBar({ progress, type, startedAt }) {
  const isGen = type === "generations";
  const isComics = type === "comics";
  const isModel3ds = type === "model3ds";
  const newCount = isGen ? progress.generationsNew || 0 : isComics ? progress.comicsNew || 0 : isModel3ds ? progress.model3dsNew || 0 : progress.postsNew || 0;
  const newLabel = isGen ? "new generation" : isComics ? "new comic" : "new post";
  const images = isModel3ds ? 0 : progress.imagesSaved || 0;
  const videos = isComics || isModel3ds ? 0 : progress.videosSaved || 0;
  const audio = isComics || isModel3ds ? 0 : progress.audioSaved || 0;
  const model3d = isGen ? progress.model3dSaved || 0 : 0;
  const filesSaved = isModel3ds ? progress.filesSaved || 0 : 0;
  const itemNoun = isGen ? "item" : isComics ? "comic" : isModel3ds ? "3D" : "post";
  const activityText = formatActivity(progress.activity, { itemNoun });
  const [now, setNow] = d(Date.now());
  y(() => {
    const id = setInterval(() => setNow(Date.now()), 1e3);
    return () => clearInterval(id);
  }, []);
  const elapsed = formatElapsed(startedAt ? now - startedAt : progress.elapsed || 0);
  const parts = [];
  if (newCount > 0) parts.push(isModel3ds ? `${newCount} new 3D` : plural(newCount, newLabel));
  if (images > 0) parts.push(plural(images, "image"));
  if (videos > 0) parts.push(plural(videos, "video"));
  if (audio > 0) parts.push(plural(audio, "audio file"));
  if (model3d > 0) parts.push(`${model3d} 3D`);
  if (filesSaved > 0) parts.push(plural(filesSaved, "file"));
  return /* @__PURE__ */ u("div", { class: "progress-bar", children: [
    /* @__PURE__ */ u("div", { class: "progress-indicator", children: [
      /* @__PURE__ */ u("div", { class: "progress-pulse" }),
      /* @__PURE__ */ u("span", { class: "progress-status", children: [
        "Downloading",
        activityText ? ` \xB7 ${activityText}` : "\u2026"
      ] })
    ] }),
    /* @__PURE__ */ u("div", { class: "progress-details", children: [
      parts.length > 0 && /* @__PURE__ */ u("span", { class: "progress-counts", children: parts.join(" \xB7 ") }),
      /* @__PURE__ */ u("span", { class: "progress-elapsed", children: elapsed })
    ] })
  ] });
}
function LastDownloadInfo({ isoDate, warnDays, expireDays, online }) {
  const days = calendarDaysAgo(isoDate);
  const text = relativeTime(isoDate);
  return /* @__PURE__ */ u("div", { class: "last-download-info", children: [
    !online && /* @__PURE__ */ u("span", { class: "offline-badge", children: "Offline" }),
    days != null ? /* @__PURE__ */ u("span", { class: expireDays && days >= expireDays ? "last-download-expired" : warnDays && days >= warnDays ? "last-download-warning" : "last-download-ok", children: [
      "Last downloaded ",
      /* @__PURE__ */ u(TimeText, { at: isoDate, children: text }),
      expireDays && days >= expireDays && " \u2014 generations may have expired!",
      warnDays && days >= warnDays && days < expireDays && " \u2014 download soon to avoid expiry"
    ] }) : /* @__PURE__ */ u("span", { class: "last-download-never", children: "Never downloaded" })
  ] });
}
function ResultBanner({ result }) {
  const isAborted = result.status === "aborted";
  const isError = result.status === "error";
  const isGen = result.type === "generations";
  const isComics = result.type === "comics";
  const isModel3ds = result.type === "model3ds";
  const newCount = isGen ? result.generationsNew || 0 : isComics ? result.comicsNew || 0 : isModel3ds ? result.model3dsNew || 0 : result.postsNew || 0;
  const newLabel = isGen ? "new generation" : isComics ? "new comic" : "new post";
  const images = isModel3ds ? 0 : result.imagesSaved || 0;
  const videos = isComics || isModel3ds ? 0 : result.videosSaved || 0;
  const audio = isComics || isModel3ds ? 0 : result.audioSaved || 0;
  const model3d = isGen ? result.model3dSaved || 0 : 0;
  const filesSaved = isModel3ds ? result.filesSaved || 0 : 0;
  const elapsed = formatElapsed(result.elapsed);
  const hasData = newCount > 0 || images > 0 || videos > 0 || audio > 0 || model3d > 0 || filesSaved > 0;
  let statusClass = "success";
  let statusText = "Download complete";
  if (isAborted) {
    statusClass = "warning";
    statusText = "Download stopped";
  }
  if (isError) {
    statusClass = "error";
    statusText = "Download failed";
  }
  if (!hasData && !isAborted && !isError) statusText = "Up to date";
  const parts = [];
  if (newCount > 0) parts.push(isModel3ds ? `${newCount} new 3D` : plural(newCount, newLabel));
  if (images > 0) parts.push(plural(images, "image"));
  if (videos > 0) parts.push(plural(videos, "video"));
  if (audio > 0) parts.push(plural(audio, "audio file"));
  if (model3d > 0) parts.push(`${model3d} 3D`);
  if (filesSaved > 0) parts.push(plural(filesSaved, "file"));
  const errorMsg = isError && result.message ? result.message : null;
  return /* @__PURE__ */ u("div", { class: `result-banner ${statusClass}`, children: [
    /* @__PURE__ */ u("span", { class: "result-status", children: statusText }),
    errorMsg && /* @__PURE__ */ u("span", { class: "result-error-msg", children: errorMsg }),
    parts.length > 0 && /* @__PURE__ */ u("span", { class: "result-counts", children: parts.join(" \xB7 ") }),
    /* @__PURE__ */ u("span", { class: "result-elapsed", children: elapsed })
  ] });
}
export {
  DownloadView
};
