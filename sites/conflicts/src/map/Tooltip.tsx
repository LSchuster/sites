import { useAtlas } from '../state/store.ts';
import { getById, localized } from '../data/conflicts.ts';
import { useLocale, useT } from '../i18n/index.ts';
import { formatDeaths, formatYears } from '../i18n/format.ts';

/** Keep the tooltip on-page near the right and bottom edges. */
function placement(pos: [number, number]): React.CSSProperties {
  const flipX = pos[0] > window.innerWidth - 300;
  const flipY = pos[1] > window.innerHeight - 260;
  return {
    left: pos[0],
    top: pos[1],
    transform: `translate(${flipX ? 'calc(-100% - 14px)' : '14px'}, ${flipY ? 'calc(-100% + 10px)' : '-50%'})`,
  };
}

export function Tooltip(): React.JSX.Element | null {
  const hoveredId = useAtlas((s) => s.hoveredId);
  const battle = useAtlas((s) => s.hoveredBattle);
  const pos = useAtlas((s) => s.hoverPos);
  const t = useT();
  const locale = useLocale();
  const conflict = getById(hoveredId);
  if (!pos) return null;

  if (conflict) {
    return (
      <div className="tooltip" style={placement(pos)} role="tooltip" aria-live="polite">
        <div className="tooltip__name">{localized(conflict, locale).name}</div>
        <div className="tooltip__row">
          <span className="tooltip__years">
            {formatYears(conflict.startYear, conflict.endYear, t)}
          </span>
          <span className="tooltip__deaths">
            {formatDeaths(conflict.total.best, t)} {t.panel.deathsShort}
          </span>
        </div>
      </div>
    );
  }

  // The battle name arrives already localized — src/data/battles.ts stamps the
  // active locale's Wikidata labels onto the dots, English where none exists.
  // No deaths line: the field is 0 for most Wikidata battles.
  if (battle) {
    return (
      <div className="tooltip" style={placement(pos)} role="tooltip" aria-live="polite">
        <div className="tooltip__name">{battle.name}</div>
        <div className="tooltip__row">
          <span className="tooltip__years">{formatYears(battle.year, battle.year, t)}</span>
        </div>
      </div>
    );
  }

  return null;
}
