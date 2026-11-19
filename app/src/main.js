// Wires the Neon Poster editor: state, controls, drag-to-crop on the preview,
// PNG export at post sizes, and the ?shot= scenes used for screenshots.
import { LAYOUTS, layoutById, pointInPolygon, polygonBounds } from './layouts.js';
import { GRADES } from './grades.js';
import { drawCoverArt, panelPolygonsFor, photoPlacement } from './render.js';
import { runShot } from './shots.js';

export const POST_SIZES = [
  { id: 'landscape', name: '1920 × 1080', w: 1920, h: 1080 },
  { id: 'square', name: '1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', name: '1080 × 1350', w: 1080, h: 1350 },
];

export const SAMPLE_PHOTOS = [
  { name: 'boulevard', label: 'Boulevard' },
  { name: 'neon-car', label: 'Neon Car' },
  { name: 'pier', label: 'Pier' },
  { name: 'palm-sunset', label: 'Palm Sunset' },
];

export const CAPTION_COLOURS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Sun Yellow', value: '#ffd23f' },
  { name: 'Hot Pink', value: '#ff4fa3' },
  { name: 'Neon Cyan', value: '#37e6ff' },
  { name: 'Sunset Orange', value: '#ff8a3d' },
];

const canvas = document.getElementById('cover');
const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const panelLabel = document.getElementById('panelLabel');
const zoomRange = document.getElementById('zoomRange');
const intensityRange = document.getElementById('intensityRange');
const titleInput = document.getElementById('titleInput');
const subtitleInput = document.getElementById('subtitleInput');

const state = {
  sizeId: 'landscape',
  layoutId: 'hero-duo',
  gradeId: 'sunset-vice',
  intensity: 0.85,
  caption: { title: 'NEON HARBOR', subtitle: 'A SUNSET STORY', color: '#ffd23f', position: 'bottom', font: 'anton' },
  slots: [],
  selected: 0,
};

let shotCoverMode = false;
const sampleCache = new Map();

function makeSlot(photo) {
  return { photo: photo ?? null, zoom: 1, panX: 0, panY: 0 };
}

function currentSize() {
  return POST_SIZES.find((size) => size.id === state.sizeId) ?? POST_SIZES[0];
}

/** Loads an image from a URL (a file under app/ or a local object URL), resolving once drawable. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Loads a bundled sample photo by name, cached after the first load. */
export function loadSample(name) {
  if (!sampleCache.has(name)) sampleCache.set(name, loadImage(`samples/${name}.jpg`));
  return sampleCache.get(name);
}

function redraw() {
  drawCoverArt(canvas, state, { showSelection: !shotCoverMode });
}

/** Rebuilds the slot list for the current layout, keeping photos already placed by index. */
function rebuildSlots() {
  const old = state.slots;
  state.slots = layoutById(state.layoutId).panels.map((_, i) => old[i] ?? makeSlot(null));
  state.selected = Math.min(state.selected, state.slots.length - 1);
}

/** Sizes the preview canvas element to fit the stage while keeping the post aspect ratio. */
function fitCanvasToStage() {
  if (shotCoverMode) {
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    return;
  }
  const rect = stage.getBoundingClientRect();
  const availW = Math.max(200, rect.width - 36);
  const availH = Math.max(200, rect.height - 70);
  const { w, h } = currentSize();
  const scale = Math.min(availW / w, availH / h);
  canvas.style.width = `${Math.round(w * scale)}px`;
  canvas.style.height = `${Math.round(h * scale)}px`;
}

function setSize(id) {
  state.sizeId = id;
  const { w, h } = currentSize();
  canvas.width = w;
  canvas.height = h;
  fitCanvasToStage();
  syncControls();
  redraw();
}

function setLayout(id) {
  state.layoutId = id;
  rebuildSlots();
  syncControls();
  redraw();
}

function setGrade(id) {
  state.gradeId = id;
  syncControls();
  redraw();
}

function selectPanel(index) {
  state.selected = Math.min(Math.max(0, index), state.slots.length - 1);
  syncControls();
  redraw();
}

function setSlotPhoto(index, photo) {
  const slot = state.slots[index] ?? makeSlot(null);
  slot.photo = photo;
  slot.zoom = 1;
  slot.panX = 0;
  slot.panY = 0;
  state.slots[index] = slot;
  syncControls();
  redraw();
}

/** Puts the selected panel's photo into every panel, each sliced with its own offset. */
function fillAllPanels() {
  const photo = state.slots[state.selected]?.photo;
  if (!photo) {
    statusEl.textContent = 'Add a photo to a panel first';
    return;
  }
  const offsets = [-0.45, 0, 0.45, -0.25, 0.25];
  state.slots = state.slots.map((_, i) => ({ photo, zoom: 1.15, panX: offsets[i % offsets.length], panY: 0 }));
  statusEl.textContent = 'One photo now fills every panel';
  syncControls();
  redraw();
}

function exportPng() {
  const { w, h } = currentSize();
  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  drawCoverArt(offscreen, state, { showSelection: false });
  offscreen.toBlob((blob) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `neon-poster-${w}x${h}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
    statusEl.textContent = `Saved neon-poster-${w}x${h}.png`;
  }, 'image/png');
}

function markActive(container, activeId) {
  for (const button of container.querySelectorAll('button')) {
    button.classList.toggle('active', button.dataset.id === activeId);
  }
}

/** Refreshes every control so it mirrors the state. */
function syncControls() {
  markActive(document.getElementById('layoutButtons'), state.layoutId);
  markActive(document.getElementById('gradeButtons'), state.gradeId);
  markActive(document.getElementById('sizeButtons'), state.sizeId);
  panelLabel.textContent = `Panel ${state.selected + 1} of ${state.slots.length}`;
  const slot = state.slots[state.selected];
  if (slot) zoomRange.value = String(Math.round(slot.zoom * 100));
  intensityRange.value = String(Math.round(state.intensity * 100));
  if (titleInput.value !== state.caption.title) titleInput.value = state.caption.title;
  if (subtitleInput.value !== state.caption.subtitle) subtitleInput.value = state.caption.subtitle;
  for (const button of document.getElementById('colorSwatches').querySelectorAll('button')) {
    button.classList.toggle('active', button.dataset.value === state.caption.color);
  }
  document.getElementById('posBottom').classList.toggle('active', state.caption.position !== 'top');
  document.getElementById('posTop').classList.toggle('active', state.caption.position === 'top');
  document.getElementById('fontAnton').classList.toggle('active', state.caption.font !== 'archivo');
  document.getElementById('fontArchivo').classList.toggle('active', state.caption.font === 'archivo');
}

function buildControls() {
  const layoutButtons = document.getElementById('layoutButtons');
  for (const layout of LAYOUTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.id = layout.id;
    button.textContent = layout.name;
    button.addEventListener('click', () => setLayout(layout.id));
    layoutButtons.append(button);
  }
  const gradeButtons = document.getElementById('gradeButtons');
  for (const grade of GRADES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.id = grade.id;
    button.textContent = grade.name;
    button.addEventListener('click', () => setGrade(grade.id));
    gradeButtons.append(button);
  }
  const sizeButtons = document.getElementById('sizeButtons');
  for (const size of POST_SIZES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.id = size.id;
    button.textContent = size.name;
    button.addEventListener('click', () => setSize(size.id));
    sizeButtons.append(button);
  }
  const sampleButtons = document.getElementById('sampleButtons');
  for (const sample of SAMPLE_PHOTOS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = sample.label;
    const thumb = document.createElement('img');
    thumb.src = `samples/${sample.name}.jpg`;
    thumb.alt = sample.label;
    button.append(thumb);
    button.addEventListener('click', async () => {
      setSlotPhoto(state.selected, await loadSample(sample.name));
      statusEl.textContent = `${sample.label} photo in panel ${state.selected + 1}`;
    });
    sampleButtons.append(button);
  }
  const swatches = document.getElementById('colorSwatches');
  for (const colour of CAPTION_COLOURS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = colour.name;
    button.dataset.value = colour.value;
    button.style.background = colour.value;
    button.addEventListener('click', () => {
      state.caption.color = colour.value;
      syncControls();
      redraw();
    });
    swatches.append(button);
  }
}

/** Converts a pointer event on the preview into canvas pixel coordinates. */
function pointerToCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

let drag = null;

canvas.addEventListener('pointerdown', (event) => {
  if (shotCoverMode) return;
  const point = pointerToCanvas(event);
  const polygons = panelPolygonsFor(state, canvas.width, canvas.height);
  const hit = polygons.findIndex((points) => pointInPolygon(points, point.x, point.y));
  if (hit >= 0) selectPanel(hit);
  const slot = state.slots[state.selected];
  if (!slot || !slot.photo) return;
  drag = { startX: point.x, startY: point.y, panX: slot.panX, panY: slot.panY, box: polygonBounds(polygons[state.selected]) };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const slot = state.slots[state.selected];
  if (!slot || !slot.photo) return;
  const point = pointerToCanvas(event);
  const place = photoPlacement(drag.box, { ...slot, panX: 0, panY: 0 });
  if (place.maxPanX > 0) slot.panX = clampPan(drag.panX + (point.x - drag.startX) / place.maxPanX);
  if (place.maxPanY > 0) slot.panY = clampPan(drag.panY + (point.y - drag.startY) / place.maxPanY);
  redraw();
});

canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

canvas.addEventListener('wheel', (event) => {
  if (shotCoverMode) return;
  event.preventDefault();
  const slot = state.slots[state.selected];
  if (!slot || !slot.photo) return;
  slot.zoom = Math.min(3, Math.max(1, slot.zoom * Math.exp(-event.deltaY * 0.0012)));
  syncControls();
  redraw();
}, { passive: false });

function clampPan(value) {
  return Math.min(1, Math.max(-1, value));
}

document.getElementById('photoFile').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const photo = await loadImage(URL.createObjectURL(file));
  setSlotPhoto(state.selected, photo);
  statusEl.textContent = `Your photo is in panel ${state.selected + 1}`;
  event.target.value = '';
});

document.getElementById('fillAll').addEventListener('click', fillAllPanels);
document.getElementById('prevPanel').addEventListener('click', () => selectPanel(state.selected - 1));
document.getElementById('nextPanel').addEventListener('click', () => selectPanel(state.selected + 1));
document.getElementById('exportBtn').addEventListener('click', exportPng);

zoomRange.addEventListener('input', () => {
  const slot = state.slots[state.selected];
  if (slot) slot.zoom = Number(zoomRange.value) / 100;
  redraw();
});
intensityRange.addEventListener('input', () => {
  state.intensity = Number(intensityRange.value) / 100;
  redraw();
});
titleInput.addEventListener('input', () => { state.caption.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.caption.subtitle = subtitleInput.value; redraw(); });
document.getElementById('posBottom').addEventListener('click', () => { state.caption.position = 'bottom'; syncControls(); redraw(); });
document.getElementById('posTop').addEventListener('click', () => { state.caption.position = 'top'; syncControls(); redraw(); });
document.getElementById('fontAnton').addEventListener('click', () => { state.caption.font = 'anton'; syncControls(); redraw(); });
document.getElementById('fontArchivo').addEventListener('click', () => { state.caption.font = 'archivo'; syncControls(); redraw(); });
window.addEventListener('resize', fitCanvasToStage);

/** Applies a parsed ?shot= configuration: layout, grade, size, caption and sample photos. */
async function applyShotConfig(config) {
  if (config.layout) state.layoutId = config.layout;
  if (config.grade) state.gradeId = config.grade;
  if (config.intensity !== null) state.intensity = config.intensity;
  if (config.title !== null) state.caption.title = config.title;
  if (config.subtitle !== null) state.caption.subtitle = config.subtitle;
  if (config.color) state.caption.color = config.color;
  if (config.position) state.caption.position = config.position;
  if (config.font) state.caption.font = config.font;
  rebuildSlots();
  const photos = await Promise.all(config.photos.map((name) => loadSample(name)));
  const offsets = [-0.45, 0, 0.45, -0.25, 0.25];
  state.slots = state.slots.map((_, i) => {
    const photo = photos[i % photos.length];
    const single = photos.length === 1 && state.slots.length > 1;
    const pan = config.pans[i];
    return {
      photo,
      zoom: config.zoom ?? (single ? 1.15 : 1),
      panX: pan ? pan[0] : single ? offsets[i % offsets.length] : 0,
      panY: pan ? pan[1] : 0,
    };
  });
  state.selected = 0;
  setSize(config.size ?? state.sizeId);
  statusEl.textContent = 'Ready — pick a panel, swap a photo, export';
  syncControls();
  redraw();
}

/** Loads the opening scene: sample photos in the hero layout so the first paint is a finished cover. */
async function loadOpeningScene() {
  rebuildSlots();
  const [hero, second, third] = await Promise.all([loadSample('boulevard'), loadSample('neon-car'), loadSample('palm-sunset')]);
  state.slots[0] = makeSlot(hero);
  if (state.slots[1]) state.slots[1] = makeSlot(second);
  if (state.slots[2]) state.slots[2] = makeSlot(third);
  statusEl.textContent = 'Ready — pick a panel, swap a photo, export';
  syncControls();
  redraw();
}

buildControls();
rebuildSlots();
setSize(state.sizeId);

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  if (shot === 'cover') shotCoverMode = true;
  runShot(shot, query, { applyShotConfig, redraw, fitCanvasToStage });
} else {
  loadOpeningScene();
  document.fonts.ready.then(redraw);
}
