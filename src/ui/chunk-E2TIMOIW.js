// dev/ui/src/lib/mesh-viewer-messages.js
var MESH_VIEWER_COPY = Object.freeze({
  importFailed: "Could not load the 3D viewer.",
  noWebgl: "This browser cannot show 3D.",
  gpuStopped: "The graphics chip stopped this view.",
  notOnDisk: "Could not open this file. It is not on disk.",
  cannotRead: "Could not open this file. This viewer cannot read it.",
  large: "This file is large."
});
var LARGE_MESH_BYTES = 100 * 1024 * 1024;
function httpStatus(err) {
  if (!err || typeof err !== "object") return 0;
  if (typeof err.status === "number") return err.status;
  const response = err.response;
  if (response && typeof response.status === "number") return response.status;
  const target = err.target;
  if (target && typeof target.status === "number") return target.status;
  return 0;
}
function meshOpenFailure(err) {
  const status = httpStatus(err);
  if (status === 404 || status === 410) return MESH_VIEWER_COPY.notOnDisk;
  return MESH_VIEWER_COPY.cannotRead;
}

export {
  MESH_VIEWER_COPY,
  LARGE_MESH_BYTES,
  meshOpenFailure
};
