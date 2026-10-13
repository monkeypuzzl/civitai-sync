import { useCallback, useEffect, useRef } from 'preact/hooks';
import { coverStillPath, mediaStageStyle } from '../lib/format.js';
import { DetailMain } from './DetailPage.jsx';
import { MeshViewport } from './MeshStage.jsx';

const DRAG_SLOP_PX = 5;

// Click closes. A drag (pointer slop or the browser's image drag) does not,
// including when the pointer returns to where the gesture started.
function ZoomImage ({ src, onClose }) {
  const gesture = useRef({ x: 0, y: 0, dragged: false, armed: false, timer: 0, stop: null });

  const cancelClear = () => {
    const g = gesture.current;
    if (!g.timer) return;
    clearTimeout(g.timer);
    g.timer = 0;
  };

  const scheduleClear = () => {
    cancelClear();
    const g = gesture.current;
    g.timer = setTimeout(() => {
      g.timer = 0;
      g.dragged = false;
      g.armed = false;
    }, 50);
  };

  useEffect(() => () => {
    gesture.current.stop?.();
    cancelClear();
  }, []);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    gesture.current.stop?.();
    cancelClear();
    const g = gesture.current;
    g.x = e.clientX;
    g.y = e.clientY;
    g.dragged = false;
    g.armed = true;
    const move = (ev) => {
      if (Math.hypot(ev.clientX - g.x, ev.clientY - g.y) >= DRAG_SLOP_PX) g.dragged = true;
    };
    const end = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', end, true);
      window.removeEventListener('pointercancel', end, true);
      if (g.stop === end) g.stop = null;
      if (g.dragged) scheduleClear();
    };
    g.stop = end;
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
  };

  const onClick = (e) => {
    e.stopPropagation();
    const g = gesture.current;
    const moved = g.armed && Math.hypot(e.clientX - g.x, e.clientY - g.y) >= DRAG_SLOP_PX;
    const wasDrag = g.dragged || moved;
    g.dragged = false;
    g.armed = false;
    cancelClear();
    if (wasDrag) return;
    onClose();
  };

  return (
    <img
      key={src}
      src={src}
      alt="Image"
      title="Close"
      onPointerDown={onPointerDown}
      onDragStart={() => { gesture.current.dragged = true; }}
      onDragEnd={scheduleClear}
      onClick={onClick}
    />
  );
}

export function Lightbox ({ src, type, audioCover, width, height, aspectClass, coverPath, onClose, yieldEscape, mesh, meshReady, children }) {
  const handleKey = useCallback((e) => {
    if (e.key !== 'Escape') return;
    e.stopImmediatePropagation();
    if (typeof yieldEscape === 'function' && yieldEscape()) {
      onClose();
      return;
    }
    e.preventDefault();
    onClose();
  }, [onClose, yieldEscape]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [handleKey]);

  const isVideo = type === 'video';
  const isAudio = type === 'audio';
  const closeIfPad = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const stageStyle = mediaStageStyle({ width, height, aspectClass });
  const poster = coverStillPath({ coverPath });
  const stage = (node) => (
    stageStyle
      ? <div class="media-stage" style={stageStyle}>{node}</div>
      : node
  );
  let media = null;
  if (type === 'model3d' && mesh) {
    media = (
      <MeshViewport
        stillSrc={src || ''}
        enabled={mesh.enabled}
        onToggle={mesh.onToggle}
        viewable={mesh.viewable}
        selectedPath={mesh.selectedPath}
        onSelect={mesh.onSelect}
        notice={mesh.notice}
        large={mesh.large}
        slotRef={mesh.expandSlotRef}
        onStillClick={meshReady ? undefined : onClose}
      />
    );
  } else if (isAudio && !audioCover) {
    media = (
      <div class="detail-audio">
        <div class="audio-placeholder detail-audio-art"><span class="audio-glyph">{'\u266B'}</span></div>
        {src ? <audio key={src} src={src} controls autoPlay /> : null}
      </div>
    );
  } else if (isAudio || isVideo) {
    media = src
      ? stage(<video key={src} src={src} poster={poster || undefined} controls autoPlay />)
      : null;
  } else if (type === 'model3d' && !src) {
    media = (
      <div class="audio-placeholder detail-audio-art">
        <span class="model3d-mark">3D</span>
      </div>
    );
  } else {
    media = src ? stage(<ZoomImage src={src} onClose={onClose} />) : null;
  }

  return (
    <>
      <button
        type="button"
        class="media-fullscreen-close"
        onClick={e => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
        title="Close"
      >{'\u2715'}</button>
      <DetailMain align="center" onPadClick={closeIfPad} landmark={false} chrome={children}>
        {media}
      </DetailMain>
    </>
  );
}
