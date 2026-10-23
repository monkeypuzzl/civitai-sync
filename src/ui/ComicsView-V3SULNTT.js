import {
  GranularityToggle,
  galleryRequestQuery,
  pruneGrainParams,
  useDebouncedUrlParam
} from "./chunk-QWPWXM7X.js";
import {
  useCardWindow
} from "./chunk-464FMWZK.js";
import {
  FacetBar
} from "./chunk-PLCSGSRC.js";
import {
  Gallery
} from "./chunk-NUBT5S7N.js";
import {
  useGalleryData
} from "./chunk-OSJP4UDL.js";
import {
  useStickyUrlState
} from "./chunk-2JZ6NTGG.js";
import {
  USED_AS_INPUT_FACET,
  publicationFacet,
  publicationFromStatus
} from "./chunk-LNGUPSA6.js";
import "./chunk-TQWSKHC6.js";
import {
  HighlightText,
  tileLead,
  tileLeadMedia,
  tileSlotIso
} from "./chunk-M6EGXWFI.js";
import "./chunk-3YME5QSH.js";
import "./chunk-XQGXV6CL.js";
import "./chunk-JLH4BCQU.js";
import {
  MediaThumb
} from "./chunk-FN3QFPOE.js";
import {
  activateOriginTile,
  originNodeHref,
  readHistoryFocus,
  resolveFocusId,
  shouldLoadFocusPrefix
} from "./chunk-5C3I5ONU.js";
import {
  TimeText
} from "./chunk-X3SNRSQH.js";
import "./chunk-FK7RTYYB.js";
import {
  useIndexEpoch
} from "./chunk-ECN4OFEF.js";
import {
  getRoute,
  replaceState
} from "./chunk-K4YW4PKR.js";
import {
  A,
  T,
  d,
  formatDate,
  getComics,
  getMedia,
  getStats,
  isAudioCover,
  k,
  nextTagsForReaction,
  q,
  reactionMarks,
  setReactions,
  u,
  useDocumentTitle,
  y
} from "./chunk-GOKE7NMO.js";

// dev/ui/src/components/ComicStatsBar.jsx
function ComicStatsBar({ stats, comicTotal, totalLabel = "comics" }) {
  const total = comicTotal !== void 0 ? comicTotal : stats?.totalComics;
  const chapters = stats?.comicChapters;
  const panels = stats?.comicPanels;
  const from = stats?.comicFrom;
  const to = stats?.comicTo;
  const items = [
    total != null && { label: totalLabel, value: total },
    chapters != null && { label: "chapters", value: chapters },
    panels > 0 && { label: "panels", value: panels },
    from && {
      label: "",
      from,
      to
    }
  ].filter(Boolean);
  return /* @__PURE__ */ u("ul", { class: "stats-bar", "aria-hidden": items.length ? void 0 : "true", children: items.flatMap((item, i) => {
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

// dev/ui/src/components/ComicCard.jsx
function ComicCard({ item, onClick, search, href }) {
  const first = tileLeadMedia(item);
  if (!first) return null;
  const thumbW = Number(first.width);
  const thumbH = Number(first.height);
  const mediaAspect = thumbW > 0 && thumbH > 0 ? `${thumbW} / ${thumbH}` : "1 / 1";
  const isVideo = first.type === "video";
  const audioCover = first.type === "audio" && (first.coverPath || isAudioCover(first));
  const totalMedia = item.imageCount + item.videoCount + (item.audioCount || 0);
  const isScheduled = item.status === "scheduled";
  const isDraft = item.status === "draft";
  const slotIso = tileSlotIso(item, "comic");
  const dateStr = formatDate(slotIso);
  const titleStr = tileLead(item, "comic", dateStr);
  const Tag = href ? "a" : "div";
  return /* @__PURE__ */ u(Tag, { class: "gallery-item post-card", href: href || void 0, onClick, onMouseDown: onClick ? (e) => {
    if (e.button === 1) onClick(e);
  } : void 0, title: titleStr, "data-focus-id": item.id, children: [
    /* @__PURE__ */ u("div", { class: "post-card-media", style: { aspectRatio: mediaAspect }, children: [
      /* @__PURE__ */ u(
        MediaThumb,
        {
          type: first.type,
          thumbnailPath: first.thumbnailPath,
          coverPath: first.coverPath
        }
      ),
      isVideo && /* @__PURE__ */ u("div", { class: "video-badge" }),
      audioCover && /* @__PURE__ */ u("div", { class: "audio-badge", children: "\u266B" }),
      totalMedia > 1 && /* @__PURE__ */ u("span", { class: "media-badge", children: totalMedia }),
      isScheduled && /* @__PURE__ */ u("span", { class: "status-badge status-badge-scheduled", children: [
        "\u23F2",
        " Scheduled"
      ] }),
      isDraft && /* @__PURE__ */ u("span", { class: "status-badge status-badge-draft", children: "Draft" }),
      search && item.promptSnippet && /* @__PURE__ */ u("div", { class: "hover-info search-snippet", children: /* @__PURE__ */ u(HighlightText, { text: item.promptSnippet, search }) }),
      !(search && item.promptSnippet) && dateStr && /* @__PURE__ */ u("div", { class: "hover-info tile-date", children: /* @__PURE__ */ u(TimeText, { at: slotIso, children: dateStr }) })
    ] }),
    /* @__PURE__ */ u("div", { class: "post-card-info", children: [
      isScheduled && dateStr && /* @__PURE__ */ u("div", { class: "post-card-status-date", children: [
        "Scheduled ",
        "\xB7",
        " ",
        /* @__PURE__ */ u(TimeText, { at: slotIso, children: dateStr })
      ] }),
      item.name && /* @__PURE__ */ u("div", { class: "post-card-title", children: /* @__PURE__ */ u(HighlightText, { text: item.name, search }) }),
      item.tags.length > 0 && /* @__PURE__ */ u("ul", { class: "post-card-tags", children: [
        item.tags.slice(0, 4).map((tag) => /* @__PURE__ */ u("li", { class: "post-card-tag", children: tag.name }, tag.id || tag.name)),
        item.tags.length > 4 && /* @__PURE__ */ u("li", { class: "post-card-tag post-card-tag-more", children: [
          "+",
          item.tags.length - 4
        ] })
      ] })
    ] })
  ] });
}

// dev/ui/src/components/ComicGallery.jsx
function ComicGallery({ items, groupsMeta, onItemActivate, onItemClick, sentinelRef, loading, search, hrefFor, hasMore, pending = false }) {
  const list = items || [];
  const isEmpty = list.length === 0;
  const activate = onItemActivate || (onItemClick ? (e, item, index, landmarks2) => onItemClick(item, e, index, landmarks2) : void 0);
  const {
    rootRef,
    gridRef,
    start,
    end,
    outerTopPad,
    outerBottomPad,
    sections,
    grouped
  } = useCardWindow({ items: list, groupsMeta, hasMore, loading, pending });
  if (isEmpty && !loading) {
    return /* @__PURE__ */ u("div", { class: "empty-state", children: [
      /* @__PURE__ */ u("h2", { children: "No comics downloaded yet" }),
      /* @__PURE__ */ u("p", { children: "Try adjusting your filters or search query." })
    ] });
  }
  if (isEmpty) {
    return /* @__PURE__ */ u("div", { ref: rootRef, children: [
      /* @__PURE__ */ u("div", { ref: sentinelRef, class: "gallery-sentinel" }),
      loading && /* @__PURE__ */ u("div", { class: "loading-bar", children: /* @__PURE__ */ u("div", { class: "spinner" }) })
    ] });
  }
  const landmarks = {
    firstId: list[start]?.id,
    lastId: list[Math.max(start, end - 1)]?.id
  };
  const renderCard = (item, index) => /* @__PURE__ */ u(
    ComicCard,
    {
      item,
      href: hrefFor ? hrefFor(item, index) : void 0,
      onClick: activate ? (e) => {
        activate(e, item, index, landmarks);
      } : void 0,
      search
    },
    item.id
  );
  return /* @__PURE__ */ u("div", { ref: rootRef, children: [
    /* @__PURE__ */ u("div", { class: "gallery-pad", style: { height: outerTopPad }, "aria-hidden": "true" }),
    grouped && sections ? sections.map((sec, i) => /* @__PURE__ */ u("section", { class: "gallery-group", children: [
      /* @__PURE__ */ u("h2", { class: "gallery-group-header", children: [
        sec.group.label,
        " ",
        /* @__PURE__ */ u("span", { class: "gallery-group-count", children: sec.group.count })
      ] }),
      sec.innerPad > 0 ? /* @__PURE__ */ u("div", { class: "gallery-pad", style: { height: sec.innerPad }, "aria-hidden": "true" }) : null,
      /* @__PURE__ */ u("div", { class: "gallery-grid", ref: i === 0 ? gridRef : void 0, children: list.slice(sec.start, sec.end).map((item, j) => renderCard(item, sec.start + j)) })
    ] }, sec.group.key || "_")) : /* @__PURE__ */ u("div", { class: "gallery-grid", ref: gridRef, children: list.slice(start, end).map((item, j) => renderCard(item, start + j)) }),
    /* @__PURE__ */ u("div", { class: "gallery-pad", style: { height: outerBottomPad }, "aria-hidden": "true" }),
    /* @__PURE__ */ u("div", { ref: sentinelRef, class: "gallery-sentinel" }),
    loading && /* @__PURE__ */ u("div", { class: "loading-bar", children: /* @__PURE__ */ u("div", { class: "spinner" }) })
  ] });
}

// dev/ui/src/components/ComicsView.jsx
var URL_SCHEMA = {
  sort: { type: "string", default: "date:desc" },
  tag: { type: "csv", default: [] },
  rating: { type: "csv", default: [] },
  q: { type: "string", default: "" },
  title: { type: "string", default: "" },
  mediaType: { type: "csv", default: [] },
  models: { type: "string", default: "" },
  publication: { type: "csv", default: [] },
  aspect: { type: "csv", default: [] },
  dateFrom: { type: "string", default: "" },
  dateTo: { type: "string", default: "" },
  cfgMin: { type: "number", default: null },
  cfgMax: { type: "number", default: null },
  stepsMin: { type: "integer", default: null },
  stepsMax: { type: "integer", default: null },
  usedAsInput: { type: "boolean", default: null },
  workflow: { type: "csv", default: [] },
  workflowMode: { type: "csv", default: [] },
  reaction: { type: "csv", default: [] },
  groupBy: { type: "string", default: "none" },
  groupSort: { type: "string", default: "count:desc" },
  granularity: { type: "string", default: "comic", sticky: true }
};
var GRAIN_OPTIONS = [
  { value: "media", label: "Media" },
  { value: "comic", label: "Comics" }
];
var FACETS = [
  { key: "reaction", kind: "chips", source: "reaction", valuesSource: "reactionTags", options: ["favorite", "feedback:liked", "feedback:disliked"], label: "Reactions" },
  { key: "tag", kind: "multi", source: "tags", label: "Tags" },
  { key: "mediaType", kind: "nested-tree", tree: "type-workflow", label: "Media Type" },
  { key: "aspect", kind: "nested-tree", tree: "aspect", label: "Aspect Ratio", alwaysShowRoots: true },
  { key: "models", kind: "tree", label: "Models" },
  { key: "dateFrom", key2: "dateTo", kind: "date-range", label: "Date" },
  { key: "cfgMin", key2: "cfgMax", kind: "number-range", label: "CFG" },
  { key: "stepsMin", key2: "stepsMax", kind: "number-range", label: "Steps" },
  publicationFacet({ unposted: false }),
  USED_AS_INPUT_FACET
];
var MEDIA_SORT_FIELDS = [{ value: "date", label: "Date" }];
var CONTAINER_SORT_FIELDS = [
  { value: "date", label: "Date" },
  { value: "published", label: "Published" }
];
var MEDIA_GROUP_AXES = [
  { value: "resourceType", label: "Model type" },
  { value: "ecosystem", label: "Ecosystem" },
  { value: "model", label: "Model" },
  { value: "version", label: "Version" },
  { value: "resource", label: "Additional resource" },
  { value: "aspect", label: "Aspect" },
  { value: "sampler", label: "Sampler" },
  { value: "month", label: "Month" },
  { value: "day", label: "Day" },
  { value: "publication", label: "Publication" }
];
var CONTAINER_GROUP_AXES = [
  { value: "month", label: "Month" },
  { value: "day", label: "Day" },
  { value: "publication", label: "Publication" }
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
function ComicsView() {
  const [urlState, updateUrl] = useStickyUrlState(URL_SCHEMA);
  const isMediaGrain = urlState.granularity === "media";
  useDocumentTitle({ place: "comics", grain: isMediaGrain ? "media" : "comic" });
  const [stats, setStats] = d(null);
  const [selectedIds, setSelectedIds] = d(() => /* @__PURE__ */ new Set());
  const searchRef = A(null);
  y(() => {
    getStats().then(setStats).catch(() => {
    });
  }, []);
  const [searchInput, setSearchInput] = useDebouncedUrlParam(urlState.q, updateUrl, "q");
  const [titleInput, setTitleInput] = useDebouncedUrlParam(urlState.title, updateUrl, "title");
  const facetParams = T(() => {
    const rating = urlState.rating?.length ? urlState.rating : void 0;
    return isMediaGrain ? { hasComic: true, rating } : { hasComic: true, dateSource: "container", rating };
  }, [isMediaGrain, urlState.rating]);
  const toggleReaction = q((token) => {
    const next = (urlState.reaction || []).includes(token) ? urlState.reaction.filter((t) => t !== token) : [...urlState.reaction || [], token];
    updateUrl({ reaction: next });
  }, [urlState.reaction, updateUrl]);
  y(() => {
    const sp = new URLSearchParams(location.search);
    if (sp.has("status") || sp.get("groupBy") === "status") replaceState({});
  }, []);
  const query = T(() => galleryRequestQuery(urlState, {
    title: urlState.title,
    publication: urlState.publication.length ? urlState.publication : publicationFromStatus(getRoute()?.params?.status)
  }), [urlState]);
  const galleryFetcher = q((params) => {
    const { granularity: g, ...rest } = params;
    return g === "media" ? getMedia({ ...rest, hasComic: true }) : getComics(rest);
  }, []);
  const reloadEpoch = useIndexEpoch();
  const {
    items,
    groupsMeta,
    total,
    loading,
    sentinelRef,
    setItems,
    hasMore,
    loadMore,
    pending
  } = useGalleryData({ fetcher: galleryFetcher, query, reloadEpoch });
  const grain = isMediaGrain ? "media" : "comic";
  y(() => {
    const focus = readHistoryFocus();
    if (shouldLoadFocusPrefix(focus, { loading, hasMore, idFound: resolveFocusId(items, focus) != null })) {
      loadMore();
    }
  }, [loading, items, hasMore, loadMore]);
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
  const hrefFor = q((item, index) => originNodeHref(item, {
    grain,
    originView: "comics",
    params: getRoute().params,
    index,
    groupsMeta
  }), [grain, urlState, groupsMeta]);
  const onItemActivate = q((e, item, index, landmarks) => {
    if (isMediaGrain && (e.shiftKey || e.metaKey || e.ctrlKey)) {
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
      originView: "comics",
      params: getRoute().params,
      groupsMeta
    });
  }, [grain, isMediaGrain, groupsMeta]);
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
      else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "f") {
        if (isMediaGrain && selectedIds.size) {
          e.preventDefault();
          applyBatchReaction("favorite");
        } else toggleReaction("favorite");
      } else if (isMediaGrain) {
        if (e.key === "Escape") {
          if (selectedIds.size) clearSelection();
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
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedIds, applyBatchReaction, clearSelection, isMediaGrain, toggleReaction]);
  return /* @__PURE__ */ u("main", { class: "main-content", children: [
    /* @__PURE__ */ u("h1", { class: "visually-hidden", children: "Comics" }),
    /* @__PURE__ */ u(
      ComicStatsBar,
      {
        stats,
        comicTotal: total,
        totalLabel: isMediaGrain ? "items" : "comics"
      }
    ),
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
        sortFields: isMediaGrain ? MEDIA_SORT_FIELDS : CONTAINER_SORT_FIELDS,
        groupAxes: isMediaGrain ? MEDIA_GROUP_AXES : CONTAINER_GROUP_AXES,
        search: searchInput,
        onSearchInput: setSearchInput,
        searchRef,
        titleSearch: titleInput,
        onTitleSearchInput: setTitleInput,
        facetParams
      }
    ),
    isMediaGrain && selectedIds.size > 0 && /* @__PURE__ */ u("div", { class: "selection-toolbar", children: [
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
    isMediaGrain ? /* @__PURE__ */ u(k, { children: [
      (items.length > 0 || !loading) && /* @__PURE__ */ u(
        Gallery,
        {
          items,
          grain: "media",
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
    ] }) : /* @__PURE__ */ u(
      ComicGallery,
      {
        items,
        groupsMeta,
        onItemActivate,
        hrefFor,
        sentinelRef,
        loading,
        search: urlState.q,
        hasMore,
        pending
      }
    )
  ] });
}
export {
  ComicsView,
  URL_SCHEMA
};
