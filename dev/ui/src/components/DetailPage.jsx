import { useLayoutEffect, useRef } from 'preact/hooks';

// Main pane. The body scrolls in .detail-main-scroll. Expand and origin ‹ ›
// sit in .detail-main-chrome, which shares this border box and the same
// stable gutter, so their insets stay on the padding edge.
// landmark is false in the fullscreen overlay so the page keeps the only <main>.
export function DetailMain ({
  align = 'start',
  header = null,
  chrome = null,
  scrollRef,
  onPadClick,
  landmark = true,
  children
}) {
  const Tag = landmark ? 'main' : 'div';
  const center = align === 'center';
  return (
    <Tag class="detail-main">
      <div
        class={`detail-main-scroll${center ? ' detail-main-center' : ''}`}
        ref={scrollRef}
        onClick={onPadClick}
      >
        {header}
        {children}
      </div>
      <div class="detail-main-chrome">
        {chrome}
      </div>
    </Tag>
  );
}

// Viewport frame shared by the media page and container pages.
// flow: at a narrow width the container page stacks into one document column.
// scrollKey is the displayed id, so a held neighbour does not reset until the swap.
export function DetailPage ({
  class: className = '',
  scrollKey,
  align = 'start',
  flow = false,
  header = null,
  sidebar = null,
  chrome = null,
  children
}) {
  const mainRef = useRef(null);
  const sideRef = useRef(null);

  useLayoutEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch {
      /* non-browser */
    }
    if (mainRef.current) mainRef.current.scrollTop = 0;
    if (sideRef.current) sideRef.current.scrollTop = 0;
  }, [scrollKey]);

  const root = ['detail-page', flow ? 'detail-page-flow' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div class={root}>
      <div class="detail-columns">
        <DetailMain
          align={align}
          header={header}
          chrome={chrome}
          scrollRef={mainRef}
        >
          {children}
        </DetailMain>
        {sidebar != null ? (
          <aside class="detail-sidebar" ref={sideRef}>{sidebar}</aside>
        ) : null}
      </div>
    </div>
  );
}
