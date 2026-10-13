// One import of the three.js chunk for the session. A rejection clears the
// cache so turning View 3D on again can retry. A success stays cached.
let pending = null;

export function loadMeshViewer () {
  if (!pending) {
    pending = import('./MeshViewer.jsx').then(mod => {
      if (!mod || typeof mod.mountMeshViewer !== 'function') {
        throw new Error('missing');
      }
      return mod;
    }).catch(err => {
      pending = null;
      throw err;
    });
  }
  return pending;
}
