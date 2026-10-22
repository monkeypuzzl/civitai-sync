import {
  ChipOverflow
} from "./chunk-KM3EBJGK.js";
import {
  openOriginNode
} from "./chunk-R5EOPP5W.js";
import {
  TimeText
} from "./chunk-OJSJHKVX.js";
import {
  originNeighbourHref,
  originSiblingArrows,
  readHistoryBag,
  replaceOriginNeighbour
} from "./chunk-JB7JSPAG.js";
import {
  getRoute
} from "./chunk-CPLX52FD.js";
import {
  A,
  _2 as _,
  chipDatetime,
  d,
  formatDate,
  k,
  q,
  relativeTime,
  u,
  y
} from "./chunk-OGIWOTNU.js";

// dev/ui/src/components/DetailPage.jsx
function DetailMain({
  align = "start",
  header = null,
  chrome = null,
  scrollRef,
  onPadClick,
  landmark = true,
  children
}) {
  const Tag = landmark ? "main" : "div";
  const center = align === "center";
  return /* @__PURE__ */ u(Tag, { class: "detail-main", children: [
    /* @__PURE__ */ u(
      "div",
      {
        class: `detail-main-scroll${center ? " detail-main-center" : ""}`,
        ref: scrollRef,
        onClick: onPadClick,
        children: [
          header,
          children
        ]
      }
    ),
    /* @__PURE__ */ u("div", { class: "detail-main-chrome", children: chrome })
  ] });
}
function DetailPage({
  class: className = "",
  scrollKey,
  align = "start",
  flow = false,
  header = null,
  sidebar = null,
  chrome = null,
  children
}) {
  const mainRef = A(null);
  const sideRef = A(null);
  _(() => {
    try {
      window.scrollTo(0, 0);
    } catch {
    }
    if (mainRef.current) mainRef.current.scrollTop = 0;
    if (sideRef.current) sideRef.current.scrollTop = 0;
  }, [scrollKey]);
  const root = ["detail-page", flow ? "detail-page-flow" : "", className].filter(Boolean).join(" ");
  return /* @__PURE__ */ u("div", { class: root, children: /* @__PURE__ */ u("div", { class: "detail-columns", children: [
    /* @__PURE__ */ u(
      DetailMain,
      {
        align,
        header,
        chrome,
        scrollRef: mainRef,
        children
      }
    ),
    sidebar != null ? /* @__PURE__ */ u("aside", { class: "detail-sidebar", ref: sideRef, children: sidebar }) : null
  ] }) });
}

// dev/ui/src/components/EntityHeader.jsx
function reactionTone(chip) {
  if (chip && chip.title === "Reactions: Favorite") return " favorite";
  if (chip && chip.title === "Reactions: Liked") return " liked";
  return "";
}
function dismissFilter(event, href) {
  if (!event || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openOriginNode(event, { href, bag: readHistoryBag() });
}
function FilterChip({ filter, clusterOpen, onToggleCluster }) {
  const text = filter && filter.text != null ? String(filter.text) : "";
  const tip = filter && filter.title ? String(filter.title) : "";
  const dest = filter && filter.href ? String(filter.href) : "";
  const aria = filter && filter.ariaLabel ? String(filter.ariaLabel) : `Remove ${tip || text}`;
  if (filter && filter.kind === "cluster") {
    return /* @__PURE__ */ u("span", { class: "tag-chip active tree-picker-chip chip-cluster", children: [
      /* @__PURE__ */ u("button", { type: "button", class: "chip-cluster-show", onClick: () => onToggleCluster(dest), children: clusterOpen ? "Show less" : text }),
      /* @__PURE__ */ u(
        "a",
        {
          class: "chip-cluster-remove",
          href: dest,
          title: tip || void 0,
          "aria-label": aria,
          onClick: (e) => dismissFilter(e, dest),
          children: "\xD7"
        }
      )
    ] });
  }
  const except = filter && filter.kind === "except";
  return /* @__PURE__ */ u(
    "a",
    {
      class: `tag-chip tree-picker-chip remove${except ? " exception" : ` active${reactionTone(filter)}`}`,
      href: dest,
      title: tip || void 0,
      "aria-label": aria,
      onClick: (e) => dismissFilter(e, dest),
      children: [
        text,
        " ",
        "\xD7"
      ]
    }
  );
}
function EntityHeader({ title, label, date, chips, href, filters }) {
  const heading = String(title || "").trim();
  const name = String(label || "").trim();
  const when = date ? formatDate(date) : "";
  const rel = date ? relativeTime(date) : "";
  const row = Array.isArray(chips) ? chips.filter(Boolean) : [];
  const filterRow = Array.isArray(filters) ? filters.filter(Boolean) : [];
  const [openCluster, setOpenCluster] = d("");
  if (!heading && !name && !when && !row.length && !filterRow.length) return null;
  const link = String(href || "").trim();
  const body = /* @__PURE__ */ u("header", { children: [
    heading ? /* @__PURE__ */ u("h1", { class: "post-detail-title", children: heading }) : null,
    name ? /* @__PURE__ */ u("div", { class: "meta-label", children: name }) : null,
    when ? /* @__PURE__ */ u("div", { class: "post-detail-date", children: [
      /* @__PURE__ */ u(TimeText, { at: date, children: when }),
      rel ? /* @__PURE__ */ u("span", { class: "text-muted", children: [
        "\xB7",
        " ",
        /* @__PURE__ */ u(TimeText, { at: date, children: rel })
      ] }) : null
    ] }) : null,
    row.length > 0 ? /* @__PURE__ */ u("ul", { class: "meta-params entity-header-chips", children: row.map((chip, i) => {
      const text = chip && typeof chip === "object" ? chip.text : String(chip || "");
      const title2 = chip && typeof chip === "object" ? String(chip.title || "").trim() : "";
      const datetime = chipDatetime(text);
      return /* @__PURE__ */ u("li", { class: "param-chip", title: title2 || void 0, children: datetime ? /* @__PURE__ */ u(TimeText, { datetime, children: text }) : text }, `${text}:${i}`);
    }) }) : null
  ] });
  return /* @__PURE__ */ u("div", { class: "meta-section entity-header", children: [
    link ? /* @__PURE__ */ u(
      "a",
      {
        class: "entity-header-link",
        href: link,
        onClick: (e) => openOriginNode(e, { href: link, bag: readHistoryBag() }),
        children: body
      }
    ) : body,
    filterRow.length > 0 ? /* @__PURE__ */ u(k, { children: [
      /* @__PURE__ */ u(ChipOverflow, { maxLines: 2, class: "entity-header-filters", children: filterRow.map((filter, i) => /* @__PURE__ */ u(
        FilterChip,
        {
          filter,
          clusterOpen: !!(filter.kind === "cluster" && openCluster && openCluster === filter.href),
          onToggleCluster: (href2) => setOpenCluster((current) => current === href2 ? "" : href2)
        },
        `${filter.text}:${i}`
      )) }),
      filterRow.filter((filter) => filter.kind === "cluster" && filter.href === openCluster).map((filter) => /* @__PURE__ */ u("div", { class: "chip-cluster-members", children: (filter.members || []).map((member, i) => /* @__PURE__ */ u(FilterChip, { filter: member }, `${member.text}:${i}`)) }, filter.href))
    ] }) : null
  ] });
}

// dev/ui/src/components/OriginSiblingNav.jsx
function overlayOpen() {
  try {
    return Boolean(document.querySelector(".media-fullscreen"));
  } catch {
    return false;
  }
}
function typingTarget(el) {
  if (!el) return false;
  const t = el.tagName;
  return t === "INPUT" || t === "TEXTAREA" || el.isContentEditable;
}
function onArrowClick(e, direction, go, enabled) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  if (!enabled) return;
  go(direction);
}
function OriginSiblingNav({ origin, routeParams, ignoreOverlay = true }) {
  const inFlight = A(false);
  const operable = origin != null && typeof origin === "object";
  const view = (() => {
    try {
      return getRoute().view;
    } catch {
      return "media";
    }
  })();
  const go = q((direction) => {
    if (inFlight.current || !origin) return;
    const id = direction < 0 ? origin.prevId : origin.nextId;
    const slot = direction < 0 ? origin.prevSlot : origin.nextSlot;
    const slotInUrl = direction < 0 ? origin.prevSlotInUrl : origin.nextSlotInUrl;
    if (id == null || id === "") return;
    inFlight.current = true;
    try {
      replaceOriginNeighbour({
        id,
        slot,
        slotInUrl,
        view,
        routeParams,
        origin
      });
    } finally {
      inFlight.current = false;
    }
  }, [origin, routeParams, view]);
  y(() => {
    if (!operable) return void 0;
    function onKey(e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (typingTarget(e.target)) return;
      if (ignoreOverlay && overlayOpen()) return;
      if (inFlight.current) return;
      e.preventDefault();
      go(e.key === "ArrowLeft" ? -1 : 1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, ignoreOverlay, operable]);
  if (!operable) return null;
  const prevHref = originNeighbourHref({
    id: origin.prevId,
    slot: origin.prevSlot,
    slotInUrl: origin.prevSlotInUrl,
    view,
    routeParams,
    origin
  });
  const nextHref = originNeighbourHref({
    id: origin.nextId,
    slot: origin.nextSlot,
    slotInUrl: origin.nextSlotInUrl,
    view,
    routeParams,
    origin
  });
  const arrows = originSiblingArrows(origin);
  return /* @__PURE__ */ u(k, { children: [
    /* @__PURE__ */ u(
      "a",
      {
        class: "page-nav-arrow prev",
        href: prevHref || void 0,
        title: arrows.prev.title,
        "aria-label": arrows.prev.title,
        "aria-disabled": arrows.prev.enabled ? void 0 : "true",
        onClick: (e) => onArrowClick(e, -1, go, arrows.prev.enabled),
        children: "\u2039"
      }
    ),
    /* @__PURE__ */ u(
      "a",
      {
        class: "page-nav-arrow next",
        href: nextHref || void 0,
        title: arrows.next.title,
        "aria-label": arrows.next.title,
        "aria-disabled": arrows.next.enabled ? void 0 : "true",
        onClick: (e) => onArrowClick(e, 1, go, arrows.next.enabled),
        children: "\u203A"
      }
    )
  ] });
}

export {
  DetailMain,
  DetailPage,
  EntityHeader,
  OriginSiblingNav
};
