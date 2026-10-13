import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MESH_VIEWER_COPY, meshOpenFailure } from '../lib/mesh-viewer-messages.js';
import {
  MESH_FIT_DIRECTION,
  meshFitDistance,
  meshSphereRadius
} from '../lib/mesh-fit.js';

function pixelRatio (limited) {
  if (limited) return 1;
  const n = window.devicePixelRatio;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return 1;
  return n;
}

function disposeMaterial (material) {
  if (!material) return;
  for (const key of Object.keys(material)) {
    const value = material[key];
    if (value && value.isTexture) {
      try { value.dispose(); } catch { /* already gone */ }
    }
  }
  try { material.dispose(); } catch { /* already gone */ }
}

function disposeObject (object) {
  if (!object) return;
  object.traverse(node => {
    if (!node.isMesh) return;
    try { node.geometry?.dispose(); } catch { /* already gone */ }
    const material = node.material;
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else disposeMaterial(material);
  });
}

function createRenderer (host) {
  const first = document.createElement('canvas');
  host.appendChild(first);
  try {
    return { renderer: new THREE.WebGLRenderer({
      canvas: first,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: false
    }), limited: false };
  } catch {
    first.remove();
  }
  const second = document.createElement('canvas');
  host.appendChild(second);
  try {
    const renderer = new THREE.WebGLRenderer({
      canvas: second,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: false
    });
    renderer.setPixelRatio(1);
    return { renderer, limited: true };
  } catch {
    second.remove();
    throw new Error('no-webgl');
  }
}

function mount (host, handlers) {
  const notify = (name, message) => {
    try { handlers[name]?.(message); } catch { /* the page still has the still */ }
  };

  let stopped = false;
  let raf = 0;
  let loadToken = 0;
  let activeUrl = '';
  let loading = false;
  let announced = false;
  let awaitingRestore = false;
  let restoreUsed = false;
  let currentRoot = null;
  let mixer = null;
  let fitRadius = 0;

  const created = createRenderer(host);
  const renderer = created.renderer;
  const ratioLimited = created.limited;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(pixelRatio(ratioLimited));
  renderer.setClearColor(0x1a1a1a, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(2, 2, 3);
  const fittedPos = camera.position.clone();
  const fittedTarget = new THREE.Vector3(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const directional = new THREE.DirectionalLight(0xffffff, 0.9);
  directional.position.set(5, 10, 7);
  scene.add(directional);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.target.set(0, 0, 0);

  const clock = new THREE.Clock();
  const loader = new GLTFLoader();

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'mesh-reset quiet-btn';
  resetButton.textContent = 'Reset view';
  resetButton.disabled = true;
  host.appendChild(resetButton);

  let gesture = false;
  let viewMoved = false;
  let gestureClear = 0;

  function markHome () {
    if (gestureClear) cancelAnimationFrame(gestureClear);
    gestureClear = 0;
    gesture = false;
    viewMoved = false;
    resetButton.disabled = true;
  }

  function onControlStart () {
    if (gestureClear) cancelAnimationFrame(gestureClear);
    gestureClear = 0;
    gesture = true;
  }
  function onControlEnd () {
    // A wheel zoom is applied in the next controls.update(), after end.
    if (gestureClear) cancelAnimationFrame(gestureClear);
    gestureClear = requestAnimationFrame(() => {
      gestureClear = 0;
      gesture = false;
    });
  }
  function onControlChange () {
    if (!gesture || viewMoved || stopped) return;
    viewMoved = true;
    resetButton.disabled = false;
  }
  controls.addEventListener('start', onControlStart);
  controls.addEventListener('end', onControlEnd);
  controls.addEventListener('change', onControlChange);

  const stopPointer = (event) => {
    event.stopPropagation();
  };
  host.addEventListener('pointerdown', stopPointer);
  host.addEventListener('click', stopPointer);

  function stopLoop () {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (gestureClear) cancelAnimationFrame(gestureClear);
    gestureClear = 0;
  }

  function resize () {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w < 1 || h < 1) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    try {
      renderer.setPixelRatio(pixelRatio(ratioLimited));
      renderer.setSize(w, h, false);
      if (fitRadius > 0) applyDistance(false);
    } catch {
      unrecoverable(MESH_VIEWER_COPY.gpuStopped);
    }
  }

  const resizeObserver = new ResizeObserver(() => {
    if (!stopped) resize();
  });
  resizeObserver.observe(host);

  function clearModel () {
    mixer = null;
    fitRadius = 0;
    if (!currentRoot) return;
    scene.remove(currentRoot);
    disposeObject(currentRoot);
    currentRoot = null;
  }

  function unrecoverable (message) {
    if (stopped) return;
    stopped = true;
    stopLoop();
    notify('onUnrecoverable', message);
    release();
  }

  function failFile (message) {
    if (stopped) return;
    loading = false;
    announced = false;
    stopLoop();
    clearModel();
    notify('onNotice', message);
  }

  function threeQuarter (distance) {
    return new THREE.Vector3(
      MESH_FIT_DIRECTION.x,
      MESH_FIT_DIRECTION.y,
      MESH_FIT_DIRECTION.z
    ).normalize().multiplyScalar(distance);
  }

  function applyDistance (useViewDirection) {
    const distance = meshFitDistance({
      radius: fitRadius,
      fovDeg: camera.fov,
      aspect: camera.aspect
    });
    if (!(distance > 0)) return;
    const dir = useViewDirection
      ? new THREE.Vector3(MESH_FIT_DIRECTION.x, MESH_FIT_DIRECTION.y, MESH_FIT_DIRECTION.z)
      : camera.position.clone();
    if (dir.lengthSq() < 1e-12) {
      dir.set(MESH_FIT_DIRECTION.x, MESH_FIT_DIRECTION.y, MESH_FIT_DIRECTION.z);
    }
    camera.position.copy(dir.normalize().multiplyScalar(distance));
    controls.target.set(0, 0, 0);
    controls.update();
    fittedPos.copy(threeQuarter(distance));
    fittedTarget.set(0, 0, 0);
  }

  function fit (model) {
    let box;
    try {
      box = new THREE.Box3().setFromObject(model);
    } catch {
      return;
    }
    if (!box || box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(center.z)) return;
    const radius = meshSphereRadius({ x: size.x, y: size.y, z: size.z });
    if (!(radius > 0)) return;
    model.position.sub(center);
    fitRadius = radius;
    camera.near = Math.max(radius / 100, 0.01);
    camera.far = radius * 100;
    camera.updateProjectionMatrix();
    applyDistance(true);
  }

  function playClip (model, clips) {
    mixer = null;
    if (!clips || !clips.length) return;
    try {
      mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(clips[0]).play();
    } catch {
      mixer = null;
    }
  }

  function hasMesh (object) {
    let found = false;
    object.traverse(node => {
      if (node.isMesh) found = true;
    });
    return found;
  }

  function adopt (gltf) {
    const model = gltf.scene;
    if (!model || !hasMesh(model)) {
      failFile(MESH_VIEWER_COPY.cannotRead);
      return;
    }
    playClip(model, gltf.animations);
    fit(model);
    scene.add(model);
    currentRoot = model;
    loading = false;
    resize();
    markHome();
    startLoop();
  }

  function tick () {
    raf = 0;
    if (stopped) return;
    try {
      if (mixer) mixer.update(clock.getDelta());
      controls.update();
      renderer.render(scene, camera);
    } catch {
      unrecoverable(MESH_VIEWER_COPY.gpuStopped);
      return;
    }
    if (currentRoot && !announced) {
      announced = true;
      notify('onReady');
    }
    if (!stopped) raf = requestAnimationFrame(tick);
  }

  function startLoop () {
    if (stopped || raf) return;
    raf = requestAnimationFrame(tick);
  }

  function load (url) {
    loadToken += 1;
    const token = loadToken;
    activeUrl = url;
    announced = false;
    loading = true;
    clearModel();
    stopLoop();
    if (!url) {
      failFile(MESH_VIEWER_COPY.cannotRead);
      return;
    }
    loader.load(
      url,
      (gltf) => {
        if (stopped || token !== loadToken) return;
        try {
          adopt(gltf);
        } catch {
          failFile(MESH_VIEWER_COPY.cannotRead);
        }
      },
      undefined,
      (err) => {
        if (stopped || token !== loadToken) return;
        failFile(meshOpenFailure(err));
      }
    );
  }

  function onLost (event) {
    if (stopped) return;
    event.preventDefault();
    stopLoop();
    if (restoreUsed) {
      unrecoverable(MESH_VIEWER_COPY.gpuStopped);
      return;
    }
    awaitingRestore = true;
    announced = false;
    notify('onNotice', MESH_VIEWER_COPY.gpuStopped);
  }

  function onRestored () {
    if (stopped || !awaitingRestore) return;
    awaitingRestore = false;
    if (restoreUsed) {
      unrecoverable(MESH_VIEWER_COPY.gpuStopped);
      return;
    }
    restoreUsed = true;
    try {
      resize();
      load(activeUrl);
    } catch {
      unrecoverable(MESH_VIEWER_COPY.gpuStopped);
    }
  }

  renderer.domElement.addEventListener('webglcontextlost', onLost, false);
  renderer.domElement.addEventListener('webglcontextrestored', onRestored, false);

  resetButton.addEventListener('click', () => {
    if (stopped || resetButton.disabled) return;
    gesture = false;
    camera.position.copy(fittedPos);
    controls.target.copy(fittedTarget);
    controls.update();
    markHome();
  });

  function release () {
    stopLoop();
    resizeObserver.disconnect();
    host.removeEventListener('pointerdown', stopPointer);
    host.removeEventListener('click', stopPointer);
    const canvas = renderer.domElement;
    canvas.removeEventListener('webglcontextlost', onLost, false);
    canvas.removeEventListener('webglcontextrestored', onRestored, false);
    try { controls.removeEventListener('start', onControlStart); } catch { /* ignore */ }
    try { controls.removeEventListener('end', onControlEnd); } catch { /* ignore */ }
    try { controls.removeEventListener('change', onControlChange); } catch { /* ignore */ }
    try { controls.dispose(); } catch { /* ignore */ }
    clearModel();
    try { renderer.dispose(); } catch { /* ignore */ }
    try {
      const gl = renderer.getContext();
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { /* ignore */ }
    try { renderer.domElement.remove(); } catch { /* ignore */ }
    try { resetButton.remove(); } catch { /* ignore */ }
  }

  resize();

  return {
    setUrl (url) {
      if (stopped) return;
      const next = typeof url === 'string' ? url : '';
      if (next === activeUrl && (loading || currentRoot)) return;
      load(next);
    },
    dispose () {
      if (stopped) return;
      stopped = true;
      loadToken += 1;
      release();
    }
  };
}

export function mountMeshViewer (host, handlers) {
  if (!host) {
    try { handlers?.onUnrecoverable?.(MESH_VIEWER_COPY.noWebgl); } catch { /* ignore */ }
    return { setUrl () {}, dispose () {} };
  }
  try {
    return mount(host, handlers || {});
  } catch {
    try { handlers?.onUnrecoverable?.(MESH_VIEWER_COPY.noWebgl); } catch { /* ignore */ }
    return { setUrl () {}, dispose () {} };
  }
}
