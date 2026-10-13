// Escape on a node: one level toward the origin list. Galleries do not
// mount this (Escape there clears a selection). Overlay, native fullscreen,
// typing, and key-repeat do not navigate.

import { useEffect } from 'preact/hooks';
import { getRoute, pushState } from '../lib/router.js';
import { completeAuthoredParams, parseUrl } from '../lib/url-state.js';
import { magicEscapeTarget } from '../lib/magic-escape.js';
import { activateOriginTab } from '../lib/nav-activate.js';
import { originBagForHop } from '../lib/gallery-focus.js';
import { readHistoryBag } from '../lib/origin-page.js';

function typingTarget (el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

function overlayOpen () {
  try {
    return Boolean(document.querySelector('.media-fullscreen'));
  } catch {
    return false;
  }
}

export function useMagicEscape ({
  origin = null,
  modelReturn = null,
  mediaScope = null,
  enabled = true
} = {}) {
  useEffect(() => {
    if (!enabled) return undefined;
    function onKey (e) {
      if (e.key !== 'Escape' || e.repeat) return;
      if (typingTarget(e.target)) return;
      if (overlayOpen()) return;
      try {
        if (document.fullscreenElement) return;
      } catch {
        /* non-browser */
      }
      const route = getRoute();
      const target = magicEscapeTarget({ route, origin, mediaScope });
      if (!target || target.action === 'none') return;
      e.preventDefault();
      const bag = readHistoryBag();
      if (target.action === 'drop-used-in') {
        pushState({
          view: route.view,
          entityId: route.entityId,
          modelTrail: route.modelTrail,
          params: { ...(route.params || {}), usedIn: null }
        }, bag);
        return;
      }
      if (target.action === 'origin-tab') {
        activateOriginTab(target.tab, route, {
          modelReturn,
          mediaScope,
          focus: bag.focus
        });
        return;
      }
      if (target.action === 'container' && target.href) {
        const parsed = parseUrl(target.href);
        pushState({
          view: parsed.view,
          entityId: parsed.entityId,
          modelTrail: parsed.modelTrail,
          params: completeAuthoredParams(route.params, parsed.params)
        }, originBagForHop(bag));
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled, origin, modelReturn, mediaScope]);
}
