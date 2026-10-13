import {
  useCardWindow
} from "./chunk-HVNR3LTJ.js";
import {
  FacetBar
} from "./chunk-FMYPGPZD.js";
import {
  ActiveMesh,
  MeshViewport,
  useMeshHost,
  useMeshViewerPref
} from "./chunk-S4CYIVDO.js";
import {
  model3dFileRows,
  model3dShownFormat,
  viewableMeshFiles
} from "./chunk-BFBNWV6Z.js";
import {
  useGalleryData
} from "./chunk-XAVY4HKU.js";
import "./chunk-OGIDMYFE.js";
import "./chunk-E2TIMOIW.js";
import {
  DetailPage,
  EntityHeader
} from "./chunk-4CEGATO7.js";
import {
  useMagicEscape
} from "./chunk-LHE46PZX.js";
import {
  OpenFolderButton
} from "./chunk-W7BMSFDW.js";
import "./chunk-7EKUSVIB.js";
import "./chunk-XWICPOXM.js";
import "./chunk-5XDJYGJC.js";
import "./chunk-XQGXV6CL.js";
import "./chunk-HMX5XSAI.js";
import "./chunk-DDUI6F2D.js";
import {
  formatDate
} from "./chunk-INNL2V6Q.js";
import {
  pushState,
  useUrlState
} from "./chunk-Z6L3MMX7.js";
import {
  A,
  T,
  d,
  getModel3d,
  getModel3ds,
  k,
  q,
  u,
  useDocumentTitle,
  y
} from "./chunk-QDJYYBZC.js";

// dev/ui/src/components/Model3dsView.jsx
var URL_SCHEMA = {
  sort: { type: "string", default: "date:desc" },
  publication: { type: "csv", default: [] },
  groupBy: { type: "string", default: "none" },
  groupSort: { type: "string", default: "count:desc" }
};
var PUBLICATION_FACET = {
  key: "publication",
  kind: "chips",
  label: "Publication",
  options: ["published", "draft", "unpublished"],
  optionLabels: {
    published: "Published",
    draft: "Draft",
    unpublished: "Unpublished"
  }
};
var SORT_FIELDS = [{ value: "date", label: "Date" }];
var GROUP_AXES = [
  { value: "month", label: "Month" },
  { value: "day", label: "Day" },
  { value: "publication", label: "Publication" }
];
function statusLabel(status) {
  if (status === "published" || status === "Published") return "Published";
  if (status === "draft" || status === "Draft") return "Draft";
  if (status === "unpublished" || status === "Unpublished") return "Unpublished";
  return "";
}
function stillSrc(item) {
  const raw = item?.media?.[0]?.thumbnailPath || item?.thumbnailPath || "";
  if (typeof raw !== "string" || !raw) return "";
  const pathOnly = raw.split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|webp|gif)$/.test(pathOnly)) return raw;
  return "";
}
function detailIso(entry) {
  if (!entry) return "";
  if (entry.status === "published") return entry.publishedAt || entry.createdAt || "";
  return entry.createdAt || "";
}
function Model3dStill({ item, detail = false }) {
  const src = stillSrc(item);
  return /* @__PURE__ */ u("div", { class: detail ? "post-card-media detail-model3d-still" : "post-card-media", style: { aspectRatio: "1 / 1" }, children: src ? /* @__PURE__ */ u("img", { src, alt: "" }) : /* @__PURE__ */ u("div", { class: detail ? "audio-placeholder detail-audio-art" : "audio-placeholder", children: /* @__PURE__ */ u("span", { class: "model3d-mark", children: "3D" }) }) });
}
function Model3dCard({ item, href, onClick }) {
  const label = statusLabel(item.status);
  return /* @__PURE__ */ u("a", { class: "gallery-item post-card", href, onClick, "data-focus-id": item.id, children: [
    /* @__PURE__ */ u(Model3dStill, { item }),
    /* @__PURE__ */ u("div", { class: "post-card-info", children: [
      item.name ? /* @__PURE__ */ u("div", { class: "post-card-title", children: item.name }) : null,
      label ? /* @__PURE__ */ u("div", { class: "post-card-status-date", children: label }) : null
    ] })
  ] });
}
function Model3dList() {
  const [urlState, updateUrl] = useUrlState(URL_SCHEMA);
  useDocumentTitle({ place: "model3ds" });
  const query = T(() => ({
    sort: urlState.sort,
    publication: urlState.publication.length ? urlState.publication : null,
    groupBy: urlState.groupBy,
    groupSort: urlState.groupSort
  }), [urlState]);
  const galleryFetcher = q((params) => getModel3ds(params), []);
  const {
    items,
    groupsMeta,
    total,
    loading,
    sentinelRef,
    hasMore,
    pending
  } = useGalleryData({ fetcher: galleryFetcher, query });
  const list = items || [];
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
  function openItem(event, item) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    pushState({ view: "model3ds", entityId: String(item.id) });
  }
  const renderCard = (item) => /* @__PURE__ */ u(
    Model3dCard,
    {
      item,
      href: `/model3ds/${item.id}`,
      onClick: (event) => openItem(event, item)
    },
    item.id
  );
  return /* @__PURE__ */ u("div", { class: "view", children: [
    /* @__PURE__ */ u(
      FacetBar,
      {
        facets: [PUBLICATION_FACET],
        state: urlState,
        update: updateUrl,
        sortFields: SORT_FIELDS,
        groupAxes: GROUP_AXES,
        facetParams: { model3ds: true },
        showSearch: false
      }
    ),
    total != null && !loading && list.length === 0 ? /* @__PURE__ */ u("div", { class: "empty-state", children: [
      /* @__PURE__ */ u("h2", { children: "No 3D downloaded yet." }),
      /* @__PURE__ */ u("p", { children: "Download 3D to see it here." })
    ] }) : /* @__PURE__ */ u("div", { ref: rootRef, children: [
      /* @__PURE__ */ u("div", { class: "gallery-pad", style: { height: outerTopPad }, "aria-hidden": "true" }),
      grouped && sections ? sections.map((sec, i) => /* @__PURE__ */ u("section", { class: "gallery-group", children: [
        /* @__PURE__ */ u("h2", { class: "gallery-group-header", children: [
          sec.group.label,
          " ",
          /* @__PURE__ */ u("span", { class: "gallery-group-count", children: sec.group.count })
        ] }),
        /* @__PURE__ */ u("div", { class: "gallery-grid", ref: i === 0 ? gridRef : void 0, children: list.slice(sec.start, sec.end).map((item) => renderCard(item)) })
      ] }, sec.group.key || "_")) : /* @__PURE__ */ u("div", { class: "gallery-grid", ref: gridRef, children: list.slice(start, end).map((item) => renderCard(item)) }),
      /* @__PURE__ */ u("div", { class: "gallery-pad", style: { height: outerBottomPad }, "aria-hidden": "true" }),
      /* @__PURE__ */ u("div", { ref: sentinelRef, class: "gallery-sentinel" }),
      loading && /* @__PURE__ */ u("div", { class: "loading-bar", children: /* @__PURE__ */ u("div", { class: "spinner" }) })
    ] })
  ] });
}
function backToList() {
  pushState({ view: "model3ds", entityId: null });
}
function Model3dDetail({ id }) {
  useMagicEscape();
  const [data, setData] = d(null);
  const [failed, setFailed] = d(false);
  const meshPref = useMeshViewerPref();
  const meshHost = useMeshHost();
  const slotRef = A(null);
  const [meshNotice, setMeshNotice] = d("");
  const [meshReady, setMeshReady] = d(false);
  const [meshPath, setMeshPath] = d("");
  y(() => {
    let stale = false;
    setFailed(false);
    setData(null);
    getModel3d(id).then((body) => {
      if (stale) return;
      if (!body || body.error || !body.index) setFailed(true);
      else setData(body);
    }).catch(() => {
      if (!stale) setFailed(true);
    });
    return () => {
      stale = true;
    };
  }, [id]);
  const entry = data && data.index;
  const when = detailIso(entry);
  const meshRows = entry ? viewableMeshFiles({
    mediaPath: entry.primaryPath,
    files: Array.isArray(entry.files) ? entry.files : []
  }) : [];
  const meshPathKey = meshRows.map((row) => row.path).join("\n");
  const meshId = entry ? String(entry.id || id) : "";
  y(() => {
    setMeshPath(meshPathKey ? meshPathKey.split("\n")[0] : "");
    setMeshNotice("");
    setMeshReady(false);
  }, [meshId, meshPathKey]);
  useDocumentTitle(entry ? {
    place: "model3d",
    name: entry.name,
    status: entry.status,
    date: formatDate(when)
  } : { place: "model3d" });
  if (!data && !failed) {
    return /* @__PURE__ */ u(DetailPage, { flow: true, scrollKey: id, sidebar: /* @__PURE__ */ u(k, {}) });
  }
  if (!entry) {
    return /* @__PURE__ */ u(DetailPage, { flow: true, scrollKey: id, sidebar: /* @__PURE__ */ u(k, {}), children: /* @__PURE__ */ u("div", { class: "empty-state", children: [
      /* @__PURE__ */ u("h1", { children: "3D not found." }),
      /* @__PURE__ */ u("p", { children: "This 3D has not been downloaded yet." }),
      /* @__PURE__ */ u("button", { class: "meta-action", type: "button", onClick: backToList, children: "Back to 3D" })
    ] }) });
  }
  const label = statusLabel(entry.status);
  const license = entry.licenseName || "";
  const rows = model3dFileRows({
    mediaPath: entry.primaryPath,
    files: Array.isArray(entry.files) ? entry.files : []
  });
  return /* @__PURE__ */ u(
    DetailPage,
    {
      flow: true,
      scrollKey: entry.id || id,
      sidebar: /* @__PURE__ */ u(k, { children: [
        /* @__PURE__ */ u(EntityHeader, { title: entry.name, label: "3D", date: when }),
        label ? /* @__PURE__ */ u("div", { class: "meta-section", children: [
          /* @__PURE__ */ u("h2", { class: "meta-label", children: "Status" }),
          /* @__PURE__ */ u("p", { children: label })
        ] }) : null,
        license ? /* @__PURE__ */ u("div", { class: "meta-section", children: [
          /* @__PURE__ */ u("h2", { class: "meta-label", children: "License" }),
          /* @__PURE__ */ u("p", { children: license })
        ] }) : null,
        /* @__PURE__ */ u("div", { class: "meta-section", children: [
          /* @__PURE__ */ u("h2", { class: "meta-label", children: "Files" }),
          rows.length > 0 ? /* @__PURE__ */ u("ul", { class: "model3d-files", children: rows.map((row, i) => {
            const shownFormat = model3dShownFormat(row);
            return /* @__PURE__ */ u("li", { children: [
              /* @__PURE__ */ u("span", { children: row.label }),
              shownFormat ? /* @__PURE__ */ u("span", { class: "model3d-file-format", children: shownFormat }) : null
            ] }, `${row.path}\0${i}`);
          }) }) : null,
          /* @__PURE__ */ u("div", { class: "meta-actions", children: /* @__PURE__ */ u(OpenFolderButton, { path: entry.primaryPath, class: "meta-action" }) })
        ] })
      ] }),
      children: [
        /* @__PURE__ */ u(
          MeshViewport,
          {
            stillSrc: stillSrc(entry),
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
            large: false,
            slotRef
          }
        ),
        /* @__PURE__ */ u(
          ActiveMesh,
          {
            host: meshHost,
            slotRef,
            live: meshPref.enabled && meshRows.length > 0 && !!meshPath,
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
        )
      ]
    }
  );
}
function Model3dsView({ entityId }) {
  if (entityId) return /* @__PURE__ */ u(Model3dDetail, { id: entityId });
  return /* @__PURE__ */ u(Model3dList, {});
}
export {
  Model3dsView,
  URL_SCHEMA
};
