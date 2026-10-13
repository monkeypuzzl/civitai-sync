import { onModelsLinkClick } from './SidebarSections.jsx';

// Under the entity header. The name links to the published 3D page.
export function PublishedAs3d ({ model3d }) {
  if (!model3d || model3d.id == null || model3d.id === '') return null;
  const name = String(model3d.name || '').trim();
  const href = `/model3ds/${model3d.id}`;
  return (
    <p class="published-as-3d">
      Published as 3D
      {' '}
      <a href={href} onClick={(event) => onModelsLinkClick(event, href)}>{name || String(model3d.id)}</a>
    </p>
  );
}
