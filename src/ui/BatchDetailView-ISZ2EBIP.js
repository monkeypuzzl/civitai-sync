import {
  agreedDurationSeconds,
  agreedProducedPair,
  detailFacts,
  entityHeaderLabel,
  jobResolutionLabel,
  sharedMediaType,
  snapshotFromRaw
} from "./chunk-BFBNWV6Z.js";
import {
  ModelMembership,
  OriginSiblingNav,
  RelatedStrip,
  WorkflowSection,
  detailCacheKey,
  loadContainerDetail,
  mediaFileCopy,
  prefetchOriginNeighbours,
  useHeldDetail,
  workflowSidebarLine
} from "./chunk-7ZEO5E2E.js";
import {
  DetailPage,
  EntityHeader
} from "./chunk-4CEGATO7.js";
import {
  composeDetailResources,
  generatorFamilyModelBlock
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
  MemoMediaTile
} from "./chunk-MY736RCS.js";
import "./chunk-XQGXV6CL.js";
import {
  useOwnModelsRevision
} from "./chunk-HMX5XSAI.js";
import "./chunk-3Y4VDHN5.js";
import {
  memberMediaHref,
  openPreservingOriginBag,
  relatedOriginHref
} from "./chunk-DDUI6F2D.js";
import {
  TimeText,
  chipDatetime,
  copyToClipboard,
  formatDate,
  generationMemberTile,
  inputMediaCaptions
} from "./chunk-INNL2V6Q.js";
import {
  pushState,
  replaceState
} from "./chunk-Z6L3MMX7.js";
import {
  A,
  d,
  k,
  openFiles,
  u,
  useDocumentTitle,
  y
} from "./chunk-QDJYYBZC.js";

// dev/ui/src/components/BatchDetailView.jsx
function backToGenerations() {
  pushState({ view: "generations", entityId: null });
}
function BatchDetailView({ batchId, params }) {
  useMagicEscape();
  const [copied, setCopied] = d(null);
  const quietAppliedRef = A(null);
  const ownRev = useOwnModelsRevision();
  const cacheKey = detailCacheKey({ view: "generations", id: batchId, params }) + `:own${ownRev}`;
  const held = useHeldDetail(cacheKey, () => loadContainerDetail("generations", batchId, params));
  const data = held.displayed;
  const onRoute = held.shownKey === cacheKey && data?.index?.id != null && String(data.index.id) === String(batchId);
  const origin = data?.index?.origin || null;
  y(() => {
    if (!onRoute || !origin) return void 0;
    prefetchOriginNeighbours({
      view: "generations",
      routeParams: params,
      origin
    });
    return void 0;
  }, [onRoute, origin, params]);
  y(() => {
    if (!onRoute || !origin || !batchId) return;
    const nextParams = { ...params || {} };
    let changed = false;
    if (origin.omitFrom && nextParams.from) {
      delete nextParams.from;
      changed = true;
    }
    if (!origin.slotInUrl && nextParams.slot) {
      delete nextParams.slot;
      changed = true;
    }
    if (!changed) return;
    const quietKey = `${batchId}|${JSON.stringify(nextParams)}`;
    if (quietAppliedRef.current === quietKey) return;
    quietAppliedRef.current = quietKey;
    replaceState({
      view: "generations",
      entityId: batchId,
      params: nextParams
    });
  }, [onRoute, origin, batchId, params]);
  async function doCopy(text, label) {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }
  useDocumentTitle(
    data?.index ? {
      place: "generation",
      date: formatDate(data.index.createdAt || data.index.date),
      members: (data.index.media || []).map((m) => ({ type: m.type }))
    } : { place: "generation" }
  );
  const scrollKey = data?.index?.id || batchId;
  if (!data && !held.failed) {
    return /* @__PURE__ */ u(DetailPage, { flow: true, scrollKey, sidebar: /* @__PURE__ */ u(k, {}) });
  }
  if (!data || !data.index) {
    return /* @__PURE__ */ u(DetailPage, { flow: true, scrollKey, sidebar: /* @__PURE__ */ u(k, {}), children: /* @__PURE__ */ u("div", { class: "empty-state", children: [
      /* @__PURE__ */ u("h1", { children: "Generation not found" }),
      /* @__PURE__ */ u("p", { children: "This generation may not have been downloaded yet." }),
      /* @__PURE__ */ u("button", { class: "meta-action", onClick: backToGenerations, children: "Back to Generations" })
    ] }) });
  }
  const index = data.index;
  const dateStr = index.createdAt || index.date;
  const members = (Array.isArray(index.media) ? index.media : []).filter((m) => m.inWalk !== false);
  const composed = composeDetailResources({
    checkpoint: index.checkpoint,
    resources: index.resources,
    model: index.model
  });
  const familyBlock = !composed.model && composed.additional.length === 0 ? generatorFamilyModelBlock(index.generatorFamily) : null;
  const modelBlock = familyBlock || composed.model;
  const additional = composed.additional;
  const originScope = params && params.from || origin && origin.scope || null;
  const originKind = originMembershipKind(originScope);
  const modelPageHrefs = [
    modelBlock && modelBlock.href,
    ...additional.map((r) => r && r.href)
  ].filter(Boolean);
  const soleModelHref = modelPageHrefs.length === 1 ? modelPageHrefs[0] : "";
  const workflowLine = workflowSidebarLine(
    index.params?.workflow,
    originScope,
    { generations: [index] }
  );
  const inputRefs = Array.isArray(index.inputs) ? index.inputs.filter((inp) => inp && inp.id && inp.thumbnailPath) : [];
  const inputCaptions = inputMediaCaptions(inputRefs);
  const batchType = sharedMediaType(members);
  const facts = detailFacts({
    type: batchType,
    snapshot: snapshotFromRaw(data.raw),
    fallback: index.params,
    produced: agreedProducedPair(members),
    resolution: jobResolutionLabel(data.raw),
    durationSeconds: agreedDurationSeconds(members),
    audio: index.audio,
    showSeed: false,
    omitModelIdentity: Boolean(modelBlock),
    omitWorkflowAliases: Boolean(workflowLine)
  });
  const fileActions = /* @__PURE__ */ u(k, { children: [
    (() => {
      const shown = members.filter((m) => m && m.thumbnailPath);
      const copy = mediaFileCopy({
        count: shown.length,
        types: shown.map((m) => m.type)
      });
      if (!copy) return null;
      if (shown.length === 1) {
        return /* @__PURE__ */ u(
          OpenFolderButton,
          {
            path: shown[0].thumbnailPath,
            class: "meta-action",
            label: copy.label,
            title: copy.title
          }
        );
      }
      const paths = shown.map((m) => m.thumbnailPath);
      return /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          class: "meta-action",
          title: copy.title,
          onClick: () => openFiles(paths),
          children: copy.label
        }
      );
    })(),
    /* @__PURE__ */ u(
      OpenJsonButton,
      {
        kind: "generation",
        id: batchId,
        class: "meta-action",
        title: "Open Generation folder, with data file selected"
      }
    )
  ] });
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
            label: entityHeaderLabel("generation", batchType),
            date: dateStr,
            chips: facts.headerChips
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
            title: "Input Media",
            items: inputRefs,
            hrefFor: (inp) => relatedOriginHref(inp, params),
            captionFor: (_inp, i) => inputCaptions[i]
          }
        ),
        index.prompt && /* @__PURE__ */ u("div", { class: "meta-section", children: [
          /* @__PURE__ */ u("h2", { class: "meta-label", children: "Prompt" }),
          /* @__PURE__ */ u("p", { class: "meta-prompt", children: index.prompt }),
          /* @__PURE__ */ u("div", { class: "meta-actions", children: /* @__PURE__ */ u(
            "button",
            {
              class: `meta-action${copied === "prompt" ? " copied" : ""}`,
              onClick: () => doCopy(index.prompt, "prompt"),
              children: copied === "prompt" ? "Copied" : "Copy prompt"
            }
          ) })
        ] }),
        index.negativePrompt && /* @__PURE__ */ u("div", { class: "meta-section", children: [
          /* @__PURE__ */ u("h2", { class: "meta-label", children: "Negative Prompt" }),
          /* @__PURE__ */ u("p", { class: "meta-prompt meta-neg-prompt", children: index.negativePrompt })
        ] }),
        (facts.title || facts.rows.length > 0) && /* @__PURE__ */ u("div", { class: "meta-section", children: [
          /* @__PURE__ */ u("h2", { class: "meta-label", children: "Parameters" }),
          facts.title ? /* @__PURE__ */ u("div", { class: "meta-value", children: facts.title }) : null,
          facts.rows.length > 0 && /* @__PURE__ */ u("ul", { class: "meta-params", children: facts.rows.map((row, i) => row.kind === "text" ? /* @__PURE__ */ u("li", { class: "param-text", children: [
            /* @__PURE__ */ u("span", { class: "param-text-label", children: row.label }),
            row.value
          ] }, `t${i}`) : /* @__PURE__ */ u("li", { class: "param-chip", children: chipDatetime(row.text) ? /* @__PURE__ */ u(TimeText, { datetime: chipDatetime(row.text), children: row.text }) : row.text }, `c${i}`)) })
        ] }),
        /* @__PURE__ */ u("div", { class: "meta-section", children: [
          /* @__PURE__ */ u("h2", { class: "meta-label", children: "Files" }),
          /* @__PURE__ */ u("div", { class: "meta-actions", children: fileActions })
        ] })
      ] }),
      children: /* @__PURE__ */ u("div", { class: "post-detail-media-grid", children: members.map((m, i) => {
        const item = generationMemberTile(m);
        const href = memberMediaHref(item.id, params, {
          slot: m.slot,
          originView: "generations",
          granularity: "batch",
          slotInUrl: m.slotInUrl
        });
        return /* @__PURE__ */ u(
          MemoMediaTile,
          {
            item,
            href,
            onActivate: (e) => openPreservingOriginBag(e, href)
          },
          `${item.id}:${i}`
        );
      }) })
    }
  );
}
export {
  BatchDetailView
};
