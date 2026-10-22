import { modelSectionHref } from '../lib/detail-resources.js';
import { navigate } from '../lib/router.js';
import { MediaTile } from './MediaTile.jsx';

export function onModelsLinkClick (e, href) {
  if (!href) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  navigate(href);
}

function inputTileType (kind) {
  if (kind === 'video') return 'video';
  if (kind === 'audio') return 'audio';
  return 'image';
}

export function RelatedStrip ({ title, items, hrefFor, captionFor, countHref, count, onCountClick }) {
  if (!items.length) return null;
  return (
    <div class="meta-section">
      <h2 class="meta-label">
        {title}
        {countHref ? (
          <>
            {' '}
            <a class="used-in-count" href={countHref} onClick={onCountClick}>{count}</a>
          </>
        ) : null}
      </h2>
      <div class="detail-related">
        {items.map((inp, i) => {
          const type = inputTileType(inp.kind || inp.type);
          const href = hrefFor(inp);
          return (
            <div key={`${inp.id}:${inp.role || ''}:${inp.slot ?? ''}`}>
              <MediaTile
                compact
                href={href}
                item={{
                  id: inp.id,
                  type,
                  hasInputs: false,
                  inputKinds: [],
                  media: [{
                    mediaId: inp.id,
                    type,
                    thumbnailPath: inp.thumbnailPath,
                    coverPath: inp.coverPath,
                    tags: []
                  }]
                }}
                onActivate={(e) => onModelsLinkClick(e, href)}
              />
              <div class="detail-related-role">{captionFor(inp, i)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function resourceTitle (name, version) {
  return [name, version].filter(Boolean).join(' · ');
}

function ResourceIdentityBody ({ name, version, title }) {
  return (
    <div class="resource-identity one-line" title={title || undefined}>
      {name ? <span class="resource-name">{name}</span> : null}
      {name && version ? <span class="resource-sep">{' · '}</span> : null}
      {version ? <span class="resource-version">{version}</span> : null}
    </div>
  );
}

function ResourceIdentity ({ name, version, href, showTitle = true }) {
  const inner = <ResourceIdentityBody name={name} version={version} />;
  if (!href) return inner;
  return (
    <a
      class="meta-resource-link"
      href={href}
      title={showTitle ? resourceTitle(name, version) : undefined}
      onClick={e => onModelsLinkClick(e, href)}
    >
      {inner}
    </a>
  );
}

function resourceTypeChip (resource) {
  if (resource?.typeHref) {
    return (
      <a
        class="resource-type"
        href={resource.typeHref}
        onClick={e => onModelsLinkClick(e, resource.typeHref)}
      >{resource.typeLabel}</a>
    );
  }
  if (resource?.typeLabel) {
    return <span class="resource-type">{resource.typeLabel}</span>;
  }
  return null;
}

function AdditionalResource ({ resource, mode }) {
  const linked = mode === 'link';
  const modeClass = mode === 'target'
    ? ' meta-sole-target'
    : mode === 'plain'
      ? ' meta-sole-plain'
      : '';
  return (
    <div class={`resource-item${modeClass}`}>
      <div class="resource-item-main">
        {linked
          ? <ResourceIdentity name={resource.name} version={resource.version} href={resource.href} />
          : (
              <ResourceIdentityBody
                name={resource.name}
                version={resource.version}
                title={mode === 'target' ? resourceTitle(resource.name, resource.version) : ''}
              />
            )}
        {resourceTypeChip(resource)}
        {resource.mine && (
          <a
            class="resource-type"
            href="/models?mine=1"
            onClick={e => onModelsLinkClick(e, '/models?mine=1')}
          >Mine</a>
        )}
      </div>
      {resource.strength != null && (
        <span class="resource-strength">Strength: {resource.strength}</span>
      )}
    </div>
  );
}

function membershipRows (modelBlock, additional, rows) {
  if (Array.isArray(rows)) return rows.filter(Boolean);
  const list = [];
  if (modelBlock) list.push({ kind: 'model', strength: null, ...modelBlock, key: 'model' });
  (additional || []).forEach((resource, i) => {
    list.push({
      kind: 'additional',
      ...resource,
      key: resource.href || `${resource.name}:${resource.version}:${i}`
    });
  });
  return list;
}

function isClassicMembership (rows) {
  let models = 0;
  let modelAt = -1;
  rows.forEach((row, i) => {
    if (row.kind !== 'model') return;
    models += 1;
    if (modelAt < 0) modelAt = i;
  });
  return models === 0 || (models === 1 && modelAt === 0);
}

function modelRowBody (row, mode) {
  const linked = mode === 'link' && row.href;
  if (linked) {
    return <ResourceIdentity name={row.name} version={row.version} href={row.href} />;
  }
  const isTarget = mode === 'target';
  return (
    <ResourceIdentityBody
      name={row.name}
      version={row.version}
      title={isTarget ? resourceTitle(row.name, row.version) : ''}
    />
  );
}

function rowRuns (rows) {
  const runs = [];
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    runs.push(buf);
    buf = [];
  };
  for (const row of rows) {
    if (row.kind === 'model') {
      flush();
      runs.push([row]);
    } else {
      buf.push(row);
    }
  }
  flush();
  return runs;
}

function renderMembershipRuns (rows, mode) {
  const target = mode === 'sole' ? rows[rows.length - 1] : null;
  return rowRuns(rows).map(run => {
    const head = run[0];
    if (head.kind === 'model') {
      const rowMode = mode === 'sole'
        ? (head === target ? 'target' : 'plain')
        : mode;
      const valueClass = rowMode === 'target'
        ? 'meta-value meta-sole-target'
        : rowMode === 'plain'
          ? 'meta-value meta-sole-plain'
          : 'meta-value';
      return (
        <div key={head.key || head.versionId || head.name} class={valueClass}>
          <div class="resource-item-main">
            {modelRowBody(head, rowMode === 'plain' ? 'text' : rowMode === 'target' ? 'target' : 'link')}
            {mode !== 'sole' ? resourceTypeChip(head) : null}
            {head.mine && (
              <a
                class="resource-type"
                href="/models?mine=1"
                onClick={e => onModelsLinkClick(e, '/models?mine=1')}
              >Mine</a>
            )}
          </div>
        </div>
      );
    }
    return (
      <div key={head.key || head.href || head.name} class="meta-resources">
        {run.map(row => {
          let resourceMode = 'text';
          if (mode === 'link') resourceMode = row.href ? 'link' : 'text';
          else if (mode === 'sole') resourceMode = row === target ? 'target' : 'plain';
          return (
            <AdditionalResource
              key={row.key || row.href || `${row.name}:${row.version}`}
              resource={row}
              mode={resourceMode}
            />
          );
        })}
      </div>
    );
  });
}

function MixedModelMembership ({ rows, soleHref, sectionClass }) {
  if (!soleHref) {
    return (
      <div class={sectionClass}>
        <h2 class="meta-label">Model</h2>
        {renderMembershipRuns(rows, 'link')}
      </div>
    );
  }
  const linkAt = rows.findIndex(row => row.href);
  const inside = rows.slice(0, linkAt + 1);
  const outside = rows.slice(linkAt + 1);
  return (
    <div class={sectionClass}>
      <a
        class="meta-sole-link"
        href={soleHref}
        onClick={e => onModelsLinkClick(e, soleHref)}
      >
        <h2 class="meta-label meta-label-link">Model</h2>
        {renderMembershipRuns(inside, 'sole')}
      </a>
      {outside.length > 0 ? renderMembershipRuns(outside, 'text') : null}
    </div>
  );
}

export function ModelMembership ({ modelBlock, additional, rows, soleHref, sectionClass }) {
  const list = membershipRows(modelBlock, additional, rows);
  if (!list.length) return null;
  const href = modelSectionHref(list, soleHref);
  if (!isClassicMembership(list)) {
    return (
      <MixedModelMembership
        rows={list}
        soleHref={href}
        sectionClass={sectionClass}
      />
    );
  }
  const classicModel = list[0]?.kind === 'model' ? list[0] : null;
  const classicAdditional = list.filter(row => row.kind === 'additional');
    return (
    <ClassicModelMembership
      modelBlock={classicModel}
      additional={classicAdditional}
      soleHref={href}
      sectionClass={sectionClass}
    />
  );
}

function ClassicModelMembership ({ modelBlock, additional, soleHref, sectionClass }) {
  if (!soleHref) {
    return (
      <div class={sectionClass}>
        <h2 class="meta-label">Model</h2>
        {modelBlock && (
          <div class="meta-value">
            <div class="resource-item-main">
              <ResourceIdentity
                name={modelBlock.name}
                version={modelBlock.version}
                href={modelBlock.href}
              />
              {resourceTypeChip(modelBlock)}
              {modelBlock.mine && (
                <a
                  class="resource-type"
                  href="/models?mine=1"
                  onClick={e => onModelsLinkClick(e, '/models?mine=1')}
                >Mine</a>
              )}
            </div>
          </div>
        )}
        {additional.length > 0 && (
          <div class="meta-resources">
            {additional.map((resource, i) => (
              <AdditionalResource
                key={resource.href || `${resource.name}:${resource.version}:${i}`}
                resource={resource}
                mode={resource.href ? 'link' : 'text'}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const rows = [];
  if (modelBlock) rows.push({ kind: 'model', resource: modelBlock, key: 'model' });
  additional.forEach((resource, i) => {
    rows.push({
      kind: 'additional',
      resource,
      key: resource.href || `${resource.name}:${resource.version}:${i}`
    });
  });
  const linkAt = rows.findIndex(row => row.resource.href);
  const target = rows[linkAt];
  const before = rows.slice(0, linkAt);
  const after = rows.slice(linkAt + 1);
  const leadingModel = before[0]?.kind === 'model' ? before[0] : null;
  const beforeAdditionals = before.filter(row => row.kind === 'additional');
  const insideAdditionals = target.kind === 'additional'
    ? [...beforeAdditionals, target]
    : beforeAdditionals;

  return (
    <div class={sectionClass}>
      <a
        class="meta-sole-link"
        href={soleHref}
        onClick={e => onModelsLinkClick(e, soleHref)}
      >
        <h2 class="meta-label meta-label-link">Model</h2>
        {leadingModel && (
          <div class="meta-value meta-sole-plain">
            <ResourceIdentityBody
              name={leadingModel.resource.name}
              version={leadingModel.resource.version}
            />
          </div>
        )}
        {target.kind === 'model' && (
          <div class="meta-value meta-sole-target">
            <ResourceIdentityBody
              name={target.resource.name}
              version={target.resource.version}
              title={resourceTitle(target.resource.name, target.resource.version)}
            />
          </div>
        )}
        {insideAdditionals.length > 0 && (
          <div class="meta-resources">
            {insideAdditionals.map(row => (
              <AdditionalResource
                key={row.key}
                resource={row.resource}
                mode={row === target ? 'target' : 'plain'}
              />
            ))}
          </div>
        )}
      </a>
      {after.length > 0 && (
        <div class="meta-resources">
          {after.map(row => (
            <AdditionalResource key={row.key} resource={row.resource} mode="text" />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowRow ({ line }) {
  const typeTitle = line.typeTitle || '';
  const typeText = typeTitle
    ? <abbr title={typeTitle}>{line.typeLabel}</abbr>
    : line.typeLabel;
  const chip = line.typeLabel
    ? (line.modeHref
        ? (
            <a
              class="resource-type"
              href={line.modeHref}
              onClick={e => onModelsLinkClick(e, line.modeHref)}
            >{typeText}</a>
          )
        : <span class="resource-type">{typeText}</span>)
    : null;
  return (
    <div class="resource-item">
      <div class="resource-item-main">
        <ResourceIdentity name={line.name} version={line.version} href={line.href} showTitle={false} />
        {chip}
      </div>
    </div>
  );
}

export function WorkflowSection ({ line, lines }) {
  const rows = Array.isArray(lines) ? lines.filter(Boolean) : (line ? [line] : []);
  if (!rows.length) return null;
  return (
    <div class="meta-section">
      <h2 class="meta-label">Workflow</h2>
      {rows.map((row, i) => (
        <WorkflowRow key={row.id || `${row.name}:${row.version}:${i}`} line={row} />
      ))}
    </div>
  );
}
