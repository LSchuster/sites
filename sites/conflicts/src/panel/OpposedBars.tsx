import type { CasualtyRange, Conflict, Side } from '../types.ts';
import { SIDE } from '../theme.ts';
import { useT, useLocale } from '../i18n/index.ts';
import { formatDeaths } from '../i18n/format.ts';
import { localizedSide } from '../data/conflicts.ts';

/**
 * Opposed (population-pyramid) bars for the two belligerents.
 *
 * This is a *diverging* form, not a categorical one: two poles that read as
 * opposition, so it takes the diverging blue↔red pair rather than two categorical
 * hues. Rows are the casualty categories, so military and civilian losses can be
 * compared both between sides (left vs right) and within a side (row vs row) —
 * which is where the real story usually is. In most 20th-century wars the civilian
 * row dwarfs the military one.
 *
 * The whisker under each bar is the low–high range. A war whose estimates vary by
 * a factor of three looks visibly different from one pinned to ±5%, which is the
 * entire point of carrying ranges through the data model.
 */

const W = 336;
const GUTTER = 52; // reserved for the value labels, so bars never collide with them
const ROW_H = 44;
const BAR_H = 16;
const HALF = (W - GUTTER * 2) / 2;

interface Row {
  label: string;
  a: CasualtyRange | undefined;
  b: CasualtyRange | undefined;
}

export function OpposedBars({ conflict }: { conflict: Conflict }): React.JSX.Element | null {
  const t = useT();
  const locale = useLocale();
  const sides = conflict.sides;
  const a = sides[0];
  const b = sides[1];
  if (!a || !b) return null;

  const rows: Row[] = [
    { label: t.panel.military, a: a.military, b: b.military },
    { label: t.panel.civilian, a: a.civilian, b: b.civilian },
  ].filter((r) => r.a || r.b);

  if (!rows.length) return null;

  // One shared scale across every bar, or the comparison means nothing.
  const max = Math.max(
    1,
    ...rows.flatMap((r) => [r.a?.high ?? 0, r.b?.high ?? 0, r.a?.best ?? 0, r.b?.best ?? 0]),
  );
  const scale = (v: number) => (v / max) * HALF;

  const height = rows.length * ROW_H + 20;
  const cx = W / 2;
  const nameA = localizedSide(conflict, 0, locale);
  const nameB = localizedSide(conflict, 1, locale);

  return (
    <div className="bars">
      <div className="bars__legend">
        <span className="bars__legend-item">
          <i className="bars__chip" style={{ background: SIDE.a }} />
          {nameA}
        </span>
        <span className="bars__legend-item">
          <i className="bars__chip" style={{ background: SIDE.b }} />
          {nameB}
        </span>
      </div>

      <svg
        className="bars__svg"
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        role="img"
        aria-label={`${t.panel.casualtiesBySide}: ${nameA} / ${nameB}`}
      >
        {rows.map((row, i) => {
          const y = 20 + i * ROW_H;
          return (
            <g key={row.label}>
              <text className="bars__row-label" x={cx} y={y - 9} textAnchor="middle">
                {row.label}
              </text>

              {/* Side A — grows left from the spine. */}
              {row.a && (
                <Bar
                  x={cx - 1 - scale(row.a.best)}
                  y={y}
                  width={scale(row.a.best)}
                  range={row.a}
                  scale={scale}
                  cx={cx}
                  dir={-1}
                  color={SIDE.a}
                />
              )}
              {row.a && (
                <text className="bars__value" x={GUTTER - 8} y={y + BAR_H - 3} textAnchor="end">
                  {formatDeaths(row.a.best, t)}
                </text>
              )}

              {/* Side B — grows right. */}
              {row.b && (
                <Bar
                  x={cx + 1}
                  y={y}
                  width={scale(row.b.best)}
                  range={row.b}
                  scale={scale}
                  cx={cx}
                  dir={1}
                  color={SIDE.b}
                />
              )}
              {row.b && (
                <text className="bars__value" x={W - GUTTER + 8} y={y + BAR_H - 3}>
                  {formatDeaths(row.b.best, t)}
                </text>
              )}
            </g>
          );
        })}

        {/* The spine. */}
        <line className="bars__spine" x1={cx} y1={12} x2={cx} y2={height - 8} />
      </svg>

      <p className="bars__note">{t.panel.barsNote}</p>
    </div>
  );
}

function Bar({
  x,
  y,
  width,
  range,
  scale,
  cx,
  dir,
  color,
}: {
  x: number;
  y: number;
  width: number;
  range: CasualtyRange;
  scale: (v: number) => number;
  cx: number;
  dir: 1 | -1;
  color: string;
}): React.JSX.Element {
  const lo = scale(range.low);
  const hi = scale(range.high);
  const whiskerY = y + BAR_H + 4;
  // Anchored at the spine, so the rounded end is always the data end.
  const x1 = cx + dir * (1 + lo);
  const x2 = cx + dir * (1 + hi);

  return (
    <>
      <rect x={x} y={y} width={Math.max(width, 1)} height={BAR_H} rx={3} fill={color} fillOpacity={0.85} />
      {range.high > range.low && (
        <g className="bars__whisker" stroke={color}>
          <line x1={x1} y1={whiskerY} x2={x2} y2={whiskerY} strokeWidth={1} opacity={0.75} />
          <line x1={x1} y1={whiskerY - 2.5} x2={x1} y2={whiskerY + 2.5} strokeWidth={1} opacity={0.75} />
          <line x1={x2} y1={whiskerY - 2.5} x2={x2} y2={whiskerY + 2.5} strokeWidth={1} opacity={0.75} />
        </g>
      )}
    </>
  );
}

/** Sides beyond the first two — usually "civilian population" — as plain bars. */
export function ExtraSides({ conflict }: { conflict: Conflict }): React.JSX.Element | null {
  const t = useT();
  const locale = useLocale();
  const extra = conflict.sides.slice(2);
  if (!extra.length) return null;

  const value = (s: Side) => (s.military?.best ?? 0) + (s.civilian?.best ?? 0);
  const max = Math.max(1, ...extra.map(value));

  return (
    <div className="extra">
      {extra.map((side, i) => {
        const v = value(side);
        return (
          <div className="extra__row" key={side.name}>
            <div className="extra__head">
              <span className="extra__name">{localizedSide(conflict, i + 2, locale)}</span>
              <span className="extra__value">{formatDeaths(v, t)}</span>
            </div>
            <div className="extra__track">
              <div
                className="extra__fill"
                style={{ width: `${(v / max) * 100}%`, background: SIDE.civilian }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
