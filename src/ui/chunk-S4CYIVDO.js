import {
  loadUiPrefs,
  readMeshViewerPref,
  rememberMeshViewer
} from "./chunk-OGIDMYFE.js";
import {
  LARGE_MESH_BYTES,
  MESH_VIEWER_COPY
} from "./chunk-E2TIMOIW.js";
import {
  A,
  _2 as _,
  d,
  q,
  u,
  y
} from "./chunk-QDJYYBZC.js";

// dev/ui/src/components/load-mesh-viewer.js
var pending = null;
function loadMeshViewer() {
  if (!pending) {
    pending = import("./MeshViewer-6K3AW3FJ.js").then((mod) => {
      if (!mod || typeof mod.mountMeshViewer !== "function") {
        throw new Error("missing");
      }
      return mod;
    }).catch((err) => {
      pending = null;
      throw err;
    });
  }
  return pending;
}

// dev/ui/src/components/MeshStage.jsx
function useMeshHost() {
  const [host, setHost] = d(null);
  y(() => {
    const el = document.createElement("div");
    el.className = "mesh-viewer-host is-concealed";
    setHost(el);
    return () => {
      el.remove();
    };
  }, []);
  return host;
}
function MeshCanvas({ host, url, onReady, onNotice, onUnrecoverable }) {
  const handlers = A({ onReady, onNotice, onUnrecoverable });
  handlers.current = { onReady, onNotice, onUnrecoverable };
  const session = A(null);
  const urlRef = A(url);
  urlRef.current = url;
  y(() => {
    if (!host) return void 0;
    let dead = false;
    loadMeshViewer().then((mod) => {
      if (dead) return;
      session.current = mod.mountMeshViewer(host, {
        url: urlRef.current,
        onReady: () => handlers.current.onReady(),
        onNotice: (message) => handlers.current.onNotice(message),
        onUnrecoverable: (message) => handlers.current.onUnrecoverable(message)
      });
      const current = urlRef.current;
      if (current) session.current.setUrl(current);
    }).catch(() => {
      if (!dead) handlers.current.onUnrecoverable(MESH_VIEWER_COPY.importFailed);
    });
    return () => {
      dead = true;
      session.current?.dispose();
      session.current = null;
    };
  }, [host]);
  y(() => {
    session.current?.setUrl(url);
  }, [url]);
  return null;
}
function ActiveMesh({
  host,
  slotRef,
  live,
  url,
  conceal,
  onReady,
  onNotice,
  onUnrecoverable
}) {
  _(() => {
    if (!host) return;
    host.classList.toggle("is-concealed", !live || conceal);
    if (!live) {
      if (host.parentNode) host.remove();
      return;
    }
    const slot = slotRef && slotRef.current;
    if (slot && host.parentNode !== slot) slot.appendChild(host);
  });
  if (!live || !host) return null;
  return /* @__PURE__ */ u(
    MeshCanvas,
    {
      host,
      url,
      onReady,
      onNotice,
      onUnrecoverable
    }
  );
}
function stopControl(event) {
  event.stopPropagation();
}
function MeshViewport({
  stillSrc,
  enabled,
  onToggle,
  viewable,
  selectedPath,
  onSelect,
  notice,
  large,
  slotRef,
  onStillClick
}) {
  const options = Array.isArray(viewable) ? viewable : [];
  const holdForMesh = enabled && options.length > 0 && !notice;
  return /* @__PURE__ */ u("div", { class: "mesh-stage", children: [
    /* @__PURE__ */ u(
      "button",
      {
        type: "button",
        class: `mesh-view-toggle quiet-btn${enabled ? " is-on" : ""}`,
        "aria-pressed": enabled ? "true" : "false",
        onPointerDown: stopControl,
        onClick: (event) => {
          stopControl(event);
          onToggle();
        },
        children: "View 3D"
      }
    ),
    large ? /* @__PURE__ */ u("p", { class: "mesh-viewer-large", children: MESH_VIEWER_COPY.large }) : null,
    options.length > 1 ? /* @__PURE__ */ u(
      "select",
      {
        class: "mesh-viewer-select",
        value: selectedPath,
        onPointerDown: stopControl,
        onClick: stopControl,
        onChange: (event) => {
          stopControl(event);
          onSelect(event.currentTarget.value);
        },
        children: options.map((row) => /* @__PURE__ */ u("option", { value: row.path, children: row.label }, row.path))
      }
    ) : null,
    /* @__PURE__ */ u("div", { class: "mesh-stage-frame", ref: slotRef, children: [
      holdForMesh ? null : stillSrc ? /* @__PURE__ */ u(
        "img",
        {
          src: stillSrc,
          alt: "",
          onClick: onStillClick ? (event) => {
            event.stopPropagation();
            onStillClick();
          } : void 0
        }
      ) : /* @__PURE__ */ u("div", { class: "audio-placeholder detail-audio-art", children: /* @__PURE__ */ u("span", { class: "model3d-mark", children: "3D" }) }),
      notice ? /* @__PURE__ */ u("p", { class: "mesh-viewer-notice", children: notice }) : null
    ] })
  ] });
}
function meshIsLarge(bytes) {
  return typeof bytes === "number" && Number.isFinite(bytes) && bytes > LARGE_MESH_BYTES;
}

// dev/ui/src/lib/mesh-viewer-pref.js
function useMeshViewerPref() {
  const touched = A(false);
  const [enabled, setEnabledState] = d(() => readMeshViewerPref().on);
  const [ready, setReady] = d(() => readMeshViewerPref().loaded);
  y(() => {
    if (ready) return void 0;
    let dead = false;
    loadUiPrefs().then((doc) => {
      if (dead) return;
      if (!touched.current) setEnabledState(!!(doc && doc.meshViewer === "on"));
      setReady(true);
    }).catch(() => {
      if (!dead) setReady(true);
    });
    return () => {
      dead = true;
    };
  }, [ready]);
  const setEnabled = q((next) => {
    touched.current = true;
    const on = !!next;
    setEnabledState(on);
    rememberMeshViewer(on ? "on" : "off");
  }, []);
  return { enabled, setEnabled, ready };
}

export {
  useMeshHost,
  ActiveMesh,
  MeshViewport,
  meshIsLarge,
  useMeshViewerPref
};
