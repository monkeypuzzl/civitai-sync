import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { loadUiPrefs, readMeshViewerPref, rememberMeshViewer } from './sticky-ui.js';

// One remembered on/off for every surface that can show the viewer.
// Absent, and any value other than "on", is off. Not a URL key.
// The first commit reads the module cache. An effect must not be the
// first place the saved value appears, or the still paints and then leaves.
export function useMeshViewerPref () {
  const touched = useRef(false);
  const [enabled, setEnabledState] = useState(() => readMeshViewerPref().on);
  const [ready, setReady] = useState(() => readMeshViewerPref().loaded);

  useEffect(() => {
    if (ready) return undefined;
    let dead = false;
    loadUiPrefs().then(doc => {
      if (dead) return;
      if (!touched.current) setEnabledState(!!(doc && doc.meshViewer === 'on'));
      setReady(true);
    }).catch(() => {
      if (!dead) setReady(true);
    });
    return () => { dead = true; };
  }, [ready]);

  const setEnabled = useCallback((next) => {
    touched.current = true;
    const on = !!next;
    setEnabledState(on);
    rememberMeshViewer(on ? 'on' : 'off');
  }, []);

  return { enabled, setEnabled, ready };
}
