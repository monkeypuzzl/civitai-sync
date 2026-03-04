import { navigate } from '../lib/router.js';

const TABS = [
  { id: 'generations', label: 'Generations' },
  { id: 'posts', label: 'Posts' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'settings', label: 'Settings' }
];

export function Nav ({ route, username }) {
  function go (e, id) {
    e.preventDefault();
    navigate(id);
  }

  return (
    <nav class="nav">
      <div class="nav-logo">
        <span class="civit">civit</span><span class="ai">ai</span>
        <span class="sync">-sync</span>
      </div>
      <div class="nav-tabs">
        {TABS.map(tab => (
          <a
            key={tab.id}
            class={`nav-tab${route === tab.id ? ' active' : ''}`}
            href={`/${tab.id}`}
            onClick={e => go(e, tab.id)}
          >
            {tab.label}
          </a>
        ))}
      </div>
      {username && <div class="nav-username">{username}</div>}
    </nav>
  );
}
