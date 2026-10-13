// Browser fullscreen for the media lightbox. The caller invokes
// requestElementFullscreen inside the Expand click, on the stable lightbox
// host. A skipped or refused request leaves the viewport overlay in place.
// The promise from this module always fulfills.

export function createFullscreenSession () {
  return { phase: 'off', token: 0 };
}

function fullscreenElementOf (doc) {
  try {
    return doc ? doc.fullscreenElement : null;
  } catch {
    return null;
  }
}

function owns (session) {
  return session.phase === 'pending' || session.phase === 'entered';
}

function exitDocumentFullscreen (doc) {
  try {
    if (!doc || !fullscreenElementOf(doc) || typeof doc.exitFullscreen !== 'function') {
      return Promise.resolve();
    }
    const pending = doc.exitFullscreen();
    const promise = pending && typeof pending.then === 'function'
      ? pending
      : Promise.resolve();
    return promise.then(() => {}, () => {});
  } catch {
    return Promise.resolve();
  }
}

function settle (session, doc, el, token) {
  try {
    if (session.token !== token) {
      if (session.phase === 'off' && fullscreenElementOf(doc) === el) {
        exitDocumentFullscreen(doc);
      }
      return false;
    }
    const ok = fullscreenElementOf(doc) === el;
    session.phase = ok ? 'entered' : 'off';
    return ok;
  } catch {
    if (session.token === token) session.phase = 'off';
    return false;
  }
}

export function requestElementFullscreen (session, doc, el) {
  if (!el) return Promise.resolve(false);
  try {
    if (fullscreenElementOf(doc)) return Promise.resolve(false);
    if (!doc || doc.fullscreenEnabled === false) return Promise.resolve(false);
    if (typeof el.requestFullscreen !== 'function') return Promise.resolve(false);
  } catch {
    return Promise.resolve(false);
  }

  const token = ++session.token;
  session.phase = 'pending';
  let pending;
  try {
    pending = el.requestFullscreen();
  } catch {
    if (session.token === token) session.phase = 'off';
    return Promise.resolve(false);
  }
  const promise = pending && typeof pending.then === 'function'
    ? pending
    : Promise.resolve();
  return promise.then(
    () => settle(session, doc, el, token),
    () => settle(session, doc, el, token)
  );
}

export function yieldFullscreenEscape (session, doc) {
  return owns(session) && !!fullscreenElementOf(doc);
}

export function releaseDocumentFullscreen (session, doc) {
  const owned = owns(session);
  session.token += 1;
  session.phase = 'off';
  if (!owned) return Promise.resolve();
  return exitDocumentFullscreen(doc);
}

export function fullscreenSessionEnded (session, doc) {
  if (!owns(session)) return false;
  if (fullscreenElementOf(doc)) return false;
  session.token += 1;
  session.phase = 'off';
  return true;
}
