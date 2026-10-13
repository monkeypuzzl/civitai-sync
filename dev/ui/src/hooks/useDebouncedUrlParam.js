import { useState, useEffect } from 'preact/hooks';

// Bridge a text input to a URL param with a debounce, without encoding UI
// ephemera in the URL on every keystroke (Phase 2 anti-pattern; the rAF
// coalescer in useUrlState is a separate backstop). Mirrors the
// search-input pattern GenerationsView / PostsView both carried
// (Phase-2-cleanup #4).
//
//   - Adopts URL-side changes (back/forward) into the local buffer.
//   - After `delay` ms of no typing, writes the buffer to the URL via
//     `update({ [key]: value })` (replaceState — a filter tweak).
//
// Returns `[input, setInput]` for the controlled input.
export function useDebouncedUrlParam (urlValue, update, key = 'q', delay = 300) {
  const [input, setInput] = useState(urlValue);

  useEffect(() => { setInput(urlValue); }, [urlValue]);

  useEffect(() => {
    if (input === urlValue) return;
    const t = setTimeout(() => update({ [key]: input }), delay);
    return () => clearTimeout(t);
  }, [input, urlValue, update, key, delay]);

  return [input, setInput];
}
