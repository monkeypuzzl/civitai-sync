// Caps a wrapping chip row at a number of lines. The more control sits in
// the last line. The header expands the row above that control. A gallery
// caller opens a panel below it, and a second click closes that panel.

import { toChildArray } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

function rowLimit (box, first, maxLines) {
  const style = getComputedStyle(box);
  const gap = parseFloat(style.rowGap || style.gap) || 0;
  return first.offsetTop + maxLines * (first.offsetHeight + gap);
}

function within (el, limit) {
  return el.offsetTop + el.offsetHeight <= limit + 1;
}

export function ChipOverflow ({ maxLines = 1, onMore, panelOpen = false, anchorRef, class: className, children }) {
  const items = toChildArray(children).filter(Boolean);
  const boxRef = useRef(null);
  const moreRef = useRef(null);
  function setMore (el) {
    moreRef.current = el;
    if (anchorRef) anchorRef.current = el;
  }
  const [hidden, setHidden] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const remembered = useRef(0);
  const inline = typeof onMore !== 'function';
  const open = inline && expanded;
  if (hidden > 0) remembered.current = hidden;

  useLayoutEffect(() => {
    const box = boxRef.current;
    const more = moreRef.current;
    if (!box || !more) return undefined;
    const measure = () => {
      const chips = [...box.querySelectorAll('[data-chip]')];
      if (!chips.length) {
        setHidden(prev => (prev === 0 ? prev : 0));
        return;
      }
      chips.forEach(el => { el.hidden = false; });
      if (open) {
        more.hidden = false;
        setHidden(prev => (prev === 0 ? prev : 0));
        return;
      }
      const limit = rowLimit(box, chips[0], maxLines);
      more.hidden = true;
      if (chips.every(el => within(el, limit))) {
        setHidden(prev => (prev === 0 ? prev : 0));
        return;
      }
      more.hidden = false;
      let hide = chips.length;
      for (let keep = chips.length - 1; keep >= 0; keep--) {
        chips.forEach((el, i) => { el.hidden = i >= keep; });
        const mark = panelOpen ? '\u25BC' : '\u2023';
        more.textContent = `${mark} ${chips.length - keep} more`;
        const visible = chips.filter(el => !el.hidden);
        if (visible.every(el => within(el, limit)) && within(more, limit)) {
          hide = chips.length - keep;
          break;
        }
      }
      setHidden(prev => (prev === hide ? prev : hide));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [items.length, maxLines, open, panelOpen]);

  if (!items.length) return null;
  const firstHidden = hidden > 0 ? items.length - hidden : 0;
  const showMore = hidden > 0 || open;
  const disclosed = inline ? open : panelOpen;
  const mark = disclosed ? (inline ? '\u25B2' : '\u25BC') : '\u2023';
  const count = hidden > 0 ? hidden : remembered.current;
  const label = `${mark} ${count} more`;

  function onMoreClick () {
    if (!inline) {
      onMore(firstHidden);
      return;
    }
    setExpanded(value => !value);
  }

  return (
    <div
      ref={boxRef}
      class={`chip-overflow${className ? ` ${className}` : ''}${open ? ' expanded' : ''}`}
    >
      {items.map((item, index) => (
        <span data-chip key={index} hidden={!open && hidden > 0 && index >= items.length - hidden}>
          {item}
        </span>
      ))}
      <button
        ref={setMore}
        type="button"
        class="text-btn chip-overflow-more"
        hidden={!showMore}
        aria-expanded={inline ? open : panelOpen}
        onClick={onMoreClick}
      >
        {label}
      </button>
    </div>
  );
}
