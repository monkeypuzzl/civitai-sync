import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { openFiles } from '../api.js';
import { OpenFolderButton, OpenJsonButton } from './OpenFolderButton.jsx';
import { formatDate, copyToClipboard, memberReactionFields } from '../lib/format.js';
import { mediaFileCopy, postAccessChips } from '../lib/sidebar-links.js';
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
import { containerFilterChips } from '../lib/filter-chips.js';
import { containerUnfilteredHref } from '../lib/media-href.js';
import { useScopeChipTree } from '../lib/scope-chip-tree.js';
import { PublishedAs3d } from './PublishedAs3d.jsx';
import { memberMediaHref, openPreservingOriginBag } from '../lib/open-origin-node.js';
import { detailCacheKey, loadContainerDetail, prefetchOriginNeighbours, useHeldDetail } from '../lib/detail-ready.js';
import { quietSlotPatch } from '../lib/origin-page.js';
import { useIndexEpoch } from '../lib/index-settle.js';
import { SafeRichText } from './SafeRichText.jsx';
import { htmlToSafeTree, treeHasText } from '../../../../src/safeHtml.mjs';
import { useDocumentTitle } from '../lib/page-title.js';
import { useOwnModelsKnown, useOwnModelsRevision } from '../lib/own-models-rev.js';
import { useMagicEscape } from '../hooks/useMagicEscape.js';

// Per Implementation Contract item 3: switching from a detail route back
// to its list view is a pushState (view change). Pass entityId: null
// explicitly so the merged state clears it.
function backToPosts () {
  pushState({ view: 'posts', entityId: null });
}

const REACTION_ICONS = {
  heartCount: '\u2764\uFE0F',
  likeCount: '\uD83D\uDC4D',
  laughCount: '\uD83D\uDE02',
  cryCount: '\uD83D\uDE22',
  dislikeCount: '\uD83D\uDC4E',
  collectedCount: '\uD83D\uDCDA',
  commentCount: '\uD83D\uDCAC'
};

function postMemberId (m) {
  if (m?.mediaId != null && m.mediaId !== '') return String(m.mediaId);
  if (m?.imageId != null && m.imageId !== '') return String(m.imageId);
  return '';
}

function postMediaToTile (m) {
  const inputs = Array.isArray(m.inputs) ? m.inputs : [];
  const kinds = [];
  const seen = new Set();
  for (const inp of inputs) {
    if (!inp?.kind || seen.has(inp.kind)) continue;
    seen.add(inp.kind);
    kinds.push(inp.kind);
  }
  const id = postMemberId(m);
  const marks = memberReactionFields(m);
  return {
    id,
    type: m.type,
    hasInputs: inputs.length > 0,
    inputKinds: kinds,
    tags: marks.tags,
    reactions: marks.reactions,
    media: [{
      mediaId: id,
      type: m.type,
      thumbnailPath: m.thumbnailPath,
      tags: m.tags || [],
      duration: m.duration
    }]
  };
}

export function PostDetailView ({ postId, params }) {
  useMagicEscape();
  const modelTree = useScopeChipTree(params && params.models);
  const [copied, setCopied] = useState(null);
  const quietAppliedRef = useRef(null);
  const ownRev = useOwnModelsRevision();
  const ownKnown = useOwnModelsKnown();
  const indexEpoch = useIndexEpoch();
  const cacheKey = detailCacheKey({ view: 'posts', id: postId, params }) + `:own${ownRev}:ix${indexEpoch}`;
  const held = useHeldDetail(cacheKey, () => loadContainerDetail('posts', postId, params));
  const data = held.displayed;
  const onRoute = held.shownKey === cacheKey && data?.index?.id != null
    && String(data.index.id) === String(postId);
  const detailTree = useMemo(
    () => (data?.index?.detail ? htmlToSafeTree(data.index.detail) : null),
    [data?.index?.detail]
  );

  const origin = data?.index?.origin || null;

  useEffect(() => {
    if (!onRoute || !origin) return undefined;
    prefetchOriginNeighbours({ view: 'posts', routeParams: params, origin });
    return undefined;
  }, [onRoute, origin, params]);

  useEffect(() => {
    if (!onRoute || !origin || !postId) return;
    const nextParams = { ...(params || {}) };
    let changed = false;
    if (origin.omitFrom && nextParams.from) {
      delete nextParams.from;
      changed = true;
    }
    const slotPatch = quietSlotPatch({ urlSlot: nextParams.slot, origin });
    if (slotPatch) {
      if (slotPatch.slot) nextParams.slot = slotPatch.slot;
      else delete nextParams.slot;
      changed = true;
    }
    if (!changed) return;
    const quietKey = `${postId}|${JSON.stringify(nextParams)}`;
    if (quietAppliedRef.current === quietKey) return;
    quietAppliedRef.current = quietKey;
    replaceState({
      view: 'posts',
      entityId: postId,
      params: nextParams
    });
  }, [onRoute, origin, postId, params]);

  async function doCopy (text, label) {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  useDocumentTitle(
    data?.index
      ? {
          place: 'post',
          title: data.index.title,
          status: data.index.status,
          date: formatDate(data.index.status === 'draft' ? data.index.createdAt : data.index.publishedAt)
        }
      : { place: 'post' }
  );

  const scrollKey = data?.index?.id || postId;

  if (!data && !held.failed) {
    return <DetailPage flow scrollKey={scrollKey} sidebar={<></>} />;
  }

  if (!data || !data.index) {
    return (
      <DetailPage flow scrollKey={scrollKey} sidebar={<></>}>
        <div class="empty-state">
          <h1>Post not found</h1>
          <p>This post may not have been downloaded yet.</p>
          <button class="meta-action" onClick={backToPosts}>Back to Posts</button>
        </div>
      </DetailPage>
    );
  }

  const post = data.index;
  const raw = data.raw;
  const rawImages = raw?.images || [];
  const stats = post.stats || {};
  const reactions = Object.entries(REACTION_ICONS)
    .filter(([key]) => stats[key] > 0)
    .map(([key, icon]) => ({ key, icon, count: stats[key] }));

  // Same status-aware date as PostCard: drafts have publishedAt: null, so
  // fall back to the derived createdAt. Scheduled uses its future publishedAt.
  const isDraft = post.status === 'draft';
  const dateStr = isDraft ? post.createdAt : post.publishedAt;
  const shownMedia = (Array.isArray(post.media) ? post.media : [])
    .filter(m => m && m.inWalk !== false);
  const shownFiles = shownMedia.filter(m => m.thumbnailPath);
  const resourceRows = unionContainerResources(shownMedia);
  const modelHrefs = resourceRows.map(row => row.href).filter(Boolean);
  const soleModelHref = modelHrefs.length === 1 ? modelHrefs[0] : '';
  const originScope = (params && params.from) || (origin && origin.scope) || null;
  const originKind = originMembershipKind(originScope);
  const workflowLines = unionContainerWorkflows(shownMedia)
    .map(id => workflowSidebarLine(id, originScope, { posts: [post] }))
    .filter(Boolean);
  const fileCopy = mediaFileCopy({
    count: shownFiles.length,
    types: shownFiles.map(m => m.type)
  });

  return (
    <DetailPage
      flow
      scrollKey={scrollKey}
      chrome={<OriginSiblingNav origin={origin} routeParams={params} />}
      sidebar={(
        <>
          <EntityHeader
            title={post.title}
            label="Post"
            date={dateStr}
            href={containerUnfilteredHref('posts', postId, params)}
            filters={containerFilterChips('posts', postId, params, { modelTree, ownKnown })}
          />
          {post.model3d ? <PublishedAs3d model3d={post.model3d} /> : null}
          {reactions.length > 0 && (
            <ul class="post-detail-reactions">
              {reactions.map(r => (
                <li key={r.key} class="post-reaction-chip">{r.icon} {r.count}</li>
              ))}
            </ul>
          )}
          {resourceRows.length > 0 && (
            <ModelMembership
              rows={resourceRows}
              soleHref={soleModelHref}
              sectionClass={originKind === 'model' ? 'meta-section meta-section-origin' : 'meta-section'}
            />
          )}
          {workflowLines.length > 0 ? <WorkflowSection lines={workflowLines} /> : null}
          {post.tags.length > 0 && (
            <div class="meta-section">
              <h2 class="meta-label">Post Tags</h2>
              <ul class="meta-tags">
                {post.tags.map(tag => (
                  <li key={tag.id || tag.name} class="meta-tag">{tag.name}</li>
                ))}
              </ul>
            </div>
          )}
          <div class="meta-section">
            <h2 class="meta-label">Files</h2>
            <div class="meta-actions">
              {fileCopy
                ? (shownFiles.length === 1
                    ? (
                        <OpenFolderButton
                          path={shownFiles[0].thumbnailPath}
                          class="meta-action"
                          label={fileCopy.label}
                          title={fileCopy.title}
                        />
                      )
                    : (
                        <button
                          type="button"
                          class="meta-action"
                          title={fileCopy.title}
                          onClick={() => openFiles(shownFiles.map(m => m.thumbnailPath))}
                        >{fileCopy.label}</button>
                      ))
                : null}
              <OpenJsonButton
                kind="post"
                id={post.id}
                class="meta-action"
                title="Open Post folder, with data file selected"
              />
            </div>
          </div>
          {post.url ? (
            <div class="meta-section">
              <div class="meta-actions">
                <span class="meta-link-row">
                  <a
                    class="meta-action"
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open this post on Civitai"
                  >{'\uD83D\uDD17 On Civitai'}</a>
                  {postAccessChips(post.availability).map(chip => (
                    <span key={chip} class="param-chip">{chip}</span>
                  ))}
                </span>
              </div>
            </div>
          ) : null}
        </>
      )}
    >
        <div class="post-detail-media-grid">
          {shownMedia.map((m) => {
            const rawImg = rawImages.find(img => img.id === m.imageId) || null;
            const meta = m.meta || rawImg?.meta || null;
            const href = memberMediaHref(postMemberId(m), params, {
              slot: m.slot,
              originView: 'posts',
              granularity: 'post',
              slotInUrl: m.slotInUrl
            });
            return (
              <div key={m.imageId} class="post-media-card">
                <div class="post-media-card-visual">
                  <MediaTile
                    item={postMediaToTile(m)}
                    href={href}
                    onActivate={e => openPreservingOriginBag(e, href)}
                  />
                </div>
                <MediaCardMeta
                  media={m}
                  rawImage={rawImg}
                  meta={meta}
                  doCopy={doCopy}
                  copied={copied}
                />
              </div>
            );
          })}
        </div>

        {treeHasText(detailTree) && (
          <div class="post-detail-description">
            <SafeRichText tree={detailTree} />
          </div>
        )}
    </DetailPage>
  );
}

function MediaCardMeta ({ media, rawImage, meta, doCopy, copied }) {
  const dims = media.width > 0 && media.height > 0
    ? `${media.width}\u00D7${media.height}`
    : null;

  const level = browsingLevelOf(rawImage);
  const showRatingChip = level != null && level > 1;
  const prompt = meta?.prompt || '';
  if (!prompt && !dims && !showRatingChip) return null;

  return (
    <div class="post-media-card-meta">
      {dims && <div class="post-media-dims">{dims}</div>}

      {prompt && (
        <div class="post-media-prompt">
          <p class="post-media-prompt-text">{prompt}</p>
          <div class="meta-actions">
            <button
              class={`meta-action compact${copied === `prompt-${media.imageId}` ? ' copied' : ''}`}
              onClick={() => doCopy(prompt, `prompt-${media.imageId}`)}
            >
              {copied === `prompt-${media.imageId}` ? 'Copied' : 'Copy prompt'}
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
