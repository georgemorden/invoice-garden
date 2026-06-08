import {
  BOTANICAL_PLANT_GROWTH_ITEMS,
  BOTANICAL_PLANT_STEM_PATH,
  BOTANICAL_PLANT_VIEWBOX,
} from "./botanicalPlantProgressGeometry";

function getSafeProgress(completedUnits, totalUnits) {
  if (!Number.isFinite(completedUnits) || !Number.isFinite(totalUnits) || totalUnits <= 0) {
    return 0;
  }
  const progress = completedUnits / totalUnits;
  return Math.max(0, Math.min(1, progress));
}

function getVisibleItemCount(progress) {
  if (!Number.isFinite(progress) || progress <= 0) {
    return 0;
  }

  return Math.min(BOTANICAL_PLANT_GROWTH_ITEMS.length, Math.floor(progress * BOTANICAL_PLANT_GROWTH_ITEMS.length));
}

function Leaf({ leaf, isVisible }) {
  return (
    <g
      className={`botanical-plant__leaf ${isVisible ? "is-visible" : ""}`}
      transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.angle}) scale(${leaf.scale})`}
      style={{ "--plant-delay": isVisible ? `${leaf.delay}ms` : "0ms" }}
    >
      <g className="botanical-plant__leaf-side" transform={leaf.side === "left" ? "scale(-1 1)" : undefined}>
        <g className="botanical-plant__sprout">
          <path className="botanical-plant__leaf-stem" d="M0 0 C7 -2 12 -7 18 -12" />
          <path
            className="botanical-plant__leaf-blade"
            d="M15 -12 C23 -24 37 -24 45 -16 C36 -9 25 -8 15 -12Z"
          />
          <path className="botanical-plant__leaf-vein" d="M18 -12 C26 -15 34 -15 42 -16" />
        </g>
      </g>
    </g>
  );
}

function Bud({ bud, isVisible }) {
  return (
    <g
      className={`botanical-plant__bud ${isVisible ? "is-visible" : ""}`}
      transform={`translate(${bud.x} ${bud.y}) rotate(${bud.angle}) scale(${bud.scale})`}
      style={{ "--plant-delay": isVisible ? `${bud.delay}ms` : "0ms" }}
    >
      <g className="botanical-plant__leaf-side" transform={bud.side === "left" ? "scale(-1 1)" : undefined}>
        <g className="botanical-plant__sprout">
          <path className="botanical-plant__bud-stem" d="M0 0 C6 -3 9 -7 12 -12" />
          <ellipse className="botanical-plant__bud-dot" cx="14" cy="-14" rx="4.1" ry="5.2" />
        </g>
      </g>
    </g>
  );
}

export default function BotanicalPlantProgress({ completedUnits = 0, totalUnits = 1 }) {
  const safeProgress = getSafeProgress(completedUnits, totalUnits);
  const visibleItemCount = getVisibleItemCount(safeProgress);
  const stemProgress = safeProgress;
  const stemOffset = 1 - stemProgress;

  return (
    <div className="botanical-plant-progress">
      <svg
        className="botanical-plant-progress__svg"
        viewBox={BOTANICAL_PLANT_VIEWBOX}
        preserveAspectRatio="xMidYMax meet"
        aria-hidden="true"
        focusable="false"
      >
        <ellipse className="botanical-plant__shadow" cx="120" cy="349" rx="63" ry="9" />

        <g className={`botanical-plant__seedling ${stemProgress > 0 ? "is-hidden" : ""}`}>
          <path className="botanical-plant__seedling-stem" d="M120 298 C119 289 121 282 124 276" />
          <path className="botanical-plant__seedling-leaf" d="M123 278 C129 269 139 268 145 275 C138 282 129 282 123 278Z" />
          <path className="botanical-plant__seedling-leaf botanical-plant__seedling-leaf--left" d="M121 286 C115 278 106 278 101 284 C107 291 115 291 121 286Z" />
        </g>

        <g className="botanical-plant__growth">
          <path
            className="botanical-plant__stem botanical-plant__stem--active"
            d={BOTANICAL_PLANT_STEM_PATH}
            pathLength="1"
            style={{
              opacity: stemProgress > 0 ? 1 : 0,
              strokeDasharray: 1,
              strokeDashoffset: stemOffset,
            }}
          />

          {BOTANICAL_PLANT_GROWTH_ITEMS.map((item, index) =>
            item.type === "bud" ? (
              <Bud key={item.id} bud={item} isVisible={index < visibleItemCount} />
            ) : (
              <Leaf key={item.id} leaf={item} isVisible={index < visibleItemCount} />
            ),
          )}
        </g>

        <g className="botanical-plant__pot">
          <path className="botanical-plant__pot-body" d="M74 298 H166 C163 322 154 342 143 344 H97 C86 342 77 322 74 298Z" />
          <rect className="botanical-plant__pot-rim" x="63" y="285" width="114" height="24" rx="12" />
          <path className="botanical-plant__pot-highlight" d="M91 311 C94 323 99 333 107 338" />
        </g>
      </svg>
    </div>
  );
}
