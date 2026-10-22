import { Fragment } from 'preact';
import { useState, useEffect, useMemo, useCallback, useRef } from 'preact/hooks';
import { getModels, getMedia } from '../api.js';
import { familyIsSelected, variantRowsForSection } from '../lib/model-catalog-filters.js';
import { familyCatalogParams } from '../lib/family-catalog-params.js';
import { pushState, navigate, replaceState, getRoute } from '../lib/router.js';
import { useOwnModelsRevision } from '../lib/own-models-rev.js';
import { useUrlState, formatUrl } from '../lib/url-state.js';
import { useGalleryData } from '../hooks/useGalleryData.js';
import { idFromToken, pathToken } from '../lib/modelSlug.js';
import { formatDate, relativeTime, copyToClipboard } from '../lib/format.js';
import { TimeText } from './TimeText.jsx';
import { MediaThumb } from './MediaThumb.jsx';
import { Gallery } from './Gallery.jsx';
import { SafeRichText } from './SafeRichText.jsx';
import {
  activateOriginTile,
  originNodeHref,
  shouldLoadFocusPrefix,
  readHistoryFocus
} from '../lib/open-origin-node.js';
import { resolveFocusId } from '../lib/gallery-focus.js';
import { useIndexEpoch } from '../lib/index-settle.js';
import { modelsTypeHref } from '../lib/detail-resources.js';
import { modelsOriginQuery } from '../lib/media-href.js';
import { useDocumentTitle } from '../lib/page-title.js';
import { versionClickHistory } from '../lib/version-link.js';
import { useMagicEscape } from '../hooks/useMagicEscape.js';

// The Models tab — Civitai-shaped catalog + model page. Catalog identity is
// query filters (`resourceType`, `family`, `variant`). The model page
// is `/models/{modelId}-{slug}?modelVersionId=` (entityId + query). Gallery
// sort is the only useUrlState write on the page besides catalog chips
// and modelVersionId; catalog chips also go through that hook (one
// coalescer writer at a time). Catalog and page payloads do not share a
// shape — chrome renders only when payload.level matches the current
// route (no empty-copy flash; no shell spinner on the sub-second hop).
export const URL_SCHEMA = {
  sort: { type: 'string', default: 'date:desc' },
  resourceType: { type: 'csv', default: [] },
  family: { type: 'csv', default: [] },
  variant: { type: 'csv', default: [] },
  modelVersionId: { type: 'string', default: '' },
  familyId: { type: 'string', default: '' },
  mine: { type: 'boolean', default: null }
};

const CATALOG_CLEAR = {
  resourceType: [],
  family: [],
  variant: [],
  modelVersionId: '',
  familyId: '',
  mine: null
};

function onModelsHref (e, href) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  navigate(href);
}

function onVersionHref (e, { href, shownVersionId, targetId, entityId }) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  if (versionClickHistory(shownVersionId, targetId) === 'replace') {
    replaceState({ view: 'models', entityId, params: { modelVersionId: targetId } });
    return;
  }
  navigate(href);
}

function modelTypeChip (model) {
  const href = modelsTypeHref(model?.type);
  if (!model?.typeLabel || !href) return null;
  return (
    <a
      class="model-type-badge"
      href={href}
      onClick={e => onModelsHref(e, href)}
    >
      {model.typeLabel}
    </a>
  );
}

function toggleMember (arr, value) {
  return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
}

function onFamilyCrumbClick (e, familyId) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  pushState({
    view: 'models',
    entityId: null,
    modelTrail: null,
    params: familyCatalogParams(familyId)
  });
}

function Breadcrumb ({ crumbs }) {
  return (
    <nav class="models-breadcrumb">
      <a class="crumb" href="/models" onClick={e => onModelsHref(e, '/models')}>
        Models
      </a>
      {crumbs.map((c) => {
        if (c.level === 'family' && c.key) {
          const href = formatUrl({
            view: 'models',
            params: familyCatalogParams(c.key)
          });
          return (
            <span key={`${c.level}:${c.key}`} class="crumb-wrap">
              <span class="crumb-sep">{'\u203A'}</span>
              <a class="crumb" href={href} onClick={e => onFamilyCrumbClick(e, c.key)}>
                {c.label}
              </a>
            </span>
          );
        }
        return (
          <span key={c.level} class="crumb-wrap">
            <span class="crumb-sep">{'\u203A'}</span>
            <span class="crumb current">{c.label}</span>
          </span>
        );
      })}
    </nav>
  );
}

function ModelLeafCard ({ resource }) {
  const [copied, setCopied] = useState(null);

  if (!resource) return null;
  const { href, dateKind, dateIso, updatedIso, trainedWords, versionOverview } = resource;
  const words = Array.isArray(trainedWords) ? trainedWords : [];
  if (!href && !dateIso && !updatedIso && words.length === 0 && !versionOverview) return null;

  async function copyWord (word) {
    await copyToClipboard(word);
    setCopied(word);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div class="model-leaf-card">
      {href && (
        <a
          class="meta-action"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title="Open this model version on Civitai"
        >
          {'\uD83D\uDD17 On Civitai'}
        </a>
      )}
      {dateIso && (
        <div class="model-leaf-card-date">
          <span>{dateKind === 'published' ? 'Published' : 'Uploaded'} <TimeText at={dateIso}>{formatDate(dateIso)}</TimeText></span>
          <span class="text-muted">{'\u00B7'} <TimeText at={dateIso}>{relativeTime(dateIso)}</TimeText></span>
        </div>
      )}
      {updatedIso && (
        <div class="model-leaf-card-updated text-muted">
          Updated <TimeText at={updatedIso}>{formatDate(updatedIso)}</TimeText>
        </div>
      )}
      {words.length > 0 && (
        <div class="model-leaf-card-triggers">
          <div class="model-leaf-card-label">Trigger words</div>
          <div class="model-leaf-card-chips">
            {words.map(word => (
              <button
                key={word}
                type="button"
                class={`param-chip${copied === word ? ' copied' : ''}`}
                onClick={() => copyWord(word)}
              >
                {copied === word ? 'Copied' : word}
              </button>
            ))}
          </div>
        </div>
      )}
      {versionOverview && (
        <details class="model-leaf-card-about">
          <summary>About this version</summary>
          <div class="post-detail-description">
            <SafeRichText tree={versionOverview} />
          </div>
        </details>
      )}
    </div>
  );
}

function NodeThumb ({ entry }) {
  if (!entry?.thumbnailPath && !entry?.coverPath) return null;
  return (
    <MediaThumb
      type={entry.type}
      thumbnailPath={entry.thumbnailPath}
      coverPath={entry.coverPath}
    />
  );
}

// A lone model is the label alone. Two or more keep the parenthetical count.
function chipLabel (label, count) {
  if (count == null || count === 1) return label;
  return `${label} (${count})`;
}

function CatalogFilters ({ options, resourceType, family, variant, mine, updateUrl }) {
  const [collapsed, setCollapsed] = useState([]);
  const typeOpts = options?.resourceTypes || [];
  const sections = options?.sections || [];
  const hasTypes = typeOpts.length > 0 || resourceType.length > 0;
  const hasFamilies = sections.length > 0 || family.length > 0 || variant.length > 0;
  const mineInfo = options?.mine;
  const showMine = !!(mineInfo && (mineInfo.count > 0 || mine));
  if (!hasTypes && !hasFamilies && !showMine) return null;

  function toggleFamily (option) {
    const vids = new Set((option.variants || []).map(v => v.value));
    const selected = familyIsSelected(option, family, variant);
    if (selected) {
      updateUrl({
        family: family.filter(id => id !== option.value),
        variant: variant.filter(id => !vids.has(id))
      });
    } else {
      updateUrl({ family: [...family, option.value] });
    }
    setCollapsed(collapsed.filter(id => id !== option.value));
  }

  function toggleVariant (vid) {
    updateUrl({ variant: toggleMember(variant, vid) });
  }

  const shownFamilyValues = new Set();
  for (const sec of sections) {
    for (const f of sec.families || []) shownFamilyValues.add(f.value);
  }
  const extraFamilies = family.filter(v => !shownFamilyValues.has(v));

  return (
    <div class="models-catalog-filters">
      {(hasTypes || showMine) && (
        <div class="models-catalog-filter">
          <span class="models-catalog-filter-label">Model types</span>
          {showMine && (
            <button
              type="button"
              class={`tag-chip${mine ? ' active' : ''}`}
              onClick={() => updateUrl({ mine: mine ? null : true })}
            >
              {chipLabel('Mine', mineInfo.count)}
            </button>
          )}
          {typeOpts.map(o => (
            <button
              key={o.value}
              type="button"
              class={`tag-chip${resourceType.includes(o.value) ? ' active' : ''}`}
              onClick={() => updateUrl({ resourceType: toggleMember(resourceType, o.value) })}
              title={o.value}
            >
              {chipLabel(o.label, o.count)}
            </button>
          ))}
          {resourceType.filter(v => !typeOpts.some(o => o.value === v)).map(v => (
            <button
              key={v}
              type="button"
              class="tag-chip active"
              onClick={() => updateUrl({ resourceType: toggleMember(resourceType, v) })}
            >
              {v}
            </button>
          ))}
        </div>
      )}
      {hasFamilies && sections.map(sec => (
        <Fragment key={sec.outputType}>
          <div class="models-catalog-filter models-catalog-family-section">
            <span class="models-catalog-filter-label">{sec.label}</span>
            {(sec.families || []).map(f => {
              const selected = familyIsSelected(f, family, variant);
              const hasVariants = Array.isArray(f.variants) && f.variants.length >= 2;
              const expanded = hasVariants && !collapsed.includes(f.value);
              return (
                <span key={f.value} class="models-catalog-family-wrap">
                  <button
                    type="button"
                    class={`tag-chip${selected ? ' active' : ''}`}
                    onClick={() => toggleFamily(f)}
                    title={f.value}
                  >
                    {chipLabel(f.label, f.count)}
                  </button>
                  {selected && hasVariants && (
                    <button
                      type="button"
                      class="models-catalog-family-caret"
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Hide' : 'Show'} ${f.label} variants`}
                      onClick={() => setCollapsed(toggleMember(collapsed, f.value))}
                    >
                      {expanded ? '\u25BE' : '\u25B8'}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
          {variantRowsForSection(sec.families, family, variant, collapsed).map(row => (
            <div key={row.value} class="models-catalog-filter models-catalog-family-variants">
              <span class="models-catalog-filter-label">{row.label}</span>
              {row.variants.map(v => (
                <button
                  key={v.value}
                  type="button"
                  class={`tag-chip${variant.includes(v.value) ? ' active' : ''}`}
                  onClick={() => toggleVariant(v.value)}
                  title={v.value}
                >
                  {chipLabel(v.label, v.count)}
                </button>
              ))}
            </div>
          ))}
        </Fragment>
      ))}
      {extraFamilies.map(v => (
        <div key={v} class="models-catalog-filter">
          <button
            type="button"
            class="tag-chip active"
            onClick={() => updateUrl({ family: toggleMember(family, v) })}
          >
            {v}
          </button>
        </div>
      ))}
    </div>
  );
}

function CatalogGrid ({ nodes, loading }) {
  if (!nodes.length) {
    if (loading) return null;
    return (
      <div class="empty-state">
        <h2>Nothing here yet</h2>
        <p>No models in your library match these filters.</p>
      </div>
    );
  }

  function openModel (node) {
    if (node.idKind === 'name') return;
    if (node.idKind === 'family') {
      pushState({
        view: 'models',
        entityId: null,
        modelTrail: null,
        params: { ...CATALOG_CLEAR, familyId: node.key }
      });
      return;
    }
    pushState({
      view: 'models',
      entityId: pathToken(node.key, node.label),
      params: CATALOG_CLEAR
    });
  }

  return (
    <>
      <h1 class="models-level-title">Models</h1>
      <div class="model-node-grid">
        {nodes.map(node => {
          const clickable = node.idKind !== 'name';
          const subParts = node.idKind === 'family'
            ? [node.unused ? null : `${node.count} item${node.count === 1 ? '' : 's'}`]
            : [
                node.typeLabel,
                (node.baseModels || []).join(', '),
                node.unused ? null : `${node.count} item${node.count === 1 ? '' : 's'}`
              ];
          const Tag = clickable ? 'button' : 'div';
          const sub = subParts.filter(Boolean);
          return (
            <Tag
              key={`${node.idKind}:${node.key}`}
              type={clickable ? 'button' : undefined}
              class={`model-node${clickable ? '' : ' model-node-static'}`}
              onClick={clickable ? () => openModel(node) : undefined}
            >
              <div class="model-node-thumbs">
                {(node.recentThumbnails || []).slice(0, 4).map((entry, i) => (
                  <NodeThumb key={i} entry={entry} />
                ))}
              </div>
              <div class="model-node-meta">
                <div class="model-node-label" title={node.label}>{node.label}</div>
                <div class="model-node-sub">
                  <span class="model-node-count">{sub.join(' · ')}</span>
                  {node.lastUsed && <TimeText at={node.lastUsed} class="model-node-date">{relativeTime(node.lastUsed)}</TimeText>}
                </div>
              </div>
            </Tag>
          );
        })}
      </div>
    </>
  );
}

function VersionStrip ({ versions, shownVersionId, entityId }) {
  if (!versions.length) return null;
  const params = getRoute().params || {};
  return (
    <nav class="model-version-strip" aria-label="Versions">
      {versions.map(v => {
        const current = v.key === shownVersionId;
        const href = formatUrl({
          view: 'models',
          entityId,
          params: { ...params, modelVersionId: v.key }
        });
        return (
          <a
            key={v.key}
            href={href}
            class="model-version-btn"
            aria-current={current ? 'page' : undefined}
            onClick={e => onVersionHref(e, { href, shownVersionId, targetId: v.key, entityId })}
          >
            <span class="model-version-btn-name">{v.label}</span>
            {v.baseModel ? <span class="model-version-btn-base">{v.baseModel}</span> : null}
          </a>
        );
      })}
    </nav>
  );
}

function FamilyGallery ({ familyId, urlState }) {
  const { sort } = urlState;
  const query = useMemo(() => ({ models: `family.${familyId}`, sort }), [familyId, sort]);
  const reloadEpoch = useIndexEpoch();
  const { items, loading, sentinelRef, hasMore, loadMore, pending } = useGalleryData({
    fetcher: getMedia,
    query,
    reloadEpoch
  });

  useEffect(() => {
    const focus = readHistoryFocus();
    if (shouldLoadFocusPrefix(focus, { loading, hasMore, idFound: resolveFocusId(items, focus) != null })) {
      loadMore();
    }
  }, [loading, items, hasMore, loadMore]);

  const originParams = useMemo(
    () => modelsOriginQuery('', { sort, familyId }),
    [familyId, sort]
  );

  const hrefFor = useCallback((item, index) => originNodeHref(item, {
    grain: 'models',
    originView: 'models',
    params: originParams,
    index
  }), [originParams]);

  const onItemActivate = useCallback((e, item, index, landmarks) => {
    activateOriginTile(e, item, index, landmarks, {
      grain: 'models',
      originView: 'models',
      params: originParams
    });
  }, [originParams]);

  if (!familyId) return null;

  return (
    <>
      {(items.length > 0 || !loading) && (
        <Gallery
          items={items}
          grain="media"
          groupsMeta={null}
          onItemActivate={onItemActivate}
          hrefFor={hrefFor}
          sentinelRef={sentinelRef}
          loading={loading}
          hasMore={hasMore}
          pending={pending}
        />
      )}
      {loading && (
        <div class="loading-bar"><div class="spinner" /></div>
      )}
    </>
  );
}

function ModelLeafGallery ({ versionId, urlState }) {
  const { sort } = urlState;

  const query = useMemo(() => ({ models: `version.${versionId}`, sort }), [versionId, sort]);
  const reloadEpoch = useIndexEpoch();
  const { items, loading, sentinelRef, hasMore, loadMore, pending } = useGalleryData({
    fetcher: getMedia,
    query,
    reloadEpoch
  });

  useEffect(() => {
    const focus = readHistoryFocus();
    if (shouldLoadFocusPrefix(focus, { loading, hasMore, idFound: resolveFocusId(items, focus) != null })) {
      loadMore();
    }
  }, [loading, items, hasMore, loadMore]);

  const originParams = useMemo(
    () => modelsOriginQuery(versionId, { sort }),
    [versionId, sort]
  );

  const hrefFor = useCallback((item, index) => originNodeHref(item, {
    grain: 'models',
    originView: 'models',
    params: originParams,
    index
  }), [originParams]);

  const onItemActivate = useCallback((e, item, index, landmarks) => {
    activateOriginTile(e, item, index, landmarks, {
      grain: 'models',
      originView: 'models',
      params: originParams
    });
  }, [originParams]);

  if (!versionId) return null;

  return (
    <>
      {(items.length > 0 || !loading) && (
        <Gallery
          items={items}
          grain="media"
          groupsMeta={null}
          onItemActivate={onItemActivate}
          hrefFor={hrefFor}
          sentinelRef={sentinelRef}
          loading={loading}
          hasMore={hasMore}
          pending={pending}
        />
      )}
      {loading && (
        <div class="loading-bar"><div class="spinner" /></div>
      )}
    </>
  );
}

export function ModelsView ({ entityId }) {
  useMagicEscape({ enabled: entityId != null && entityId !== '' });
  const [urlState, updateUrl] = useUrlState(URL_SCHEMA);
  const { resourceType, family, variant, modelVersionId, familyId, mine } = urlState;
  const ownRev = useOwnModelsRevision();
  const indexEpoch = useIndexEpoch();
  const modelId = entityId ? idFromToken(entityId) : null;
  const isPage = Boolean(modelId);

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  const identity = isPage
    ? `page:${modelId}:${modelVersionId}`
    : `catalog:${resourceType.join(',')}|${family.join(',')}|${variant.join(',')}|${mine ? 1 : 0}`;
  const fetchKey = `${identity}:${ownRev}:${indexEpoch}`;
  const identityRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const samePage = identityRef.current === identity;
    identityRef.current = identity;
    if (!samePage) setLoading(true);
    const req = isPage
      ? getModels({ modelId, versionId: modelVersionId || undefined })
      : getModels({ resourceType, family, variant, mine: mine ? '1' : '' });
    req
      .then(data => { if (!cancelled) { setPayload(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // fetchKey is 1:1 with the request identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  // Catalog vs model-page payloads do not share a shape. Ready is render-time
  // so the first paint after a hop cannot treat leftover payload as this view.
  // The /api/models gap is sub-second — render nothing, not a spinner.
  const catalogReady = !isPage && payload?.level === 'catalog';
  const pageReady = isPage
    && payload?.level === 'model'
    && String(payload?.model?.key) === String(modelId);
  const selectedVersionId = pageReady
    ? (modelVersionId || payload.selectedVersionId || '')
    : '';

  let titleSpec;
  if (!entityId) {
    titleSpec = { place: 'models' };
  } else if (!pageReady) {
    titleSpec = { place: 'model' };
  } else {
    const selected = (payload.versions || []).find(v => v.key === selectedVersionId);
    titleSpec = {
      place: 'model',
      name: payload.model.label,
      version: selected?.label || ''
    };
  }
  useDocumentTitle(titleSpec);

  const catalogNodes = catalogReady ? (payload.nodes || []) : [];
  const shortcutFamilyId = (
    !familyId
    && family.length === 1
    && catalogNodes.length > 0
    && catalogNodes.every(n => n.idKind === 'family')
  ) ? String(catalogNodes[0].key) : '';

  function familyLeafLabel (id) {
    const node = (payload?.nodes || []).find(n => n.idKind === 'family' && String(n.key) === String(id));
    if (node?.label) return node.label;
    for (const sec of payload?.options?.sections || []) {
      const hit = (sec.families || []).find(f => String(f.value) === String(id));
      if (hit?.label) return hit.label;
    }
    return id;
  }
  const leafCrumbs = familyId
    ? [{ level: 'page', key: familyId, label: familyLeafLabel(familyId) }]
    : [];

  return (
    <main class={`main-content models-tree${isPage ? ' models-page' : ''}`}>
      <Breadcrumb crumbs={pageReady ? (payload.breadcrumb || []) : leafCrumbs} />
      {isPage ? (
        pageReady ? (
          <>
            {payload.model && (
              <header class="model-page-header">
                <h1 class="models-page-title">{payload.model.label}</h1>
                {modelTypeChip(payload.model)}
                {payload.model.mine && (
                  <a
                    class="model-type-badge"
                    href="/models?mine=1"
                    onClick={e => onModelsHref(e, '/models?mine=1')}
                  >
                    Mine
                  </a>
                )}
              </header>
            )}
            <VersionStrip
              versions={payload.versions || []}
              shownVersionId={modelVersionId || payload.selectedVersionId || ''}
              entityId={entityId}
            />
            {payload.resource ? <ModelLeafCard resource={payload.resource} /> : null}
            {selectedVersionId
              ? <ModelLeafGallery versionId={selectedVersionId} urlState={urlState} />
              : (
                <div class="empty-state">
                  <h2>Unresolved version</h2>
                  <p>This model page is missing a valid version id.</p>
                </div>
              )}
          </>
        ) : null
      ) : familyId ? (
        <FamilyGallery familyId={familyId} urlState={urlState} />
      ) : catalogReady ? (
        <>
          <CatalogFilters
            options={payload.options}
            resourceType={resourceType}
            family={family}
            variant={variant}
            mine={mine === true}
            updateUrl={updateUrl}
          />
          {shortcutFamilyId
            ? <FamilyGallery familyId={shortcutFamilyId} urlState={urlState} />
            : <CatalogGrid nodes={payload.nodes || []} loading={loading} />}
        </>
      ) : null}
    </main>
  );
}
