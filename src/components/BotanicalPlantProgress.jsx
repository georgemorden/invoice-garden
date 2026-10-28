import { useEffect, useRef } from "react";
import {
  BOTANICAL_PLANT_DETAIL_ITEMS,
  BOTANICAL_PLANT_GROWTH_ITEMS,
  BOTANICAL_PLANT_STEM_PATH,
  BOTANICAL_PLANT_STEM_LENGTH,
  BOTANICAL_PLANT_VIEWBOX,
  getSafeProgress,
} from "./botanicalPlantProgressGeometry";

const LEAF_BLADES = [
  "M14 -9 C19 -24 38 -35 55 -30 C51 -16 31 -5 14 -9Z",
  "M14 -9 C17 -27 36 -39 53 -34 C55 -20 35 -6 14 -9Z",
  "M14 -9 C22 -26 44 -30 57 -24 C48 -10 30 -4 14 -9Z",
];

function Leaf({ leaf }) {
  return (
    <g
      className={`botanical-plant__leaf botanical-plant__leaf--${leaf.tone} ${leaf.detailAt !== undefined ? "botanical-plant__leaf--detail" : ""}`}
      transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.angle}) scale(${leaf.scale})`}
      style={{ "--leaf-at": leaf.revealAt, "--detail-at": leaf.detailAt, "--leaf-phase": `${-leaf.stemDistance * 8}s` }}
    >
      <g transform={leaf.side === "left" ? "scale(-1 1)" : undefined}>
        <g className="botanical-plant__leaf-breeze">
          <g className="botanical-plant__sprout">
            <path className="botanical-plant__leaf-stem" d="M0 0 Q10 -2 19 -12" />
            <path className="botanical-plant__leaf-blade" d={LEAF_BLADES[leaf.variant]} />
            <path className="botanical-plant__leaf-vein" d="M16 -10 Q31 -17 47 -26" />
          </g>
        </g>
      </g>
    </g>
  );
}

export default function BotanicalPlantProgress({ completedUnits = 0, totalUnits = 1, detailUnits = 0, totalDetailUnits = 17 }) {
  const progress = getSafeProgress(completedUnits, totalUnits);
  const detail = getSafeProgress(detailUnits, totalDetailUnits);
  const plantRef = useRef(null);

  useEffect(() => {
    const node = plantRef.current;
    const observer = typeof IntersectionObserver === "function"
      ? new IntersectionObserver(([entry]) => { node.dataset.inView = String(entry.isIntersecting); })
      : null;
    observer?.observe(node);
    const updateVisibility = () => { node.dataset.pageVisible = String(!document.hidden); };
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  return (
    <div ref={plantRef} className="botanical-plant-progress" style={{ "--plant-progress": progress, "--plant-detail": detail }} data-growth={progress} data-detail={detail}>
      <svg className="botanical-plant-progress__svg" viewBox={BOTANICAL_PLANT_VIEWBOX} preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
        <ellipse className="botanical-plant__shadow" cx="121" cy="348" rx="49" ry="5" />
        <path className="botanical-plant__pot-body" d="M78 294 C81 310 82 329 94 339 C105 346 139 347 151 338 C162 328 163 308 165 292Z" />
        <path className="botanical-plant__pot-rim" d="M76 289 C88 281 147 280 164 287 C172 290 170 299 162 302 C141 308 96 307 79 301 C73 298 72 293 76 289Z" />
        <path className="botanical-plant__soil" d="M84 291 C100 285 143 285 158 291 C145 297 99 298 84 291Z" />
        <g className="botanical-plant__growth">
          <path className="botanical-plant__stem botanical-plant__stem--active" d={BOTANICAL_PLANT_STEM_PATH} style={{ "--stem-length": BOTANICAL_PLANT_STEM_LENGTH }} />
          {BOTANICAL_PLANT_GROWTH_ITEMS.map((leaf) => <Leaf key={leaf.id} leaf={leaf} />)}
          {BOTANICAL_PLANT_DETAIL_ITEMS.map((leaf) => <Leaf key={leaf.id} leaf={leaf} />)}
          <g className="botanical-plant__crown" style={{ offsetPath: `path("${BOTANICAL_PLANT_STEM_PATH}")` }}>
            <g className="botanical-plant__crown-leaves">
              <path className="botanical-plant__leaf-blade" d="M0 0 C-12 -2 -23 -12 -19 -21 C-8 -21 0 -11 0 0Z" />
              <path className="botanical-plant__leaf-blade" d="M0 0 C-5 -9 -2 -25 7 -29 C16 -20 12 -7 0 0Z" />
              <path className="botanical-plant__leaf-vein" d="M0 0 Q4 -10 6 -22 M-1 -1 Q-9 -7 -16 -16" />
            </g>
          </g>
        </g>
        <g className="botanical-plant__pot">
          <path className="botanical-plant__pot-front" d="M79 299 C83 313 83 329 94 339 C105 346 139 347 151 338 C161 327 162 310 165 298 C143 306 100 307 79 299Z" />
          <path className="botanical-plant__pot-lip" d="M76 294 C91 303 146 305 167 294 L165 301 C146 311 96 310 79 302Z" />
          <path className="botanical-plant__pot-highlight" d="M89 310 C91 319 93 329 100 334 M103 315 L105 325" />
          <path className="botanical-plant__pot-contour" d="M148 310 Q146 327 139 336 M93 340 Q113 347 137 342" />
        </g>
      </svg>
    </div>
  );
}
