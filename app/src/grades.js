// Colour grades: a canvas filter for the photo plus a gradient overlay wash.
// `filter` maps strength t (0..1) to a CSS filter string; t = 0 is the plain photo.

function mix(from, to, t) {
  return from + (to - from) * t;
}

export const GRADES = [
  {
    id: 'sunset-vice',
    name: 'Sunset Vice',
    filter: (t) =>
      `saturate(${mix(1, 1.45, t)}) contrast(${mix(1, 1.14, t)}) brightness(${mix(1, 1.03, t)}) hue-rotate(${mix(0, -10, t)}deg)`,
    wash: ['rgba(255, 138, 61, 0.55)', 'rgba(255, 47, 150, 0.55)'],
    washAlpha: 0.5,
    vignette: 0.38,
  },
  {
    id: 'neon-nights',
    name: 'Neon Nights',
    filter: (t) =>
      `saturate(${mix(1, 1.6, t)}) contrast(${mix(1, 1.2, t)}) brightness(${mix(1, 1.02, t)}) hue-rotate(${mix(0, 14, t)}deg)`,
    wash: ['rgba(55, 230, 255, 0.5)', 'rgba(255, 47, 214, 0.55)'],
    washAlpha: 0.55,
    vignette: 0.42,
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    filter: (t) =>
      `saturate(${mix(1, 1.3, t)}) contrast(${mix(1, 1.06, t)}) brightness(${mix(1, 1.06, t)}) sepia(${mix(0, 0.28, t)})`,
    wash: ['rgba(255, 190, 80, 0.5)', 'rgba(255, 110, 60, 0.45)'],
    washAlpha: 0.42,
    vignette: 0.3,
  },
  {
    id: 'midnight-drive',
    name: 'Midnight Drive',
    filter: (t) =>
      `saturate(${mix(1, 1.15, t)}) contrast(${mix(1, 1.18, t)}) brightness(${mix(1, 0.92, t)}) hue-rotate(${mix(0, -20, t)}deg)`,
    wash: ['rgba(0, 180, 200, 0.5)', 'rgba(90, 40, 180, 0.55)'],
    washAlpha: 0.5,
    vignette: 0.5,
  },
  {
    id: 'noir',
    name: 'Noir Mono',
    filter: (t) =>
      `grayscale(${mix(0, 1, t)}) contrast(${mix(1, 1.38, t)}) brightness(${mix(1, 1.03, t)})`,
    wash: ['rgba(20, 20, 30, 0.25)', 'rgba(0, 0, 0, 0.35)'],
    washAlpha: 0.35,
    vignette: 0.55,
  },
];

/** Finds a grade by id, falling back to the first grade. */
export function gradeById(id) {
  return GRADES.find((grade) => grade.id === id) ?? GRADES[0];
}
