// Poster layouts: each layout splits the cover's inner area into photo panels.
// Panel geometry is in fractions of the inner area (0..1). A panel is either a
// rectangle {x, y, w, h} or a slanted polygon {points: [[x, y], ...]}.

export const LAYOUTS = [
  {
    id: 'hero-duo',
    name: 'Hero + Duo',
    panels: [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.62, y: 0, w: 0.38, h: 0.5 },
      { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
    ],
  },
  {
    id: 'mosaic-five',
    name: 'Mosaic Five',
    panels: [
      { x: 0, y: 0, w: 0.54, h: 1 },
      { x: 0.54, y: 0, w: 0.23, h: 0.5 },
      { x: 0.77, y: 0, w: 0.23, h: 0.5 },
      { x: 0.54, y: 0.5, w: 0.23, h: 0.5 },
      { x: 0.77, y: 0.5, w: 0.23, h: 0.5 },
    ],
  },
  {
    id: 'trio-strip',
    name: 'Trio Strip',
    panels: [
      { x: 0, y: 0, w: 1 / 3, h: 1 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ],
  },
  {
    id: 'quad-grid',
    name: 'Quad Grid',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: 'banner-panels',
    name: 'Banner + Panels',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.58 },
      { x: 0, y: 0.58, w: 0.5, h: 0.42 },
      { x: 0.5, y: 0.58, w: 0.5, h: 0.42 },
    ],
  },
  {
    id: 'diagonal',
    name: 'Diagonal Split',
    panels: [
      { points: [[0, 0], [0.44, 0], [0.34, 1], [0, 1]] },
      { points: [[0.44, 0], [0.74, 0], [0.64, 1], [0.34, 1]] },
      { points: [[0.74, 0], [1, 0], [1, 1], [0.64, 1]] },
    ],
  },
  {
    id: 'full-bleed',
    name: 'Full Bleed',
    panels: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
];

/** Finds a layout by id, falling back to the first layout. */
export function layoutById(id) {
  return LAYOUTS.find((layout) => layout.id === id) ?? LAYOUTS[0];
}

/** Converts a panel's fraction geometry into canvas-pixel polygon points, shrunk by the gutter. */
export function panelPolygon(panel, inner, gutter) {
  if (panel.points) {
    const pts = panel.points.map(([fx, fy]) => [inner.x + fx * inner.w, inner.y + fy * inner.h]);
    const cx = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
    const cy = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
    const box = polygonBounds(pts);
    const shrink = Math.max(0, 1 - gutter / Math.max(1, Math.min(box.w, box.h)));
    return pts.map(([px, py]) => [cx + (px - cx) * shrink, cy + (py - cy) * shrink]);
  }
  const half = gutter / 2;
  const x = inner.x + panel.x * inner.w + half;
  const y = inner.y + panel.y * inner.h + half;
  const w = panel.w * inner.w - gutter;
  const h = panel.h * inner.h - gutter;
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

/** Axis-aligned bounds of a polygon's points. */
export function polygonBounds(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of points) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** True when the point (px, py) lies inside the polygon (ray-casting test). */
export function pointInPolygon(points, px, py) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
