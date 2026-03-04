import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Nav } from './components/Nav.jsx';
import { GenerationsView } from './components/GenerationsView.jsx';
import { PostsView } from './components/PostsView.jsx';
import { PostDetailView } from './components/PostDetailView.jsx';
import { TimelineView } from './components/TimelineView.jsx';
import { SettingsView } from './components/SettingsView.jsx';
import { getConfig } from './api.js';
import { getRoute } from './lib/router.js';

function App () {
  const [route, setRoute] = useState(getRoute);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const update = () => setRoute(getRoute());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);

  useEffect(() => {
    getConfig().then(cfg => { if (cfg.username) setUsername(cfg.username); }).catch(() => {});
  }, []);

  const { top, sub } = route;

  return (
    <>
      <Nav route={top} username={username} />
      {top === 'generations' && <GenerationsView />}
      {top === 'posts' && !sub && <PostsView />}
      {top === 'posts' && sub && <PostDetailView postId={sub} />}
      {top === 'timeline' && <TimelineView />}
      {top === 'settings' && <SettingsView />}
    </>
  );
}

render(<App />, document.getElementById('app'));
