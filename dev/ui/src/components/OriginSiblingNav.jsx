import { useCallback, useEffect, useRef } from 'preact/hooks';
import {
  originNeighbourHref,
  originSiblingArrows,
  replaceOriginNeighbour
} from '../lib/origin-page.js';
import { getRoute } from '../lib/router.js';

function overlayOpen () {
  try {
    return Boolean(document.querySelector('.media-fullscreen'));
  } catch {
    return false;
  }
}

function typingTarget (el) {
  if (!el) return false;
  const t = el.tagName;
  return t === 'INPUT' || t === 'TEXTAREA' || el.isContentEditable;
}

function onArrowClick (e, direction, go, enabled) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  if (!enabled) return;
  go(direction);
}

// ignoreOverlay default true: the page instance skips ← → while .media-fullscreen
// exists. Fullscreen reuses this walker with ignoreOverlay={false}.
export function OriginSiblingNav ({ origin, routeParams, ignoreOverlay = true }) {
  const inFlight = useRef(false);
  const operable = origin != null && typeof origin === 'object';
  const view = (() => {
    try {
      return getRoute().view;
    } catch {
      return 'media';
    }
  })();

  const go = useCallback((direction) => {
    if (inFlight.current || !origin) return;
    const id = direction < 0 ? origin.prevId : origin.nextId;
    const slot = direction < 0 ? origin.prevSlot : origin.nextSlot;
    const slotInUrl = direction < 0 ? origin.prevSlotInUrl : origin.nextSlotInUrl;
    if (id == null || id === '') return;
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

  useEffect(() => {
    if (!operable) return undefined;
    function onKey (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (typingTarget(e.target)) return;
      if (ignoreOverlay && overlayOpen()) return;
      if (inFlight.current) return;
      e.preventDefault();
      go(e.key === 'ArrowLeft' ? -1 : 1);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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

  return (
    <>
      <a
        class="page-nav-arrow prev"
        href={prevHref || undefined}
        title={arrows.prev.title}
        aria-label={arrows.prev.title}
        aria-disabled={arrows.prev.enabled ? undefined : 'true'}
        onClick={e => onArrowClick(e, -1, go, arrows.prev.enabled)}
      >{'\u2039'}</a>
      <a
        class="page-nav-arrow next"
        href={nextHref || undefined}
        title={arrows.next.title}
        aria-label={arrows.next.title}
        aria-disabled={arrows.next.enabled ? undefined : 'true'}
        onClick={e => onArrowClick(e, 1, go, arrows.next.enabled)}
      >{'\u203A'}</a>
    </>
  );
}
