// Camera fit for a mesh. No three.js import. The viewer is the only module
// that imports three.

// A little air so the sphere does not sit under Reset view.
export const MESH_FIT_MARGIN = 1.08;

// Three-quarter view. The viewer normalizes this.
export const MESH_FIT_DIRECTION = Object.freeze({ x: 1, y: 1, z: 1.5 });

// Half the diagonal of a box. A turn stays inside this sphere. A flat or
// non-finite box is 0, and the viewer skips the fit.
export function meshSphereRadius ({ x, y, z } = {}) {
  if (![x, y, z].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)) return 0;
  return 0.5 * Math.hypot(x, y, z);
}

// Distance from the origin so the sphere touches the tighter field of view,
// then MESH_FIT_MARGIN. 0 when the inputs cannot describe a camera.
export function meshFitDistance ({ radius, fovDeg, aspect } = {}) {
  if (typeof radius !== 'number' || !Number.isFinite(radius) || radius <= 0) return 0;
  if (typeof fovDeg !== 'number' || !Number.isFinite(fovDeg) || fovDeg <= 0 || fovDeg >= 180) return 0;
  if (typeof aspect !== 'number' || !Number.isFinite(aspect) || aspect <= 0) return 0;
  const vHalf = (fovDeg * Math.PI / 180) / 2;
  const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  const theta = Math.min(vHalf, hHalf);
  const sine = Math.sin(theta);
  if (!(sine > 0)) return 0;
  return (radius / sine) * MESH_FIT_MARGIN;
}
