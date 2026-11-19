// Draws the cover art on a canvas at export size: framed multi-panel poster,
// each panel's photo cropped and colour-graded, bold caption lettering on top.
import { layoutById, panelPolygon, polygonBounds } from './layouts.js';
import { gradeById } from './grades.js';

export const POSTER_BACKGROUND = '#0c0714';
const PANEL_KEYLINE = 'rgba(255, 255, 255, 0.92)';
const SELECTION_COLOUR = '#37e6ff';

export const CAPTION_FONTS = {
  anton: "'Anton', 'Arial Narrow Bold', sans-serif",
  archivo: "'Archivo Black', 'Arial Black', sans-serif",
};

/** Frame, gutter and inner-area geometry for a cover of W x H pixels. */
export function coverGeometry(W, H) {
  const minDim = Math.min(W, H);
  const frame = Math.round(minDim * 0.03);
  const gutter = Math.max(6, Math.round(minDim * 0.014));
  const inner = { x: frame, y: frame, w: W - frame * 2, h: H - frame * 2 };
  return { frame, gutter, inner, minDim };
}

/** Pixel polygons for every panel of the state's layout at W x H. */
export function panelPolygonsFor(state, W, H) {
  const { inner, gutter } = coverGeometry(W, H);
  return layoutById(state.layoutId).panels.map((panel) => panelPolygon(panel, inner, gutter));
}

/** Where a slot's photo lands inside a panel box: cover-fit, zoomed, panned. Also the pan range in pixels. */
export function photoPlacement(box, slot) {
  const iw = slot.photo.naturalWidth;
  const ih = slot.photo.naturalHeight;
  const scale = Math.max(box.w / iw, box.h / ih) * slot.zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const maxPanX = Math.max(0, (dw - box.w) / 2);
  const maxPanY = Math.max(0, (dh - box.h) / 2);
  const dx = box.x + (box.w - dw) / 2 + clamp(slot.panX, -1, 1) * maxPanX;
  const dy = box.y + (box.h - dh) / 2 + clamp(slot.panY, -1, 1) * maxPanY;
  return { dx, dy, dw, dh, maxPanX, maxPanY };
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

function tracePolygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

/** Draws one panel: the graded photo (or an empty placeholder), wash, vignette and keyline. */
function drawPanel(ctx, points, slot, index, grade, intensity) {
  const box = polygonBounds(points);
  ctx.save();
  tracePolygon(ctx, points);
  ctx.clip();
  if (slot && slot.photo) {
    const place = photoPlacement(box, slot);
    ctx.filter = grade.filter(intensity);
    ctx.drawImage(slot.photo, place.dx, place.dy, place.dw, place.dh);
    ctx.filter = 'none';
    drawGradeWash(ctx, box, grade, intensity);
  } else {
    drawEmptyPanel(ctx, box, index);
  }
  drawPanelVignette(ctx, box, grade.vignette);
  ctx.restore();
  tracePolygon(ctx, points);
  ctx.lineWidth = Math.max(2, Math.min(box.w, box.h) * 0.006);
  ctx.strokeStyle = PANEL_KEYLINE;
  ctx.stroke();
}

/** The grade's two-colour wash blended over a panel in overlay mode. */
function drawGradeWash(ctx, box, grade, intensity) {
  if (intensity <= 0) return;
  const wash = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  wash.addColorStop(0, grade.wash[0]);
  wash.addColorStop(1, grade.wash[1]);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = grade.washAlpha * intensity;
  ctx.fillStyle = wash;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}

/** Soft darkening toward a panel's corners. */
function drawPanelVignette(ctx, box, strength) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const radius = Math.max(box.w, box.h) * 0.72;
  const vignette = ctx.createRadialGradient(cx, cy, radius * 0.45, cx, cy, radius);
  vignette.addColorStop(0, 'rgba(5, 2, 10, 0)');
  vignette.addColorStop(1, `rgba(5, 2, 10, ${strength})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(box.x, box.y, box.w, box.h);
}

/** Placeholder for a panel with no photo yet (editor only in practice: defaults load samples). */
function drawEmptyPanel(ctx, box, index) {
  const fill = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  fill.addColorStop(0, '#241040');
  fill.addColorStop(1, '#47135c');
  ctx.fillStyle = fill;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 2;
  const inset = Math.min(box.w, box.h) * 0.06;
  ctx.strokeRect(box.x + inset, box.y + inset, box.w - inset * 2, box.h - inset * 2);
  ctx.restore();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(Math.min(box.w, box.h) * 0.11)}px ${CAPTION_FONTS.anton}`;
  ctx.fillText(`PANEL ${index + 1}`, box.x + box.w / 2, box.y + box.h / 2);
  ctx.font = `${Math.round(Math.min(box.w, box.h) * 0.05)}px sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText('add a photo', box.x + box.w / 2, box.y + box.h / 2 + Math.min(box.w, box.h) * 0.1);
}

/** Splits a title into one or two balanced lines and picks the largest size that fits maxWidth. */
function fitTitleLines(ctx, title, maxWidth, startSize, fontFamily) {
  const setFont = (size) => { ctx.font = `${size}px ${fontFamily}`; };
  let size = startSize;
  setFont(size);
  while (ctx.measureText(title).width > maxWidth && size > 16) {
    size *= 0.94;
    setFont(size);
  }
  const words = title.split(/\s+/).filter(Boolean);
  if (size >= startSize * 0.55 || words.length < 2) return { lines: [title], size };
  let best = null;
  for (let cut = 1; cut < words.length; cut++) {
    const lines = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
    let s = startSize;
    setFont(s);
    while (Math.max(ctx.measureText(lines[0]).width, ctx.measureText(lines[1]).width) > maxWidth && s > 16) {
      s *= 0.94;
      setFont(s);
    }
    if (!best || s > best.size) best = { lines, size: s };
  }
  return best ?? { lines: [title], size };
}

/** Draws the caption block: scrim, huge outlined title, accent rule and letter-spaced subtitle. */
function drawCaptionLettering(ctx, W, H, caption, geometry) {
  const title = caption.title.trim().toUpperCase();
  const subtitle = caption.subtitle.trim().toUpperCase();
  if (!title && !subtitle) return;
  const { frame, minDim } = geometry;
  const atBottom = caption.position !== 'top';
  const fontFamily = CAPTION_FONTS[caption.font] ?? CAPTION_FONTS.anton;
  const maxWidth = W - frame * 2 - minDim * 0.05;

  const scrimH = H * 0.4;
  const scrim = atBottom
    ? ctx.createLinearGradient(0, H - scrimH, 0, H)
    : ctx.createLinearGradient(0, scrimH, 0, 0);
  scrim.addColorStop(0, 'rgba(5, 2, 10, 0)');
  scrim.addColorStop(1, 'rgba(5, 2, 10, 0.85)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, atBottom ? H - scrimH : 0, W, scrimH);

  const fitted = title ? fitTitleLines(ctx, title, maxWidth, minDim * 0.19, fontFamily) : { lines: [], size: 0 };
  const titleSize = fitted.size;
  const lineHeight = titleSize * 1.02;
  const subSize = Math.max(14, minDim * 0.032);
  const ruleGap = minDim * 0.022;
  const blockH = fitted.lines.length * lineHeight + (subtitle ? ruleGap * 2 + subSize : 0);
  const edge = frame + minDim * 0.028;
  let cursorY = atBottom ? H - edge - blockH : edge;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const centreX = W / 2;

  if (title) {
    ctx.font = `${titleSize}px ${fontFamily}`;
    try { ctx.letterSpacing = `${Math.round(titleSize * 0.015)}px`; } catch { /* older canvas */ }
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = titleSize * 0.14;
    ctx.shadowOffsetY = titleSize * 0.045;
    ctx.lineJoin = 'round';
    ctx.lineWidth = titleSize * 0.16;
    ctx.strokeStyle = 'rgba(12, 4, 18, 0.94)';
    ctx.fillStyle = caption.color;
    for (const line of fitted.lines) {
      cursorY += lineHeight;
      const baseline = cursorY - titleSize * 0.12;
      ctx.strokeText(line, centreX, baseline);
      ctx.fillText(line, centreX, baseline);
    }
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }

  if (subtitle) {
    cursorY += ruleGap;
    const ruleW = Math.min(maxWidth * 0.42, minDim * 0.5);
    ctx.fillStyle = caption.color;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(centreX - ruleW / 2, cursorY, ruleW, Math.max(3, minDim * 0.005));
    ctx.globalAlpha = 1;
    cursorY += ruleGap + subSize;
    ctx.font = `${subSize}px ${fontFamily}`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.45)}px`; } catch { /* older canvas */ }
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = subSize * 0.3;
    ctx.lineWidth = subSize * 0.18;
    ctx.strokeStyle = 'rgba(12, 4, 18, 0.9)';
    ctx.fillStyle = '#ffffff';
    ctx.strokeText(subtitle, centreX, cursorY);
    ctx.fillText(subtitle, centreX, cursorY);
    ctx.shadowBlur = 0;
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
}

/** The poster frame: white keyline around the panels plus a neon gradient pinstripe. */
function drawPosterFrame(ctx, W, H, geometry) {
  const { frame, inner, minDim } = geometry;
  ctx.lineWidth = Math.max(3, minDim * 0.0045);
  ctx.strokeStyle = PANEL_KEYLINE;
  ctx.strokeRect(inner.x, inner.y, inner.w, inner.h);
  const pinstripe = ctx.createLinearGradient(0, 0, W, H);
  pinstripe.addColorStop(0, '#ffd23f');
  pinstripe.addColorStop(0.5, '#ff4fa3');
  pinstripe.addColorStop(1, '#37e6ff');
  ctx.lineWidth = Math.max(2, minDim * 0.003);
  ctx.strokeStyle = pinstripe;
  const inset = frame * 0.42;
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
}

/** Draws the whole cover for `state` onto `canvas` (sized to the export size). */
export function drawCoverArt(canvas, state, options = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const geometry = coverGeometry(W, H);
  const grade = gradeById(state.gradeId);

  const backdrop = ctx.createLinearGradient(0, 0, W, H);
  backdrop.addColorStop(0, '#180b2b');
  backdrop.addColorStop(0.5, POSTER_BACKGROUND);
  backdrop.addColorStop(1, '#1d0b30');
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, W, H);

  const polygons = panelPolygonsFor(state, W, H);
  polygons.forEach((points, i) => drawPanel(ctx, points, state.slots[i], i, grade, state.intensity));
  drawPosterFrame(ctx, W, H, geometry);
  drawCaptionLettering(ctx, W, H, state.caption, geometry);

  if (options.showSelection && polygons[state.selected]) {
    ctx.save();
    tracePolygon(ctx, polygons[state.selected]);
    ctx.setLineDash([16, 10]);
    ctx.lineWidth = Math.max(3, geometry.minDim * 0.004);
    ctx.strokeStyle = SELECTION_COLOUR;
    ctx.stroke();
    ctx.restore();
  }
}
