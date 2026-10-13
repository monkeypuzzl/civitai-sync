import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { LARGE_MESH_BYTES, MESH_VIEWER_COPY } from '../lib/mesh-viewer-messages.js';
import { loadMeshViewer } from './load-mesh-viewer.js';

export function useMeshHost () {
  const [host, setHost] = useState(null);
  useEffect(() => {
    const el = document.createElement('div');
    el.className = 'mesh-viewer-host is-concealed';
    setHost(el);
    return () => { el.remove(); };
  }, []);
  return host;
}

function MeshCanvas ({ host, url, onReady, onNotice, onUnrecoverable }) {
  const handlers = useRef({ onReady, onNotice, onUnrecoverable });
  handlers.current = { onReady, onNotice, onUnrecoverable };
  const session = useRef(null);
  const urlRef = useRef(url);
  urlRef.current = url;

  useEffect(() => {
    if (!host) return undefined;
    let dead = false;
    loadMeshViewer().then(mod => {
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

  useEffect(() => {
    session.current?.setUrl(url);
  }, [url]);

  return null;
}

// Moves the one host into the active slot. The host is not a Preact child,
// so Expand open and close do not parse the file again.
export function ActiveMesh ({
  host,
  slotRef,
  live,
  url,
  conceal,
  onReady,
  onNotice,
  onUnrecoverable
}) {
  useLayoutEffect(() => {
    if (!host) return;
    host.classList.toggle('is-concealed', !live || conceal);
    if (!live) {
      if (host.parentNode) host.remove();
      return;
    }
    const slot = slotRef && slotRef.current;
    if (slot && host.parentNode !== slot) slot.appendChild(host);
  });

  if (!live || !host) return null;
  return (
    <MeshCanvas
      host={host}
      url={url}
      onReady={onReady}
      onNotice={onNotice}
      onUnrecoverable={onUnrecoverable}
    />
  );
}

function stopControl (event) {
  event.stopPropagation();
}

export function MeshViewport ({
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
  // A viewable file with the control on is about to cover this frame. The
  // still would flash and then swap. A failure brings the still back.
  const holdForMesh = enabled && options.length > 0 && !notice;
  return (
    <div class="mesh-stage">
      <button
        type="button"
        class={`mesh-view-toggle quiet-btn${enabled ? ' is-on' : ''}`}
        aria-pressed={enabled ? 'true' : 'false'}
        onPointerDown={stopControl}
        onClick={(event) => {
          stopControl(event);
          onToggle();
        }}
      >View 3D</button>
      {large ? <p class="mesh-viewer-large">{MESH_VIEWER_COPY.large}</p> : null}
      {options.length > 1 ? (
        <select
          class="mesh-viewer-select"
          value={selectedPath}
          onPointerDown={stopControl}
          onClick={stopControl}
          onChange={(event) => {
            stopControl(event);
            onSelect(event.currentTarget.value);
          }}
        >
          {options.map(row => (
            <option key={row.path} value={row.path}>{row.label}</option>
          ))}
        </select>
      ) : null}
      <div class="mesh-stage-frame" ref={slotRef}>
        {holdForMesh ? null : stillSrc
          ? (
            <img
              src={stillSrc}
              alt=""
              onClick={onStillClick
                ? (event) => { event.stopPropagation(); onStillClick(); }
                : undefined}
            />
          )
          : (
            <div class="audio-placeholder detail-audio-art">
              <span class="model3d-mark">3D</span>
            </div>
          )}
        {notice ? <p class="mesh-viewer-notice">{notice}</p> : null}
      </div>
    </div>
  );
}

export function meshIsLarge (bytes) {
  return typeof bytes === 'number' && Number.isFinite(bytes) && bytes > LARGE_MESH_BYTES;
}
