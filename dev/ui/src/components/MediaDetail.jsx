import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'preact/hooks';
import { chipDatetime, formatDate, tagLabel, tagCssClass, copyToClipboard, nextTagsForReaction, reactionMarks, isAudioCover, mediaStageStyle, coverStillPath, containerEdgeHeading, containerEdgeRowParts, inputMediaCaptions, normalizeMediaId, postStatusLabel } from '../lib/format.js';
import { TimeText } from './TimeText.jsx';
import { projectAudioParams } from '../lib/ace-audio.js';
import { composeDetailResources, generatorFamilyModelBlock, modelsOriginReturnHref } from '../lib/detail-resources.js';
import {
  entityHeaderLabel,
  jobResolutionLabel,
  model3dFileRows,
  model3dShownFormat,
  model3dSizeText,
  viewableMeshFiles
} from '../lib/param-display.js';
import { detailFacts, snapshotFromRaw } from '../../../../src/parameters.mjs';
import { browsingLevelLabel } from '../lib/browsing-level.js';
import {
  downloadTitle,
  mediaFileCopy,
  mediaNoun,
  civitaiInstanceLabels,
  postAccessChips,
  comicPublication,
  comicAccessChips
} from '../lib/sidebar-links.js';
import { getMedia, getMediaDetail, getGeneration, getPost, getComic, setReaction } from '../api.js';
import { OpenFolderButton, OpenJsonButton } from './OpenFolderButton.jsx';
import { HighlightText } from './HighlightText.jsx';
import { Gallery } from './Gallery.jsx';
import { DetailMain, DetailPage } from './DetailPage.jsx';
import { EntityHeader } from './EntityHeader.jsx';
import { PublishedAs3d } from './PublishedAs3d.jsx';
import { Lightbox } from './Lightbox.jsx';
import { ActiveMesh, MeshViewport, meshIsLarge, useMeshHost } from './MeshStage.jsx';
import { useMeshViewerPref } from '../lib/mesh-viewer-pref.js';
import { getRoute, pushState, replaceState } from '../lib/router.js';
import { ModelMembership, RelatedStrip, WorkflowSection, onModelsLinkClick } from './SidebarSections.jsx';
import { completeAuthoredParams, formatUrl, parseUrl } from '../lib/url-state.js';
import { workflowSidebarLine, usedInCaption } from '../lib/workflow-line.js';
import { OriginSiblingNav } from './OriginSiblingNav.jsx';
import { memberMediaHref, openOriginNode, openStepperSibling, readHistoryAnchorSlot, relatedOriginHref, usedInConsumerHref } from '../lib/open-origin-node.js';
import { readHistoryBag } from '../lib/origin-page.js';
import { useGalleryData } from '../hooks/useGalleryData.js';
import { canonicalMediaRouteId, membershipContainerHref, originFetchQuery } from '../lib/media-href.js';
import { memberCursor, comicReadingIds, mapMemberIdsToCanonical } from '../lib/container-member.js';
import { useDocumentTitle } from '../lib/page-title.js';
import { useOwnModelsRevision } from '../lib/own-models-rev.js';
import { useIndexEpoch } from '../lib/index-settle.js';
import { quietSlotPatch } from '../lib/origin-page.js';
import { useMagicEscape } from '../hooks/useMagicEscape.js';
import {
  createFullscreenSession,
  fullscreenSessionEnded,
  releaseDocumentFullscreen,
  requestElementFullscreen,
  yieldFullscreenEscape
} from '../lib/native-fullscreen.js';
import { sidebarPaint } from '../lib/sidebar-paint.js';
import {
  detailCacheKey,
  loadMediaDetail,
  prefetchOriginNeighbours,
  useHeldDetail
} from '../lib/detail-ready.js';
import { originMembershipKind } from '../lib/nav-tabs.js';

function model3dBytesFor (index, filePath) {
  const files = Array.isArray(index && index.files) ? index.files : [];
  for (const file of files) {
    if (file && file.path === filePath && typeof file.bytes === 'number') return file.bytes;
  }
  if (index && index.mediaPath === filePath && typeof index.bytes === 'number') return index.bytes;
  return undefined;
}

function uniqueById (list) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const sorted = list
    .filter(item => item && item.id != null && item.id !== '')
    .slice()
    .sort((a, b) => String(b.sortKey || '').localeCompare(String(a.sortKey || '')));
  const seen = new Map();
  for (const item of sorted) {
    const key = String(item.id);
    if (!seen.has(key)) seen.set(key, item);
  }
  return [...seen.values()];
}

function containerHref (kind, id, params, origin) {
  return membershipContainerHref(kind, id, params, origin);
}

const MEMBER_NAV_LABEL = {
  generation: 'In this generation',
  post: 'In this post',
  comic: 'In this comic'
};

function generationMemberRows (data) {
  const media = data && data.index && data.index.media;
  if (!Array.isArray(media)) return [];
  const out = [];
  for (const m of media) {
    if (!m || m.mediaId == null || m.mediaId === '') continue;
    const id = normalizeMediaId(m.mediaId);
    if (!id) continue;
    out.push({
      id,
      inWalk: m.inWalk === true,
      slot: m.slot != null && m.slot !== '' ? m.slot : null,
      slotInUrl: m.slotInUrl === true
    });
  }
  return out;
}

function postMemberRows (data) {
  const media = data && data.index && data.index.media;
  if (!Array.isArray(media)) return [];
  const out = [];
  for (const m of media) {
    const rawId = m?.mediaId != null && m.mediaId !== '' ? m.mediaId : m?.imageId;
    if (!m || rawId == null || rawId === '') continue;
    const id = normalizeMediaId(rawId);
    if (!id) continue;
    out.push({
      id,
      inWalk: m.inWalk === true,
      slot: m.slot != null && m.slot !== '' ? m.slot : null,
      slotInUrl: m.slotInUrl === true
    });
  }
  return out;
}

function comicMemberRows (data) {
  const index = data && data.index;
  if (!index || !Array.isArray(index.media)) return [];
  const ids = comicReadingIds(index);
  const byId = new Map();
  for (const m of index.media) {
    if (!m || m.role === 'cover' || m.role === 'hero') continue;
    let sid = '';
    if (m.mediaId != null && m.mediaId !== '') sid = String(m.mediaId);
    else if (m.panelMediaId) sid = String(m.panelMediaId);
    else if (m.imageId != null) sid = normalizeMediaId(m.imageId);
    else if (m.panelId != null) sid = `comic-panel:${m.panelId}`;
    if (!sid) continue;
    if (!byId.has(sid)) {
      byId.set(sid, {
        inWalk: m.inWalk === true,
        slot: m.slot != null && m.slot !== '' ? m.slot : null,
        slotInUrl: m.slotInUrl === true
      });
    }
  }
  return ids.map(id => {
    const stamp = byId.get(id) || { inWalk: false, slot: null, slotInUrl: false };
    return {
      id,
      inWalk: stamp.inWalk,
      slot: stamp.slot,
      slotInUrl: stamp.slotInUrl === true
    };
  });
}

async function canonicalizeMemberIds (ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const unique = [...new Set(ids.map(id => normalizeMediaId(id)).filter(Boolean))];
  const canonicalByAlias = new Map();
  await Promise.all(unique.map(async id => {
    try {
      const data = await getMediaDetail(id);
      const canonical = normalizeMediaId(data && data.index && data.index.id);
      canonicalByAlias.set(id, canonical || id);
    } catch {
      canonicalByAlias.set(id, id);
    }
  }));
  return mapMemberIdsToCanonical(ids, id => canonicalByAlias.get(id) || id);
}

async function canonicalizeMemberRows (rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const ids = rows.map(r => r.id);
  const canonical = await canonicalizeMemberIds(ids);
  return rows.map((r, i) => ({
    id: canonical[i] || r.id,
    inWalk: r.inWalk,
    slot: r.slot,
    slotInUrl: r.slotInUrl === true
  }));
}

function fetchContainerMembers (kind, id, originParams) {
  const q = originParams || {};
  if (kind === 'generation') {
    return getGeneration(id, q).then(generationMemberRows);
  }
  if (kind === 'post') {
    return getPost(id, q).then(postMemberRows).then(canonicalizeMemberRows);
  }
  if (kind === 'comic') {
    return getComic(id, q).then(comicMemberRows).then(canonicalizeMemberRows);
  }
  return Promise.resolve([]);
}

function foldMemberRows (rows) {
  const out = [];
  for (const r of rows) {
    if (!r || !r.id) continue;
    if (out.length > 0 && out[out.length - 1].id === r.id) continue;
    out.push(r);
  }
  return out;
}

function shouldFetchContainerMembers (kind, item) {
  if (!item || item.id == null || item.id === '') return false;
  if (kind === 'generation') {
    const n = Number(item.batchSize);
    if (Number.isFinite(n) && n < 2) return false;
  }
  return true;
}

function ContainerMemberNav ({ kind, item, mediaId, params, cacheRef, origin }) {
  const containerId = item && item.id;
  const batchSize = item && item.batchSize;
  const originParams = originFetchQuery(params);
  const originKey = JSON.stringify(originParams);
  const cacheKey = `${kind}:${containerId}:${originKey}`;
  const [rows, setRows] = useState(() => (
    cacheRef && cacheRef.current && cacheRef.current.has(cacheKey)
      ? cacheRef.current.get(cacheKey)
      : null
  ));

  useEffect(() => {
    const fetchItem = { id: containerId, batchSize };
    if (!shouldFetchContainerMembers(kind, fetchItem)) {
      setRows(null);
      return undefined;
    }
    const key = `${kind}:${containerId}:${originKey}`;
    if (cacheRef && cacheRef.current && cacheRef.current.has(key)) {
      setRows(cacheRef.current.get(key));
      return undefined;
    }
    let cancelled = false;
    fetchContainerMembers(kind, containerId, originParams)
      .then(list => {
        const next = Array.isArray(list) ? list : [];
        if (cacheRef && cacheRef.current) cacheRef.current.set(key, next);
        if (!cancelled) setRows(next);
      })
      .catch(() => {
        if (cacheRef && cacheRef.current) cacheRef.current.set(key, []);
        if (!cancelled) setRows([]);
      });
    return () => { cancelled = true; };
  }, [kind, containerId, batchSize, cacheRef, originKey]);

  if (!shouldFetchContainerMembers(kind, item)) return null;
  const label = MEMBER_NAV_LABEL[kind];
  if (!label || !Array.isArray(rows)) return null;
  // Full-container walk — do not filter by inWalk. Adjacent same ids fold.
  const folded = foldMemberRows(rows);
  const cursor = memberCursor(folded.map(r => r.id), mediaId);
  if (!cursor || cursor.n < 2) return null;
  const leaveSlot = (params && params.slot)
    || (origin && origin.slot)
    || null;
  const placement = origin && origin.placement;
  // Prefer the folded row whose slot matches the current origin slot when
  // that row's id is the open media id; else first-id (memberCursor).
  let pos = cursor.index;
  if (leaveSlot) {
    const want = normalizeMediaId(mediaId);
    for (let i = 0; i < folded.length; i++) {
      if (folded[i].id === want && folded[i].slot === leaveSlot) {
        pos = i;
        break;
      }
    }
  }
  const prevRow = pos > 0 ? folded[pos - 1] : null;
  const nextRow = pos >= 0 && pos < folded.length - 1
    ? folded[pos + 1]
    : null;

  function hrefFor (row) {
    if (!row) return '';
    const originView = (params && params.from) || (origin && origin.scope) || null;
    if (row.inWalk && row.slot) {
      return memberMediaHref(row.id, params, {
        slot: row.slot,
        originView,
        slotInUrl: row.slotInUrl
      });
    }
    return memberMediaHref(row.id, params, { dropSlot: true, originView });
  }

  function onHop (e, row) {
    if (!row) {
      e.preventDefault();
      return;
    }
    const href = hrefFor(row);
    if (!href) {
      e.preventDefault();
      return;
    }
    if (row.inWalk) {
      openOriginNode(e, { href, bag: { anchorSlot: null } });
      return;
    }
    openStepperSibling(e, href, { leaveSlot, placement });
  }

  const prevHref = hrefFor(prevRow);
  const nextHref = hrefFor(nextRow);
  return (
    <div class="container-member-nav">
      <a
        class="container-member-nav-arrow"
        href={prevHref || undefined}
        aria-label={`Previous · ${label}`}
        aria-disabled={!prevHref ? 'true' : undefined}
        onClick={e => onHop(e, prevRow)}
      >{'\u2039'}</a>
      <span class="container-member-nav-pos">{`${pos + 1} of ${cursor.n}`}</span>
      <a
        class="container-member-nav-arrow"
        href={nextHref || undefined}
        aria-label={`Next · ${label}`}
        aria-disabled={!nextHref ? 'true' : undefined}
        onClick={e => onHop(e, nextRow)}
      >{'\u203A'}</a>
    </div>
  );
}

function ContainerEdgeList ({ kind, items, textFor, mediaId, params, pageFiles, cacheRef, origin, originKind }) {
  const heading = containerEdgeHeading(kind, items.length);
  if (!heading) return null;
  const soleHref = items.length === 1 ? containerHref(kind, items[0].id, params, origin) : '';
  const sectionClass = originKind === kind ? 'meta-section meta-section-origin' : 'meta-section';
  const memberNav = (item) => (pageFiles
    ? (
        <ContainerMemberNav
          kind={kind}
          item={item}
          mediaId={mediaId}
          params={params}
          cacheRef={cacheRef}
          origin={origin}
        />
      )
    : null);
  if (soleHref) {
    const item = items[0];
    return (
      <div class={sectionClass}>
        <a
          class="meta-sole-link"
          href={soleHref}
          onClick={e => onModelsLinkClick(e, soleHref)}
        >
          <h2 class="meta-label meta-label-link">{heading}</h2>
          <span class="meta-edge-row">{textFor(item)}</span>
        </a>
        {memberNav(item)}
      </div>
    );
  }
  return (
    <div class={sectionClass}>
      <h2 class="meta-label">{heading}</h2>
      <div class="meta-edge-list">
        {items.map(item => {
          const href = containerHref(kind, item.id, params, origin);
          return (
            <div key={String(item.id)} class="meta-edge-item">
              <a
                class="meta-edge-row"
                href={href}
                onClick={e => onModelsLinkClick(e, href)}
              >{textFor(item)}</a>
              {memberNav(item)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pushKeepingHistoryBag (e, href) {
  if (!e || !href) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const path = String(href).startsWith('/') ? href : `/${href}`;
  const parsed = parseUrl(path);
  const current = getRoute();
  pushState({
    view: parsed.view,
    entityId: parsed.entityId,
    modelTrail: parsed.modelTrail,
    params: completeAuthoredParams(current.params, parsed.params)
  }, readHistoryBag());
}

function mediaPageHref (entityId, params) {
  return formatUrl({
    view: 'media',
    entityId,
    modelTrail: null,
    params: params || {}
  });
}

function withUsedIn (params, open) {
  const next = { ...(params || {}) };
  if (open) next.usedIn = '1';
  else delete next.usedIn;
  return next;
}

export function MediaDetail ({
  mediaId,
  search,
  fallback,
  fallbackRaw,
  onTagsChange,
  onExpand,
  showReactions = true,
  reactionKeyRef,
  occurrenceGenerationId,
  fileOrigin,
  originContainerId,
  jsonSource,
  onJsonId,
  pageFiles,
  params,
  pageClass = '',
  band = false,
  mesh = null,
  children
}) {
  const [copied, setCopied] = useState({ id: '', label: null });
  const [detail, setDetail] = useState(null);
  const [reactionEdit, setReactionEdit] = useState(null);
  const memberCacheRef = useRef(new Map());

  const originQueryKey = JSON.stringify(originFetchQuery(params));
  const anchorSlot = readHistoryAnchorSlot();
  const fetchKey = `${originQueryKey}|${anchorSlot || ''}`;

  useEffect(() => {
    if (!mediaId) return undefined;
    const want = normalizeMediaId(mediaId);
    if (fallback && normalizeMediaId(fallback.id) === want) {
      setDetail({ index: fallback, raw: fallbackRaw ?? null });
      return undefined;
    }
    let cancelled = false;
    const anchor = readHistoryAnchorSlot();
    getMediaDetail(mediaId, {
      generation: occurrenceGenerationId,
      origin: fileOrigin,
      post: fileOrigin === 'post' ? originContainerId : undefined,
      comic: fileOrigin === 'comic' ? originContainerId : undefined,
      ...originFetchQuery(params),
      ...(anchor ? { anchor } : {})
    })
      .then(d => { if (!cancelled) setDetail(d); })
      .catch(() => { if (!cancelled) setDetail({ index: null, raw: null }); });
    return () => { cancelled = true; };
  }, [mediaId, occurrenceGenerationId, fileOrigin, originContainerId, fetchKey, params, fallback, fallbackRaw]);

  const painted = sidebarPaint(detail, fallback, mediaId, fallbackRaw);
  const index = painted.index;
  const raw = painted.raw;
  const origin = (index && index.origin) || (fallback && fallback.origin) || null;
  const originScope = (params && params.from) || (origin && origin.scope) || null;
  const originKind = originMembershipKind(originScope);
  const itemKey = mediaId || '';
  const tags = (reactionEdit && reactionEdit.id === itemKey)
    ? reactionEdit.tags
    : reactionMarks(index);
  const copiedLabel = copied.id === itemKey ? copied.label : null;

  useEffect(() => {
    if (!onJsonId) return undefined;
    const id = occurrenceGenerationId || index?.containers?.generation?.id;
    if (id) onJsonId(id);
    return undefined;
  }, [onJsonId, occurrenceGenerationId, index]);

  const applyReaction = useCallback((edit) => {
    if (!itemKey) return;
    const prevTags = tags;
    const next = nextTagsForReaction(prevTags, edit);
    setReactionEdit({ id: itemKey, tags: next });
    if (onTagsChange) onTagsChange(itemKey, next);
    setReaction(itemKey, edit)
      .then(res => {
        const settled = (res && res.ok && Array.isArray(res.tags)) ? res.tags : prevTags;
        setReactionEdit(current => (
          current && current.id === itemKey ? { id: itemKey, tags: settled } : current
        ));
        if (onTagsChange) onTagsChange(itemKey, settled);
      })
      .catch(() => {
        setReactionEdit(current => (
          current && current.id === itemKey ? { id: itemKey, tags: prevTags } : current
        ));
        if (onTagsChange) onTagsChange(itemKey, prevTags);
      });
  }, [itemKey, tags, onTagsChange]);

  useEffect(() => {
    if (!reactionKeyRef) return undefined;
    reactionKeyRef.current = (key) => {
      if (key === 'f') applyReaction({ favorite: !tags.includes('favorite') });
      else if (key === 'l') applyReaction({ feedback: tags.includes('feedback:liked') ? null : 'liked' });
      else if (key === 'd') applyReaction({ feedback: tags.includes('feedback:disliked') ? null : 'disliked' });
    };
    return () => { reactionKeyRef.current = null; };
  }, [reactionKeyRef, applyReaction, tags]);

  const cur = {
    type: (index && index.type) || (fallback && fallback.type),
    thumbnailPath: (index && index.thumbnailPath) || (fallback && fallback.thumbnailPath),
    tags,
    duration: index?.duration ?? fallback?.duration,
    seed: index?.seed ?? fallback?.seed
  };
  const isVideo = cur.type === 'video';
  const isAudio = cur.type === 'audio';
  const isModel3d = cur.type === 'model3d';
  const audioCover = isAudio && isAudioCover(cur);
  const meshPath = (index && typeof index.mediaPath === 'string') ? index.mediaPath : '';
  const folderPath = (isModel3d && meshPath) ? meshPath : cur.thumbnailPath;
  const jsonId = jsonSource?.id
    || (jsonSource?.kind === 'generation'
      ? (occurrenceGenerationId || index?.containers?.generation?.id)
      : null);

  const composed = composeDetailResources({
    checkpoint: index?.checkpoint,
    resources: index?.resources,
    model: index?.model
  });
  const familyBlock = (!composed.model && composed.additional.length === 0)
    ? generatorFamilyModelBlock(index?.generatorFamily)
    : null;
  const modelBlock = familyBlock || composed.model;
  const additional = composed.additional;
  const modelPageHrefs = [
    modelBlock && modelBlock.href,
    ...additional.map(r => r && r.href)
  ].filter(Boolean);
  const soleModelHref = modelPageHrefs.length === 1 ? modelPageHrefs[0] : '';
  const workflowLine = workflowSidebarLine(index?.params?.workflow, originScope, index?.containers);
  const producedSize = (Number(index?.width) > 0 && Number(index?.height) > 0)
    ? { width: Number(index.width), height: Number(index.height) }
    : null;
  const model3dFiles = isModel3d
    ? model3dFileRows({ mediaPath: index && index.mediaPath, files: index && index.files })
    : [];

  // Prefer the indexed typed audio; fall back to projecting raw params so a
  // stale INDEX 18 cache still renders custom JSON without the image Prompt.
  const audio = (() => {
    if (!isAudio) return null;
    if (index?.audio) return index.audio;
    return projectAudioParams(raw?.metadata?.params || raw?.steps?.[0]?.params) || null;
  })();
  const simplePrompt = String(audio?.simplePrompt || audio?.songConcept || '').trim();
  const musicDescription = String(audio?.musicDescription || '').trim();
  const showSimplePrompt = Boolean(simplePrompt && simplePrompt !== musicDescription);
  const facts = index
    ? detailFacts({
      type: cur.type,
      snapshot: snapshotFromRaw(raw, mediaId),
      fallback: index.params,
      produced: producedSize,
      resolution: jobResolutionLabel(raw),
      durationSeconds: cur.duration,
      audio,
      files: index.files,
      seed: cur.seed,
      showSeed: true,
      omitModelIdentity: Boolean(modelBlock),
      omitWorkflowAliases: Boolean(workflowLine)
    })
    : null;
  const prompt = String(index?.prompt || '').trim() || (facts && facts.promptText) || '';
  const lyrics = String(audio?.lyrics || '').trim() || (facts && facts.lyricsText) || '';

  const inputRefs = Array.isArray(index?.inputs)
    ? index.inputs.filter(inp => inp && inp.id && inp.thumbnailPath)
    : [];
  const inputCaptions = inputMediaCaptions(inputRefs);
  const usedAsInputRefs = Array.isArray(index?.usedAsInput)
    ? index.usedAsInput.filter(e => e && e.id && e.thumbnailPath)
    : [];
  const usedTotal = typeof index?.usedAsInputTotal === 'number'
    ? index.usedAsInputTotal
    : usedAsInputRefs.length;
  const usedInOpenHref = mediaPageHref(mediaId, withUsedIn(params, true));

  const generationEdges = uniqueById(index?.containers?.generations);
  const postEdges = uniqueById(index?.containers?.posts);
  const comicEdges = uniqueById(index?.containers?.comics);
  const isImport = index != null
    && generationEdges.length === 0
    && postEdges.length === 0
    && comicEdges.length === 0;
  const headerChips = facts ? facts.headerChips : [];
  const ratingLevel = index?.browsingLevel;
  const ratingLabel = (ratingLevel != null && Number(ratingLevel) > 0)
    ? browsingLevelLabel(ratingLevel)
    : '';
  const contentTags = Array.isArray(index?.contentTags) ? index.contentTags : [];
  const stageRecord = index || fallback;
  const stageStyle = mediaStageStyle(stageRecord);
  const poster = coverStillPath(stageRecord);

  async function doCopy (text, label) {
    await copyToClipboard(text);
    const id = itemKey;
    setCopied({ id, label });
    setTimeout(() => setCopied(prev => (
      prev && prev.id === id && prev.label === label ? { id, label: null } : prev
    )), 1500);
  }

  const scrollBody = (
    <>
          {isModel3d && mesh
            ? (
              <MeshViewport
                stillSrc={cur.thumbnailPath || ''}
                enabled={mesh.enabled}
                onToggle={mesh.onToggle}
                viewable={mesh.viewable}
                selectedPath={mesh.selectedPath}
                onSelect={mesh.onSelect}
                notice={mesh.notice}
                large={mesh.large}
                slotRef={mesh.pageSlotRef}
                onStillClick={onExpand}
              />
            )
            : isAudio && !audioCover
            ? (
                <div class="detail-audio">
                  <div class="audio-placeholder detail-audio-art"><span class="audio-glyph">{'\u266B'}</span></div>
                  {cur.thumbnailPath && <audio src={cur.thumbnailPath} controls autoPlay />}
                </div>
              )
            : isModel3d && !cur.thumbnailPath
              ? (
                  <div class="audio-placeholder detail-audio-art">
                    <span class="model3d-mark">3D</span>
                  </div>
                )
            : (cur.thumbnailPath && (
                <div class={stageStyle ? 'media-stage' : undefined} style={stageStyle || undefined}>
                  {isAudio || isVideo
                    ? (
                        <video
                          src={cur.thumbnailPath}
                          poster={poster || undefined}
                          controls
                          autoPlay
                        />
                      )
                    : (
                        <img
                          src={cur.thumbnailPath}
                          alt="Image"
                          onClick={onExpand
                            ? (e => { e.stopPropagation(); onExpand(); })
                            : undefined}
                        />
                      )}
                </div>
              ))
          }
    </>
  );

  const chrome = (
    <>
      {onExpand && (isAudio || isModel3d || cur.thumbnailPath) && (
        <button
          type="button"
          class="detail-expand"
          aria-label="Expand"
          title="Expand"
          onClick={e => { e.stopPropagation(); onExpand(); }}
        >{'\u26F6'}</button>
      )}
      {children}
    </>
  );

  const sidebar = !band ? (
    <>
        {index ? (
          <EntityHeader
            label={entityHeaderLabel('media', cur.type)}
            date={isImport ? index.usedInEarliestAt : ''}
            chips={headerChips}
          />
        ) : null}
        {index?.model3d ? <PublishedAs3d model3d={index.model3d} /> : null}
        {showReactions && mediaId && (
          <div class="meta-section reaction-row">
            <button
              type="button"
              class={`reaction-btn favorite${tags.includes('favorite') ? ' active' : ''}`}
              onClick={() => applyReaction({ favorite: !tags.includes('favorite') })}
              aria-pressed={tags.includes('favorite')}
              title="Favorite (f)"
            >{'\u2764\uFE0F'}</button>
            <button
              type="button"
              class={`reaction-btn liked${tags.includes('feedback:liked') ? ' active' : ''}`}
              onClick={() => applyReaction({ feedback: tags.includes('feedback:liked') ? null : 'liked' })}
              aria-pressed={tags.includes('feedback:liked')}
              title="Like (l)"
            >{'\uD83D\uDC4D'}</button>
            <button
              type="button"
              class={`reaction-btn disliked${tags.includes('feedback:disliked') ? ' active' : ''}`}
              onClick={() => applyReaction({ feedback: tags.includes('feedback:disliked') ? null : 'disliked' })}
              aria-pressed={tags.includes('feedback:disliked')}
              title="Dislike (d)"
            >{'\uD83D\uDC4E'}</button>
          </div>
        )}

        <ContainerEdgeList
          kind="generation"
          items={generationEdges}
          textFor={occ => {
            const iso = occ.sortKey || occ.batchDate;
            return <TimeText at={iso}>{formatDate(iso)}</TimeText>;
          }}
          mediaId={mediaId}
          params={params}
          pageFiles={pageFiles}
          cacheRef={memberCacheRef}
          origin={origin}
          originKind={originKind}
        />
        <ContainerEdgeList
          kind="post"
          items={postEdges}
          textFor={ref => {
            const iso = ref.publishedAt || ref.sortKey;
            const parts = containerEdgeRowParts({
              date: formatDate(iso),
              title: ref.title,
              id: ref.id
            });
            return <>{parts.date ? <TimeText at={iso}>{parts.date}</TimeText> : null}{parts.tail}</>;
          }}
          mediaId={mediaId}
          params={params}
          pageFiles={pageFiles}
          cacheRef={memberCacheRef}
          origin={origin}
          originKind={originKind}
        />
        <ContainerEdgeList
          kind="comic"
          items={comicEdges}
          textFor={ref => {
            const iso = ref.sortKey;
            const parts = containerEdgeRowParts({
              date: formatDate(iso),
              title: ref.name,
              id: ref.id
            });
            return <>{parts.date ? <TimeText at={iso}>{parts.date}</TimeText> : null}{parts.tail}</>;
          }}
          mediaId={mediaId}
          params={params}
          pageFiles={pageFiles}
          cacheRef={memberCacheRef}
          origin={origin}
          originKind={originKind}
        />

        {(modelBlock || additional.length > 0) && (
          <ModelMembership
            modelBlock={modelBlock}
            additional={additional}
            soleHref={soleModelHref}
            sectionClass={originKind === 'model' ? 'meta-section meta-section-origin' : 'meta-section'}
          />
        )}

        {workflowLine ? <WorkflowSection line={workflowLine} /> : null}

        {/* Used in… consumers. One thumb per id (the detail preview).
            Input-only leftovers omit this when empty. */}
        <RelatedStrip
          title={'Used in\u2026'}
          items={usedAsInputRefs}
          count={usedTotal > 3 ? usedTotal : null}
          countHref={usedTotal > 3 ? usedInOpenHref : ''}
          onCountClick={e => pushKeepingHistoryBag(e, usedInOpenHref)}
          hrefFor={inp => usedInConsumerHref(inp, params, originScope)}
          captionFor={inp => {
            const { caption, abbreviation, title } = usedInCaption(inp.workflow);
            if (!caption) return '';
            if (abbreviation && title) {
              return [
                <abbr title={title}>{abbreviation}</abbr>,
                caption.slice(abbreviation.length)
              ];
            }
            return caption;
          }}
        />
        <RelatedStrip
          title="Input Media"
          items={inputRefs}
          hrefFor={inp => relatedOriginHref(inp, params)}
          captionFor={(_inp, i) => inputCaptions[i]}
        />

        {index == null && (
          <div class="meta-section">
            <div class="meta-prompt-skeleton" />
          </div>
        )}

        {!isAudio && prompt && (
          <div class="meta-section">
            <h2 class="meta-label">Prompt</h2>
            <p class="meta-prompt"><HighlightText text={prompt} search={search} /></p>
            <div class="meta-actions">
              <button
                class={`meta-action${copiedLabel === 'prompt' ? ' copied' : ''}`}
                onClick={() => doCopy(prompt, 'prompt')}
              >
                {copiedLabel === 'prompt' ? 'Copied' : 'Copy prompt'}
              </button>
            </div>
          </div>
        )}

        {!isAudio && index?.negativePrompt && (
          <div class="meta-section">
            <h2 class="meta-label">Negative Prompt</h2>
            <p class="meta-prompt meta-neg-prompt">{index.negativePrompt}</p>
          </div>
        )}

        {musicDescription && (
          <div class="meta-section">
            <h2 class="meta-label">Music description</h2>
            <p class="meta-prompt"><HighlightText text={musicDescription} search={search} /></p>
            <div class="meta-actions">
              <button
                class={`meta-action${copiedLabel === 'description' ? ' copied' : ''}`}
                onClick={() => doCopy(musicDescription, 'description')}
              >
                {copiedLabel === 'description' ? 'Copied' : 'Copy description'}
              </button>
            </div>
          </div>
        )}

        {lyrics && (
          <div class="meta-section">
            <h2 class="meta-label">Lyrics</h2>
            <pre class="meta-prompt audio-lyrics"><HighlightText text={lyrics} search={search} /></pre>
            <div class="meta-actions">
              <button
                class={`meta-action${copiedLabel === 'lyrics' ? ' copied' : ''}`}
                onClick={() => doCopy(lyrics, 'lyrics')}
              >
                {copiedLabel === 'lyrics' ? 'Copied' : 'Copy lyrics'}
              </button>
            </div>
          </div>
        )}

        {showSimplePrompt && (
          <div class="meta-section">
            <h2 class="meta-label">Simple prompt</h2>
            <p class="meta-prompt"><HighlightText text={simplePrompt} search={search} /></p>
            <div class="meta-actions">
              <button
                class={`meta-action${copiedLabel === 'simple-prompt' ? ' copied' : ''}`}
                onClick={() => doCopy(simplePrompt, 'simple-prompt')}
              >
                {copiedLabel === 'simple-prompt' ? 'Copied' : 'Copy simple prompt'}
              </button>
            </div>
          </div>
        )}

        {(facts && (facts.title || facts.rows.length > 0)) && (
          <div class="meta-section">
            <h2 class="meta-label">Parameters</h2>
            {facts.title ? <div class="meta-value">{facts.title}</div> : null}
            {facts.rows.length > 0 && (
              <ul class="meta-params">
                {facts.rows.map((row, i) => (
                  row.kind === 'text'
                    ? (
                      <li key={`t${i}`} class="param-text">
                        <span class="param-text-label">{row.label}</span>
                        {row.value}
                      </li>
                    )
                    : (
                      <li key={`c${i}`} class="param-chip">
                        {chipDatetime(row.text)
                          ? <TimeText datetime={chipDatetime(row.text)}>{row.text}</TimeText>
                          : row.text}
                      </li>
                    )
                ))}
              </ul>
            )}
          </div>
        )}

        {contentTags.length > 0 && (
          <div class="meta-section">
            <h2 class="meta-label">Content Tags</h2>
            <ul class="meta-tags">
              {contentTags.map(tag => (
                <li key={tag} class={`meta-tag ${tagCssClass(tag)}`}>
                  {tagLabel(tag)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {ratingLabel ? (
          <div class="meta-section">
            <h2 class="meta-label">Rating</h2>
            <ul class="meta-tags">
              <li class={`meta-tag ${tagCssClass(ratingLabel)}`}>{ratingLabel}</li>
            </ul>
          </div>
        ) : null}

        {pageFiles ? (
          <>
            <div class="meta-section">
              <h2 class="meta-label">Files</h2>
              {model3dFiles.length > 0 && (
                <ul class="model3d-files">
                  {model3dFiles.map((row, i) => {
                    const size = model3dSizeText(model3dBytesFor(index, row.path));
                    const shownFormat = model3dShownFormat(row);
                    return (
                      <li key={`${row.path}\0${i}`}>
                        <span>{row.label}</span>
                        {shownFormat ? <span class="model3d-file-format">{shownFormat}</span> : null}
                        {size ? <span class="model3d-file-size">{size}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div class="meta-actions">
                {folderPath ? (
                  <a
                    class="meta-action"
                    href={folderPath}
                    download
                    title={downloadTitle(cur.type)}
                  >{'\u2913'}</a>
                ) : null}
                {(() => {
                  const mediaCopy = folderPath
                    ? mediaFileCopy({ count: 1, types: [cur.type] })
                    : null;
                  return mediaCopy ? (
                    <OpenFolderButton
                      path={folderPath}
                      class="meta-action"
                      label={mediaCopy.label}
                      title={mediaCopy.title}
                    />
                  ) : null;
                })()}
                {generationEdges.map(occ => {
                  const iso = occ.sortKey || occ.batchDate;
                  const when = formatDate(iso);
                  return (
                    <OpenJsonButton
                      key={String(occ.id)}
                      kind="generation"
                      id={occ.id}
                      class="meta-action"
                      title="Open Generation folder, with data file selected"
                      suffix={generationEdges.length > 1 && when
                        ? <TimeText at={iso}>{when}</TimeText>
                        : undefined}
                    />
                  );
                })}
                {postEdges.map(ref => {
                  const iso = ref.publishedAt || ref.sortKey;
                  const when = formatDate(iso);
                  return (
                    <OpenJsonButton
                      key={`post-data-${String(ref.id)}`}
                      kind="post"
                      id={ref.id}
                      class="meta-action"
                      title="Open Post folder, with data file selected"
                      suffix={postEdges.length > 1 && when
                        ? <TimeText at={iso}>{when}</TimeText>
                        : undefined}
                    />
                  );
                })}
                {comicEdges.map(ref => {
                  const iso = ref.sortKey;
                  const when = formatDate(iso);
                  return (
                    <OpenJsonButton
                      key={`comic-data-${String(ref.id)}`}
                      kind="comic"
                      id={ref.id}
                      class="meta-action"
                      title="Open Comic folder, with data file selected"
                      suffix={comicEdges.length > 1 && when
                        ? <TimeText at={iso}>{when}</TimeText>
                        : undefined}
                    />
                  );
                })}
              </div>
            </div>
            {(() => {
              const postLinks = postEdges.filter(ref => ref && ref.url);
              const comicLinks = comicEdges.filter(ref => ref && ref.url);
              if (postLinks.length === 0 && comicLinks.length === 0) return null;
              const labelItems = [
                ...postLinks.map(ref => ({
                  kind: 'post',
                  date: formatDate(ref.publishedAt || ref.sortKey) || ''
                })),
                ...comicLinks.map(ref => ({
                  kind: 'comic',
                  date: formatDate(ref.sortKey) || ''
                }))
              ];
              const labels = civitaiInstanceLabels(labelItems);
              const instanceTitle = `Open this ${mediaNoun(cur.type)} on Civitai`;
              const allComics = Array.isArray(index?.containers?.comics)
                ? index.containers.comics
                : [];
              let labelIdx = 0;
              return (
                <div class="meta-section">
                  <div class="meta-actions">
                    {postLinks.map(ref => {
                      const text = labels[labelIdx++];
                      const pub = postStatusLabel(ref.publishedAt);
                      const access = postAccessChips(ref.availability);
                      const chips = [
                        ...(pub === 'Draft' || pub === 'Scheduled' ? [pub] : []),
                        ...access
                      ];
                      return (
                        <span key={`civ-post-${String(ref.id)}`} class="meta-link-row">
                          <a
                            class="meta-action"
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={instanceTitle}
                          >{text}</a>
                          {chips.map(chip => (
                            <span key={chip} class="param-chip">{chip}</span>
                          ))}
                        </span>
                      );
                    })}
                    {comicLinks.map(ref => {
                      const text = labels[labelIdx++];
                      const chapterRefs = allComics.filter(
                        c => c && String(c.id) === String(ref.id)
                      );
                      const pub = comicPublication(
                        chapterRefs.map(c => c.chapterStatus)
                      );
                      const pubChip = (pub === 'draft' || pub === 'scheduled')
                        ? (pub === 'draft' ? 'Draft' : 'Scheduled')
                        : '';
                      const access = comicAccessChips(chapterRefs);
                      const chips = [
                        ...(pubChip ? [pubChip] : []),
                        ...access
                      ];
                      return (
                        <span key={`civ-comic-${String(ref.id)}`} class="meta-link-row">
                          <a
                            class="meta-action"
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={instanceTitle}
                          >{text}</a>
                          {chips.map(chip => (
                            <span key={chip} class="param-chip">{chip}</span>
                          ))}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <div class="meta-section">
            <div class="meta-actions">
              <OpenFolderButton path={folderPath} class="meta-action" />
              <OpenJsonButton kind={jsonSource?.kind} id={jsonId} class="meta-action" />
            </div>
          </div>
        )}
    </>
  ) : null;

  if (band) {
    return (
      <DetailMain align="center" landmark={false} chrome={children}>
        {scrollBody}
      </DetailMain>
    );
  }

  return (
    <DetailPage
      class={pageClass}
      scrollKey={itemKey}
      align="center"
      chrome={chrome}
      sidebar={sidebar}
    >
      {scrollBody}
    </DetailPage>
  );
}

function UsedInGallery ({ mediaId, params, originScope }) {
  const query = useMemo(() => ({ usedInput: mediaId, limit: 50 }), [mediaId]);
  const fetcher = useCallback((p) => getMedia({
    usedInput: p.usedInput,
    limit: 50,
    page: p.page
  }), []);
  const { items, loading, sentinelRef, hasMore, pending } = useGalleryData({ fetcher, query });
  const hrefFor = useCallback(
    (tile) => usedInConsumerHref(tile, params, originScope),
    [params, originScope]
  );
  const onItemActivate = useCallback((e, item) => {
    onModelsLinkClick(e, hrefFor(item));
  }, [hrefFor]);
  if (!items || items.length === 0) return null;
  return (
    <Gallery
      items={items}
      grain="media"
      loading={loading}
      hasMore={hasMore}
      pending={pending}
      sentinelRef={sentinelRef}
      hrefFor={hrefFor}
      onItemActivate={onItemActivate}
    />
  );
}

function fileOriginFrom (params) {
  const from = params && params.from;
  if (from === 'posts') return 'post';
  if (from === 'comics') return 'comic';
  return undefined;
}

function pausePageMedia () {
  try {
    const root = document.querySelector('.media-detail-page .detail-main');
    if (!root) return;
    for (const el of root.querySelectorAll('video, audio')) {
      el.pause();
    }
  } catch {
    /* ignore */
  }
}

export function MediaDetailView ({ entityId, occurrenceGenerationId, params, onOriginScope, onModelReturn }) {
  const [fullscreen, setFullscreen] = useState(false);
  const quietAppliedRef = useRef(null);
  const fileOrigin = fileOriginFrom(params);
  const anchorSlot = readHistoryAnchorSlot();
  const ownRev = useOwnModelsRevision();
  const indexEpoch = useIndexEpoch();
  const [playing, setPlaying] = useState(false);
  const [heldEpoch, setHeldEpoch] = useState(indexEpoch);
  useEffect(() => {
    if (!playing) setHeldEpoch(indexEpoch);
  }, [playing, indexEpoch]);
  const cacheKey = detailCacheKey({
    view: 'media',
    id: entityId,
    params,
    anchor: anchorSlot
  }) + `:own${ownRev}:ix${heldEpoch}`;
  const held = useHeldDetail(cacheKey, () => loadMediaDetail(entityId, params, anchorSlot));
  const data = held.displayed;
  const onRoute = held.shownKey === cacheKey && !!data?.index;
  useEffect(() => {
    if (!onRoute) return undefined;
    const root = document.querySelector('.media-detail-page');
    if (!root) return undefined;
    const sync = () => {
      const live = [...root.querySelectorAll('video, audio')].some(el => !el.paused && !el.ended);
      setPlaying(live);
    };
    root.addEventListener('play', sync, true);
    root.addEventListener('pause', sync, true);
    root.addEventListener('ended', sync, true);
    return () => {
      root.removeEventListener('play', sync, true);
      root.removeEventListener('pause', sync, true);
      root.removeEventListener('ended', sync, true);
    };
  }, [onRoute, entityId, fullscreen]);

  const fsSession = useRef(createFullscreenSession());
  const fsAlive = useRef(true);
  const fsHostRef = useRef(null);
  const meshPref = useMeshViewerPref();
  const meshHost = useMeshHost();
  const pageSlotRef = useRef(null);
  const expandSlotRef = useRef(null);
  const [meshNotice, setMeshNotice] = useState('');
  const [meshReady, setMeshReady] = useState(false);
  const [meshPath, setMeshPath] = useState('');
  const meshIndex = data?.index?.type === 'model3d' ? data.index : null;
  const meshRows = meshIndex
    ? viewableMeshFiles({ mediaPath: meshIndex.mediaPath, files: meshIndex.files })
    : [];
  const meshPathKey = meshRows.map(row => row.path).join('\n');
  const meshId = meshIndex ? String(meshIndex.id || entityId || '') : '';

  useEffect(() => {
    setMeshPath(meshPathKey ? meshPathKey.split('\n')[0] : '');
    setMeshNotice('');
    setMeshReady(false);
  }, [meshId, meshPathKey]);

  const closeFullscreen = useCallback(() => {
    releaseDocumentFullscreen(fsSession.current, document).then(() => {
      if (fsAlive.current) setFullscreen(false);
    });
  }, []);

  const openFullscreen = useCallback(() => {
    pausePageMedia();
    const host = fsHostRef.current;
    try {
      if (host) {
        host.classList.remove('media-fullscreen-standby');
        host.classList.add('media-fullscreen');
      }
    } catch {
      /* ignore */
    }
    requestElementFullscreen(fsSession.current, document, host);
    setFullscreen(true);
  }, []);

  const yieldEscape = useCallback(() => {
    try {
      return yieldFullscreenEscape(fsSession.current, document);
    } catch {
      return false;
    }
  }, []);

  useLayoutEffect(() => {
    fsAlive.current = true;
    const session = fsSession.current;
    const onChange = () => {
      try {
        if (fullscreenSessionEnded(session, document)) setFullscreen(false);
      } catch {
        /* ignore */
      }
    };
    try {
      document.addEventListener('fullscreenchange', onChange);
    } catch {
      /* non-browser */
    }
    return () => {
      fsAlive.current = false;
      try {
        document.removeEventListener('fullscreenchange', onChange);
      } catch {
        /* ignore */
      }
      releaseDocumentFullscreen(session, document);
    };
  }, []);

  const escapeOrigin = data?.index?.origin ? data.index.origin : null;
  const escapeModelReturn = (onRoute && params?.from === 'models')
    ? (modelsOriginReturnHref({
        versionId: params.versionId,
        familyId: params.familyId,
        sort: params.sort,
        checkpoint: data.index.checkpoint,
        resources: data.index.resources
      }) || null)
    : null;
  useMagicEscape({ origin: escapeOrigin, modelReturn: escapeModelReturn });

  useEffect(() => {
    if (!fullscreen) return undefined;
    pausePageMedia();
    return undefined;
  }, [fullscreen, entityId]);

  useEffect(() => {
    if (!fullscreen) return undefined;
    let previous = '';
    try {
      previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    } catch {
      return undefined;
    }
    return () => {
      try { document.body.style.overflow = previous; } catch { /* ignore */ }
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!onRoute || !data?.index?.origin) return undefined;
    prefetchOriginNeighbours({
      view: 'media',
      routeParams: params,
      origin: data.index.origin,
      anchor: anchorSlot
    });
    return undefined;
  }, [onRoute, data, params, anchorSlot]);

  useEffect(() => {
    if (!onRoute || !data?.index) return;
    const next = canonicalMediaRouteId(entityId, data.index.id);
    if (!next) return;
    replaceState({
      view: 'media',
      entityId: next,
      params: { ...(params || {}) }
    });
  }, [onRoute, data, entityId, params]);

  // Publish origin.scope for the nav tab when from is absent. While the
  // previous page is held, leave the last scope in place.
  useEffect(() => {
    if (typeof onOriginScope !== 'function') return;
    if (!onRoute || !data?.index) return;
    if (params && params.from) {
      onOriginScope(null);
      return;
    }
    const scope = data.index.origin && data.index.origin.scope;
    onOriginScope(scope || null);
  }, [onRoute, data, params, onOriginScope]);

  // Models tab return: the version page for this versionId, once the detail
  // read has the matching resource. Keep the last href while a read is in
  // flight so a neighbour step does not flash the catalog.
  useEffect(() => {
    if (typeof onModelReturn !== 'function') return;
    if (!params || params.from !== 'models') {
      onModelReturn(null);
      return;
    }
    if (!onRoute || !data?.index) return;
    const href = modelsOriginReturnHref({
      versionId: params.versionId,
      familyId: params.familyId,
      sort: params.sort,
      checkpoint: data.index.checkpoint,
      resources: data.index.resources
    });
    onModelReturn(href || null);
  }, [onRoute, data, params, onModelReturn]);

  // After the route's own detail has settled, quiet omitFrom / slot.
  useEffect(() => {
    if (!onRoute || !data?.index?.origin || !entityId) return;
    const origin = data.index.origin;
    const canonical = data.index.id != null ? normalizeMediaId(data.index.id) : '';
    const openId = normalizeMediaId(entityId);
    if (canonical && openId && canonical !== openId) return;

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
    if (nextParams.usedIn != null && nextParams.usedIn !== '1') {
      nextParams.usedIn = null;
      changed = true;
    }
    if (!changed) return;

    const quietKey = `${openId}|${JSON.stringify(nextParams)}`;
    if (quietAppliedRef.current === quietKey) return;
    quietAppliedRef.current = quietKey;
    replaceState({
      view: 'media',
      entityId: canonical || openId,
      params: nextParams
    });
  }, [onRoute, data, entityId, params]);

  const galleryOpen = !!(params && params.usedIn === '1');
  useEffect(() => {
    if (!galleryOpen) return undefined;
    try { window.scrollTo(0, 0); } catch { /* ignore */ }
    return undefined;
  }, [galleryOpen, entityId]);

  useDocumentTitle(
    data?.index
      ? {
          place: 'media',
          type: data.index.type,
          date: formatDate(data.index.date),
          title: String(data.index.audio?.title || '').trim()
        }
      : { place: 'media' }
  );

  if (!data && !held.failed) return null;

  if (!data || !data.index) {
    return (
      <main class="main-content">
        <div class="empty-state">
          <h1>Media item not found</h1>
          <p>This id is not in the local index.</p>
        </div>
      </main>
    );
  }

  const index = data.index;
  const origin = index.origin || null;
  const mediaId = normalizeMediaId(index.id) || String(entityId);
  const originScope = (params && params.from) || (origin && origin.scope) || null;
  const usedTotal = typeof index.usedAsInputTotal === 'number' ? index.usedAsInputTotal : null;
  const closeHref = mediaPageHref(mediaId, withUsedIn(params, false));
  const pageClass = `media-detail-page${fullscreen ? ' media-fullscreen-open' : ''}${galleryOpen ? ' media-used-in-open' : ''}`;
  const closeIfHost = (e) => {
    if (e.target === e.currentTarget) closeFullscreen();
  };
  const mesh = index.type === 'model3d'
    ? {
        enabled: meshPref.enabled,
        onToggle: () => {
          if (meshPref.enabled) {
            meshPref.setEnabled(false);
            return;
          }
          setMeshNotice('');
          setMeshReady(false);
          meshPref.setEnabled(true);
        },
        viewable: meshRows,
        selectedPath: meshPath,
        onSelect: (path) => {
          setMeshPath(path);
          setMeshNotice('');
          setMeshReady(false);
        },
        notice: meshNotice,
        large: meshIsLarge(model3dBytesFor(index, meshPath)),
        pageSlotRef,
        expandSlotRef
      }
    : null;
  const meshLive = !!(mesh && meshPref.enabled && meshRows.length > 0 && meshPath);
  const meshLayer = (
    <ActiveMesh
      host={meshHost}
      slotRef={fullscreen ? expandSlotRef : pageSlotRef}
      live={meshLive}
      url={meshPath}
      conceal={!meshReady || !!meshNotice}
      onReady={() => {
        setMeshNotice('');
        setMeshReady(true);
      }}
      onNotice={(message) => {
        setMeshNotice(message);
        setMeshReady(false);
      }}
      onUnrecoverable={(message) => {
        setMeshNotice(message);
        setMeshReady(false);
        meshPref.setEnabled(false);
      }}
    />
  );
  const overlay = (
    <div
      key="fs-host"
      ref={fsHostRef}
      class={fullscreen ? 'media-fullscreen' : 'media-fullscreen-standby'}
      onClick={fullscreen ? closeIfHost : undefined}
      aria-hidden={fullscreen ? undefined : 'true'}
    >
      {fullscreen ? (
        <Lightbox
          src={index.thumbnailPath}
          type={index.type}
          audioCover={isAudioCover(index)}
          width={index.width}
          height={index.height}
          aspectClass={index.aspectClass}
          coverPath={coverStillPath(index)}
          onClose={closeFullscreen}
          yieldEscape={yieldEscape}
          mesh={mesh}
          meshReady={meshReady}
        >
          <OriginSiblingNav origin={origin} routeParams={params} ignoreOverlay={false} />
        </Lightbox>
      ) : null}
    </div>
  );

  if (galleryOpen) {
    return (
      <>
        <main class={`main-content ${pageClass}`}>
          <div class="used-in-band">
            <MediaDetail
              band
              mediaId={mediaId}
              occurrenceGenerationId={occurrenceGenerationId}
              fileOrigin={fileOrigin}
              params={params}
              fallback={index}
              fallbackRaw={data.raw}
              onExpand={openFullscreen}
              mesh={mesh}
            >
              <OriginSiblingNav origin={origin} routeParams={params} />
            </MediaDetail>
          </div>
          <div class="used-in-line">
            <h2 class="meta-label">{'Used in\u2026'}</h2>
            {usedTotal != null ? <span class="used-in-total">{usedTotal}</span> : null}
            <a class="used-in-close" href={closeHref} onClick={e => pushKeepingHistoryBag(e, closeHref)}>Close</a>
          </div>
          <UsedInGallery mediaId={mediaId} params={params} originScope={originScope} />
        </main>
        {overlay}
        {meshLayer}
      </>
    );
  }

  return (
    <>
      <MediaDetail
        pageClass={pageClass}
        mediaId={mediaId}
        occurrenceGenerationId={occurrenceGenerationId}
        fileOrigin={fileOrigin}
        pageFiles
        params={params}
        fallback={index}
        fallbackRaw={data.raw}
        showReactions
        onExpand={openFullscreen}
        mesh={mesh}
      >
        <OriginSiblingNav origin={origin} routeParams={params} />
      </MediaDetail>
      {overlay}
      {meshLayer}
    </>
  );
}
