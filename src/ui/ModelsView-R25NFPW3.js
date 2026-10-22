import {
  Gallery
} from "./chunk-ENMMRQ3U.js";
import {
  useGalleryData
} from "./chunk-TFYFMUZK.js";
import {
  SafeRichText
} from "./chunk-S3H3QIJP.js";
import {
  idFromToken,
  modelsTypeHref,
  pathToken
} from "./chunk-XXC5O5XC.js";
import "./chunk-2VK77LR3.js";
import {
  useMagicEscape
} from "./chunk-4VS5UKZ5.js";
import "./chunk-TO3P2SCC.js";
import "./chunk-XQGXV6CL.js";
import "./chunk-SNTDJ2GX.js";
import {
  useOwnModelsRevision
} from "./chunk-UASMX4HS.js";
import {
  MediaThumb
} from "./chunk-UFLKPWQW.js";
import {
  activateOriginTile,
  originNodeHref,
  readHistoryFocus,
  resolveFocusId,
  shouldLoadFocusPrefix
} from "./chunk-R5EOPP5W.js";
import {
  TimeText
} from "./chunk-OJSJHKVX.js";
import {
  modelsOriginQuery
} from "./chunk-JB7JSPAG.js";
import {
  useIndexEpoch
} from "./chunk-TI5I7VA3.js";
import {
  formatUrl,
  getRoute,
  navigate,
  pushState,
  replaceState,
  useUrlState
} from "./chunk-CPLX52FD.js";
import {
  A,
  T,
  copyToClipboard,
  d,
  formatDate,
  getMedia,
  getModels,
  k,
  q,
  relativeTime,
  u,
  useDocumentTitle,
  y
} from "./chunk-OGIWOTNU.js";

// dev/ui/src/lib/model-catalog-filters.js
function familyIsSelected(option, familyIds, variantIds) {
  if (!option) return false;
  const families = familyIds || [];
  const variants = variantIds || [];
  if (families.includes(option.value)) return true;
  const vids = Array.isArray(option.variants) ? option.variants : [];
  return vids.some((v) => variants.includes(v.value));
}
function variantRowsForSection(families, familyIds, variantIds, collapsedIds) {
  const collapsed = collapsedIds || [];
  return (families || []).filter(
    (f) => Array.isArray(f.variants) && f.variants.length >= 2 && familyIsSelected(f, familyIds, variantIds) && !collapsed.includes(f.value)
  );
}

// dev/ui/src/lib/family-catalog-params.js
function familyCatalogParams(familyId) {
  return {
    resourceType: [],
    family: [String(familyId)],
    variant: [],
    modelVersionId: "",
    mine: null,
    sort: "",
    familyId: ""
  };
}

// dev/ui/src/lib/version-link.js
function versionClickHistory(shownId, targetId) {
  return String(shownId) === String(targetId) ? "replace" : "push";
}

// dev/ui/src/components/ModelsView.jsx
var URL_SCHEMA = {
  sort: { type: "string", default: "date:desc" },
  resourceType: { type: "csv", default: [] },
  family: { type: "csv", default: [] },
  variant: { type: "csv", default: [] },
  modelVersionId: { type: "string", default: "" },
  familyId: { type: "string", default: "" },
  mine: { type: "boolean", default: null }
};
var CATALOG_CLEAR = {
  resourceType: [],
  family: [],
  variant: [],
  modelVersionId: "",
  familyId: "",
  mine: null
};
function onModelsHref(e, href) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  navigate(href);
}
function onVersionHref(e, { href, shownVersionId, targetId, entityId }) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  if (versionClickHistory(shownVersionId, targetId) === "replace") {
    replaceState({ view: "models", entityId, params: { modelVersionId: targetId } });
    return;
  }
  navigate(href);
}
function modelTypeChip(model) {
  const href = modelsTypeHref(model?.type);
  if (!model?.typeLabel || !href) return null;
  return /* @__PURE__ */ u(
    "a",
    {
      class: "model-type-badge",
      href,
      onClick: (e) => onModelsHref(e, href),
      children: model.typeLabel
    }
  );
}
function toggleMember(arr, value) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}
function onFamilyCrumbClick(e, familyId) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  pushState({
    view: "models",
    entityId: null,
    modelTrail: null,
    params: familyCatalogParams(familyId)
  });
}
function Breadcrumb({ crumbs }) {
  return /* @__PURE__ */ u("nav", { class: "models-breadcrumb", children: [
    /* @__PURE__ */ u("a", { class: "crumb", href: "/models", onClick: (e) => onModelsHref(e, "/models"), children: "Models" }),
    crumbs.map((c) => {
      if (c.level === "family" && c.key) {
        const href = formatUrl({
          view: "models",
          params: familyCatalogParams(c.key)
        });
        return /* @__PURE__ */ u("span", { class: "crumb-wrap", children: [
          /* @__PURE__ */ u("span", { class: "crumb-sep", children: "\u203A" }),
          /* @__PURE__ */ u("a", { class: "crumb", href, onClick: (e) => onFamilyCrumbClick(e, c.key), children: c.label })
        ] }, `${c.level}:${c.key}`);
      }
      return /* @__PURE__ */ u("span", { class: "crumb-wrap", children: [
        /* @__PURE__ */ u("span", { class: "crumb-sep", children: "\u203A" }),
        /* @__PURE__ */ u("span", { class: "crumb current", children: c.label })
      ] }, c.level);
    })
  ] });
}
function ModelLeafCard({ resource }) {
  const [copied, setCopied] = d(null);
  if (!resource) return null;
  const { href, dateKind, dateIso, updatedIso, trainedWords, versionOverview } = resource;
  const words = Array.isArray(trainedWords) ? trainedWords : [];
  if (!href && !dateIso && !updatedIso && words.length === 0 && !versionOverview) return null;
  async function copyWord(word) {
    await copyToClipboard(word);
    setCopied(word);
    setTimeout(() => setCopied(null), 1500);
  }
  return /* @__PURE__ */ u("div", { class: "model-leaf-card", children: [
    href && /* @__PURE__ */ u(
      "a",
      {
        class: "meta-action",
        href,
        target: "_blank",
        rel: "noopener noreferrer",
        title: "Open this model version on Civitai",
        children: "\u{1F517} On Civitai"
      }
    ),
    dateIso && /* @__PURE__ */ u("div", { class: "model-leaf-card-date", children: [
      /* @__PURE__ */ u("span", { children: [
        dateKind === "published" ? "Published" : "Uploaded",
        " ",
        /* @__PURE__ */ u(TimeText, { at: dateIso, children: formatDate(dateIso) })
      ] }),
      /* @__PURE__ */ u("span", { class: "text-muted", children: [
        "\xB7",
        " ",
        /* @__PURE__ */ u(TimeText, { at: dateIso, children: relativeTime(dateIso) })
      ] })
    ] }),
    updatedIso && /* @__PURE__ */ u("div", { class: "model-leaf-card-updated text-muted", children: [
      "Updated ",
      /* @__PURE__ */ u(TimeText, { at: updatedIso, children: formatDate(updatedIso) })
    ] }),
    words.length > 0 && /* @__PURE__ */ u("div", { class: "model-leaf-card-triggers", children: [
      /* @__PURE__ */ u("div", { class: "model-leaf-card-label", children: "Trigger words" }),
      /* @__PURE__ */ u("div", { class: "model-leaf-card-chips", children: words.map((word) => /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          class: `param-chip${copied === word ? " copied" : ""}`,
          onClick: () => copyWord(word),
          children: copied === word ? "Copied" : word
        },
        word
      )) })
    ] }),
    versionOverview && /* @__PURE__ */ u("details", { class: "model-leaf-card-about", children: [
      /* @__PURE__ */ u("summary", { children: "About this version" }),
      /* @__PURE__ */ u("div", { class: "post-detail-description", children: /* @__PURE__ */ u(SafeRichText, { tree: versionOverview }) })
    ] })
  ] });
}
function NodeThumb({ entry }) {
  if (!entry?.thumbnailPath && !entry?.coverPath) return null;
  return /* @__PURE__ */ u(
    MediaThumb,
    {
      type: entry.type,
      thumbnailPath: entry.thumbnailPath,
      coverPath: entry.coverPath
    }
  );
}
function chipLabel(label, count) {
  if (count == null || count === 1) return label;
  return `${label} (${count})`;
}
function CatalogFilters({ options, resourceType, family, variant, mine, updateUrl }) {
  const [collapsed, setCollapsed] = d([]);
  const typeOpts = options?.resourceTypes || [];
  const sections = options?.sections || [];
  const hasTypes = typeOpts.length > 0 || resourceType.length > 0;
  const hasFamilies = sections.length > 0 || family.length > 0 || variant.length > 0;
  const mineInfo = options?.mine;
  const showMine = !!(mineInfo && (mineInfo.count > 0 || mine));
  if (!hasTypes && !hasFamilies && !showMine) return null;
  function toggleFamily(option) {
    const vids = new Set((option.variants || []).map((v) => v.value));
    const selected = familyIsSelected(option, family, variant);
    if (selected) {
      updateUrl({
        family: family.filter((id) => id !== option.value),
        variant: variant.filter((id) => !vids.has(id))
      });
    } else {
      updateUrl({ family: [...family, option.value] });
    }
    setCollapsed(collapsed.filter((id) => id !== option.value));
  }
  function toggleVariant(vid) {
    updateUrl({ variant: toggleMember(variant, vid) });
  }
  const shownFamilyValues = /* @__PURE__ */ new Set();
  for (const sec of sections) {
    for (const f of sec.families || []) shownFamilyValues.add(f.value);
  }
  const extraFamilies = family.filter((v) => !shownFamilyValues.has(v));
  return /* @__PURE__ */ u("div", { class: "models-catalog-filters", children: [
    (hasTypes || showMine) && /* @__PURE__ */ u("div", { class: "models-catalog-filter", children: [
      /* @__PURE__ */ u("span", { class: "models-catalog-filter-label", children: "Model types" }),
      showMine && /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          class: `tag-chip${mine ? " active" : ""}`,
          onClick: () => updateUrl({ mine: mine ? null : true }),
          children: chipLabel("Mine", mineInfo.count)
        }
      ),
      typeOpts.map((o) => /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          class: `tag-chip${resourceType.includes(o.value) ? " active" : ""}`,
          onClick: () => updateUrl({ resourceType: toggleMember(resourceType, o.value) }),
          title: o.value,
          children: chipLabel(o.label, o.count)
        },
        o.value
      )),
      resourceType.filter((v) => !typeOpts.some((o) => o.value === v)).map((v) => /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          class: "tag-chip active",
          onClick: () => updateUrl({ resourceType: toggleMember(resourceType, v) }),
          children: v
        },
        v
      ))
    ] }),
    hasFamilies && sections.map((sec) => /* @__PURE__ */ u(k, { children: [
      /* @__PURE__ */ u("div", { class: "models-catalog-filter models-catalog-family-section", children: [
        /* @__PURE__ */ u("span", { class: "models-catalog-filter-label", children: sec.label }),
        (sec.families || []).map((f) => {
          const selected = familyIsSelected(f, family, variant);
          const hasVariants = Array.isArray(f.variants) && f.variants.length >= 2;
          const expanded = hasVariants && !collapsed.includes(f.value);
          return /* @__PURE__ */ u("span", { class: "models-catalog-family-wrap", children: [
            /* @__PURE__ */ u(
              "button",
              {
                type: "button",
                class: `tag-chip${selected ? " active" : ""}`,
                onClick: () => toggleFamily(f),
                title: f.value,
                children: chipLabel(f.label, f.count)
              }
            ),
            selected && hasVariants && /* @__PURE__ */ u(
              "button",
              {
                type: "button",
                class: "models-catalog-family-caret",
                "aria-expanded": expanded,
                "aria-label": `${expanded ? "Hide" : "Show"} ${f.label} variants`,
                onClick: () => setCollapsed(toggleMember(collapsed, f.value)),
                children: expanded ? "\u25BE" : "\u25B8"
              }
            )
          ] }, f.value);
        })
      ] }),
      variantRowsForSection(sec.families, family, variant, collapsed).map((row) => /* @__PURE__ */ u("div", { class: "models-catalog-filter models-catalog-family-variants", children: [
        /* @__PURE__ */ u("span", { class: "models-catalog-filter-label", children: row.label }),
        row.variants.map((v) => /* @__PURE__ */ u(
          "button",
          {
            type: "button",
            class: `tag-chip${variant.includes(v.value) ? " active" : ""}`,
            onClick: () => toggleVariant(v.value),
            title: v.value,
            children: chipLabel(v.label, v.count)
          },
          v.value
        ))
      ] }, row.value))
    ] }, sec.outputType)),
    extraFamilies.map((v) => /* @__PURE__ */ u("div", { class: "models-catalog-filter", children: /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        class: "tag-chip active",
        onClick: () => updateUrl({ family: toggleMember(family, v) }),
        children: v
      }
    ) }, v))
  ] });
}
function CatalogGrid({ nodes, loading }) {
  if (!nodes.length) {
    if (loading) return null;
    return /* @__PURE__ */ u("div", { class: "empty-state", children: [
      /* @__PURE__ */ u("h2", { children: "Nothing here yet" }),
      /* @__PURE__ */ u("p", { children: "No models in your library match these filters." })
    ] });
  }
  function openModel(node) {
    if (node.idKind === "name") return;
    if (node.idKind === "family") {
      pushState({
        view: "models",
        entityId: null,
        modelTrail: null,
        params: { ...CATALOG_CLEAR, familyId: node.key }
      });
      return;
    }
    pushState({
      view: "models",
      entityId: pathToken(node.key, node.label),
      params: CATALOG_CLEAR
    });
  }
  return /* @__PURE__ */ u(k, { children: [
    /* @__PURE__ */ u("h1", { class: "models-level-title", children: "Models" }),
    /* @__PURE__ */ u("div", { class: "model-node-grid", children: nodes.map((node) => {
      const clickable = node.idKind !== "name";
      const subParts = node.idKind === "family" ? [node.unused ? null : `${node.count} item${node.count === 1 ? "" : "s"}`] : [
        node.typeLabel,
        (node.baseModels || []).join(", "),
        node.unused ? null : `${node.count} item${node.count === 1 ? "" : "s"}`
      ];
      const Tag = clickable ? "button" : "div";
      const sub = subParts.filter(Boolean);
      return /* @__PURE__ */ u(
        Tag,
        {
          type: clickable ? "button" : void 0,
          class: `model-node${clickable ? "" : " model-node-static"}`,
          onClick: clickable ? () => openModel(node) : void 0,
          children: [
            /* @__PURE__ */ u("div", { class: "model-node-thumbs", children: (node.recentThumbnails || []).slice(0, 4).map((entry, i) => /* @__PURE__ */ u(NodeThumb, { entry }, i)) }),
            /* @__PURE__ */ u("div", { class: "model-node-meta", children: [
              /* @__PURE__ */ u("div", { class: "model-node-label", title: node.label, children: node.label }),
              /* @__PURE__ */ u("div", { class: "model-node-sub", children: [
                /* @__PURE__ */ u("span", { class: "model-node-count", children: sub.join(" \xB7 ") }),
                node.lastUsed && /* @__PURE__ */ u(TimeText, { at: node.lastUsed, class: "model-node-date", children: relativeTime(node.lastUsed) })
              ] })
            ] })
          ]
        },
        `${node.idKind}:${node.key}`
      );
    }) })
  ] });
}
function VersionStrip({ versions, shownVersionId, entityId }) {
  if (!versions.length) return null;
  const params = getRoute().params || {};
  return /* @__PURE__ */ u("nav", { class: "model-version-strip", "aria-label": "Versions", children: versions.map((v) => {
    const current = v.key === shownVersionId;
    const href = formatUrl({
      view: "models",
      entityId,
      params: { ...params, modelVersionId: v.key }
    });
    return /* @__PURE__ */ u(
      "a",
      {
        href,
        class: "model-version-btn",
        "aria-current": current ? "page" : void 0,
        onClick: (e) => onVersionHref(e, { href, shownVersionId, targetId: v.key, entityId }),
        children: [
          /* @__PURE__ */ u("span", { class: "model-version-btn-name", children: v.label }),
          v.baseModel ? /* @__PURE__ */ u("span", { class: "model-version-btn-base", children: v.baseModel }) : null
        ]
      },
      v.key
    );
  }) });
}
function FamilyGallery({ familyId, urlState }) {
  const { sort } = urlState;
  const query = T(() => ({ models: `family.${familyId}`, sort }), [familyId, sort]);
  const reloadEpoch = useIndexEpoch();
  const { items, loading, sentinelRef, hasMore, loadMore, pending } = useGalleryData({
    fetcher: getMedia,
    query,
    reloadEpoch
  });
  y(() => {
    const focus = readHistoryFocus();
    if (shouldLoadFocusPrefix(focus, { loading, hasMore, idFound: resolveFocusId(items, focus) != null })) {
      loadMore();
    }
  }, [loading, items, hasMore, loadMore]);
  const originParams = T(
    () => modelsOriginQuery("", { sort, familyId }),
    [familyId, sort]
  );
  const hrefFor = q((item, index) => originNodeHref(item, {
    grain: "models",
    originView: "models",
    params: originParams,
    index
  }), [originParams]);
  const onItemActivate = q((e, item, index, landmarks) => {
    activateOriginTile(e, item, index, landmarks, {
      grain: "models",
      originView: "models",
      params: originParams
    });
  }, [originParams]);
  if (!familyId) return null;
  return /* @__PURE__ */ u(k, { children: [
    (items.length > 0 || !loading) && /* @__PURE__ */ u(
      Gallery,
      {
        items,
        grain: "media",
        groupsMeta: null,
        onItemActivate,
        hrefFor,
        sentinelRef,
        loading,
        hasMore,
        pending
      }
    ),
    loading && /* @__PURE__ */ u("div", { class: "loading-bar", children: /* @__PURE__ */ u("div", { class: "spinner" }) })
  ] });
}
function ModelLeafGallery({ versionId, urlState }) {
  const { sort } = urlState;
  const query = T(() => ({ models: `version.${versionId}`, sort }), [versionId, sort]);
  const reloadEpoch = useIndexEpoch();
  const { items, loading, sentinelRef, hasMore, loadMore, pending } = useGalleryData({
    fetcher: getMedia,
    query,
    reloadEpoch
  });
  y(() => {
    const focus = readHistoryFocus();
    if (shouldLoadFocusPrefix(focus, { loading, hasMore, idFound: resolveFocusId(items, focus) != null })) {
      loadMore();
    }
  }, [loading, items, hasMore, loadMore]);
  const originParams = T(
    () => modelsOriginQuery(versionId, { sort }),
    [versionId, sort]
  );
  const hrefFor = q((item, index) => originNodeHref(item, {
    grain: "models",
    originView: "models",
    params: originParams,
    index
  }), [originParams]);
  const onItemActivate = q((e, item, index, landmarks) => {
    activateOriginTile(e, item, index, landmarks, {
      grain: "models",
      originView: "models",
      params: originParams
    });
  }, [originParams]);
  if (!versionId) return null;
  return /* @__PURE__ */ u(k, { children: [
    (items.length > 0 || !loading) && /* @__PURE__ */ u(
      Gallery,
      {
        items,
        grain: "media",
        groupsMeta: null,
        onItemActivate,
        hrefFor,
        sentinelRef,
        loading,
        hasMore,
        pending
      }
    ),
    loading && /* @__PURE__ */ u("div", { class: "loading-bar", children: /* @__PURE__ */ u("div", { class: "spinner" }) })
  ] });
}
function ModelsView({ entityId }) {
  useMagicEscape({ enabled: entityId != null && entityId !== "" });
  const [urlState, updateUrl] = useUrlState(URL_SCHEMA);
  const { resourceType, family, variant, modelVersionId, familyId, mine } = urlState;
  const ownRev = useOwnModelsRevision();
  const indexEpoch = useIndexEpoch();
  const modelId = entityId ? idFromToken(entityId) : null;
  const isPage = Boolean(modelId);
  const [payload, setPayload] = d(null);
  const [loading, setLoading] = d(true);
  const identity = isPage ? `page:${modelId}:${modelVersionId}` : `catalog:${resourceType.join(",")}|${family.join(",")}|${variant.join(",")}|${mine ? 1 : 0}`;
  const fetchKey = `${identity}:${ownRev}:${indexEpoch}`;
  const identityRef = A(null);
  y(() => {
    let cancelled = false;
    const samePage = identityRef.current === identity;
    identityRef.current = identity;
    if (!samePage) setLoading(true);
    const req = isPage ? getModels({ modelId, versionId: modelVersionId || void 0 }) : getModels({ resourceType, family, variant, mine: mine ? "1" : "" });
    req.then((data) => {
      if (!cancelled) {
        setPayload(data);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchKey]);
  const catalogReady = !isPage && payload?.level === "catalog";
  const pageReady = isPage && payload?.level === "model" && String(payload?.model?.key) === String(modelId);
  const selectedVersionId = pageReady ? modelVersionId || payload.selectedVersionId || "" : "";
  let titleSpec;
  if (!entityId) {
    titleSpec = { place: "models" };
  } else if (!pageReady) {
    titleSpec = { place: "model" };
  } else {
    const selected = (payload.versions || []).find((v) => v.key === selectedVersionId);
    titleSpec = {
      place: "model",
      name: payload.model.label,
      version: selected?.label || ""
    };
  }
  useDocumentTitle(titleSpec);
  const catalogNodes = catalogReady ? payload.nodes || [] : [];
  const shortcutFamilyId = !familyId && family.length === 1 && catalogNodes.length > 0 && catalogNodes.every((n) => n.idKind === "family") ? String(catalogNodes[0].key) : "";
  function familyLeafLabel(id) {
    const node = (payload?.nodes || []).find((n) => n.idKind === "family" && String(n.key) === String(id));
    if (node?.label) return node.label;
    for (const sec of payload?.options?.sections || []) {
      const hit = (sec.families || []).find((f) => String(f.value) === String(id));
      if (hit?.label) return hit.label;
    }
    return id;
  }
  const leafCrumbs = familyId ? [{ level: "page", key: familyId, label: familyLeafLabel(familyId) }] : [];
  return /* @__PURE__ */ u("main", { class: `main-content models-tree${isPage ? " models-page" : ""}`, children: [
    /* @__PURE__ */ u(Breadcrumb, { crumbs: pageReady ? payload.breadcrumb || [] : leafCrumbs }),
    isPage ? pageReady ? /* @__PURE__ */ u(k, { children: [
      payload.model && /* @__PURE__ */ u("header", { class: "model-page-header", children: [
        /* @__PURE__ */ u("h1", { class: "models-page-title", children: payload.model.label }),
        modelTypeChip(payload.model),
        payload.model.mine && /* @__PURE__ */ u(
          "a",
          {
            class: "model-type-badge",
            href: "/models?mine=1",
            onClick: (e) => onModelsHref(e, "/models?mine=1"),
            children: "Mine"
          }
        )
      ] }),
      /* @__PURE__ */ u(
        VersionStrip,
        {
          versions: payload.versions || [],
          shownVersionId: modelVersionId || payload.selectedVersionId || "",
          entityId
        }
      ),
      payload.resource ? /* @__PURE__ */ u(ModelLeafCard, { resource: payload.resource }) : null,
      selectedVersionId ? /* @__PURE__ */ u(ModelLeafGallery, { versionId: selectedVersionId, urlState }) : /* @__PURE__ */ u("div", { class: "empty-state", children: [
        /* @__PURE__ */ u("h2", { children: "Unresolved version" }),
        /* @__PURE__ */ u("p", { children: "This model page is missing a valid version id." })
      ] })
    ] }) : null : familyId ? /* @__PURE__ */ u(FamilyGallery, { familyId, urlState }) : catalogReady ? /* @__PURE__ */ u(k, { children: [
      /* @__PURE__ */ u(
        CatalogFilters,
        {
          options: payload.options,
          resourceType,
          family,
          variant,
          mine: mine === true,
          updateUrl
        }
      ),
      shortcutFamilyId ? /* @__PURE__ */ u(FamilyGallery, { familyId: shortcutFamilyId, urlState }) : /* @__PURE__ */ u(CatalogGrid, { nodes: payload.nodes || [], loading })
    ] }) : null
  ] });
}
export {
  ModelsView,
  URL_SCHEMA
};
