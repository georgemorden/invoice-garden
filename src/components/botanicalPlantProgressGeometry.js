export const BOTANICAL_PLANT_VIEWBOX = "0 0 240 360";

const STEM_NODES = [
  { x: 120, y: 300 },
  { x: 117, y: 260 },
  { x: 123, y: 218 },
  { x: 119, y: 177 },
  { x: 125, y: 135 },
  { x: 120, y: 94 },
  { x: 126, y: 52 },
];

export const BOTANICAL_PLANT_STEM_PATH = STEM_NODES.reduce((path, node, index) => {
  if (index === 0) return `M${node.x} ${node.y}`;
  const previous = STEM_NODES[index - 1];
  return `${path} C${previous.x} ${previous.y - 14} ${node.x} ${node.y + 14} ${node.x} ${node.y}`;
}, "");

// Sample the same curve we draw: attachments and reveal thresholds share one
// distance along the stem, so leaves cannot appear ahead of a growing stem.
const stemSamples = [{ ...STEM_NODES[0], distance: 0 }];
for (let index = 1; index < STEM_NODES.length; index += 1) {
  const start = STEM_NODES[index - 1];
  const end = STEM_NODES[index];
  for (let step = 1; step <= 32; step += 1) {
    const t = step / 32;
    const inverse = 1 - t;
    const x = inverse ** 3 * start.x + 3 * inverse ** 2 * t * start.x + 3 * inverse * t ** 2 * end.x + t ** 3 * end.x;
    const y = inverse ** 3 * start.y + 3 * inverse ** 2 * t * (start.y - 14) + 3 * inverse * t ** 2 * (end.y + 14) + t ** 3 * end.y;
    const previous = stemSamples[stemSamples.length - 1];
    stemSamples.push({ x, y, distance: previous.distance + Math.hypot(x - previous.x, y - previous.y) });
  }
}
const stemLength = stemSamples[stemSamples.length - 1].distance;
export const BOTANICAL_PLANT_STEM_LENGTH = stemLength;

function pointOnStem(fraction) {
  const distance = fraction * stemLength;
  const index = stemSamples.findIndex((point) => point.distance >= distance);
  const end = stemSamples[index];
  const start = stemSamples[Math.max(0, index - 1)];
  const ratio = (distance - start.distance) / (end.distance - start.distance || 1);
  return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
}

export function getSafeProgress(completedUnits, totalUnits) {
  if (!Number.isFinite(completedUnits) || !Number.isFinite(totalUnits) || totalUnits <= 0) return 0;
  return Math.max(0, Math.min(1, completedUnits / totalUnits));
}

const LEAVES = [
  { distance: 0.07, side: "left", scale: 0.3, angle: -8, seed: true },
  { distance: 0.085, side: "right", scale: 0.34, angle: 12, seed: true },
  { distance: 0.22, side: "left", scale: 0.62, angle: -15 },
  { distance: 0.29, side: "right", scale: 0.72, angle: 8 },
  { distance: 0.4, side: "left", scale: 0.94, angle: -5 },
  { distance: 0.49, side: "right", scale: 0.84, angle: 18 },
  { distance: 0.59, side: "left", scale: 0.88, angle: -16 },
  { distance: 0.68, side: "right", scale: 0.76, angle: 4 },
  { distance: 0.78, side: "left", scale: 0.66, angle: -9 },
  { distance: 0.85, side: "right", scale: 0.58, angle: 21 },
];

function createLeaf(leaf, index, detail = false) {
  return {
    id: `${detail ? "detail" : "leaf"}-${index}`,
    ...leaf,
    ...pointOnStem(leaf.distance),
    stemDistance: leaf.distance,
    revealAt: leaf.seed ? -0.14 : (leaf.distance - 0.1) / 0.9,
    tone: index % 3 === 0 ? "soft" : "deep",
    variant: index % 3,
    detailAt: detail ? index / 17 : undefined,
  };
}

export const BOTANICAL_PLANT_GROWTH_ITEMS = LEAVES.map((leaf, index) => createLeaf(leaf, index));

export const BOTANICAL_PLANT_DETAIL_ITEMS = Array.from({ length: 17 }, (_, index) => {
  const distance = 0.16 + index * 0.041;
  return createLeaf({
    distance,
    side: index % 2 ? "left" : "right",
    scale: 0.32 + (index % 3) * 0.065,
    angle: index % 2 ? 18 : -24,
  }, index, true);
});
