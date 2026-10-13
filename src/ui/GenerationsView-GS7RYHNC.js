import {
  GranularityToggle,
  pruneGrainParams,
  useDebouncedUrlParam
} from "./chunk-G4X7ZT5J.js";
import {
  USED_AS_INPUT_FACET,
  effectivePublication,
  publicationFacet,
  publicationFromInPost
} from "./chunk-BSWGQMHZ.js";
import {
  FacetBar
} from "./chunk-FMYPGPZD.js";
import {
  Gallery
} from "./chunk-4QKRDROH.js";
import {
  useGalleryData
} from "./chunk-XAVY4HKU.js";
import {
  useStickyUrlState
} from "./chunk-OGIDMYFE.js";
import "./chunk-5XDJYGJC.js";
import "./chunk-MY736RCS.js";
import "./chunk-XQGXV6CL.js";
import "./chunk-HMX5XSAI.js";
import "./chunk-3Y4VDHN5.js";
import {
  activateOriginTile,
  originNodeHref,
  readHistoryFocus,
  shouldLoadFocusPrefix
} from "./chunk-DDUI6F2D.js";
import {
  TimeText,
  nextTagsForReaction,
  reactionMarks
} from "./chunk-INNL2V6Q.js";
import {
  getRoute
} from "./chunk-Z6L3MMX7.js";
import {
  A,
  T,
  d,
  getGenerations,
  getMedia,
  getStats,
  k,
  q,
  setReactions,
  u,
  useDocumentTitle,
  y
} from "./chunk-QDJYYBZC.js";

// dev/ui/src/components/StatsBar.jsx
function StatsBar({ stats }) {
  if (!stats) return null;
  const imgCount = stats.genImages ?? stats.totalImages;
  const vidCount = stats.genVideos ?? stats.totalVideos;
  const audCount = stats.genAudio ?? stats.totalAudio;
  const model3dCount = stats.genModel3d ?? stats.totalModel3d;
  const items = [
    stats.totalGenerations != null && { label: "generations", value: stats.totalGenerations },
    imgCount != null && { label: "images", value: imgCount },
    vidCount > 0 && { label: "videos", value: vidCount },
    audCount > 0 && { label: "audio", value: audCount },
    model3dCount > 0 && { label: "3D", value: model3dCount },
    stats.totalFavorites > 0 && { label: "favorites", value: stats.totalFavorites },
    stats.totalLiked > 0 && { label: "liked", value: stats.totalLiked },
    stats.generationDateRange?.from && {
      label: "",
      from: stats.generationDateRange.from,
      to: stats.generationDateRange.to
    }
  ].filter(Boolean);
  return /* @__PURE__ */ u("ul", { class: "stats-bar", children: items.flatMap((item, i) => {
    const cell = /* @__PURE__ */ u("li", { class: "stat-item", children: item.label ? /* @__PURE__ */ u(k, { children: [
      /* @__PURE__ */ u("strong", { children: item.value.toLocaleString() }),
      " ",
      item.label
    ] }) : /* @__PURE__ */ u(k, { children: [
      /* @__PURE__ */ u(TimeText, { at: item.from, children: item.from }),
      " \u2014 ",
      /* @__PURE__ */ u(TimeText, { at: item.to, children: item.to })
    ] }) }, `item-${i}`);
    if (i === 0) return [cell];
    return [
      /* @__PURE__ */ u("li", { class: "stat-separator", "aria-hidden": "true", children: "\xB7" }, `sep-${i}`),
      cell
    ];
  }) });
}

// dev/ui/src/components/GenerationsView.jsx
var URL_SCHEMA = {
  sort: { type: "string", default: "date:desc" },
  tag: { type: "csv", default: [] },
  q: { type: "string", default: "" },
  type: { type: "csv", default: [] },
  ecosystem: { type: "csv", default: [] },
  model: { type: "csv", default: [] },
  version: { type: "csv", default: [] },
  resourceType: { type: "csv", default: [] },
  resource: { type: "csv", default: [] },
  versionId: { type: "csv", default: [] },
  scope: { type: "string", default: "" },
  mine: { type: "boolean", default: null },
  aspect: { type: "csv", default: [] },
  dateFrom: { type: "string", default: "" },
  dateTo: { type: "string", default: "" },
  cfgMin: { type: "number", default: null },
  cfgMax: { type: "number", default: null },
  stepsMin: { type: "integer", default: null },
  stepsMax: { type: "integer", default: null },
  inPost: { type: "boolean", default: null },
  publication: { type: "csv", default: [] },
  usedAsInput: { type: "boolean", default: null },
  workflow: { type: "csv", default: [] },
  workflowMode: { type: "csv", default: [] },
  reaction: { type: "csv", default: [] },
  groupBy: { type: "string", default: "none" },
  groupSort: { type: "string", default: "count:desc" },
  granularity: { type: "string", default: "media", sticky: true }
};
var FACETS = [
  { key: "reaction", kind: "chips", source: "reaction", valuesSource: "reactionTags", options: ["favorite", "feedback:liked", "feedback:disliked"], label: "Reactions" },
  { key: "type", kind: "nested-tree", tree: "type-workflow", label: "Media Type" },
  { key: "aspect", kind: "nested-tree", tree: "aspect", label: "Aspect Ratio", alwaysShowRoots: true },
  { key: "scope", kind: "tree", label: "Models" },
  { key: "dateFrom", key2: "dateTo", kind: "date-range", label: "When" },
  { key: "cfgMin", key2: "cfgMax", kind: "number-range", label: "CFG" },
  { key: "stepsMin", key2: "stepsMax", kind: "number-range", label: "Steps" },
  publicationFacet(),
  USED_AS_INPUT_FACET
];
var GRAIN_OPTIONS = [
  { value: "media", label: "Media" },
  { value: "batch", label: "Batches" }
];
var SORT_FIELDS = [{ value: "date", label: "Date" }];
var GROUP_AXES = [
  { value: "resourceType", label: "Model type" },
  { value: "ecosystem", label: "Ecosystem" },
  { value: "model", label: "Model" },
  { value: "version", label: "Version" },
  { value: "resource", label: "Additional resource" },
  { value: "aspect", label: "Aspect" },
  { value: "sampler", label: "Sampler" },
  { value: "month", label: "Month" },
  { value: "day", label: "Day" }
];
function rollUpTags(media) {
  return [...new Set(media.flatMap((m) => m.tags || []))].sort();
}
function findMediaTagsFromResponse(rawMediaId, responseItems) {
  const hit = responseItems.find(
    (r) => rawMediaId === r.mediaItemId || rawMediaId.startsWith(`${r.mediaItemId}.`)
  );
  return hit && Array.isArray(hit.tags) ? hit.tags : null;
}
function GenerationsView() {
  const [urlState, updateUrl] = useStickyUrlState(URL_SCHEMA);
  const grain = urlState.granularity === "batch" ? "batch" : "media";
  useDocumentTitle({ place: "generations", grain });
  const [stats, setStats] = d(null);
  const [selectedIds, setSelectedIds] = d(() => /* @__PURE__ */ new Set());
  const searchRef = A(null);
  y(() => {
    getStats().then(setStats).catch(() => {
    });
  }, []);
  const [searchInput, setSearchInput] = useDebouncedUrlParam(urlState.q, updateUrl, "q");
  y(() => {
    if ((urlState.publication || []).length) {
      if (urlState.inPost != null) updateUrl({ inPost: null });
      return;
    }
    if (urlState.inPost == null) return;
    updateUrl({ publication: publicationFromInPost(urlState.inPost), inPost: null });
  }, [urlState.publication, urlState.inPost, updateUrl]);
  const query = T(() => ({
    tag: urlState.tag,
    reaction: urlState.reaction,
    q: urlState.q,
    sort: urlState.sort,
    type: urlState.type,
    ecosystem: urlState.ecosystem,
    model: urlState.model,
    version: urlState.version,
    resourceType: urlState.resourceType,
    resource: urlState.resource,
    versionId: urlState.versionId,
    scope: urlState.scope,
    aspect: urlState.aspect,
    dateFrom: urlState.dateFrom,
    dateTo: urlState.dateTo,
    cfgMin: urlState.cfgMin,
    cfgMax: urlState.cfgMax,
    stepsMin: urlState.stepsMin,
    stepsMax: urlState.stepsMax,
    publication: effectivePublication(urlState.publication, urlState.inPost),
    usedAsInput: urlState.usedAsInput === true ? true : null,
    workflow: urlState.workflow,
    workflowMode: urlState.workflowMode,
    groupBy: urlState.groupBy,
    groupSort: urlState.groupSort,
    granularity: urlState.granularity
  }), [urlState]);
  const galleryFetcher = q((params) => {
    const { granularity: g, ...rest } = params;
    return g === "media" ? getMedia({ ...rest, hasGeneration: true }) : getGenerations(rest);
  }, []);
  const { items, groupsMeta, loading, sentinelRef, setItems, hasMore, loadMore, pending } = useGalleryData({ fetcher: galleryFetcher, query });
  const facetParams = T(() => grain === "media" ? { hasGeneration: true } : { hasGeneration: true, dateSource: "container" }, [grain]);
  y(() => {
    if (shouldLoadFocusPrefix(readHistoryFocus(), { loading, itemCount: items.length, hasMore })) {
      loadMore();
    }
  }, [loading, items.length, hasMore, loadMore]);
  const queryKey = JSON.stringify(query);
  y(() => {
    setSelectedIds(/* @__PURE__ */ new Set());
  }, [queryKey]);
  const applyMediaTagUpdates = q((updates) => {
    const patch = (arr) => arr.map((it) => {
      if (!Array.isArray(it.media)) return it;
      let changed = false;
      const media = it.media.map((m) => {
        if (updates.has(m.mediaId)) {
          changed = true;
          const marks = updates.get(m.mediaId);
          return { ...m, tags: marks, reactions: marks };
        }
        return m;
      });
      if (!changed) return it;
      const rolled = rollUpTags(media);
      return { ...it, media, tags: rolled, reactions: rolled };
    });
    setItems((prev) => patch(prev));
  }, [setItems]);
  const toggleReaction = q((token) => {
    const next = urlState.reaction.includes(token) ? urlState.reaction.filter((t) => t !== token) : [...urlState.reaction, token];
    updateUrl({ reaction: next });
  }, [urlState.reaction, updateUrl]);
  const hrefFor = q((item, index) => originNodeHref(item, {
    grain,
    originView: "generations",
    params: getRoute().params,
    index,
    groupsMeta
  }), [grain, urlState, groupsMeta]);
  const onItemActivate = q((e, item, index, landmarks) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
      return;
    }
    activateOriginTile(e, item, index, landmarks, {
      grain,
      originView: "generations",
      params: getRoute().params,
      groupsMeta
    });
  }, [grain, groupsMeta]);
  const clearSelection = q(() => setSelectedIds(/* @__PURE__ */ new Set()), []);
  const applyBatchReaction = q((kind) => {
    const targets = items.filter((it) => selectedIds.has(it.id));
    if (!targets.length) return;
    let edit;
    if (kind === "favorite") edit = { favorite: !targets.every((it) => reactionMarks(it).includes("favorite")) };
    else if (kind === "liked") edit = { feedback: targets.every((it) => reactionMarks(it).includes("feedback:liked")) ? null : "liked" };
    else if (kind === "disliked") edit = { feedback: targets.every((it) => reactionMarks(it).includes("feedback:disliked")) ? null : "disliked" };
    else return;
    const original = /* @__PURE__ */ new Map();
    const optimistic = /* @__PURE__ */ new Map();
    const batchItems = [];
    for (const it of targets) {
      for (const m of it.media || []) {
        const marks = reactionMarks(m);
        original.set(m.mediaId, marks);
        optimistic.set(m.mediaId, nextTagsForReaction(marks, edit));
        batchItems.push({ mediaItemId: m.mediaId, ...edit });
      }
    }
    if (!batchItems.length) return;
    applyMediaTagUpdates(optimistic);
    setReactions(batchItems).then((res) => {
      if (!res || res.ok === false || !Array.isArray(res.items)) {
        applyMediaTagUpdates(original);
        return;
      }
      const settle = /* @__PURE__ */ new Map();
      for (const mediaId of original.keys()) {
        const tags = findMediaTagsFromResponse(mediaId, res.items);
        settle.set(mediaId, tags != null ? tags : optimistic.get(mediaId));
      }
      applyMediaTagUpdates(settle);
    }).catch(() => applyMediaTagUpdates(original));
  }, [items, selectedIds, applyMediaTagUpdates]);
  y(() => {
    function onKey(e) {
      const t = e.target.tagName;
      if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return;
      if (e.key === "j") window.scrollBy({ top: 300, behavior: "smooth" });
      else if (e.key === "k") window.scrollBy({ top: -300, behavior: "smooth" });
      else if (e.key === "Escape") {
        if (selectedIds.size) clearSelection();
      } else if (e.key === "f") {
        if (selectedIds.size) {
          e.preventDefault();
          applyBatchReaction("favorite");
        } else toggleReaction("favorite");
      } else if (e.key === "l") {
        if (selectedIds.size) {
          e.preventDefault();
          applyBatchReaction("liked");
        }
      } else if (e.key === "d") {
        if (selectedIds.size) {
          e.preventDefault();
          applyBatchReaction("disliked");
        }
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleReaction, selectedIds, applyBatchReaction, clearSelection]);
  return /* @__PURE__ */ u("main", { class: "main-content", children: [
    /* @__PURE__ */ u("h1", { class: "visually-hidden", children: "Generations" }),
    /* @__PURE__ */ u(StatsBar, { stats }),
    /* @__PURE__ */ u(
      GranularityToggle,
      {
        value: urlState.granularity,
        options: GRAIN_OPTIONS,
        onChange: (next) => updateUrl({ granularity: next, ...pruneGrainParams(next, urlState) })
      }
    ),
    /* @__PURE__ */ u(
      FacetBar,
      {
        facets: FACETS,
        state: urlState,
        update: updateUrl,
        sortFields: SORT_FIELDS,
        groupAxes: GROUP_AXES,
        search: searchInput,
        onSearchInput: setSearchInput,
        searchRef,
        facetParams
      }
    ),
    selectedIds.size > 0 && /* @__PURE__ */ u("div", { class: "selection-toolbar", children: [
      /* @__PURE__ */ u("span", { class: "selection-count", children: [
        selectedIds.size,
        " selected"
      ] }),
      /* @__PURE__ */ u("div", { class: "selection-actions", children: [
        /* @__PURE__ */ u("button", { type: "button", class: "reaction-btn favorite", onClick: () => applyBatchReaction("favorite"), title: "Favorite (f)", children: "\u2764\uFE0F" }),
        /* @__PURE__ */ u("button", { type: "button", class: "reaction-btn liked", onClick: () => applyBatchReaction("liked"), title: "Like (l)", children: "\u{1F44D}" }),
        /* @__PURE__ */ u("button", { type: "button", class: "reaction-btn disliked", onClick: () => applyBatchReaction("disliked"), title: "Dislike (d)", children: "\u{1F44E}" })
      ] }),
      /* @__PURE__ */ u("button", { type: "button", class: "quiet-btn", onClick: clearSelection, children: "Clear" })
    ] }),
    (items.length > 0 || !loading) && /* @__PURE__ */ u(
      Gallery,
      {
        items,
        grain,
        groupsMeta,
        onItemActivate,
        hrefFor,
        selectedIds,
        sentinelRef,
        search: urlState.q,
        loading,
        hasMore,
        pending
      }
    ),
    loading && /* @__PURE__ */ u("div", { class: "loading-bar", children: /* @__PURE__ */ u("div", { class: "spinner" }) })
  ] });
}
export {
  GenerationsView,
  URL_SCHEMA
};
