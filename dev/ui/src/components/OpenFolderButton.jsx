import { openFolder, openJson } from '../api.js';

const JSON_LABELS = {
  generation: 'Generation data',
  post: 'Post data',
  comic: 'Comic data'
};

// Shared Open folder control. Same POST /api/open-folder as the lightbox and
// Exports; callers pick the chrome (`quiet-btn` on list and property-sheet rows,
// `meta-action` on detail). A media-file path is revealed/selected when the
// file exists on disk; folder-only paths still open the folder. Renders
// nothing when `path` is empty. Optional `label` (default Open folder) and
// `title`.
export function OpenFolderButton ({
  path,
  class: className = 'quiet-btn',
  label = 'Open folder',
  title
}) {
  if (!path) return null;
  return (
    <button
      type="button"
      class={className}
      title={title}
      onClick={() => openFolder(path)}
    >
      {label}
    </button>
  );
}

// Reveal the viewed container's saved JSON (`{ json: { type, id } }`).
// Labels Generation data / Post data / Comic data. Renders nothing when kind
// or id is empty. Optional `title`. `suffix` is a string or a node (a date
// when there is more than one).
export function OpenJsonButton ({ kind, id, class: className = 'meta-action', suffix, title }) {
  const label = JSON_LABELS[kind];
  if (!label || id == null || id === '') return null;
  return (
    <button type="button" class={className} title={title} onClick={() => openJson(kind, id)}>
      {label}
      {suffix ? <>{' \u00B7 '}{suffix}</> : null}
    </button>
  );
}
