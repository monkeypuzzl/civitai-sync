const TOP_ROUTES = ['generations', 'posts', 'timeline', 'settings'];

export function getRoute () {
  const segments = location.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  const top = TOP_ROUTES.includes(segments[0]) ? segments[0] : 'generations';
  const sub = segments[1] || null;
  return { top, sub };
}

export function navigate (route) {
  history.pushState(null, '', `/${route}`);
  window.dispatchEvent(new Event('popstate'));
}
