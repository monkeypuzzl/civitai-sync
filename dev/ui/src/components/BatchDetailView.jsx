import { useState, useEffect, useRef } from 'preact/hooks';
import { openFiles } from '../api.js';
import { OpenFolderButton, OpenJsonButton } from './OpenFolderButton.jsx';
import { chipDatetime, formatDate, copyToClipboard, inputMediaCaptions, generationMemberTile } from '../lib/format.js';
import { TimeText } from './TimeText.jsx';
import { mediaFileCopy } from '../lib/sidebar-links.js';
import { composeDetailResources, generatorFamilyModelBlock } from '../lib/detail-resources.js';
import {
  agreedDurationSeconds,
  agreedProducedPair,
  entityHeaderLabel,
  jobResolutionLabel,
  sharedMediaType
} from '../lib/param-display.js';
import { detailFacts, snapshotFromRaw } from '../../../../src/parameters.mjs';
import { pushState, replaceState } from '../lib/router.js';
import { memberMediaHref, openPreservingOriginBag, relatedOriginHref } from '../lib/open-origin-node.js';
import { originMembershipKind } from '../lib/nav-tabs.js';
import { workflowSidebarLine } from '../lib/workflow-line.js';
import { ModelMembership, RelatedStrip, WorkflowSection } from './SidebarSections.jsx';
import { detailCacheKey, loadContainerDetail, prefetchOriginNeighbours, useHeldDetail } from '../lib/detail-ready.js';
import { quietSlotPatch } from '../lib/origin-page.js';
import { useIndexEpoch } from '../lib/index-settle.js';
import { MediaTile } from './MediaTile.jsx';
import { OriginSiblingNav } from './OriginSiblingNav.jsx';
import { DetailPage } from './DetailPage.jsx';
import { EntityHeader } from './EntityHeader.jsx';
import { containerFilterChips } from '../lib/filter-chips.js';
import { containerUnfilteredHref } from '../lib/media-href.js';
import { useScopeChipTree } from '../lib/scope-chip-tree.js';
import { useDocumentTitle } from '../lib/page-title.js';
import { useOwnModelsKnown, useOwnModelsRevision } from '../lib/own-models-rev.js';
import { useMagicEscape } from '../hooks/useMagicEscape.js';

// Per Implementation Contract item 3: switching from a detail route back
// to its list view is a pushState (view change). Pass entityId: null
// explicitly so the merged state clears it.
function backToGenerations () {
  pushState({ view: 'generations', entityId: null });
}

export function BatchDetailView ({ batchId, params }) {
  useMagicEscape();
  const modelTree = useScopeChipTree(params && params.models);
  const [copied, setCopied] = useState(null);
  const quietAppliedRef = useRef(null);
  const ownRev = useOwnModelsRevision();
  const ownKnown = useOwnModelsKnown();
  const indexEpoch = useIndexEpoch();
  const cacheKey = detailCacheKey({ view: 'generations', id: batchId, params }) + `:own${ownRev}:ix${indexEpoch}`;
  const held = useHeldDetail(cacheKey, () => loadContainerDetail('generations', batchId, params));
  const data = held.displayed;
  const onRoute = held.shownKey === cacheKey && data?.index?.id != null
    && String(data.index.id) === String(batchId);
  const origin = data?.index?.origin || null;

  useEffect(() => {
    if (!onRoute || !origin) return undefined;
    prefetchOriginNeighbours({
      view: 'generations',
      routeParams: params,
      origin
    });
    return undefined;
  }, [onRoute, origin, params]);

  useEffect(() => {
    if (!onRoute || !origin || !batchId) return;
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
    const quietKey = `${batchId}|${JSON.stringify(nextParams)}`;
    if (quietAppliedRef.current === quietKey) return;
    quietAppliedRef.current = quietKey;
    replaceState({
      view: 'generations',
      entityId: batchId,
      params: nextParams
    });
  }, [onRoute, origin, batchId, params]);

  async function doCopy (text, label) {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  useDocumentTitle(
    data?.index
      ? {
          place: 'generation',
          date: formatDate(data.index.createdAt || data.index.date),
          members: (data.index.media || []).map(m => ({ type: m.type }))
        }
      : { place: 'generation' }
  );

  const scrollKey = data?.index?.id || batchId;

  if (!data && !held.failed) {
    return (
      <DetailPage flow scrollKey={scrollKey} sidebar={<></>} />
    );
  }

  if (!data || !data.index) {
    return (
      <DetailPage flow scrollKey={scrollKey} sidebar={<></>}>
        <div class="empty-state">
          <h1>Generation not found</h1>
          <p>This generation may not have been downloaded yet.</p>
          <button class="meta-action" onClick={backToGenerations}>Back to Generations</button>
        </div>
      </DetailPage>
    );
  }

  const index = data.index;
  const dateStr = index.createdAt || index.date;
  const members = (Array.isArray(index.media) ? index.media : [])
    .filter(m => m.inWalk !== false);
  const composed = composeDetailResources({
    checkpoint: index.checkpoint,
    resources: index.resources,
    model: index.model
  });
  const familyBlock = (!composed.model && composed.additional.length === 0)
    ? generatorFamilyModelBlock(index.generatorFamily)
    : null;
  const modelBlock = familyBlock || composed.model;
  const additional = composed.additional;
  const originScope = (params && params.from) || (origin && origin.scope) || null;
  const originKind = originMembershipKind(originScope);
  const modelPageHrefs = [
    modelBlock && modelBlock.href,
    ...additional.map(r => r && r.href)
  ].filter(Boolean);
  const soleModelHref = modelPageHrefs.length === 1 ? modelPageHrefs[0] : '';
  const workflowLine = workflowSidebarLine(
    index.params?.workflow,
    originScope,
    { generations: [index] }
  );
  const inputRefs = Array.isArray(index.inputs)
    ? index.inputs.filter(inp => inp && inp.id && inp.thumbnailPath)
    : [];
  const inputCaptions = inputMediaCaptions(inputRefs);
  const batchType = sharedMediaType(members);
  const facts = detailFacts({
    type: batchType,
    snapshot: snapshotFromRaw(data.raw),
    fallback: index.params,
    produced: agreedProducedPair(members),
    resolution: jobResolutionLabel(data.raw),
    durationSeconds: agreedDurationSeconds(members),
    audio: index.audio,
    showSeed: false,
    omitModelIdentity: Boolean(modelBlock),
    omitWorkflowAliases: Boolean(workflowLine)
  });
  const prompt = String(index.prompt || '').trim() || facts.promptText || '';
  const fileActions = (
    <>
      {(() => {
        const shown = members.filter(m => m && m.thumbnailPath);
        const copy = mediaFileCopy({
          count: shown.length,
          types: shown.map(m => m.type)
        });
        if (!copy) return null;
        if (shown.length === 1) {
          return (
            <OpenFolderButton
              path={shown[0].thumbnailPath}
              class="meta-action"
              label={copy.label}
              title={copy.title}
            />
          );
        }
        const paths = shown.map(m => m.thumbnailPath);
        return (
          <button
            type="button"
            class="meta-action"
            title={copy.title}
            onClick={() => openFiles(paths)}
          >{copy.label}</button>
        );
      })()}
      <OpenJsonButton
        kind="generation"
        id={batchId}
        class="meta-action"
        title="Open Generation folder, with data file selected"
      />
    </>
  );

  return (
    <DetailPage
      flow
      scrollKey={scrollKey}
      chrome={<OriginSiblingNav origin={origin} routeParams={params} />}
      sidebar={(
        <>
          <EntityHeader
            label={entityHeaderLabel('generation', batchType)}
            date={dateStr}
            chips={facts.headerChips}
            href={containerUnfilteredHref('generations', batchId, params)}
            filters={containerFilterChips('generations', batchId, params, { modelTree, ownKnown })}
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

          <RelatedStrip
            title="Input Media"
            items={inputRefs}
            hrefFor={inp => relatedOriginHref(inp, params)}
            captionFor={(_inp, i) => inputCaptions[i]}
          />

          {prompt && (
            <div class="meta-section">
              <h2 class="meta-label">Prompt</h2>
              <p class="meta-prompt">{prompt}</p>
              <div class="meta-actions">
                <button
                  class={`meta-action${copied === 'prompt' ? ' copied' : ''}`}
                  onClick={() => doCopy(prompt, 'prompt')}
                >
                  {copied === 'prompt' ? 'Copied' : 'Copy prompt'}
                </button>
              </div>
            </div>
          )}

          {index.negativePrompt && (
            <div class="meta-section">
              <h2 class="meta-label">Negative Prompt</h2>
              <p class="meta-prompt meta-neg-prompt">{index.negativePrompt}</p>
            </div>
          )}

          {(facts.title || facts.rows.length > 0) && (
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

          <div class="meta-section">
            <h2 class="meta-label">Files</h2>
            <div class="meta-actions">
              {fileActions}
            </div>
          </div>
        </>
      )}
    >
          <div class="post-detail-media-grid">
            {members.map((m, i) => {
              const item = generationMemberTile(m);
              const href = memberMediaHref(item.id, params, {
                slot: m.slot,
                originView: 'generations',
                granularity: 'batch',
                slotInUrl: m.slotInUrl
              });
              return (
                <MediaTile
                  key={`${item.id}:${i}`}
                  item={item}
                  href={href}
                  onActivate={e => openPreservingOriginBag(e, href)}
                />
              );
            })}
          </div>
    </DetailPage>
  );
}
