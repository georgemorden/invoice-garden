export const BOTANICAL_PLANT_VIEWBOX = "0 0 240 360";

export const BOTANICAL_PLANT_STEM_PATH =
  "M120 301 C119 282 122 263 121 244 C120 224 116 207 118 188 C120 168 126 152 124 132 C122 112 126 94 130 76 C134 58 133 43 130 29";

export const BOTANICAL_PLANT_GROWTH_ITEMS = [
  { type: "bud", id: "soil-bud-left", x: 120, y: 287, side: "left", angle: -10, scale: 0.3, delay: 20 },
  { type: "leaf", id: "base-left", x: 120, y: 274, side: "left", angle: -2, scale: 0.48, delay: 35 },
  { type: "leaf", id: "base-right", x: 121, y: 260, side: "right", angle: -22, scale: 0.5, delay: 75 },
  { type: "bud", id: "bud-base", x: 121, y: 244, side: "right", angle: 10, scale: 0.38, delay: 130 },

  { type: "bud", id: "lower-node-left", x: 119, y: 229, side: "left", angle: -18, scale: 0.32, delay: 15 },
  { type: "leaf", id: "lower-left", x: 118, y: 222, side: "left", angle: -12, scale: 0.56, delay: 35 },
  { type: "leaf", id: "lower-right", x: 117, y: 204, side: "right", angle: -25, scale: 0.6, delay: 80 },
  { type: "bud", id: "bud-low", x: 118, y: 190, side: "left", angle: 22, scale: 0.4, delay: 145 },

  { type: "bud", id: "mid-node-right", x: 121, y: 175, side: "right", angle: 8, scale: 0.32, delay: 20 },
  { type: "leaf", id: "middle-left", x: 122, y: 167, side: "left", angle: -10, scale: 0.64, delay: 40 },
  { type: "leaf", id: "middle-right", x: 125, y: 150, side: "right", angle: -25, scale: 0.66, delay: 90 },
  { type: "bud", id: "bud-mid", x: 125, y: 135, side: "right", angle: 16, scale: 0.42, delay: 150 },

  { type: "bud", id: "upper-node-left", x: 123, y: 122, side: "left", angle: -10, scale: 0.3, delay: 20 },
  { type: "leaf", id: "upper-left", x: 123, y: 116, side: "left", angle: -17, scale: 0.64, delay: 40 },
  { type: "leaf", id: "upper-right", x: 126, y: 97, side: "right", angle: -29, scale: 0.68, delay: 85 },
  { type: "leaf", id: "upper-small", x: 128, y: 84, side: "left", angle: 16, scale: 0.42, delay: 130 },
  { type: "bud", id: "bud-upper", x: 130, y: 74, side: "left", angle: 25, scale: 0.42, delay: 145 },

  { type: "bud", id: "crown-node-right", x: 131, y: 63, side: "right", angle: -18, scale: 0.3, delay: 20 },
  { type: "leaf", id: "crown-left", x: 132, y: 57, side: "left", angle: -20, scale: 0.58, delay: 35 },
  { type: "leaf", id: "crown-right", x: 132, y: 42, side: "right", angle: -36, scale: 0.68, delay: 80 },
  { type: "bud", id: "bud-crown", x: 131, y: 33, side: "right", angle: -22, scale: 0.38, delay: 125 },
  { type: "bud", id: "tip-bud", x: 130, y: 29, side: "right", angle: -30, scale: 0.26, delay: 150 },
];
