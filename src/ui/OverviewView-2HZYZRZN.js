import {
  MediaThumb
} from "./chunk-3Y4VDHN5.js";
import {
  openOriginNode,
  tileHref
} from "./chunk-DDUI6F2D.js";
import {
  TimeText,
  formatDate,
  formatMediaCounts
} from "./chunk-INNL2V6Q.js";
import {
  formatUrl
} from "./chunk-Z6L3MMX7.js";
import {
  d,
  documentLead,
  getOverview,
  u,
  useDocumentTitle,
  y
} from "./chunk-QDJYYBZC.js";

// dev/ui/src/lib/overview-href.js
function hasId(id) {
  return id != null && id !== "";
}
function overviewMarkerHref(marker) {
  if (!marker || typeof marker !== "object") return "";
  if (marker.kind === "batch") {
    if (!hasId(marker.id)) return "";
    if (hasId(marker.mediaId)) {
      return tileHref(
        { id: marker.id, media: [{ mediaId: marker.mediaId }] },
        { grain: "batch" }
      );
    }
    return formatUrl({
      view: "generations",
      entityId: String(marker.id),
      modelTrail: null,
      params: {}
    });
  }
  const view = marker.kind === "comic" ? "comics" : marker.kind === "post" ? "posts" : "";
  if (!view) return "";
  if (!hasId(marker.id)) return "";
  return formatUrl({
    view,
    entityId: String(marker.id),
    modelTrail: null,
    params: {}
  });
}
function overviewMarkerLead(marker) {
  if (!marker || typeof marker !== "object") return "";
  const date = marker.dateLabel || "";
  if (marker.kind === "batch") {
    if (hasId(marker.mediaId)) {
      const audioTitle = String(marker.audioTitle || "").trim();
      return documentLead({
        place: "media",
        type: marker.mediaType,
        title: audioTitle,
        date
      });
    }
    return documentLead({
      place: "generation",
      date,
      members: Array.isArray(marker.members) ? marker.members : []
    });
  }
  if (marker.kind === "comic") {
    return documentLead({
      place: "comic",
      name: marker.name,
      status: marker.status,
      date
    });
  }
  if (marker.kind === "post") {
    return documentLead({
      place: "post",
      title: marker.title,
      status: marker.status,
      date
    });
  }
  return "";
}

// dev/ui/src/components/OverviewView.jsx
function laneHref(view, params) {
  return formatUrl({ view, entityId: null, modelTrail: null, params: params || {} });
}
function onSpaLink(e) {
  const href = e.currentTarget && e.currentTarget.getAttribute("href");
  openOriginNode(e, { href });
}
function onSpaLinkMouseDown(e) {
  if (e.button === 1) onSpaLink(e);
}
function monthLabel(month) {
  const [y2, m] = String(month).split("-").map(Number);
  if (!y2 || !m) return month;
  const d2 = new Date(Date.UTC(y2, m - 1, 1));
  return d2.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
function UnknownNotice({ unknownView }) {
  return /* @__PURE__ */ u("p", { class: "overview-unknown", children: [
    "Unknown page \u2014 ",
    '"',
    unknownView || "unknown",
    '"',
    "."
  ] });
}
function MarkerThumb({ thumb }) {
  if (!thumb) return /* @__PURE__ */ u("span", { class: "overview-marker-empty" });
  return /* @__PURE__ */ u(
    MediaThumb,
    {
      type: thumb.type,
      thumbnailPath: thumb.thumbnailPath,
      coverPath: thumb.coverPath
    }
  );
}
function Marker({ marker }) {
  const statusClass = marker.kind === "batch" ? "overview-marker-batch" : `overview-marker-${marker.status || "published"}`;
  const title = overviewMarkerLead({
    ...marker,
    dateLabel: formatDate(marker.titleAt)
  });
  const href = overviewMarkerHref(marker);
  const Tag = href ? "a" : "span";
  return /* @__PURE__ */ u(
    Tag,
    {
      class: `overview-marker ${statusClass}`,
      title,
      href: href || void 0,
      onClick: href ? onSpaLink : void 0,
      onMouseDown: href ? onSpaLinkMouseDown : void 0,
      children: /* @__PURE__ */ u(MarkerThumb, { thumb: marker.thumb })
    }
  );
}
function Lane({ title, counts, markers, more, headerHref, moreHref }) {
  const countLine = formatMediaCounts(counts);
  return /* @__PURE__ */ u("div", { class: "overview-lane", children: [
    /* @__PURE__ */ u("a", { class: "overview-lane-header", href: headerHref, onClick: onSpaLink, onMouseDown: onSpaLinkMouseDown, children: [
      /* @__PURE__ */ u("span", { class: "overview-lane-title", children: title }),
      countLine && /* @__PURE__ */ u("span", { class: "overview-lane-counts", children: countLine })
    ] }),
    (markers.length > 0 || more > 0) && /* @__PURE__ */ u("div", { class: "overview-markers", children: [
      markers.map((m) => /* @__PURE__ */ u(Marker, { marker: m }, `${m.kind}-${m.id}`)),
      more > 0 && /* @__PURE__ */ u("a", { class: "overview-more", href: moreHref, onClick: onSpaLink, onMouseDown: onSpaLinkMouseDown, children: [
        "+",
        more,
        " more"
      ] })
    ] })
  ] });
}
function MonthBlock({ bucket, createdTitle = "Generations" }) {
  const monthRange = { dateFrom: bucket.dateFrom, dateTo: bucket.dateTo };
  const hasGenerations = bucket.created.batchesTotal > 0;
  const hasPosts = (bucket.published?.total || 0) > 0;
  const hasComics = (bucket.comics?.total || 0) > 0;
  return /* @__PURE__ */ u("section", { class: "overview-month", children: [
    /* @__PURE__ */ u("h2", { class: "overview-month-title", children: /* @__PURE__ */ u(TimeText, { at: bucket.month, children: monthLabel(bucket.month) }) }),
    hasGenerations && /* @__PURE__ */ u(
      Lane,
      {
        title: createdTitle,
        counts: bucket.created.counts,
        markers: bucket.created.markers,
        more: bucket.created.more,
        headerHref: laneHref("generations", monthRange),
        moreHref: laneHref("generations", monthRange)
      }
    ),
    hasPosts && /* @__PURE__ */ u(
      Lane,
      {
        title: "Posts",
        counts: bucket.published.counts,
        markers: bucket.published.markers,
        more: bucket.published.more,
        headerHref: laneHref("posts", monthRange),
        moreHref: laneHref("posts", monthRange)
      }
    ),
    hasComics && /* @__PURE__ */ u(
      Lane,
      {
        title: "Comics",
        counts: bucket.comics.counts,
        markers: bucket.comics.markers,
        more: bucket.comics.more,
        headerHref: laneHref("comics", monthRange),
        moreHref: laneHref("comics", monthRange)
      }
    )
  ] });
}
function OverviewView({ viewWasUnknown, unknownView }) {
  const [data, setData] = d(null);
  const [status, setStatus] = d("loading");
  useDocumentTitle({ place: "overview" });
  y(() => {
    let cancelled = false;
    setStatus("loading");
    getOverview().then((d2) => {
      if (!cancelled) {
        setData(d2);
        setStatus("ready");
      }
    }).catch(() => {
      if (!cancelled) setStatus("error");
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (status === "loading") {
    return /* @__PURE__ */ u("main", { class: "main-content", children: [
      /* @__PURE__ */ u("h1", { class: "visually-hidden", children: "Overview" }),
      /* @__PURE__ */ u("div", { class: "loading-bar", children: /* @__PURE__ */ u("div", { class: "spinner" }) })
    ] });
  }
  if (status === "error" || !data) {
    return /* @__PURE__ */ u("main", { class: "main-content", children: [
      /* @__PURE__ */ u("h1", { class: "visually-hidden", children: "Overview" }),
      viewWasUnknown && /* @__PURE__ */ u(UnknownNotice, { unknownView }),
      /* @__PURE__ */ u("div", { class: "empty-state", children: [
        /* @__PURE__ */ u("h2", { children: "Overview unavailable" }),
        /* @__PURE__ */ u("p", { children: "Could not load activity." })
      ] })
    ] });
  }
  const { upcoming = [], months = [], undatedDrafts } = data;
  const undatedTotal = undatedDrafts?.total || 0;
  const isEmpty = !upcoming.length && !months.length && undatedTotal === 0;
  if (isEmpty) {
    return /* @__PURE__ */ u("main", { class: "main-content", children: [
      /* @__PURE__ */ u("h1", { class: "visually-hidden", children: "Overview" }),
      viewWasUnknown && /* @__PURE__ */ u(UnknownNotice, { unknownView }),
      /* @__PURE__ */ u("div", { class: "empty-state", children: [
        /* @__PURE__ */ u("h2", { children: "No activity yet" }),
        /* @__PURE__ */ u("p", { children: "Download your generations and posts to see your activity." })
      ] })
    ] });
  }
  return /* @__PURE__ */ u("main", { class: "main-content overview-view", children: [
    viewWasUnknown && /* @__PURE__ */ u(UnknownNotice, { unknownView }),
    /* @__PURE__ */ u("h1", { class: "overview-title", children: "Overview" }),
    upcoming.length > 0 && /* @__PURE__ */ u("section", { class: "overview-upcoming", children: [
      /* @__PURE__ */ u("h2", { class: "overview-section-title", children: "Upcoming" }),
      upcoming.map((b) => /* @__PURE__ */ u(MonthBlock, { bucket: b }, b.month))
    ] }),
    months.map((b) => /* @__PURE__ */ u(MonthBlock, { bucket: b }, b.month)),
    undatedTotal > 0 && /* @__PURE__ */ u("section", { class: "overview-undated", children: [
      /* @__PURE__ */ u("h2", { class: "overview-section-title", children: "Dateless drafts" }),
      /* @__PURE__ */ u("p", { class: "overview-undated-sub", children: [
        "Drafts whose saved JSON predates the image-createdAt field.",
        " ",
        /* @__PURE__ */ u("a", { class: "overview-undated-link", href: laneHref("posts", { publication: "draft" }), onClick: onSpaLink, onMouseDown: onSpaLinkMouseDown, children: "View all" })
      ] }),
      /* @__PURE__ */ u("div", { class: "overview-markers", children: [
        (undatedDrafts.markers || []).map((m) => /* @__PURE__ */ u(Marker, { marker: m }, `${m.kind}-${m.id}`)),
        undatedDrafts.more > 0 && /* @__PURE__ */ u("a", { class: "overview-more", href: laneHref("posts", { publication: "draft" }), onClick: onSpaLink, onMouseDown: onSpaLinkMouseDown, children: [
          "+",
          undatedDrafts.more,
          " more"
        ] })
      ] })
    ] })
  ] });
}
export {
  OverviewView
};
