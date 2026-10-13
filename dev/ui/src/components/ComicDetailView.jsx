import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { detailCacheKey, loadContainerDetail, prefetchOriginNeighbours, useHeldDetail } from '../lib/detail-ready.js';
import { OpenFolderButton, OpenJsonButton } from './OpenFolderButton.jsx';
import { formatDate, copyToClipboard, normalizeMediaId } from '../lib/format.js';
import { TimeText } from './TimeText.jsx';
import { mediaFileCopy } from '../lib/sidebar-links.js';
import { originMembershipKind } from '../lib/nav-tabs.js';
import { unionContainerResources } from '../lib/detail-resources.js';
import { unionContainerWorkflows, workflowSidebarLine } from '../lib/workflow-line.js';
import { ModelMembership, WorkflowSection } from './SidebarSections.jsx';
import { browsingLevelLabel, browsingLevelOf } from '../lib/browsing-level.js';
import { pushState, replaceState } from '../lib/router.js';
import { MediaTile } from './MediaTile.jsx';
import { OriginSiblingNav } from './OriginSiblingNav.jsx';
import { DetailPage } from './DetailPage.jsx';
import { EntityHeader } from './EntityHeader.jsx';
import { memberMediaHref, openPreservingOriginBag } from '../lib/open-origin-node.js';
import { useDocumentTitle } from '../lib/page-title.js';
import { useOwnModelsRevision } from '../lib/own-models-rev.js';
import { useMagicEscape } from '../hooks/useMagicEscape.js';

function backToComics () {
  pushState({ view: 'comics', entityId: null });
}

function panelSelectId (m) {
  if (m?.mediaId != null && m.mediaId !== '') return String(m.mediaId);
  if (m?.panelMediaId) return String(m.panelMediaId);
  if (m?.imageId != null) return normalizeMediaId(m.imageId);
  if (m?.panelId != null) return `comic-panel:${m.panelId}`;
  return '';
}

function isReadingPanel (m) {
  return m && m.role !== 'cover' && m.role !== 'hero';
}

function panelToTile (m, selectId) {
  const inputs = Array.isArray(m.inputs) ? m.inputs : [];
  const kinds = [];
  const seen = new Set();
  for (const inp of inputs) {
    if (!inp?.kind || seen.has(inp.kind)) continue;
    seen.add(inp.kind);
    kinds.push(inp.kind);
  }
  return {
    id: selectId,
    type: m.type || 'image',
    hasInputs: inputs.length > 0,
    inputKinds: kinds,
    media: [{
      mediaId: selectId,
      type: m.type || 'image',
      thumbnailPath: m.thumbnailPath,
      tags: m.tags || [],
      duration: m.duration
    }]
  };
}

function comicDetailDate (comic) {
  const status = comic.status;
  const chapters = Array.isArray(comic.chapters) ? comic.chapters : [];
  if (status === 'draft') return comic.createdAt;
  if (status === 'published') {
    let best = '';
    let bestT = -Infinity;
    const now = Date.now();
    for (const ch of chapters) {
      if (ch.status !== 'Published' || !ch.publishedAt) continue;
      const t = new Date(ch.publishedAt).getTime();
      if (Number.isNaN(t) || t > now) continue;
      if (t >= bestT) {
        bestT = t;
        best = ch.publishedAt;
      }
    }
    return best || comic.createdAt;
  }
  if (status === 'scheduled') {
    let best = '';
    let bestT = Infinity;
    for (const ch of chapters) {
      if (ch.status !== 'Scheduled' || !ch.publishedAt) continue;
      const t = new Date(ch.publishedAt).getTime();
      if (Number.isNaN(t)) continue;
      if (t < bestT) {
        bestT = t;
        best = ch.publishedAt;
      }
    }
    return best || comic.createdAt;
  }
  return comic.createdAt;
}

function isLiveEarlyAccess (ch, now = Date.now()) {
  if (!ch || ch.availability !== 'EarlyAccess') return false;
  if (!ch.earlyAccessEndsAt) return false;
  const t = new Date(ch.earlyAccessEndsAt).getTime();
  return Number.isFinite(t) && t > now;
}

function chromeFrom (comic, raw) {
  const cover = (comic.media || []).find(m => m.role === 'cover') || null;
  const hero = (comic.media || []).find(m => m.role === 'hero') || null;
  const date = comic.date || (comic.createdAt ? String(comic.createdAt).slice(0, 10) : '');
  let coverOut = cover;
  let heroOut = hero;
  if (!coverOut) {
    const coverId = raw?.coverImage?.id ?? raw?.coverImageId;
    if (coverId != null && date) {
      coverOut = {
        role: 'cover',
        imageId: coverId,
        thumbnailPath: `/media/comics/${date}/${comic.id}/cover_${coverId}.jpeg`
      };
    }
  }
  if (!heroOut) {
    const heroId = raw?.heroImage?.id ?? raw?.heroImageId;
    if (heroId != null && date) {
      heroOut = {
        role: 'hero',
        imageId: heroId,
        thumbnailPath: `/media/comics/${date}/${comic.id}/hero_${heroId}.jpeg`
      };
    }
  }
  return { cover: coverOut, hero: heroOut };
}

function findRawPanel (raw, panelId) {
  if (panelId == null || !raw) return null;
  for (const ch of (raw.chapters || [])) {
    const hit = (ch.panels || []).find(p => p && p.id === panelId);
    if (hit) return hit;
  }
  return null;
}

function referenceImages (reference) {
  const images = Array.isArray(reference?.images) ? reference.images : [];
  return images.map((img, i) => {
    const imageId = img?.imageId ?? img?.image?.id;
    if (imageId == null) return null;
    const id = normalizeMediaId(imageId);
    return {
      key: `${reference.id}-${id}-${i}`,
      id,
      thumbnailPath: `/media/inputs/${id}.jpeg`,
      name: reference.name || '',
      type: reference.type || ''
    };
  }).filter(Boolean);
}

function chapterBadgeClass (status) {
  if (status === 'Scheduled') return 'comic-chapter-badge comic-chapter-badge-scheduled';
  if (status === 'Published') return 'comic-chapter-badge comic-chapter-badge-published';
  return 'comic-chapter-badge comic-chapter-badge-draft';
}

export function ComicDetailView ({ comicId, params }) {
  useMagicEscape();
  const [copied, setCopied] = useState(null);
  const quietAppliedRef = useRef(null);
  const ownRev = useOwnModelsRevision();
  const cacheKey = detailCacheKey({ view: 'comics', id: comicId, params }) + `:own${ownRev}`;
  const held = useHeldDetail(cacheKey, () => loadContainerDetail('comics', comicId, params));
  const data = held.displayed;
  const onRoute = held.shownKey === cacheKey && data?.index?.id != null
    && String(data.index.id) === String(comicId);

  async function doCopy (text, label) {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  const comic = data?.index;
  const raw = data?.raw;
  const origin = comic?.origin || null;

  useEffect(() => {
    if (!onRoute || !origin) return undefined;
    prefetchOriginNeighbours({ view: 'comics', routeParams: params, origin });
    return undefined;
  }, [onRoute, origin, params]);

  useEffect(() => {
    if (!onRoute || !origin || !comicId) return;
    const nextParams = { ...(params || {}) };
    let changed = false;
    if (origin.omitFrom && nextParams.from) {
      delete nextParams.from;
      changed = true;
    }
    if (!origin.slotInUrl && nextParams.slot) {
      delete nextParams.slot;
      changed = true;
    }
    if (!changed) return;
    const quietKey = `${comicId}|${JSON.stringify(nextParams)}`;
    if (quietAppliedRef.current === quietKey) return;
    quietAppliedRef.current = quietKey;
    replaceState({
      view: 'comics',
      entityId: comicId,
      params: nextParams
    });
  }, [onRoute, origin, comicId, params]);

  const readingMedia = useMemo(() => {
    if (!comic || !Array.isArray(comic.media)) return [];
    return comic.media.filter(
      m => isReadingPanel(m) && panelSelectId(m) && m.inWalk !== false
    );
  }, [comic]);

  useDocumentTitle(
    data?.index
      ? {
          place: 'comic',
          name: data.index.name,
          status: data.index.status,
          date: formatDate(comicDetailDate(data.index))
        }
      : { place: 'comic' }
  );

  const scrollKey = data?.index?.id || comicId;

  if (!data && !held.failed) {
    return <DetailPage flow scrollKey={scrollKey} sidebar={<></>} />;
  }

  if (!data || !data.index) {
    return (
      <DetailPage flow scrollKey={scrollKey} sidebar={<></>}>
        <div class="empty-state">
          <h1>Comic not found</h1>
          <p>This comic may not have been downloaded yet.</p>
          <button class="meta-action" onClick={backToComics}>Back to Comics</button>
        </div>
      </DetailPage>
    );
  }

  const dateStr = comicDetailDate(comic);
  const { cover, hero } = chromeFrom(comic, raw);
  const comicAltName = String(comic.name || '').trim();
  const chapters = [...(comic.chapters || [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  );
  const panelsByChapter = new Map();
  const shownPanels = [];
  for (const ch of chapters) {
    const panels = readingMedia
      .filter(m => m.chapterId === ch.id)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    panelsByChapter.set(ch.id, panels);
    shownPanels.push(...panels);
  }
  const resourceRows = unionContainerResources(shownPanels);
  const modelHrefs = resourceRows.map(row => row.href).filter(Boolean);
  const soleModelHref = modelHrefs.length === 1 ? modelHrefs[0] : '';
  const originScope = (params && params.from) || (origin && origin.scope) || null;
  const originKind = originMembershipKind(originScope);
  const workflowLines = unionContainerWorkflows(shownPanels)
    .map(id => workflowSidebarLine(id, originScope, { comics: [comic] }))
    .filter(Boolean);
  const deletedPanels = (comic.deletedPanels && comic.deletedPanels.length)
    ? comic.deletedPanels
    : (raw?.deletedPanels || []);
  const references = Array.isArray(raw?.references) ? raw.references : [];
  const tags = comic.tags || [];
  const comicDate = comic.date || (comic.createdAt ? String(comic.createdAt).slice(0, 10) : '');
  const mediaCopy = mediaFileCopy({
    count: readingMedia.length,
    types: readingMedia.map(m => m.type),
    comicFolder: true
  });
  const mediaFolderPath = readingMedia.length === 1
    ? (readingMedia[0].thumbnailPath || null)
    : (readingMedia.length > 1 && comicDate
        ? `/media/comics/${comicDate}/${comic.id}`
        : null);
  return (
    <DetailPage
      flow
      scrollKey={scrollKey}
      chrome={<OriginSiblingNav origin={origin} routeParams={params} />}
      sidebar={(
        <>
          <EntityHeader title={comic.name} label="Comic" date={dateStr} />
          {resourceRows.length > 0 && (
            <ModelMembership
              rows={resourceRows}
              soleHref={soleModelHref}
              sectionClass={originKind === 'model' ? 'meta-section meta-section-origin' : 'meta-section'}
            />
          )}
          {workflowLines.length > 0 ? <WorkflowSection lines={workflowLines} /> : null}
          {tags.length > 0 && (
            <div class="meta-section">
              <h2 class="meta-label">Tags</h2>
              <ul class="meta-tags">
                {tags.map(tag => (
                  <li key={tag.id || tag.name || tag} class="meta-tag">{tag.name || tag}</li>
                ))}
              </ul>
            </div>
          )}
          <div class="meta-section">
            <h2 class="meta-label">Files</h2>
            <div class="meta-actions">
              {mediaCopy && mediaFolderPath ? (
                <OpenFolderButton
                  path={mediaFolderPath}
                  class="meta-action"
                  label={mediaCopy.label}
                  title={mediaCopy.title}
                />
              ) : null}
              <OpenJsonButton
                kind="comic"
                id={comic.id}
                class="meta-action"
                title="Open Comic folder, with data file selected"
              />
            </div>
          </div>
          {comic.url ? (
            <div class="meta-section">
              <div class="meta-actions">
                <a
                  class="meta-action"
                  href={comic.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open this comic on Civitai"
                >{'\uD83D\uDD17 On Civitai'}</a>
              </div>
            </div>
          ) : null}
        </>
      )}
    >
        {(cover || hero) && (
          <div class={`comic-detail-chrome${hero ? ' has-hero' : ''}`}>
            {cover && cover.thumbnailPath && (
              <div class="comic-chrome-cover">
                <img src={cover.thumbnailPath} alt={comicAltName ? `Cover of ${comicAltName}` : 'Cover'} />
              </div>
            )}
            {hero && hero.thumbnailPath && (
              <div class="comic-chrome-hero">
                <img src={hero.thumbnailPath} alt={comicAltName ? `Hero of ${comicAltName}` : 'Hero'} />
              </div>
            )}
          </div>
        )}

        {comic.description && (
          <div class="post-detail-description"><p>{comic.description}</p></div>
        )}

        {chapters.map(ch => {
          const panels = panelsByChapter.get(ch.id) || [];
          const liveEa = isLiveEarlyAccess(ch);
          const buzz = ch.earlyAccessConfig && ch.earlyAccessConfig.buzzPrice;
          return (
            <section key={ch.id} class="comic-chapter">
              <div class="comic-chapter-header">
                <h2 class="comic-chapter-title">
                  {ch.name || `Chapter ${(ch.position ?? 0) + 1}`}
                </h2>
                <span class={chapterBadgeClass(ch.status)}>{ch.status || 'Draft'}</span>
                {liveEa && (
                  <span class="comic-ea-overlay">
                    Early Access
                    {buzz != null ? ` \u00B7 ${buzz} Buzz` : ''}
                  </span>
                )}
              </div>
              {panels.length > 0 ? (
                <div class="post-detail-media-grid">
                  {panels.map(m => {
                    const selectId = panelSelectId(m);
                    const rawPanel = findRawPanel(raw, m.panelId);
                    const meta = m.meta || rawPanel?.image?.meta || null;
                    const href = memberMediaHref(selectId, params, {
                      slot: m.slot,
                      originView: 'comics',
                      granularity: 'comic',
                      slotInUrl: m.slotInUrl
                    });
                    return (
                      <div key={selectId || m.panelId} class="post-media-card">
                        <div class="post-media-card-visual">
                          <MediaTile
                            item={panelToTile(m, selectId)}
                            href={href}
                            onActivate={e => openPreservingOriginBag(e, href)}
                          />
                        </div>
                        <MediaCardMeta
                          media={m}
                          rawPanel={rawPanel}
                          meta={meta}
                          doCopy={doCopy}
                          copied={copied}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p class="text-muted comic-chapter-empty">No ready panels in this chapter.</p>
              )}
            </section>
          );
        })}

        {references.length > 0 && (
          <section class="comic-references">
            <h2 class="comic-section-heading">References</h2>
            <div class="post-detail-media-grid">
              {references.map(ref => referenceImages(ref).map(img => {
                const href = memberMediaHref(img.id, params, {
                  originView: 'comics',
                  granularity: 'comic'
                });
                return (
                <div key={img.key} class="post-media-card">
                  <div class="post-media-card-visual">
                    <MediaTile
                      item={{
                        id: img.id,
                        type: 'image',
                        media: [{ mediaId: img.id, type: 'image', thumbnailPath: img.thumbnailPath, tags: [] }]
                      }}
                      href={href}
                      onActivate={e => openPreservingOriginBag(e, href)}
                    />
                  </div>
                  <div class="post-media-card-meta">
                    {ref.name && <div class="post-media-dims">{ref.name}</div>}
                    {ref.type && <span class="param-chip">{ref.type}</span>}
                  </div>
                </div>
                );
              }))}
            </div>
          </section>
        )}

        {deletedPanels.length > 0 && (
          <section class="comic-removed">
            <h2 class="comic-section-heading">Removed from chapter</h2>
            <ul class="comic-removed-list">
              {deletedPanels.map(p => (
                <li key={p.id}>
                  Panel {p.id}
                  {p.chapterId != null ? ` \u00B7 chapter ${p.chapterId}` : ''}
                  {p.removedAt ? <>{' \u00B7 '}<TimeText at={p.removedAt}>{formatDate(p.removedAt)}</TimeText></> : null}
                </li>
              ))}
            </ul>
          </section>
        )}
    </DetailPage>
  );
}

function MediaCardMeta ({ media, rawPanel, meta, doCopy, copied }) {
  const dims = media.width > 0 && media.height > 0
    ? `${media.width}\u00D7${media.height}`
    : null;
  const prompt = meta?.prompt || rawPanel?.prompt || '';
  const copyKey = `prompt-${media.panelId ?? media.imageId}`;

  const level = browsingLevelOf(rawPanel?.image);
  const showRatingChip = level != null && level > 1;
  if (!dims && !prompt && !showRatingChip) return null;

  return (
    <div class="post-media-card-meta">
      {dims && <div class="post-media-dims">{dims}</div>}

      {prompt && (
        <div class="post-media-prompt">
          <p class="post-media-prompt-text">{prompt}</p>
          <div class="meta-actions">
            <button
              class={`meta-action compact${copied === copyKey ? ' copied' : ''}`}
              onClick={() => doCopy(prompt, copyKey)}
            >
              {copied === copyKey ? 'Copied' : 'Copy prompt'}
            </button>
          </div>
        </div>
      )}

      {showRatingChip && (
        <span class="param-chip post-media-rating">{browsingLevelLabel(level)}</span>
      )}
    </div>
  );
}
