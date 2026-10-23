import {
  containerFilterChips,
  useScopeChipTree
} from "./chunk-FXP5WZOJ.js";
import "./chunk-CI4B4ALB.js";
import "./chunk-LNGUPSA6.js";
import {
  ModelMembership,
  WorkflowSection,
  mediaFileCopy,
  unionContainerWorkflows,
  workflowSidebarLine
} from "./chunk-FQAGHCNK.js";
import {
  DetailPage,
  EntityHeader,
  OriginSiblingNav
} from "./chunk-R7JIPL56.js";
import "./chunk-TQWSKHC6.js";
import {
  unionContainerResources
} from "./chunk-QOFOVBU3.js";
import {
  MemoMediaTile
} from "./chunk-M6EGXWFI.js";
import {
  useMagicEscape
} from "./chunk-CSCBF7FS.js";
import "./chunk-3YME5QSH.js";
import "./chunk-XQGXV6CL.js";
import {
  OpenFolderButton,
  OpenJsonButton
} from "./chunk-LSVDCSFO.js";
import {
  detailCacheKey,
  loadContainerDetail,
  prefetchOriginNeighbours,
  useHeldDetail
} from "./chunk-5PKL4AOG.js";
import "./chunk-XQFHA4YD.js";
import {
  useOwnModelsKnown,
  useOwnModelsRevision
} from "./chunk-JLH4BCQU.js";
import "./chunk-FN3QFPOE.js";
import {
  memberMediaHref,
  openPreservingOriginBag
} from "./chunk-5C3I5ONU.js";
import {
  TimeText
} from "./chunk-X3SNRSQH.js";
import {
  containerUnfilteredHref,
  quietSlotPatch
} from "./chunk-FK7RTYYB.js";
import {
  useIndexEpoch
} from "./chunk-ECN4OFEF.js";
import {
  originMembershipKind,
  pushState,
  replaceState
} from "./chunk-K4YW4PKR.js";
import {
  A,
  T,
  browsingLevelLabel,
  browsingLevelOf,
  copyToClipboard,
  d,
  formatDate,
  genreLabel,
  k,
  memberReactionFields,
  normalizeMediaId,
  u,
  useDocumentTitle,
  y
} from "./chunk-GOKE7NMO.js";

// dev/ui/src/components/ComicDetailView.jsx
function backToComics() {
  pushState({ view: "comics", entityId: null });
}
function panelSelectId(m) {
  if (m?.mediaId != null && m.mediaId !== "") return String(m.mediaId);
  if (m?.panelMediaId) return String(m.panelMediaId);
  if (m?.imageId != null) return normalizeMediaId(m.imageId);
  if (m?.panelId != null) return `comic-panel:${m.panelId}`;
  return "";
}
function isReadingPanel(m) {
  return m && m.role !== "cover" && m.role !== "hero";
}
function panelToTile(m, selectId) {
  const inputs = Array.isArray(m.inputs) ? m.inputs : [];
  const kinds = [];
  const seen = /* @__PURE__ */ new Set();
  for (const inp of inputs) {
    if (!inp?.kind || seen.has(inp.kind)) continue;
    seen.add(inp.kind);
    kinds.push(inp.kind);
  }
  const marks = memberReactionFields(m);
  return {
    id: selectId,
    type: m.type || "image",
    hasInputs: inputs.length > 0,
    inputKinds: kinds,
    tags: marks.tags,
    reactions: marks.reactions,
    media: [{
      mediaId: selectId,
      type: m.type || "image",
      thumbnailPath: m.thumbnailPath,
      tags: m.tags || [],
      duration: m.duration
    }]
  };
}
function comicDetailDate(comic) {
  const status = comic.status;
  const chapters = Array.isArray(comic.chapters) ? comic.chapters : [];
  if (status === "draft") return comic.createdAt;
  if (status === "published") {
    let best = "";
    let bestT = -Infinity;
    const now = Date.now();
    for (const ch of chapters) {
      if (ch.status !== "Published" || !ch.publishedAt) continue;
      const t = new Date(ch.publishedAt).getTime();
      if (Number.isNaN(t) || t > now) continue;
      if (t >= bestT) {
        bestT = t;
        best = ch.publishedAt;
      }
    }
    return best || comic.createdAt;
  }
  if (status === "scheduled") {
    let best = "";
    let bestT = Infinity;
    for (const ch of chapters) {
      if (ch.status !== "Scheduled" || !ch.publishedAt) continue;
      const t = new Date(ch.publishedAt).getTime();
      if (Number.isNaN(t)) continue;
      if (t < bestT) {
        bestT = t;
        best = ch.publishedAt;
      }
    }
    return best || comic.createdAt;
  }
  return comic.createdAt;
}
function isLiveEarlyAccess(ch, now = Date.now()) {
  if (!ch || ch.availability !== "EarlyAccess") return false;
  if (!ch.earlyAccessEndsAt) return false;
  const t = new Date(ch.earlyAccessEndsAt).getTime();
  return Number.isFinite(t) && t > now;
}
function chromeFrom(comic, raw) {
  const cover = (comic.media || []).find((m) => m.role === "cover") || null;
  const hero = (comic.media || []).find((m) => m.role === "hero") || null;
  const date = comic.date || (comic.createdAt ? String(comic.createdAt).slice(0, 10) : "");
  let coverOut = cover;
  let heroOut = hero;
  if (!coverOut) {
    const coverId = raw?.coverImage?.id ?? raw?.coverImageId;
    if (coverId != null && date) {
      coverOut = {
        role: "cover",
        imageId: coverId,
        thumbnailPath: `/media/comics/${date}/${comic.id}/cover_${coverId}.jpeg`
      };
    }
  }
  if (!heroOut) {
    const heroId = raw?.heroImage?.id ?? raw?.heroImageId;
    if (heroId != null && date) {
      heroOut = {
        role: "hero",
        imageId: heroId,
        thumbnailPath: `/media/comics/${date}/${comic.id}/hero_${heroId}.jpeg`
      };
    }
  }
  return { cover: coverOut, hero: heroOut };
}
function findRawPanel(raw, panelId) {
  if (panelId == null || !raw) return null;
  for (const ch of raw.chapters || []) {
    const hit = (ch.panels || []).find((p) => p && p.id === panelId);
    if (hit) return hit;
  }
  return null;
}
function referenceImages(reference) {
  const images = Array.isArray(reference?.images) ? reference.images : [];
  return images.map((img, i) => {
    const imageId = img?.imageId ?? img?.image?.id;
    if (imageId == null) return null;
    const id = normalizeMediaId(imageId);
    return {
      key: `${reference.id}-${id}-${i}`,
      id,
      thumbnailPath: `/media/inputs/${id}.jpeg`,
      name: reference.name || "",
      type: reference.type || ""
    };
  }).filter(Boolean);
}
function chapterBadgeClass(status) {
  if (status === "Scheduled") return "comic-chapter-badge comic-chapter-badge-scheduled";
  if (status === "Published") return "comic-chapter-badge comic-chapter-badge-published";
  return "comic-chapter-badge comic-chapter-badge-draft";
}
function ComicDetailView({ comicId, params }) {
  useMagicEscape();
  const modelTree = useScopeChipTree(params && params.models);
  const [copied, setCopied] = d(null);
  const quietAppliedRef = A(null);
  const ownRev = useOwnModelsRevision();
  const ownKnown = useOwnModelsKnown();
  const indexEpoch = useIndexEpoch();
  const cacheKey = detailCacheKey({ view: "comics", id: comicId, params }) + `:own${ownRev}:ix${indexEpoch}`;
  const held = useHeldDetail(cacheKey, () => loadContainerDetail("comics", comicId, params));
  const data = held.displayed;
  const onRoute = held.shownKey === cacheKey && data?.index?.id != null && String(data.index.id) === String(comicId);
  async function doCopy(text, label) {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }
  const comic = data?.index;
  const raw = data?.raw;
  const origin = comic?.origin || null;
  y(() => {
    if (!onRoute || !origin) return void 0;
    prefetchOriginNeighbours({ view: "comics", routeParams: params, origin });
    return void 0;
  }, [onRoute, origin, params]);
  y(() => {
    if (!onRoute || !origin || !comicId) return;
    const nextParams = { ...params || {} };
    let changed = false;
    if (origin.omitFrom && nextParams.from) {
      delete nextParams.from;
      changed = true;
    }
    const slotPatch = quietSlotPatch({ urlSlot: nextParams.slot, origin });
    if (slotPatch) {
      if (slotPatch.slot) nextParams.slot = slotPatch.slot;
      else delete nextParams.slot;
      changed = true;
    }
    if (!changed) return;
    const quietKey = `${comicId}|${JSON.stringify(nextParams)}`;
    if (quietAppliedRef.current === quietKey) return;
    quietAppliedRef.current = quietKey;
    replaceState({
      view: "comics",
      entityId: comicId,
      params: nextParams
    });
  }, [onRoute, origin, comicId, params]);
  const readingMedia = T(() => {
    if (!comic || !Array.isArray(comic.media)) return [];
    return comic.media.filter(
      (m) => isReadingPanel(m) && panelSelectId(m) && m.inWalk !== false
    );
  }, [comic]);
  useDocumentTitle(
    data?.index ? {
      place: "comic",
      name: data.index.name,
      status: data.index.status,
      date: formatDate(comicDetailDate(data.index))
    } : { place: "comic" }
  );
  const scrollKey = data?.index?.id || comicId;
  if (!data && !held.failed) {
    return /* @__PURE__ */ u(DetailPage, { flow: true, scrollKey, sidebar: /* @__PURE__ */ u(k, {}) });
  }
  if (!data || !data.index) {
    return /* @__PURE__ */ u(DetailPage, { flow: true, scrollKey, sidebar: /* @__PURE__ */ u(k, {}), children: /* @__PURE__ */ u("div", { class: "empty-state", children: [
      /* @__PURE__ */ u("h1", { children: "Comic not found" }),
      /* @__PURE__ */ u("p", { children: "This comic may not have been downloaded yet." }),
      /* @__PURE__ */ u("button", { class: "meta-action", onClick: backToComics, children: "Back to Comics" })
    ] }) });
  }
  const dateStr = comicDetailDate(comic);
  const { cover, hero } = chromeFrom(comic, raw);
  const comicAltName = String(comic.name || "").trim();
  const chapters = [...comic.chapters || []].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  );
  const panelsByChapter = /* @__PURE__ */ new Map();
  const shownPanels = [];
  for (const ch of chapters) {
    const panels = readingMedia.filter((m) => m.chapterId === ch.id).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    panelsByChapter.set(ch.id, panels);
    shownPanels.push(...panels);
  }
  const resourceRows = unionContainerResources(shownPanels);
  const modelHrefs = resourceRows.map((row) => row.href).filter(Boolean);
  const soleModelHref = modelHrefs.length === 1 ? modelHrefs[0] : "";
  const originScope = params && params.from || origin && origin.scope || null;
  const originKind = originMembershipKind(originScope);
  const workflowLines = unionContainerWorkflows(shownPanels).map((id) => workflowSidebarLine(id, originScope, { comics: [comic] })).filter(Boolean);
  const deletedPanels = comic.deletedPanels && comic.deletedPanels.length ? comic.deletedPanels : raw?.deletedPanels || [];
  const references = Array.isArray(raw?.references) ? raw.references : [];
  const genreText = genreLabel(comic.genre);
  const comicDate = comic.date || (comic.createdAt ? String(comic.createdAt).slice(0, 10) : "");
  const mediaCopy = mediaFileCopy({
    count: readingMedia.length,
    types: readingMedia.map((m) => m.type),
    comicFolder: true
  });
  const mediaFolderPath = readingMedia.length === 1 ? readingMedia[0].thumbnailPath || null : readingMedia.length > 1 && comicDate ? `/media/comics/${comicDate}/${comic.id}` : null;
  return /* @__PURE__ */ u(
    DetailPage,
    {
      flow: true,
      scrollKey,
      chrome: /* @__PURE__ */ u(OriginSiblingNav, { origin, routeParams: params }),
      sidebar: /* @__PURE__ */ u(k, { children: [
        /* @__PURE__ */ u(
          EntityHeader,
          {
            title: comic.name,
            label: "Comic",
            date: dateStr,
            href: containerUnfilteredHref("comics", comicId, params),
            filters: containerFilterChips("comics", comicId, params, { modelTree, ownKnown })
          }
        ),
        resourceRows.length > 0 && /* @__PURE__ */ u(
          ModelMembership,
          {
            rows: resourceRows,
            soleHref: soleModelHref,
            sectionClass: originKind === "model" ? "meta-section meta-section-origin" : "meta-section"
          }
        ),
        workflowLines.length > 0 ? /* @__PURE__ */ u(WorkflowSection, { lines: workflowLines }) : null,
        genreText ? /* @__PURE__ */ u("div", { class: "meta-section", children: [
          /* @__PURE__ */ u("h2", { class: "meta-label", children: "Genre" }),
          /* @__PURE__ */ u("ul", { class: "meta-tags", children: /* @__PURE__ */ u("li", { class: "meta-tag", children: genreText }) })
        ] }) : null,
        /* @__PURE__ */ u("div", { class: "meta-section", children: [
          /* @__PURE__ */ u("h2", { class: "meta-label", children: "Files" }),
          /* @__PURE__ */ u("div", { class: "meta-actions", children: [
            mediaCopy && mediaFolderPath ? /* @__PURE__ */ u(
              OpenFolderButton,
              {
                path: mediaFolderPath,
                class: "meta-action",
                label: mediaCopy.label,
                title: mediaCopy.title
              }
            ) : null,
            /* @__PURE__ */ u(
              OpenJsonButton,
              {
                kind: "comic",
                id: comic.id,
                class: "meta-action",
                title: "Open Comic folder, with data file selected"
              }
            )
          ] })
        ] }),
        comic.url ? /* @__PURE__ */ u("div", { class: "meta-section", children: /* @__PURE__ */ u("div", { class: "meta-actions", children: /* @__PURE__ */ u(
          "a",
          {
            class: "meta-action",
            href: comic.url,
            target: "_blank",
            rel: "noopener noreferrer",
            title: "Open this comic on Civitai",
            children: "\u{1F517} On Civitai"
          }
        ) }) }) : null
      ] }),
      children: [
        (cover || hero) && /* @__PURE__ */ u("div", { class: `comic-detail-chrome${hero ? " has-hero" : ""}`, children: [
          cover && cover.thumbnailPath && /* @__PURE__ */ u("div", { class: "comic-chrome-cover", children: /* @__PURE__ */ u("img", { src: cover.thumbnailPath, alt: comicAltName ? `Cover of ${comicAltName}` : "Cover" }) }),
          hero && hero.thumbnailPath && /* @__PURE__ */ u("div", { class: "comic-chrome-hero", children: /* @__PURE__ */ u("img", { src: hero.thumbnailPath, alt: comicAltName ? `Hero of ${comicAltName}` : "Hero" }) })
        ] }),
        comic.description && /* @__PURE__ */ u("div", { class: "post-detail-description", children: /* @__PURE__ */ u("p", { children: comic.description }) }),
        chapters.map((ch) => {
          const panels = panelsByChapter.get(ch.id) || [];
          const liveEa = isLiveEarlyAccess(ch);
          const buzz = ch.earlyAccessConfig && ch.earlyAccessConfig.buzzPrice;
          return /* @__PURE__ */ u("section", { class: "comic-chapter", children: [
            /* @__PURE__ */ u("div", { class: "comic-chapter-header", children: [
              /* @__PURE__ */ u("h2", { class: "comic-chapter-title", children: ch.name || `Chapter ${(ch.position ?? 0) + 1}` }),
              /* @__PURE__ */ u("span", { class: chapterBadgeClass(ch.status), children: ch.status || "Draft" }),
              liveEa && /* @__PURE__ */ u("span", { class: "comic-ea-overlay", children: [
                "Early Access",
                buzz != null ? ` \xB7 ${buzz} Buzz` : ""
              ] })
            ] }),
            panels.length > 0 ? /* @__PURE__ */ u("div", { class: "post-detail-media-grid", children: panels.map((m) => {
              const selectId = panelSelectId(m);
              const rawPanel = findRawPanel(raw, m.panelId);
              const meta = m.meta || rawPanel?.image?.meta || null;
              const href = memberMediaHref(selectId, params, {
                slot: m.slot,
                originView: "comics",
                granularity: "comic",
                slotInUrl: m.slotInUrl
              });
              return /* @__PURE__ */ u("div", { class: "post-media-card", children: [
                /* @__PURE__ */ u("div", { class: "post-media-card-visual", children: /* @__PURE__ */ u(
                  MemoMediaTile,
                  {
                    item: panelToTile(m, selectId),
                    href,
                    onActivate: (e) => openPreservingOriginBag(e, href)
                  }
                ) }),
                /* @__PURE__ */ u(
                  MediaCardMeta,
                  {
                    media: m,
                    rawPanel,
                    meta,
                    doCopy,
                    copied
                  }
                )
              ] }, selectId || m.panelId);
            }) }) : /* @__PURE__ */ u("p", { class: "text-muted comic-chapter-empty", children: "No ready panels in this chapter." })
          ] }, ch.id);
        }),
        references.length > 0 && /* @__PURE__ */ u("section", { class: "comic-references", children: [
          /* @__PURE__ */ u("h2", { class: "comic-section-heading", children: "References" }),
          /* @__PURE__ */ u("div", { class: "post-detail-media-grid", children: references.map((ref) => referenceImages(ref).map((img) => {
            const href = memberMediaHref(img.id, params, {
              originView: "comics",
              granularity: "comic"
            });
            return /* @__PURE__ */ u("div", { class: "post-media-card", children: [
              /* @__PURE__ */ u("div", { class: "post-media-card-visual", children: /* @__PURE__ */ u(
                MemoMediaTile,
                {
                  item: {
                    id: img.id,
                    type: "image",
                    media: [{ mediaId: img.id, type: "image", thumbnailPath: img.thumbnailPath, tags: [] }]
                  },
                  href,
                  onActivate: (e) => openPreservingOriginBag(e, href)
                }
              ) }),
              /* @__PURE__ */ u("div", { class: "post-media-card-meta", children: [
                ref.name && /* @__PURE__ */ u("div", { class: "post-media-dims", children: ref.name }),
                ref.type && /* @__PURE__ */ u("span", { class: "param-chip", children: ref.type })
              ] })
            ] }, img.key);
          })) })
        ] }),
        deletedPanels.length > 0 && /* @__PURE__ */ u("section", { class: "comic-removed", children: [
          /* @__PURE__ */ u("h2", { class: "comic-section-heading", children: "Removed from chapter" }),
          /* @__PURE__ */ u("ul", { class: "comic-removed-list", children: deletedPanels.map((p) => /* @__PURE__ */ u("li", { children: [
            "Panel ",
            p.id,
            p.chapterId != null ? ` \xB7 chapter ${p.chapterId}` : "",
            p.removedAt ? /* @__PURE__ */ u(k, { children: [
              " \xB7 ",
              /* @__PURE__ */ u(TimeText, { at: p.removedAt, children: formatDate(p.removedAt) })
            ] }) : null
          ] }, p.id)) })
        ] })
      ]
    }
  );
}
function MediaCardMeta({ media, rawPanel, meta, doCopy, copied }) {
  const dims = media.width > 0 && media.height > 0 ? `${media.width}\xD7${media.height}` : null;
  const prompt = meta?.prompt || rawPanel?.prompt || "";
  const copyKey = `prompt-${media.panelId ?? media.imageId}`;
  const level = browsingLevelOf(rawPanel?.image);
  const showRatingChip = level != null && level > 1;
  if (!dims && !prompt && !showRatingChip) return null;
  return /* @__PURE__ */ u("div", { class: "post-media-card-meta", children: [
    dims && /* @__PURE__ */ u("div", { class: "post-media-dims", children: dims }),
    prompt && /* @__PURE__ */ u("div", { class: "post-media-prompt", children: [
      /* @__PURE__ */ u("p", { class: "post-media-prompt-text", children: prompt }),
      /* @__PURE__ */ u("div", { class: "meta-actions", children: /* @__PURE__ */ u(
        "button",
        {
          class: `meta-action compact${copied === copyKey ? " copied" : ""}`,
          onClick: () => doCopy(prompt, copyKey),
          children: copied === copyKey ? "Copied" : "Copy prompt"
        }
      ) })
    ] }),
    showRatingChip && /* @__PURE__ */ u("span", { class: "param-chip post-media-rating", children: browsingLevelLabel(level) })
  ] });
}
export {
  ComicDetailView
};
