import {
  ActiveMesh,
  MeshViewport,
  meshIsLarge,
  useMeshHost,
  useMeshViewerPref
} from "./chunk-S4CYIVDO.js";
import {
  detailFacts,
  entityHeaderLabel,
  jobResolutionLabel,
  model3dFileRows,
  model3dShownFormat,
  model3dSizeText,
  snapshotFromRaw,
  viewableMeshFiles
} from "./chunk-BFBNWV6Z.js";
import {
  Gallery
} from "./chunk-4QKRDROH.js";
import {
  useGalleryData
} from "./chunk-XAVY4HKU.js";
import "./chunk-OGIDMYFE.js";
import "./chunk-E2TIMOIW.js";
import {
  PublishedAs3d
} from "./chunk-FAVWLZQ2.js";
import {
  browsingLevelLabel,
  tagsWithoutRating
} from "./chunk-HDLQKIU7.js";
import {
  ModelMembership,
  OriginSiblingNav,
  RelatedStrip,
  WorkflowSection,
  civitaiInstanceLabels,
  comicAccessChips,
  comicPublication,
  detailCacheKey,
  downloadTitle,
  loadMediaDetail,
  mediaFileCopy,
  mediaNoun,
  onModelsLinkClick,
  postAccessChips,
  prefetchOriginNeighbours,
  useHeldDetail,
  usedInCaption,
  workflowSidebarLine
} from "./chunk-7ZEO5E2E.js";
import {
  DetailMain,
  DetailPage,
  EntityHeader
} from "./chunk-4CEGATO7.js";
import {
  composeDetailResources,
  generatorFamilyModelBlock,
  modelsOriginReturnHref
} from "./chunk-J6EACQEJ.js";
import {
  useMagicEscape
} from "./chunk-LHE46PZX.js";
import {
  OpenFolderButton,
  OpenJsonButton
} from "./chunk-W7BMSFDW.js";
import "./chunk-7EKUSVIB.js";
import {
  originMembershipKind
} from "./chunk-XWICPOXM.js";
import "./chunk-5XDJYGJC.js";
import {
  HighlightText
} from "./chunk-MY736RCS.js";
import "./chunk-XQGXV6CL.js";
import {
  useOwnModelsRevision
} from "./chunk-HMX5XSAI.js";
import "./chunk-3Y4VDHN5.js";
import {
  canonicalMediaRouteId,
  containerResetQuery,
  memberMediaHref,
  openOriginNode,
  openStepperSibling,
  originFetchQuery,
  readHistoryAnchorSlot,
  readHistoryBag,
  relatedOriginHref,
  usedInConsumerHref
} from "./chunk-DDUI6F2D.js";
import {
  TimeText,
  chipDatetime,
  containerEdgeHeading,
  containerEdgeRowParts,
  copyToClipboard,
  coverStillPath,
  formatDate,
  inputMediaCaptions,
  isAudioCover,
  mediaStageStyle,
  nextTagsForReaction,
  normalizeMediaId,
  postStatusLabel,
  reactionMarks,
  tagCssClass,
  tagLabel
} from "./chunk-INNL2V6Q.js";
import {
  completeAuthoredParams,
  formatUrl,
  getRoute,
  parseUrl,
  pushState,
  replaceState
} from "./chunk-Z6L3MMX7.js";
import {
  A,
  T,
  _2 as _,
  d,
  getComic,
  getGeneration,
  getMedia,
  getMediaDetail,
  getPost,
  k,
  q,
  setReaction,
  u,
  useDocumentTitle,
  y
} from "./chunk-QDJYYBZC.js";

// dev/ui/src/lib/ace-audio.js
function isAceAudioParams(params) {
  if (!params || typeof params !== "object") return false;
  if (params.workflow === "txt2music") return true;
  const mode = params.aceAudioMode;
  return mode === "simple" || mode === "custom";
}
function asString(value) {
  if (value == null) return "";
  return String(value);
}
function asNumber(value) {
  if (value == null || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
}
function coverKind(params) {
  if (params.generateCover === true) return "generated";
  if (Array.isArray(params.images) && params.images.length > 0) return "uploaded";
  return "none";
}
function aceMode(params) {
  const mode = params.aceAudioMode;
  return mode === "simple" || mode === "custom" ? mode : "";
}
function projectAudioParams(params) {
  if (!isAceAudioParams(params)) return null;
  const mode = aceMode(params);
  return {
    mode,
    cover: coverKind(params),
    simplePrompt: mode === "simple" ? asString(params.prompt) : "",
    musicDescription: asString(params.musicDescription),
    lyrics: asString(params.lyrics),
    title: asString(params.title),
    bpm: asNumber(params.bpm),
    key: asString(params.key),
    duration: asNumber(params.duration),
    cfgScale: asNumber(params.cfgScale),
    steps: asNumber(params.steps),
    instrumentalWeight: asNumber(params.instrumentalWeight),
    vocalWeight: asNumber(params.vocalWeight),
    seed: asNumber(params.seed)
  };
}

// dev/ui/src/components/Lightbox.jsx
var DRAG_SLOP_PX = 5;
function ZoomImage({ src, onClose }) {
  const gesture = A({ x: 0, y: 0, dragged: false, armed: false, timer: 0, stop: null });
  const cancelClear = () => {
    const g = gesture.current;
    if (!g.timer) return;
    clearTimeout(g.timer);
    g.timer = 0;
  };
  const scheduleClear = () => {
    cancelClear();
    const g = gesture.current;
    g.timer = setTimeout(() => {
      g.timer = 0;
      g.dragged = false;
      g.armed = false;
    }, 50);
  };
  y(() => () => {
    gesture.current.stop?.();
    cancelClear();
  }, []);
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    gesture.current.stop?.();
    cancelClear();
    const g = gesture.current;
    g.x = e.clientX;
    g.y = e.clientY;
    g.dragged = false;
    g.armed = true;
    const move = (ev) => {
      if (Math.hypot(ev.clientX - g.x, ev.clientY - g.y) >= DRAG_SLOP_PX) g.dragged = true;
    };
    const end = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      if (g.stop === end) g.stop = null;
      if (g.dragged) scheduleClear();
    };
    g.stop = end;
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
  };
  const onClick = (e) => {
    e.stopPropagation();
    const g = gesture.current;
    const moved = g.armed && Math.hypot(e.clientX - g.x, e.clientY - g.y) >= DRAG_SLOP_PX;
    const wasDrag = g.dragged || moved;
    g.dragged = false;
    g.armed = false;
    cancelClear();
    if (wasDrag) return;
    onClose();
  };
  return /* @__PURE__ */ u(
    "img",
    {
      src,
      alt: "Image",
      title: "Close",
      onPointerDown,
      onDragStart: () => {
        gesture.current.dragged = true;
      },
      onDragEnd: scheduleClear,
      onClick
    },
    src
  );
}
function Lightbox({ src, type, audioCover, width, height, aspectClass, coverPath, onClose, yieldEscape, mesh, meshReady, children }) {
  const handleKey = q((e) => {
    if (e.key !== "Escape") return;
    e.stopImmediatePropagation();
    if (typeof yieldEscape === "function" && yieldEscape()) {
      onClose();
      return;
    }
    e.preventDefault();
    onClose();
  }, [onClose, yieldEscape]);
  y(() => {
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [handleKey]);
  const isVideo = type === "video";
  const isAudio = type === "audio";
  const closeIfPad = (e) => {
    if (e.target === e.currentTarget) onClose();
  };
  const stageStyle = mediaStageStyle({ width, height, aspectClass });
  const poster = coverStillPath({ coverPath });
  const stage = (node) => stageStyle ? /* @__PURE__ */ u("div", { class: "media-stage", style: stageStyle, children: node }) : node;
  let media = null;
  if (type === "model3d" && mesh) {
    media = /* @__PURE__ */ u(
      MeshViewport,
      {
        stillSrc: src || "",
        enabled: mesh.enabled,
        onToggle: mesh.onToggle,
        viewable: mesh.viewable,
        selectedPath: mesh.selectedPath,
        onSelect: mesh.onSelect,
        notice: mesh.notice,
        large: mesh.large,
        slotRef: mesh.expandSlotRef,
        onStillClick: meshReady ? void 0 : onClose
      }
    );
  } else if (isAudio && !audioCover) {
    media = /* @__PURE__ */ u("div", { class: "detail-audio", children: [
      /* @__PURE__ */ u("div", { class: "audio-placeholder detail-audio-art", children: /* @__PURE__ */ u("span", { class: "audio-glyph", children: "\u266B" }) }),
      src ? /* @__PURE__ */ u("audio", { src, controls: true, autoPlay: true }, src) : null
    ] });
  } else if (isAudio || isVideo) {
    media = src ? stage(/* @__PURE__ */ u("video", { src, poster: poster || void 0, controls: true, autoPlay: true }, src)) : null;
  } else if (type === "model3d" && !src) {
    media = /* @__PURE__ */ u("div", { class: "audio-placeholder detail-audio-art", children: /* @__PURE__ */ u("span", { class: "model3d-mark", children: "3D" }) });
  } else {
    media = src ? stage(/* @__PURE__ */ u(ZoomImage, { src, onClose })) : null;
  }
  return /* @__PURE__ */ u(k, { children: [
    /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        class: "media-fullscreen-close",
        onClick: (e) => {
          e.stopPropagation();
          onClose();
        },
        "aria-label": "Close",
        title: "Close",
        children: "\u2715"
      }
    ),
    /* @__PURE__ */ u(DetailMain, { align: "center", onPadClick: closeIfPad, landmark: false, chrome: children, children: media })
  ] });
}

// dev/ui/src/lib/container-member.js
function memberCursor(ids, currentId) {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const current = normalizeMediaId(currentId);
  if (!current) return null;
  const folded = [];
  for (const raw of ids) {
    const id = normalizeMediaId(raw);
    if (folded.length > 0 && folded[folded.length - 1] === id) continue;
    folded.push(id);
  }
  const index = folded.findIndex((id) => id === current);
  if (index < 0) return null;
  const n = folded.length;
  return {
    index,
    n,
    prevId: index > 0 ? folded[index - 1] : null,
    nextId: index < n - 1 ? folded[index + 1] : null
  };
}
function mapMemberIdsToCanonical(ids, canonicalIdFor) {
  if (!Array.isArray(ids)) return [];
  const out = [];
  for (const raw of ids) {
    const n = normalizeMediaId(raw);
    if (!n) continue;
    const mapped = canonicalIdFor ? canonicalIdFor(n) : n;
    out.push(normalizeMediaId(mapped) || n);
  }
  return out;
}
function panelSelectId(m) {
  if (!m) return "";
  if (m.mediaId != null && m.mediaId !== "") return String(m.mediaId);
  if (m.panelMediaId) return String(m.panelMediaId);
  if (m.imageId != null) return normalizeMediaId(m.imageId);
  if (m.panelId != null) return `comic-panel:${m.panelId}`;
  return "";
}
function comicReadingIds(comic) {
  if (!comic || !Array.isArray(comic.media)) return [];
  const chapters = Array.isArray(comic.chapters) ? comic.chapters.filter((ch) => ch && ch.id != null).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) : [];
  const panels = comic.media.filter((m) => m && m.role !== "cover" && m.role !== "hero");
  const out = [];
  function pushPanel(m) {
    const id = panelSelectId(m);
    if (id) out.push(id);
  }
  if (chapters.length === 0) {
    panels.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).forEach(pushPanel);
    return out;
  }
  for (const ch of chapters) {
    panels.filter((m) => m.chapterId === ch.id).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).forEach(pushPanel);
  }
  return out;
}

// dev/ui/src/lib/native-fullscreen.js
function createFullscreenSession() {
  return { phase: "off", token: 0 };
}
function fullscreenElementOf(doc) {
  try {
    return doc ? doc.fullscreenElement : null;
  } catch {
    return null;
  }
}
function owns(session) {
  return session.phase === "pending" || session.phase === "entered";
}
function exitDocumentFullscreen(doc) {
  try {
    if (!doc || !fullscreenElementOf(doc) || typeof doc.exitFullscreen !== "function") {
      return Promise.resolve();
    }
    const pending = doc.exitFullscreen();
    const promise = pending && typeof pending.then === "function" ? pending : Promise.resolve();
    return promise.then(() => {
    }, () => {
    });
  } catch {
    return Promise.resolve();
  }
}
function settle(session, doc, el, token) {
  try {
    if (session.token !== token) {
      if (session.phase === "off" && fullscreenElementOf(doc) === el) {
        exitDocumentFullscreen(doc);
      }
      return false;
    }
    const ok = fullscreenElementOf(doc) === el;
    session.phase = ok ? "entered" : "off";
    return ok;
  } catch {
    if (session.token === token) session.phase = "off";
    return false;
  }
}
function requestElementFullscreen(session, doc, el) {
  if (!el) return Promise.resolve(false);
  try {
    if (fullscreenElementOf(doc)) return Promise.resolve(false);
    if (!doc || doc.fullscreenEnabled === false) return Promise.resolve(false);
    if (typeof el.requestFullscreen !== "function") return Promise.resolve(false);
  } catch {
    return Promise.resolve(false);
  }
  const token = ++session.token;
  session.phase = "pending";
  let pending;
  try {
    pending = el.requestFullscreen();
  } catch {
    if (session.token === token) session.phase = "off";
    return Promise.resolve(false);
  }
  const promise = pending && typeof pending.then === "function" ? pending : Promise.resolve();
  return promise.then(
    () => settle(session, doc, el, token),
    () => settle(session, doc, el, token)
  );
}
function yieldFullscreenEscape(session, doc) {
  return owns(session) && !!fullscreenElementOf(doc);
}
function releaseDocumentFullscreen(session, doc) {
  const owned = owns(session);
  session.token += 1;
  session.phase = "off";
  if (!owned) return Promise.resolve();
  return exitDocumentFullscreen(doc);
}
function fullscreenSessionEnded(session, doc) {
  if (!owns(session)) return false;
  if (fullscreenElementOf(doc)) return false;
  session.token += 1;
  session.phase = "off";
  return true;
}

// dev/ui/src/lib/sidebar-paint.js
function sidebarPaint(detail, fallback, mediaId, fallbackRaw) {
  const want = normalizeMediaId(mediaId);
  if (!want) return { index: null, raw: null };
  const fromDetail = detail && detail.index;
  if (fromDetail && normalizeMediaId(fromDetail.id) === want) {
    return { index: fromDetail, raw: detail.raw ?? null };
  }
  if (fallback && normalizeMediaId(fallback.id) === want) {
    return { index: fallback, raw: fallbackRaw ?? null };
  }
  return { index: null, raw: null };
}

// dev/ui/src/components/MediaDetail.jsx
function model3dBytesFor(index, filePath) {
  const files = Array.isArray(index && index.files) ? index.files : [];
  for (const file of files) {
    if (file && file.path === filePath && typeof file.bytes === "number") return file.bytes;
  }
  if (index && index.mediaPath === filePath && typeof index.bytes === "number") return index.bytes;
  return void 0;
}
function uniqueById(list) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const sorted = list.filter((item) => item && item.id != null && item.id !== "").slice().sort((a, b) => String(b.sortKey || "").localeCompare(String(a.sortKey || "")));
  const seen = /* @__PURE__ */ new Map();
  for (const item of sorted) {
    const key = String(item.id);
    if (!seen.has(key)) seen.set(key, item);
  }
  return [...seen.values()];
}
function containerHref(kind, id) {
  if (id == null || id === "") return "";
  const view = kind === "generation" ? "generations" : kind === "post" ? "posts" : kind === "comic" ? "comics" : null;
  if (!view) return "";
  return formatUrl({
    view,
    entityId: String(id),
    modelTrail: null,
    params: containerResetQuery(kind)
  });
}
var MEMBER_NAV_LABEL = {
  generation: "In this generation",
  post: "In this post",
  comic: "In this comic"
};
function generationMemberRows(data) {
  const media = data && data.index && data.index.media;
  if (!Array.isArray(media)) return [];
  const out = [];
  for (const m of media) {
    if (!m || m.mediaId == null || m.mediaId === "") continue;
    const id = normalizeMediaId(m.mediaId);
    if (!id) continue;
    out.push({
      id,
      inWalk: m.inWalk === true,
      slot: m.slot != null && m.slot !== "" ? m.slot : null,
      slotInUrl: m.slotInUrl === true
    });
  }
  return out;
}
function postMemberRows(data) {
  const media = data && data.index && data.index.media;
  if (!Array.isArray(media)) return [];
  const out = [];
  for (const m of media) {
    const rawId = m?.mediaId != null && m.mediaId !== "" ? m.mediaId : m?.imageId;
    if (!m || rawId == null || rawId === "") continue;
    const id = normalizeMediaId(rawId);
    if (!id) continue;
    out.push({
      id,
      inWalk: m.inWalk === true,
      slot: m.slot != null && m.slot !== "" ? m.slot : null,
      slotInUrl: m.slotInUrl === true
    });
  }
  return out;
}
function comicMemberRows(data) {
  const index = data && data.index;
  if (!index || !Array.isArray(index.media)) return [];
  const ids = comicReadingIds(index);
  const byId = /* @__PURE__ */ new Map();
  for (const m of index.media) {
    if (!m || m.role === "cover" || m.role === "hero") continue;
    let sid = "";
    if (m.mediaId != null && m.mediaId !== "") sid = String(m.mediaId);
    else if (m.panelMediaId) sid = String(m.panelMediaId);
    else if (m.imageId != null) sid = normalizeMediaId(m.imageId);
    else if (m.panelId != null) sid = `comic-panel:${m.panelId}`;
    if (!sid) continue;
    if (!byId.has(sid)) {
      byId.set(sid, {
        inWalk: m.inWalk === true,
        slot: m.slot != null && m.slot !== "" ? m.slot : null,
        slotInUrl: m.slotInUrl === true
      });
    }
  }
  return ids.map((id) => {
    const stamp = byId.get(id) || { inWalk: false, slot: null, slotInUrl: false };
    return {
      id,
      inWalk: stamp.inWalk,
      slot: stamp.slot,
      slotInUrl: stamp.slotInUrl === true
    };
  });
}
async function canonicalizeMemberIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const unique = [...new Set(ids.map((id) => normalizeMediaId(id)).filter(Boolean))];
  const canonicalByAlias = /* @__PURE__ */ new Map();
  await Promise.all(unique.map(async (id) => {
    try {
      const data = await getMediaDetail(id);
      const canonical = normalizeMediaId(data && data.index && data.index.id);
      canonicalByAlias.set(id, canonical || id);
    } catch {
      canonicalByAlias.set(id, id);
    }
  }));
  return mapMemberIdsToCanonical(ids, (id) => canonicalByAlias.get(id) || id);
}
async function canonicalizeMemberRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const canonical = await canonicalizeMemberIds(ids);
  return rows.map((r, i) => ({
    id: canonical[i] || r.id,
    inWalk: r.inWalk,
    slot: r.slot,
    slotInUrl: r.slotInUrl === true
  }));
}
function fetchContainerMembers(kind, id, originParams) {
  const q2 = originParams || {};
  if (kind === "generation") {
    return getGeneration(id, q2).then(generationMemberRows);
  }
  if (kind === "post") {
    return getPost(id, q2).then(postMemberRows).then(canonicalizeMemberRows);
  }
  if (kind === "comic") {
    return getComic(id, q2).then(comicMemberRows).then(canonicalizeMemberRows);
  }
  return Promise.resolve([]);
}
function foldMemberRows(rows) {
  const out = [];
  for (const r of rows) {
    if (!r || !r.id) continue;
    if (out.length > 0 && out[out.length - 1].id === r.id) continue;
    out.push(r);
  }
  return out;
}
function shouldFetchContainerMembers(kind, item) {
  if (!item || item.id == null || item.id === "") return false;
  if (kind === "generation") {
    const n = Number(item.batchSize);
    if (Number.isFinite(n) && n < 2) return false;
  }
  return true;
}
function ContainerMemberNav({ kind, item, mediaId, params, cacheRef, origin }) {
  const containerId = item && item.id;
  const batchSize = item && item.batchSize;
  const originParams = originFetchQuery(params);
  const originKey = JSON.stringify(originParams);
  const cacheKey = `${kind}:${containerId}:${originKey}`;
  const [rows, setRows] = d(() => cacheRef && cacheRef.current && cacheRef.current.has(cacheKey) ? cacheRef.current.get(cacheKey) : null);
  y(() => {
    const fetchItem = { id: containerId, batchSize };
    if (!shouldFetchContainerMembers(kind, fetchItem)) {
      setRows(null);
      return void 0;
    }
    const key = `${kind}:${containerId}:${originKey}`;
    if (cacheRef && cacheRef.current && cacheRef.current.has(key)) {
      setRows(cacheRef.current.get(key));
      return void 0;
    }
    let cancelled = false;
    fetchContainerMembers(kind, containerId, originParams).then((list) => {
      const next = Array.isArray(list) ? list : [];
      if (cacheRef && cacheRef.current) cacheRef.current.set(key, next);
      if (!cancelled) setRows(next);
    }).catch(() => {
      if (cacheRef && cacheRef.current) cacheRef.current.set(key, []);
      if (!cancelled) setRows([]);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, containerId, batchSize, cacheRef, originKey]);
  if (!shouldFetchContainerMembers(kind, item)) return null;
  const label = MEMBER_NAV_LABEL[kind];
  if (!label || !Array.isArray(rows)) return null;
  const folded = foldMemberRows(rows);
  const cursor = memberCursor(folded.map((r) => r.id), mediaId);
  if (!cursor || cursor.n < 2) return null;
  const leaveSlot = params && params.slot || origin && origin.slot || null;
  const placement = origin && origin.placement;
  let pos = cursor.index;
  if (leaveSlot) {
    const want = normalizeMediaId(mediaId);
    for (let i = 0; i < folded.length; i++) {
      if (folded[i].id === want && folded[i].slot === leaveSlot) {
        pos = i;
        break;
      }
    }
  }
  const prevRow = pos > 0 ? folded[pos - 1] : null;
  const nextRow = pos >= 0 && pos < folded.length - 1 ? folded[pos + 1] : null;
  function hrefFor(row) {
    if (!row) return "";
    const originView = params && params.from || origin && origin.scope || null;
    if (row.inWalk && row.slot) {
      return memberMediaHref(row.id, params, {
        slot: row.slot,
        originView,
        slotInUrl: row.slotInUrl
      });
    }
    return memberMediaHref(row.id, params, { dropSlot: true, originView });
  }
  function onHop(e, row) {
    if (!row) {
      e.preventDefault();
      return;
    }
    const href = hrefFor(row);
    if (!href) {
      e.preventDefault();
      return;
    }
    if (row.inWalk) {
      openOriginNode(e, { href, bag: { anchorSlot: null } });
      return;
    }
    openStepperSibling(e, href, { leaveSlot, placement });
  }
  const prevHref = hrefFor(prevRow);
  const nextHref = hrefFor(nextRow);
  return /* @__PURE__ */ u("div", { class: "container-member-nav", children: [
    /* @__PURE__ */ u(
      "a",
      {
        class: "container-member-nav-arrow",
        href: prevHref || void 0,
        "aria-label": `Previous \xB7 ${label}`,
        "aria-disabled": !prevHref ? "true" : void 0,
        onClick: (e) => onHop(e, prevRow),
        children: "\u2039"
      }
    ),
    /* @__PURE__ */ u("span", { class: "container-member-nav-pos", children: `${pos + 1} of ${cursor.n}` }),
    /* @__PURE__ */ u(
      "a",
      {
        class: "container-member-nav-arrow",
        href: nextHref || void 0,
        "aria-label": `Next \xB7 ${label}`,
        "aria-disabled": !nextHref ? "true" : void 0,
        onClick: (e) => onHop(e, nextRow),
        children: "\u203A"
      }
    )
  ] });
}
function ContainerEdgeList({ kind, items, textFor, mediaId, params, pageFiles, cacheRef, origin, originKind }) {
  const heading = containerEdgeHeading(kind, items.length);
  if (!heading) return null;
  const soleHref = items.length === 1 ? containerHref(kind, items[0].id) : "";
  const sectionClass = originKind === kind ? "meta-section meta-section-origin" : "meta-section";
  const memberNav = (item) => pageFiles ? /* @__PURE__ */ u(
    ContainerMemberNav,
    {
      kind,
      item,
      mediaId,
      params,
      cacheRef,
      origin
    }
  ) : null;
  if (soleHref) {
    const item = items[0];
    return /* @__PURE__ */ u("div", { class: sectionClass, children: [
      /* @__PURE__ */ u(
        "a",
        {
          class: "meta-sole-link",
          href: soleHref,
          onClick: (e) => onModelsLinkClick(e, soleHref),
          children: [
            /* @__PURE__ */ u("h2", { class: "meta-label meta-label-link", children: heading }),
            /* @__PURE__ */ u("span", { class: "meta-edge-row", children: textFor(item) })
          ]
        }
      ),
      memberNav(item)
    ] });
  }
  return /* @__PURE__ */ u("div", { class: sectionClass, children: [
    /* @__PURE__ */ u("h2", { class: "meta-label", children: heading }),
    /* @__PURE__ */ u("div", { class: "meta-edge-list", children: items.map((item) => {
      const href = containerHref(kind, item.id);
      return /* @__PURE__ */ u("div", { class: "meta-edge-item", children: [
        /* @__PURE__ */ u(
          "a",
          {
            class: "meta-edge-row",
            href,
            onClick: (e) => onModelsLinkClick(e, href),
            children: textFor(item)
          }
        ),
        memberNav(item)
      ] }, String(item.id));
    }) })
  ] });
}
function pushKeepingHistoryBag(e, href) {
  if (!e || !href) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const path = String(href).startsWith("/") ? href : `/${href}`;
  const parsed = parseUrl(path);
  const current = getRoute();
  pushState({
    view: parsed.view,
    entityId: parsed.entityId,
    modelTrail: parsed.modelTrail,
    params: completeAuthoredParams(current.params, parsed.params)
  }, readHistoryBag());
}
function mediaPageHref(entityId, params) {
  return formatUrl({
    view: "media",
    entityId,
    modelTrail: null,
    params: params || {}
  });
}
function withUsedIn(params, open) {
  const next = { ...params || {} };
  if (open) next.usedIn = "1";
  else delete next.usedIn;
  return next;
}
function MediaDetail({
  mediaId,
  search,
  fallback,
  fallbackRaw,
  onTagsChange,
  onExpand,
  showReactions = true,
  reactionKeyRef,
  occurrenceGenerationId,
  fileOrigin,
  originContainerId,
  jsonSource,
  onJsonId,
  pageFiles,
  params,
  pageClass = "",
  band = false,
  mesh = null,
  children
}) {
  const [copied, setCopied] = d({ id: "", label: null });
  const [detail, setDetail] = d(null);
  const [reactionEdit, setReactionEdit] = d(null);
  const memberCacheRef = A(/* @__PURE__ */ new Map());
  const originQueryKey = JSON.stringify(originFetchQuery(params));
  const anchorSlot = readHistoryAnchorSlot();
  const fetchKey = `${originQueryKey}|${anchorSlot || ""}`;
  y(() => {
    if (!mediaId) return void 0;
    const want = normalizeMediaId(mediaId);
    if (fallback && normalizeMediaId(fallback.id) === want) {
      setDetail({ index: fallback, raw: fallbackRaw ?? null });
      return void 0;
    }
    let cancelled = false;
    const anchor = readHistoryAnchorSlot();
    getMediaDetail(mediaId, {
      generation: occurrenceGenerationId,
      origin: fileOrigin,
      post: fileOrigin === "post" ? originContainerId : void 0,
      comic: fileOrigin === "comic" ? originContainerId : void 0,
      ...originFetchQuery(params),
      ...anchor ? { anchor } : {}
    }).then((d2) => {
      if (!cancelled) setDetail(d2);
    }).catch(() => {
      if (!cancelled) setDetail({ index: null, raw: null });
    });
    return () => {
      cancelled = true;
    };
  }, [mediaId, occurrenceGenerationId, fileOrigin, originContainerId, fetchKey, params, fallback, fallbackRaw]);
  const painted = sidebarPaint(detail, fallback, mediaId, fallbackRaw);
  const index = painted.index;
  const raw = painted.raw;
  const origin = index && index.origin || fallback && fallback.origin || null;
  const originScope = params && params.from || origin && origin.scope || null;
  const originKind = originMembershipKind(originScope);
  const itemKey = mediaId || "";
  const tags = reactionEdit && reactionEdit.id === itemKey ? reactionEdit.tags : reactionMarks(index);
  const copiedLabel = copied.id === itemKey ? copied.label : null;
  y(() => {
    if (!onJsonId) return void 0;
    const id = occurrenceGenerationId || index?.containers?.generation?.id;
    if (id) onJsonId(id);
    return void 0;
  }, [onJsonId, occurrenceGenerationId, index]);
  const applyReaction = q((edit) => {
    if (!itemKey) return;
    const prevTags = tags;
    const next = nextTagsForReaction(prevTags, edit);
    setReactionEdit({ id: itemKey, tags: next });
    if (onTagsChange) onTagsChange(itemKey, next);
    setReaction(itemKey, edit).then((res) => {
      const settled = res && res.ok && Array.isArray(res.tags) ? res.tags : prevTags;
      setReactionEdit((current) => current && current.id === itemKey ? { id: itemKey, tags: settled } : current);
      if (onTagsChange) onTagsChange(itemKey, settled);
    }).catch(() => {
      setReactionEdit((current) => current && current.id === itemKey ? { id: itemKey, tags: prevTags } : current);
      if (onTagsChange) onTagsChange(itemKey, prevTags);
    });
  }, [itemKey, tags, onTagsChange]);
  y(() => {
    if (!reactionKeyRef) return void 0;
    reactionKeyRef.current = (key) => {
      if (key === "f") applyReaction({ favorite: !tags.includes("favorite") });
      else if (key === "l") applyReaction({ feedback: tags.includes("feedback:liked") ? null : "liked" });
      else if (key === "d") applyReaction({ feedback: tags.includes("feedback:disliked") ? null : "disliked" });
    };
    return () => {
      reactionKeyRef.current = null;
    };
  }, [reactionKeyRef, applyReaction, tags]);
  const cur = {
    type: index && index.type || fallback && fallback.type,
    thumbnailPath: index && index.thumbnailPath || fallback && fallback.thumbnailPath,
    tags,
    duration: index?.duration ?? fallback?.duration,
    seed: index?.seed ?? fallback?.seed
  };
  const isVideo = cur.type === "video";
  const isAudio = cur.type === "audio";
  const isModel3d = cur.type === "model3d";
  const audioCover = isAudio && isAudioCover(cur);
  const meshPath = index && typeof index.mediaPath === "string" ? index.mediaPath : "";
  const folderPath = isModel3d && meshPath ? meshPath : cur.thumbnailPath;
  const jsonId = jsonSource?.id || (jsonSource?.kind === "generation" ? occurrenceGenerationId || index?.containers?.generation?.id : null);
  const composed = composeDetailResources({
    checkpoint: index?.checkpoint,
    resources: index?.resources,
    model: index?.model
  });
  const familyBlock = !composed.model && composed.additional.length === 0 ? generatorFamilyModelBlock(index?.generatorFamily) : null;
  const modelBlock = familyBlock || composed.model;
  const additional = composed.additional;
  const modelPageHrefs = [
    modelBlock && modelBlock.href,
    ...additional.map((r) => r && r.href)
  ].filter(Boolean);
  const soleModelHref = modelPageHrefs.length === 1 ? modelPageHrefs[0] : "";
  const workflowLine = workflowSidebarLine(index?.params?.workflow, originScope, index?.containers);
  const producedSize = Number(index?.width) > 0 && Number(index?.height) > 0 ? { width: Number(index.width), height: Number(index.height) } : null;
  const model3dFiles = isModel3d ? model3dFileRows({ mediaPath: index && index.mediaPath, files: index && index.files }) : [];
  const audio = (() => {
    if (!isAudio) return null;
    if (index?.audio) return index.audio;
    return projectAudioParams(raw?.metadata?.params || raw?.steps?.[0]?.params) || null;
  })();
  const simplePrompt = String(audio?.simplePrompt || audio?.songConcept || "").trim();
  const musicDescription = String(audio?.musicDescription || "").trim();
  const showSimplePrompt = Boolean(simplePrompt && simplePrompt !== musicDescription);
  const lyrics = String(audio?.lyrics || "").trim();
  const facts = index ? detailFacts({
    type: cur.type,
    snapshot: snapshotFromRaw(raw, mediaId),
    fallback: index.params,
    produced: producedSize,
    resolution: jobResolutionLabel(raw),
    durationSeconds: cur.duration,
    audio,
    files: index.files,
    seed: cur.seed,
    showSeed: true,
    omitModelIdentity: Boolean(modelBlock),
    omitQuantity: true,
    omitWorkflowAliases: Boolean(workflowLine)
  }) : null;
  const inputRefs = Array.isArray(index?.inputs) ? index.inputs.filter((inp) => inp && inp.id && inp.thumbnailPath) : [];
  const inputCaptions = inputMediaCaptions(inputRefs);
  const usedAsInputRefs = Array.isArray(index?.usedAsInput) ? index.usedAsInput.filter((e) => e && e.id && e.thumbnailPath) : [];
  const usedTotal = typeof index?.usedAsInputTotal === "number" ? index.usedAsInputTotal : usedAsInputRefs.length;
  const usedInOpenHref = mediaPageHref(mediaId, withUsedIn(params, true));
  const generationEdges = uniqueById(index?.containers?.generations);
  const postEdges = uniqueById(index?.containers?.posts);
  const comicEdges = uniqueById(index?.containers?.comics);
  const isImport = index != null && generationEdges.length === 0 && postEdges.length === 0 && comicEdges.length === 0;
  const headerChips = facts ? facts.headerChips : [];
  const ratingLevel = index?.browsingLevel;
  const ratingLabel = ratingLevel != null && Number(ratingLevel) > 0 ? browsingLevelLabel(ratingLevel) : "";
  const displayTags = tagsWithoutRating(tags);
  const stageRecord = index || fallback;
  const stageStyle = mediaStageStyle(stageRecord);
  const poster = coverStillPath(stageRecord);
  async function doCopy(text, label) {
    await copyToClipboard(text);
    const id = itemKey;
    setCopied({ id, label });
    setTimeout(() => setCopied((prev) => prev && prev.id === id && prev.label === label ? { id, label: null } : prev), 1500);
  }
  const scrollBody = /* @__PURE__ */ u(k, { children: isModel3d && mesh ? /* @__PURE__ */ u(
    MeshViewport,
    {
      stillSrc: cur.thumbnailPath || "",
      enabled: mesh.enabled,
      onToggle: mesh.onToggle,
      viewable: mesh.viewable,
      selectedPath: mesh.selectedPath,
      onSelect: mesh.onSelect,
      notice: mesh.notice,
      large: mesh.large,
      slotRef: mesh.pageSlotRef,
      onStillClick: onExpand
    }
  ) : isAudio && !audioCover ? /* @__PURE__ */ u("div", { class: "detail-audio", children: [
    /* @__PURE__ */ u("div", { class: "audio-placeholder detail-audio-art", children: /* @__PURE__ */ u("span", { class: "audio-glyph", children: "\u266B" }) }),
    cur.thumbnailPath && /* @__PURE__ */ u("audio", { src: cur.thumbnailPath, controls: true, autoPlay: true })
  ] }) : isModel3d && !cur.thumbnailPath ? /* @__PURE__ */ u("div", { class: "audio-placeholder detail-audio-art", children: /* @__PURE__ */ u("span", { class: "model3d-mark", children: "3D" }) }) : cur.thumbnailPath && /* @__PURE__ */ u("div", { class: stageStyle ? "media-stage" : void 0, style: stageStyle || void 0, children: isAudio || isVideo ? /* @__PURE__ */ u(
    "video",
    {
      src: cur.thumbnailPath,
      poster: poster || void 0,
      controls: true,
      autoPlay: true
    }
  ) : /* @__PURE__ */ u(
    "img",
    {
      src: cur.thumbnailPath,
      alt: "Image",
      onClick: onExpand ? ((e) => {
        e.stopPropagation();
        onExpand();
      }) : void 0
    }
  ) }) });
  const chrome = /* @__PURE__ */ u(k, { children: [
    onExpand && (isAudio || isModel3d || cur.thumbnailPath) && /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        class: "detail-expand",
        "aria-label": "Expand",
        title: "Expand",
        onClick: (e) => {
          e.stopPropagation();
          onExpand();
        },
        children: "\u26F6"
      }
    ),
    children
  ] });
  const sidebar = !band ? /* @__PURE__ */ u(k, { children: [
    index ? /* @__PURE__ */ u(
      EntityHeader,
      {
        label: entityHeaderLabel("media", cur.type),
        date: isImport ? index.usedInEarliestAt : "",
        chips: headerChips
      }
    ) : null,
    index?.model3d ? /* @__PURE__ */ u(PublishedAs3d, { model3d: index.model3d }) : null,
    showReactions && mediaId && /* @__PURE__ */ u("div", { class: "meta-section reaction-row", children: [
      /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          class: `reaction-btn favorite${tags.includes("favorite") ? " active" : ""}`,
          onClick: () => applyReaction({ favorite: !tags.includes("favorite") }),
          "aria-pressed": tags.includes("favorite"),
          title: "Favorite (f)",
          children: "\u2764\uFE0F"
        }
      ),
      /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          class: `reaction-btn liked${tags.includes("feedback:liked") ? " active" : ""}`,
          onClick: () => applyReaction({ feedback: tags.includes("feedback:liked") ? null : "liked" }),
          "aria-pressed": tags.includes("feedback:liked"),
          title: "Like (l)",
          children: "\u{1F44D}"
        }
      ),
      /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          class: `reaction-btn disliked${tags.includes("feedback:disliked") ? " active" : ""}`,
          onClick: () => applyReaction({ feedback: tags.includes("feedback:disliked") ? null : "disliked" }),
          "aria-pressed": tags.includes("feedback:disliked"),
          title: "Dislike (d)",
          children: "\u{1F44E}"
        }
      )
    ] }),
    /* @__PURE__ */ u(
      ContainerEdgeList,
      {
        kind: "generation",
        items: generationEdges,
        textFor: (occ) => {
          const iso = occ.sortKey || occ.batchDate;
          return /* @__PURE__ */ u(TimeText, { at: iso, children: formatDate(iso) });
        },
        mediaId,
        params,
        pageFiles,
        cacheRef: memberCacheRef,
        origin,
        originKind
      }
    ),
    /* @__PURE__ */ u(
      ContainerEdgeList,
      {
        kind: "post",
        items: postEdges,
        textFor: (ref) => {
          const iso = ref.publishedAt || ref.sortKey;
          const parts = containerEdgeRowParts({
            date: formatDate(iso),
            title: ref.title,
            id: ref.id
          });
          return /* @__PURE__ */ u(k, { children: [
            parts.date ? /* @__PURE__ */ u(TimeText, { at: iso, children: parts.date }) : null,
            parts.tail
          ] });
        },
        mediaId,
        params,
        pageFiles,
        cacheRef: memberCacheRef,
        origin,
        originKind
      }
    ),
    /* @__PURE__ */ u(
      ContainerEdgeList,
      {
        kind: "comic",
        items: comicEdges,
        textFor: (ref) => {
          const iso = ref.sortKey;
          const parts = containerEdgeRowParts({
            date: formatDate(iso),
            title: ref.name,
            id: ref.id
          });
          return /* @__PURE__ */ u(k, { children: [
            parts.date ? /* @__PURE__ */ u(TimeText, { at: iso, children: parts.date }) : null,
            parts.tail
          ] });
        },
        mediaId,
        params,
        pageFiles,
        cacheRef: memberCacheRef,
        origin,
        originKind
      }
    ),
    (modelBlock || additional.length > 0) && /* @__PURE__ */ u(
      ModelMembership,
      {
        modelBlock,
        additional,
        soleHref: soleModelHref,
        sectionClass: originKind === "model" ? "meta-section meta-section-origin" : "meta-section"
      }
    ),
    workflowLine ? /* @__PURE__ */ u(WorkflowSection, { line: workflowLine }) : null,
    /* @__PURE__ */ u(
      RelatedStrip,
      {
        title: "Used in\u2026",
        items: usedAsInputRefs,
        count: usedTotal > 3 ? usedTotal : null,
        countHref: usedTotal > 3 ? usedInOpenHref : "",
        onCountClick: (e) => pushKeepingHistoryBag(e, usedInOpenHref),
        hrefFor: (inp) => usedInConsumerHref(inp, params, originScope),
        captionFor: (inp) => {
          const { caption, abbreviation, title } = usedInCaption(inp.workflow);
          if (!caption) return "";
          if (abbreviation && title) {
            return [
              /* @__PURE__ */ u("abbr", { title, children: abbreviation }),
              caption.slice(abbreviation.length)
            ];
          }
          return caption;
        }
      }
    ),
    /* @__PURE__ */ u(
      RelatedStrip,
      {
        title: "Input Media",
        items: inputRefs,
        hrefFor: (inp) => relatedOriginHref(inp, params),
        captionFor: (_inp, i) => inputCaptions[i]
      }
    ),
    index == null && /* @__PURE__ */ u("div", { class: "meta-section", children: /* @__PURE__ */ u("div", { class: "meta-prompt-skeleton" }) }),
    !isAudio && index?.prompt && /* @__PURE__ */ u("div", { class: "meta-section", children: [
      /* @__PURE__ */ u("h2", { class: "meta-label", children: "Prompt" }),
      /* @__PURE__ */ u("p", { class: "meta-prompt", children: /* @__PURE__ */ u(HighlightText, { text: index.prompt, search }) }),
      /* @__PURE__ */ u("div", { class: "meta-actions", children: /* @__PURE__ */ u(
        "button",
        {
          class: `meta-action${copiedLabel === "prompt" ? " copied" : ""}`,
          onClick: () => doCopy(index.prompt, "prompt"),
          children: copiedLabel === "prompt" ? "Copied" : "Copy prompt"
        }
      ) })
    ] }),
    !isAudio && index?.negativePrompt && /* @__PURE__ */ u("div", { class: "meta-section", children: [
      /* @__PURE__ */ u("h2", { class: "meta-label", children: "Negative Prompt" }),
      /* @__PURE__ */ u("p", { class: "meta-prompt meta-neg-prompt", children: index.negativePrompt })
    ] }),
    musicDescription && /* @__PURE__ */ u("div", { class: "meta-section", children: [
      /* @__PURE__ */ u("h2", { class: "meta-label", children: "Music description" }),
      /* @__PURE__ */ u("p", { class: "meta-prompt", children: /* @__PURE__ */ u(HighlightText, { text: musicDescription, search }) }),
      /* @__PURE__ */ u("div", { class: "meta-actions", children: /* @__PURE__ */ u(
        "button",
        {
          class: `meta-action${copiedLabel === "description" ? " copied" : ""}`,
          onClick: () => doCopy(musicDescription, "description"),
          children: copiedLabel === "description" ? "Copied" : "Copy description"
        }
      ) })
    ] }),
    lyrics && /* @__PURE__ */ u("div", { class: "meta-section", children: [
      /* @__PURE__ */ u("h2", { class: "meta-label", children: "Lyrics" }),
      /* @__PURE__ */ u("pre", { class: "meta-prompt audio-lyrics", children: /* @__PURE__ */ u(HighlightText, { text: lyrics, search }) }),
      /* @__PURE__ */ u("div", { class: "meta-actions", children: /* @__PURE__ */ u(
        "button",
        {
          class: `meta-action${copiedLabel === "lyrics" ? " copied" : ""}`,
          onClick: () => doCopy(lyrics, "lyrics"),
          children: copiedLabel === "lyrics" ? "Copied" : "Copy lyrics"
        }
      ) })
    ] }),
    showSimplePrompt && /* @__PURE__ */ u("div", { class: "meta-section", children: [
      /* @__PURE__ */ u("h2", { class: "meta-label", children: "Simple prompt" }),
      /* @__PURE__ */ u("p", { class: "meta-prompt", children: /* @__PURE__ */ u(HighlightText, { text: simplePrompt, search }) }),
      /* @__PURE__ */ u("div", { class: "meta-actions", children: /* @__PURE__ */ u(
        "button",
        {
          class: `meta-action${copiedLabel === "simple-prompt" ? " copied" : ""}`,
          onClick: () => doCopy(simplePrompt, "simple-prompt"),
          children: copiedLabel === "simple-prompt" ? "Copied" : "Copy simple prompt"
        }
      ) })
    ] }),
    facts && (facts.title || facts.rows.length > 0) && /* @__PURE__ */ u("div", { class: "meta-section", children: [
      /* @__PURE__ */ u("h2", { class: "meta-label", children: "Parameters" }),
      facts.title ? /* @__PURE__ */ u("div", { class: "meta-value", children: facts.title }) : null,
      facts.rows.length > 0 && /* @__PURE__ */ u("ul", { class: "meta-params", children: facts.rows.map((row, i) => row.kind === "text" ? /* @__PURE__ */ u("li", { class: "param-text", children: [
        /* @__PURE__ */ u("span", { class: "param-text-label", children: row.label }),
        row.value
      ] }, `t${i}`) : /* @__PURE__ */ u("li", { class: "param-chip", children: chipDatetime(row.text) ? /* @__PURE__ */ u(TimeText, { datetime: chipDatetime(row.text), children: row.text }) : row.text }, `c${i}`)) })
    ] }),
    displayTags.length > 0 && /* @__PURE__ */ u("div", { class: "meta-section", children: [
      /* @__PURE__ */ u("h2", { class: "meta-label", children: "Tags" }),
      /* @__PURE__ */ u("ul", { class: "meta-tags", children: displayTags.map((tag) => /* @__PURE__ */ u("li", { class: `meta-tag ${tagCssClass(tag)}`, children: tagLabel(tag) }, typeof tag === "string" ? tag : tag.id)) })
    ] }),
    ratingLabel ? /* @__PURE__ */ u("div", { class: "meta-section", children: [
      /* @__PURE__ */ u("h2", { class: "meta-label", children: "Rating" }),
      /* @__PURE__ */ u("ul", { class: "meta-tags", children: /* @__PURE__ */ u("li", { class: `meta-tag ${tagCssClass(ratingLabel)}`, children: ratingLabel }) })
    ] }) : null,
    pageFiles ? /* @__PURE__ */ u(k, { children: [
      /* @__PURE__ */ u("div", { class: "meta-section", children: [
        /* @__PURE__ */ u("h2", { class: "meta-label", children: "Files" }),
        model3dFiles.length > 0 && /* @__PURE__ */ u("ul", { class: "model3d-files", children: model3dFiles.map((row, i) => {
          const size = model3dSizeText(model3dBytesFor(index, row.path));
          const shownFormat = model3dShownFormat(row);
          return /* @__PURE__ */ u("li", { children: [
            /* @__PURE__ */ u("span", { children: row.label }),
            shownFormat ? /* @__PURE__ */ u("span", { class: "model3d-file-format", children: shownFormat }) : null,
            size ? /* @__PURE__ */ u("span", { class: "model3d-file-size", children: size }) : null
          ] }, `${row.path}\0${i}`);
        }) }),
        /* @__PURE__ */ u("div", { class: "meta-actions", children: [
          folderPath ? /* @__PURE__ */ u(
            "a",
            {
              class: "meta-action",
              href: folderPath,
              download: true,
              title: downloadTitle(cur.type),
              children: "\u2913"
            }
          ) : null,
          (() => {
            const mediaCopy = folderPath ? mediaFileCopy({ count: 1, types: [cur.type] }) : null;
            return mediaCopy ? /* @__PURE__ */ u(
              OpenFolderButton,
              {
                path: folderPath,
                class: "meta-action",
                label: mediaCopy.label,
                title: mediaCopy.title
              }
            ) : null;
          })(),
          generationEdges.map((occ) => {
            const iso = occ.sortKey || occ.batchDate;
            const when = formatDate(iso);
            return /* @__PURE__ */ u(
              OpenJsonButton,
              {
                kind: "generation",
                id: occ.id,
                class: "meta-action",
                title: "Open Generation folder, with data file selected",
                suffix: generationEdges.length > 1 && when ? /* @__PURE__ */ u(TimeText, { at: iso, children: when }) : void 0
              },
              String(occ.id)
            );
          }),
          postEdges.map((ref) => {
            const iso = ref.publishedAt || ref.sortKey;
            const when = formatDate(iso);
            return /* @__PURE__ */ u(
              OpenJsonButton,
              {
                kind: "post",
                id: ref.id,
                class: "meta-action",
                title: "Open Post folder, with data file selected",
                suffix: postEdges.length > 1 && when ? /* @__PURE__ */ u(TimeText, { at: iso, children: when }) : void 0
              },
              `post-data-${String(ref.id)}`
            );
          }),
          comicEdges.map((ref) => {
            const iso = ref.sortKey;
            const when = formatDate(iso);
            return /* @__PURE__ */ u(
              OpenJsonButton,
              {
                kind: "comic",
                id: ref.id,
                class: "meta-action",
                title: "Open Comic folder, with data file selected",
                suffix: comicEdges.length > 1 && when ? /* @__PURE__ */ u(TimeText, { at: iso, children: when }) : void 0
              },
              `comic-data-${String(ref.id)}`
            );
          })
        ] })
      ] }),
      (() => {
        const postLinks = postEdges.filter((ref) => ref && ref.url);
        const comicLinks = comicEdges.filter((ref) => ref && ref.url);
        if (postLinks.length === 0 && comicLinks.length === 0) return null;
        const labelItems = [
          ...postLinks.map((ref) => ({
            kind: "post",
            date: formatDate(ref.publishedAt || ref.sortKey) || ""
          })),
          ...comicLinks.map((ref) => ({
            kind: "comic",
            date: formatDate(ref.sortKey) || ""
          }))
        ];
        const labels = civitaiInstanceLabels(labelItems);
        const instanceTitle = `Open this ${mediaNoun(cur.type)} on Civitai`;
        const allComics = Array.isArray(index?.containers?.comics) ? index.containers.comics : [];
        let labelIdx = 0;
        return /* @__PURE__ */ u("div", { class: "meta-section", children: /* @__PURE__ */ u("div", { class: "meta-actions", children: [
          postLinks.map((ref) => {
            const text = labels[labelIdx++];
            const pub = postStatusLabel(ref.publishedAt);
            const access = postAccessChips(ref.availability);
            const chips = [
              ...pub === "Draft" || pub === "Scheduled" ? [pub] : [],
              ...access
            ];
            return /* @__PURE__ */ u("span", { class: "meta-link-row", children: [
              /* @__PURE__ */ u(
                "a",
                {
                  class: "meta-action",
                  href: ref.url,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  title: instanceTitle,
                  children: text
                }
              ),
              chips.map((chip) => /* @__PURE__ */ u("span", { class: "param-chip", children: chip }, chip))
            ] }, `civ-post-${String(ref.id)}`);
          }),
          comicLinks.map((ref) => {
            const text = labels[labelIdx++];
            const chapterRefs = allComics.filter(
              (c) => c && String(c.id) === String(ref.id)
            );
            const pub = comicPublication(
              chapterRefs.map((c) => c.chapterStatus)
            );
            const pubChip = pub === "draft" || pub === "scheduled" ? pub === "draft" ? "Draft" : "Scheduled" : "";
            const access = comicAccessChips(chapterRefs);
            const chips = [
              ...pubChip ? [pubChip] : [],
              ...access
            ];
            return /* @__PURE__ */ u("span", { class: "meta-link-row", children: [
              /* @__PURE__ */ u(
                "a",
                {
                  class: "meta-action",
                  href: ref.url,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  title: instanceTitle,
                  children: text
                }
              ),
              chips.map((chip) => /* @__PURE__ */ u("span", { class: "param-chip", children: chip }, chip))
            ] }, `civ-comic-${String(ref.id)}`);
          })
        ] }) });
      })()
    ] }) : /* @__PURE__ */ u("div", { class: "meta-section", children: /* @__PURE__ */ u("div", { class: "meta-actions", children: [
      /* @__PURE__ */ u(OpenFolderButton, { path: folderPath, class: "meta-action" }),
      /* @__PURE__ */ u(OpenJsonButton, { kind: jsonSource?.kind, id: jsonId, class: "meta-action" })
    ] }) })
  ] }) : null;
  if (band) {
    return /* @__PURE__ */ u(DetailMain, { align: "center", landmark: false, chrome: children, children: scrollBody });
  }
  return /* @__PURE__ */ u(
    DetailPage,
    {
      class: pageClass,
      scrollKey: itemKey,
      align: "center",
      chrome,
      sidebar,
      children: scrollBody
    }
  );
}
function UsedInGallery({ mediaId, params, originScope }) {
  const query = T(() => ({ usedInput: mediaId, limit: 50 }), [mediaId]);
  const fetcher = q((p) => getMedia({
    usedInput: p.usedInput,
    limit: 50,
    page: p.page
  }), []);
  const { items, loading, sentinelRef, hasMore, pending } = useGalleryData({ fetcher, query });
  const hrefFor = q(
    (tile) => usedInConsumerHref(tile, params, originScope),
    [params, originScope]
  );
  const onItemActivate = q((e, item) => {
    onModelsLinkClick(e, hrefFor(item));
  }, [hrefFor]);
  if (!items || items.length === 0) return null;
  return /* @__PURE__ */ u(
    Gallery,
    {
      items,
      grain: "media",
      loading,
      hasMore,
      pending,
      sentinelRef,
      hrefFor,
      onItemActivate
    }
  );
}
function fileOriginFrom(params) {
  const from = params && params.from;
  if (from === "posts") return "post";
  if (from === "comics") return "comic";
  return void 0;
}
function pausePageMedia() {
  try {
    const root = document.querySelector(".media-detail-page .detail-main");
    if (!root) return;
    for (const el of root.querySelectorAll("video, audio")) {
      el.pause();
    }
  } catch {
  }
}
function MediaDetailView({ entityId, occurrenceGenerationId, params, onOriginScope, onModelReturn }) {
  const [fullscreen, setFullscreen] = d(false);
  const quietAppliedRef = A(null);
  const fileOrigin = fileOriginFrom(params);
  const anchorSlot = readHistoryAnchorSlot();
  const ownRev = useOwnModelsRevision();
  const cacheKey = detailCacheKey({
    view: "media",
    id: entityId,
    params,
    anchor: anchorSlot
  }) + `:own${ownRev}`;
  const held = useHeldDetail(cacheKey, () => loadMediaDetail(entityId, params, anchorSlot));
  const data = held.displayed;
  const onRoute = held.shownKey === cacheKey && !!data?.index;
  const fsSession = A(createFullscreenSession());
  const fsAlive = A(true);
  const fsHostRef = A(null);
  const meshPref = useMeshViewerPref();
  const meshHost = useMeshHost();
  const pageSlotRef = A(null);
  const expandSlotRef = A(null);
  const [meshNotice, setMeshNotice] = d("");
  const [meshReady, setMeshReady] = d(false);
  const [meshPath, setMeshPath] = d("");
  const meshIndex = data?.index?.type === "model3d" ? data.index : null;
  const meshRows = meshIndex ? viewableMeshFiles({ mediaPath: meshIndex.mediaPath, files: meshIndex.files }) : [];
  const meshPathKey = meshRows.map((row) => row.path).join("\n");
  const meshId = meshIndex ? String(meshIndex.id || entityId || "") : "";
  y(() => {
    setMeshPath(meshPathKey ? meshPathKey.split("\n")[0] : "");
    setMeshNotice("");
    setMeshReady(false);
  }, [meshId, meshPathKey]);
  const closeFullscreen = q(() => {
    releaseDocumentFullscreen(fsSession.current, document).then(() => {
      if (fsAlive.current) setFullscreen(false);
    });
  }, []);
  const openFullscreen = q(() => {
    pausePageMedia();
    const host = fsHostRef.current;
    try {
      if (host) {
        host.classList.remove("media-fullscreen-standby");
        host.classList.add("media-fullscreen");
      }
    } catch {
    }
    requestElementFullscreen(fsSession.current, document, host);
    setFullscreen(true);
  }, []);
  const yieldEscape = q(() => {
    try {
      return yieldFullscreenEscape(fsSession.current, document);
    } catch {
      return false;
    }
  }, []);
  _(() => {
    fsAlive.current = true;
    const session = fsSession.current;
    const onChange = () => {
      try {
        if (fullscreenSessionEnded(session, document)) setFullscreen(false);
      } catch {
      }
    };
    try {
      document.addEventListener("fullscreenchange", onChange);
    } catch {
    }
    return () => {
      fsAlive.current = false;
      try {
        document.removeEventListener("fullscreenchange", onChange);
      } catch {
      }
      releaseDocumentFullscreen(session, document);
    };
  }, []);
  const escapeOrigin = data?.index?.origin ? data.index.origin : null;
  const escapeModelReturn = onRoute && params?.from === "models" ? modelsOriginReturnHref({
    versionId: params.versionId,
    familyId: params.familyId,
    sort: params.sort,
    checkpoint: data.index.checkpoint,
    resources: data.index.resources
  }) || null : null;
  useMagicEscape({ origin: escapeOrigin, modelReturn: escapeModelReturn });
  y(() => {
    if (!fullscreen) return void 0;
    pausePageMedia();
    return void 0;
  }, [fullscreen, entityId]);
  y(() => {
    if (!fullscreen) return void 0;
    let previous = "";
    try {
      previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    } catch {
      return void 0;
    }
    return () => {
      try {
        document.body.style.overflow = previous;
      } catch {
      }
    };
  }, [fullscreen]);
  y(() => {
    if (!onRoute || !data?.index?.origin) return void 0;
    prefetchOriginNeighbours({
      view: "media",
      routeParams: params,
      origin: data.index.origin,
      anchor: anchorSlot
    });
    return void 0;
  }, [onRoute, data, params, anchorSlot]);
  y(() => {
    if (!onRoute || !data?.index) return;
    const next = canonicalMediaRouteId(entityId, data.index.id);
    if (!next) return;
    replaceState({
      view: "media",
      entityId: next,
      params: { ...params || {} }
    });
  }, [onRoute, data, entityId, params]);
  y(() => {
    if (typeof onOriginScope !== "function") return;
    if (!onRoute || !data?.index) return;
    if (params && params.from) {
      onOriginScope(null);
      return;
    }
    const scope = data.index.origin && data.index.origin.scope;
    onOriginScope(scope || null);
  }, [onRoute, data, params, onOriginScope]);
  y(() => {
    if (typeof onModelReturn !== "function") return;
    if (!params || params.from !== "models") {
      onModelReturn(null);
      return;
    }
    if (!onRoute || !data?.index) return;
    const href = modelsOriginReturnHref({
      versionId: params.versionId,
      familyId: params.familyId,
      sort: params.sort,
      checkpoint: data.index.checkpoint,
      resources: data.index.resources
    });
    onModelReturn(href || null);
  }, [onRoute, data, params, onModelReturn]);
  y(() => {
    if (!onRoute || !data?.index?.origin || !entityId) return;
    const origin2 = data.index.origin;
    const canonical = data.index.id != null ? normalizeMediaId(data.index.id) : "";
    const openId = normalizeMediaId(entityId);
    if (canonical && openId && canonical !== openId) return;
    const nextParams = { ...params || {} };
    let changed = false;
    if (origin2.omitFrom && nextParams.from) {
      delete nextParams.from;
      changed = true;
    }
    if (!origin2.slotInUrl && nextParams.slot) {
      delete nextParams.slot;
      changed = true;
    }
    if (nextParams.usedIn != null && nextParams.usedIn !== "1") {
      nextParams.usedIn = null;
      changed = true;
    }
    if (!changed) return;
    const quietKey = `${openId}|${JSON.stringify(nextParams)}`;
    if (quietAppliedRef.current === quietKey) return;
    quietAppliedRef.current = quietKey;
    replaceState({
      view: "media",
      entityId: canonical || openId,
      params: nextParams
    });
  }, [onRoute, data, entityId, params]);
  const galleryOpen = !!(params && params.usedIn === "1");
  y(() => {
    if (!galleryOpen) return void 0;
    try {
      window.scrollTo(0, 0);
    } catch {
    }
    return void 0;
  }, [galleryOpen, entityId]);
  useDocumentTitle(
    data?.index ? {
      place: "media",
      type: data.index.type,
      date: formatDate(data.index.date),
      title: String(data.index.audio?.title || "").trim()
    } : { place: "media" }
  );
  if (!data && !held.failed) return null;
  if (!data || !data.index) {
    return /* @__PURE__ */ u("main", { class: "main-content", children: /* @__PURE__ */ u("div", { class: "empty-state", children: [
      /* @__PURE__ */ u("h1", { children: "Media item not found" }),
      /* @__PURE__ */ u("p", { children: "This id is not in the local index." })
    ] }) });
  }
  const index = data.index;
  const origin = index.origin || null;
  const mediaId = normalizeMediaId(index.id) || String(entityId);
  const originScope = params && params.from || origin && origin.scope || null;
  const usedTotal = typeof index.usedAsInputTotal === "number" ? index.usedAsInputTotal : null;
  const closeHref = mediaPageHref(mediaId, withUsedIn(params, false));
  const pageClass = `media-detail-page${fullscreen ? " media-fullscreen-open" : ""}${galleryOpen ? " media-used-in-open" : ""}`;
  const closeIfHost = (e) => {
    if (e.target === e.currentTarget) closeFullscreen();
  };
  const mesh = index.type === "model3d" ? {
    enabled: meshPref.enabled,
    onToggle: () => {
      if (meshPref.enabled) {
        meshPref.setEnabled(false);
        return;
      }
      setMeshNotice("");
      setMeshReady(false);
      meshPref.setEnabled(true);
    },
    viewable: meshRows,
    selectedPath: meshPath,
    onSelect: (path) => {
      setMeshPath(path);
      setMeshNotice("");
      setMeshReady(false);
    },
    notice: meshNotice,
    large: meshIsLarge(model3dBytesFor(index, meshPath)),
    pageSlotRef,
    expandSlotRef
  } : null;
  const meshLive = !!(mesh && meshPref.enabled && meshRows.length > 0 && meshPath);
  const meshLayer = /* @__PURE__ */ u(
    ActiveMesh,
    {
      host: meshHost,
      slotRef: fullscreen ? expandSlotRef : pageSlotRef,
      live: meshLive,
      url: meshPath,
      conceal: !meshReady || !!meshNotice,
      onReady: () => {
        setMeshNotice("");
        setMeshReady(true);
      },
      onNotice: (message) => {
        setMeshNotice(message);
        setMeshReady(false);
      },
      onUnrecoverable: (message) => {
        setMeshNotice(message);
        setMeshReady(false);
        meshPref.setEnabled(false);
      }
    }
  );
  const overlay = /* @__PURE__ */ u(
    "div",
    {
      ref: fsHostRef,
      class: fullscreen ? "media-fullscreen" : "media-fullscreen-standby",
      onClick: fullscreen ? closeIfHost : void 0,
      "aria-hidden": fullscreen ? void 0 : "true",
      children: fullscreen ? /* @__PURE__ */ u(
        Lightbox,
        {
          src: index.thumbnailPath,
          type: index.type,
          audioCover: isAudioCover(index),
          width: index.width,
          height: index.height,
          aspectClass: index.aspectClass,
          coverPath: coverStillPath(index),
          onClose: closeFullscreen,
          yieldEscape,
          mesh,
          meshReady,
          children: /* @__PURE__ */ u(OriginSiblingNav, { origin, routeParams: params, ignoreOverlay: false })
        }
      ) : null
    },
    "fs-host"
  );
  if (galleryOpen) {
    return /* @__PURE__ */ u(k, { children: [
      /* @__PURE__ */ u("main", { class: `main-content ${pageClass}`, children: [
        /* @__PURE__ */ u("div", { class: "used-in-band", children: /* @__PURE__ */ u(
          MediaDetail,
          {
            band: true,
            mediaId,
            occurrenceGenerationId,
            fileOrigin,
            params,
            fallback: index,
            fallbackRaw: data.raw,
            onExpand: openFullscreen,
            mesh,
            children: /* @__PURE__ */ u(OriginSiblingNav, { origin, routeParams: params })
          }
        ) }),
        /* @__PURE__ */ u("div", { class: "used-in-line", children: [
          /* @__PURE__ */ u("h2", { class: "meta-label", children: "Used in\u2026" }),
          usedTotal != null ? /* @__PURE__ */ u("span", { class: "used-in-total", children: usedTotal }) : null,
          /* @__PURE__ */ u("a", { class: "used-in-close", href: closeHref, onClick: (e) => pushKeepingHistoryBag(e, closeHref), children: "Close" })
        ] }),
        /* @__PURE__ */ u(UsedInGallery, { mediaId, params, originScope })
      ] }),
      overlay,
      meshLayer
    ] });
  }
  return /* @__PURE__ */ u(k, { children: [
    /* @__PURE__ */ u(
      MediaDetail,
      {
        pageClass,
        mediaId,
        occurrenceGenerationId,
        fileOrigin,
        pageFiles: true,
        params,
        fallback: index,
        fallbackRaw: data.raw,
        showReactions: true,
        onExpand: openFullscreen,
        mesh,
        children: /* @__PURE__ */ u(OriginSiblingNav, { origin, routeParams: params })
      }
    ),
    overlay,
    meshLayer
  ] });
}
export {
  MediaDetail,
  MediaDetailView
};
