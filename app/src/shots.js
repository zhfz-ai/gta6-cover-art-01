// Fixed scenes for screenshots: ?shot=cover shows the exported cover alone,
// ?shot=editor shows the full editor with photos loaded. Query parameters pick
// the layout, grade, size, caption and sample photos; window.__shotReady is
// set once the scene has painted with the bundled fonts.

const COLOUR_NAMES = {
  white: '#ffffff',
  yellow: '#ffd23f',
  pink: '#ff4fa3',
  cyan: '#37e6ff',
  orange: '#ff8a3d',
};

function parseColour(raw) {
  if (!raw) return null;
  if (COLOUR_NAMES[raw]) return COLOUR_NAMES[raw];
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw}` : null;
}

/** Reads the shot configuration out of the query string. */
export function parseShotConfig(query) {
  const photosRaw = query.get('photos') ?? query.get('photo') ?? 'boulevard,neon-car,palm-sunset';
  const pansRaw = query.get('pans');
  const intensityRaw = query.get('intensity');
  const zoomRaw = query.get('zoom');
  return {
    layout: query.get('layout'),
    grade: query.get('grade'),
    size: query.get('size'),
    title: query.get('title') ?? query.get('caption'),
    subtitle: query.get('subtitle'),
    color: parseColour(query.get('color')),
    position: query.get('pos'),
    font: query.get('font'),
    intensity: intensityRaw === null ? null : Math.min(1, Math.max(0, Number(intensityRaw))),
    zoom: zoomRaw === null ? null : Math.min(3, Math.max(1, Number(zoomRaw))),
    photos: photosRaw.split(',').map((name) => name.trim()).filter(Boolean),
    pans: pansRaw
      ? pansRaw.split(';').map((pair) => pair.split(',').map((n) => Math.min(1, Math.max(-1, Number(n) || 0))))
      : [],
  };
}

/** Runs a screenshot scene: applies the config, waits for fonts, then flags readiness. */
export async function runShot(shot, query, api) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await api.applyShotConfig(parseShotConfig(query));
  await document.fonts.ready;
  api.fitCanvasToStage();
  api.redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
