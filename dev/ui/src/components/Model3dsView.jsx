import { useState, useEffect, useMemo, useCallback, useRef } from 'preact/hooks';
import { getModel3ds, getModel3d } from '../api.js';
import { useUrlState } from '../lib/url-state.js';
import { useGalleryData } from '../hooks/useGalleryData.js';
import { useCardWindow } from '../hooks/useCardWindow.js';
import { pushState } from '../lib/router.js';
import { useDocumentTitle } from '../lib/page-title.js';
import { formatDate } from '../lib/format.js';
import { model3dFileRows, model3dShownFormat, viewableMeshFiles } from '../lib/param-display.js';
import { FacetBar } from './FacetBar.jsx';
import { DetailPage } from './DetailPage.jsx';
import { OriginSiblingNav } from './OriginSiblingNav.jsx';
import { EntityHeader } from './EntityHeader.jsx';
import { containerFilterChips } from '../lib/filter-chips.js';
import { containerUnfilteredHref } from '../lib/media-href.js';
import { useScopeChipTree } from '../lib/scope-chip-tree.js';
import { useOwnModelsKnown } from '../lib/own-models-rev.js';
import { MODEL3D_PUBLICATION_LABELS } from '../lib/publication.js';
import { OpenFolderButton } from './OpenFolderButton.jsx';
import { useMagicEscape } from '../hooks/useMagicEscape.js';
import { ActiveMesh, MeshViewport, useMeshHost } from './MeshStage.jsx';
import { useMeshViewerPref } from '../lib/mesh-viewer-pref.js';

export const URL_SCHEMA = {
  sort: { type: 'string', default: 'date:desc' },
  publication: { type: 'csv', default: [] },
  groupBy: { type: 'string', default: 'none' },
  groupSort: { type: 'string', default: 'count:desc' }
};

const PUBLICATION_FACET = {
  key: 'publication',
  kind: 'chips',
  label: 'Publication',
  options: ['published', 'draft', 'unpublished'],
  optionLabels: MODEL3D_PUBLICATION_LABELS
};

const SORT_FIELDS = [{ value: 'date', label: 'Date' }];
const GROUP_AXES = [
  { value: 'month', label: 'Month' },
  { value: 'day', label: 'Day' },
  { value: 'publication', label: 'Publication' }
];

function statusLabel (status) {
  if (status == null || status === '') return '';
  const raw = String(status);
  return MODEL3D_PUBLICATION_LABELS[raw] || MODEL3D_PUBLICATION_LABELS[raw.toLowerCase()] || '';
}

function stillSrc (item) {
  const raw = item?.media?.[0]?.thumbnailPath || item?.thumbnailPath || '';
  if (typeof raw !== 'string' || !raw) return '';
  const pathOnly = raw.split('?')[0].toLowerCase();
  if (/\.(png|jpe?g|webp|gif)$/.test(pathOnly)) return raw;
  return '';
}

function detailIso (entry) {
  if (!entry) return '';
  if (entry.status === 'published') return entry.publishedAt || entry.createdAt || '';
  return entry.createdAt || '';
}

function Model3dStill ({ item, detail = false }) {
  const src = stillSrc(item);
  return (
    <div class={detail ? 'post-card-media detail-model3d-still' : 'post-card-media'} style={{ aspectRatio: '1 / 1' }}>
      {src
        ? <img src={src} alt="" />
        : (
          <div class={detail ? 'audio-placeholder detail-audio-art' : 'audio-placeholder'}>
            <span class="model3d-mark">3D</span>
          </div>
        )}
    </div>
  );
}

function Model3dCard ({ item, href, onClick }) {
  const label = statusLabel(item.status);
  return (
    <a class="gallery-item post-card" href={href} onClick={onClick} data-focus-id={item.id}>
      <Model3dStill item={item} />
      <div class="post-card-info">
        {item.name ? <div class="post-card-title">{item.name}</div> : null}
        {label ? <div class="post-card-status-date">{label}</div> : null}
      </div>
    </a>
  );
}

function Model3dList () {
  const [urlState, updateUrl] = useUrlState(URL_SCHEMA);
  useDocumentTitle({ place: 'model3ds' });

  const query = useMemo(() => ({
    sort: urlState.sort,
    publication: urlState.publication.length ? urlState.publication : null,
    groupBy: urlState.groupBy,
    groupSort: urlState.groupSort
  }), [urlState]);

  const galleryFetcher = useCallback((params) => getModel3ds(params), []);
  const {
    items, groupsMeta, total, loading, sentinelRef, hasMore, pending
  } = useGalleryData({ fetcher: galleryFetcher, query });

  const list = items || [];
  const {
    rootRef, gridRef, start, end, outerTopPad, outerBottomPad, sections, grouped
  } = useCardWindow({ items: list, groupsMeta, hasMore, loading, pending });

  function openItem (event, item) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    pushState({ view: 'model3ds', entityId: String(item.id) });
  }

  const renderCard = (item) => (
    <Model3dCard
      key={item.id}
      item={item}
      href={`/model3ds/${item.id}`}
      onClick={(event) => openItem(event, item)}
    />
  );

  return (
    <div class="view">
      <FacetBar
        facets={[PUBLICATION_FACET]}
        state={urlState}
        update={updateUrl}
        sortFields={SORT_FIELDS}
        groupAxes={GROUP_AXES}
        facetParams={{ model3ds: true }}
        showSearch={false}
      />
      {total != null && !loading && list.length === 0 ? (
        <div class="empty-state">
          <h2>No 3D downloaded yet.</h2>
          <p>Download 3D to see it here.</p>
        </div>
      ) : (
        <div ref={rootRef}>
          <div class="gallery-pad" style={{ height: outerTopPad }} aria-hidden="true" />
          {grouped && sections ? (
            sections.map((sec, i) => (
              <section class="gallery-group" key={sec.group.key || '_'}>
                <h2 class="gallery-group-header">
                  {sec.group.label} <span class="gallery-group-count">{sec.group.count}</span>
                </h2>
                <div class="gallery-grid" ref={i === 0 ? gridRef : undefined}>
                  {list.slice(sec.start, sec.end).map(item => renderCard(item))}
                </div>
              </section>
            ))
          ) : (
            <div class="gallery-grid" ref={gridRef}>
              {list.slice(start, end).map(item => renderCard(item))}
            </div>
          )}
          <div class="gallery-pad" style={{ height: outerBottomPad }} aria-hidden="true" />
          <div ref={sentinelRef} class="gallery-sentinel" />
          {loading && (
            <div class="loading-bar"><div class="spinner" /></div>
          )}
        </div>
      )}
    </div>
  );
}

function backToList () {
  pushState({ view: 'model3ds', entityId: null });
}

function Model3dDetail ({ id, params }) {
  useMagicEscape();
  const modelTree = useScopeChipTree(params && params.models);
  const ownKnown = useOwnModelsKnown();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const meshPref = useMeshViewerPref();
  const meshHost = useMeshHost();
  const slotRef = useRef(null);
  const [meshNotice, setMeshNotice] = useState('');
  const [meshReady, setMeshReady] = useState(false);
  const [meshPath, setMeshPath] = useState('');

  const paramsKey = JSON.stringify(params || {});
  // An id change blanks, the same as the first load. A query change keeps
  // the open model until the new origin arrives.
  useEffect(() => {
    setFailed(false);
    setData(null);
  }, [id]);

  useEffect(() => {
    let stale = false;
    setFailed(false);
    getModel3d(id, params).then(body => {
      if (stale) return;
      if (!body || body.error || !body.index) setFailed(true);
      else setData(body);
    }).catch(() => {
      if (!stale) setFailed(true);
    });
    return () => { stale = true; };
  }, [id, paramsKey]);

  const entry = data && data.index;
  const when = detailIso(entry);
  const meshRows = entry
    ? viewableMeshFiles({
      mediaPath: entry.primaryPath,
      files: Array.isArray(entry.files) ? entry.files : []
    })
    : [];
  const meshPathKey = meshRows.map(row => row.path).join('\n');
  const meshId = entry ? String(entry.id || id) : '';
  useEffect(() => {
    setMeshPath(meshPathKey ? meshPathKey.split('\n')[0] : '');
    setMeshNotice('');
    setMeshReady(false);
  }, [meshId, meshPathKey]);
  useDocumentTitle(entry
    ? {
      place: 'model3d',
      name: entry.name,
      status: entry.status,
      date: formatDate(when)
    }
    : { place: 'model3d' });

  if (!data && !failed) {
    return <DetailPage flow scrollKey={id} sidebar={<></>} />;
  }

  if (!entry) {
    return (
      <DetailPage flow scrollKey={id} sidebar={<></>}>
        <div class="empty-state">
          <h1>3D not found.</h1>
          <p>This 3D has not been downloaded yet.</p>
          <button class="meta-action" type="button" onClick={backToList}>Back to 3D</button>
        </div>
      </DetailPage>
    );
  }

  const label = statusLabel(entry.status);
  const license = entry.licenseName || '';
  const rows = model3dFileRows({
    mediaPath: entry.primaryPath,
    files: Array.isArray(entry.files) ? entry.files : []
  });

  return (
    <DetailPage
      flow
      scrollKey={entry.id || id}
      chrome={<OriginSiblingNav origin={entry && entry.origin} routeParams={params} />}
      sidebar={(
        <>
          <EntityHeader
            title={entry.name}
            label="3D"
            date={when}
            href={containerUnfilteredHref('model3ds', entry.id || id, params)}
            filters={containerFilterChips('model3ds', entry.id || id, params, { modelTree, ownKnown })}
          />
          {label ? (
            <div class="meta-section">
              <h2 class="meta-label">Status</h2>
              <p>{label}</p>
            </div>
          ) : null}
          {license ? (
            <div class="meta-section">
              <h2 class="meta-label">License</h2>
              <p>{license}</p>
            </div>
          ) : null}
          <div class="meta-section">
            <h2 class="meta-label">Files</h2>
            {rows.length > 0 ? (
              <ul class="model3d-files">
                {rows.map((row, i) => {
                  const shownFormat = model3dShownFormat(row);
                  return (
                    <li key={`${row.path}\0${i}`}>
                      <span>{row.label}</span>
                      {shownFormat ? <span class="model3d-file-format">{shownFormat}</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div class="meta-actions">
              <OpenFolderButton path={entry.primaryPath} class="meta-action" />
            </div>
          </div>
        </>
      )}
    >
      <MeshViewport
        stillSrc={stillSrc(entry)}
        reactions={entry.stillReactions}
        enabled={meshPref.enabled}
        onToggle={() => {
          if (meshPref.enabled) {
            meshPref.setEnabled(false);
            return;
          }
          setMeshNotice('');
          setMeshReady(false);
          meshPref.setEnabled(true);
        }}
        viewable={meshRows}
        selectedPath={meshPath}
        onSelect={(path) => {
          setMeshPath(path);
          setMeshNotice('');
          setMeshReady(false);
        }}
        notice={meshNotice}
        large={false}
        slotRef={slotRef}
      />
      <ActiveMesh
        host={meshHost}
        slotRef={slotRef}
        live={meshPref.enabled && meshRows.length > 0 && !!meshPath}
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
    </DetailPage>
  );
}

export function Model3dsView ({ entityId, params }) {
  if (entityId) return <Model3dDetail id={entityId} params={params} />;
  return <Model3dList />;
}
