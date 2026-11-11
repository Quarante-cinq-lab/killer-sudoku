/**
 * Statistiques (section 10) : par niveau, grilles terminées, temps moyen et médian, meilleur temps,
 * part des parties sans indice et série en cours ; puis le temps moyen par mois, en graphique (une
 * courbe par niveau) ou en tableau.
 */
import { useState } from 'react';
import { LEVELS, type Level } from '../../engine/model';
import { TEXTS } from '../../texts/fr';
import { levelStats, monthlyAverages, type HistoryEntry } from '../data/history';
import { formatTime } from '../game/clock';
import { Icon } from '../icons';

const S = TEXTS.stats;

/** Une couleur par niveau, toujours la même (palette validée pour les daltonismes, clair et sombre). */
const LEVEL_COLOR: Record<Level, string> = {
  HARD: 'var(--series-1)',
  EXPERT: 'var(--series-2)',
  DIABOLIQUE: 'var(--series-3)',
  EXTREME: 'var(--series-4)',
  ULTIME: 'var(--series-5)',
};

const monthLabel = (month: string): string =>
  new Date(`${month}-15`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

const timeOrDash = (ms: number | null): string => (ms === null ? S.none : formatTime(ms));

interface Series {
  level: Level;
  points: { month: string; averageMs: number; count: number }[];
}

/** Graphique en courbes : un seul axe (minutes), mois en abscisse, étiquette directe en bout de courbe. */
function MonthlyChart({ series }: { series: readonly Series[] }) {
  const [hover, setHover] = useState<{
    level: Level;
    month: string;
    averageMs: number;
    count: number;
  } | null>(null);
  const months = [...new Set(series.flatMap((s) => s.points.map((p) => p.month)))].sort();
  const maxMin = Math.max(10, ...series.flatMap((s) => s.points.map((p) => p.averageMs / 60_000)));
  const top = Math.ceil(maxMin / 20) * 20; // graduations rondes (quarts de multiples de 20 min)
  const W = 640;
  const H = 260;
  const pad = { left: 52, right: 88, top: 16, bottom: 34 };
  const x = (month: string): number =>
    months.length === 1
      ? (pad.left + W - pad.right) / 2
      : pad.left + (months.indexOf(month) * (W - pad.left - pad.right)) / (months.length - 1);
  const y = (ms: number): number => pad.top + (1 - ms / 60_000 / top) * (H - pad.top - pad.bottom);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f));

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={S.chartTitle}>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y(t * 60_000)}
              y2={y(t * 60_000)}
              className="chart-grid"
            />
            <text x={pad.left - 8} y={y(t * 60_000) + 4} className="chart-axis" textAnchor="end">
              {S.minutes(t)}
            </text>
          </g>
        ))}
        {months.map((m) => (
          <text key={m} x={x(m)} y={H - 10} className="chart-axis" textAnchor="middle">
            {monthLabel(m)}
          </text>
        ))}
        {series.map((s) => {
          const last = s.points[s.points.length - 1];
          return (
            <g key={s.level}>
              <polyline
                points={s.points.map((p) => `${x(p.month)},${y(p.averageMs)}`).join(' ')}
                fill="none"
                stroke={LEVEL_COLOR[s.level]}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {s.points.map((p) => (
                <g key={p.month}>
                  <circle
                    cx={x(p.month)}
                    cy={y(p.averageMs)}
                    r={4}
                    fill={LEVEL_COLOR[s.level]}
                    className="chart-dot"
                  />
                  {/* Zone de toucher plus grande que le point. */}
                  <circle
                    cx={x(p.month)}
                    cy={y(p.averageMs)}
                    r={18}
                    fill="transparent"
                    onPointerEnter={() => setHover({ level: s.level, ...p })}
                    onPointerDown={() => setHover({ level: s.level, ...p })}
                    onPointerLeave={() => setHover(null)}
                  />
                </g>
              ))}
              <text x={x(last.month) + 10} y={y(last.averageMs) + 4} className="chart-label">
                {TEXTS.levels[s.level]}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="chart-tooltip" aria-live="polite">
        {hover
          ? S.tooltip(
              TEXTS.levels[hover.level],
              monthLabel(hover.month),
              Math.round(hover.averageMs / 60_000),
              hover.count,
            )
          : ' '}
      </p>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.level}>
            <i style={{ background: LEVEL_COLOR[s.level] }} />
            {TEXTS.levels[s.level]}
          </span>
        ))}
      </div>
    </div>
  );
}

function MonthlyTable({ series }: { series: readonly Series[] }) {
  const months = [...new Set(series.flatMap((s) => s.points.map((p) => p.month)))].sort();
  return (
    <table className="stats-table">
      <thead>
        <tr>
          <th>{S.month}</th>
          {series.map((s) => (
            <th key={s.level}>{TEXTS.levels[s.level]}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {months.map((m) => (
          <tr key={m}>
            <td>{monthLabel(m)}</td>
            {series.map((s) => {
              const p = s.points.find((q) => q.month === m);
              return <td key={s.level}>{p ? formatTime(p.averageMs) : S.none}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StatsScreen({
  history,
  levels,
  onBack,
}: {
  history: readonly HistoryEntry[];
  /** Niveaux qui ont des grilles dans la banque. */
  levels: readonly Level[];
  onBack: () => void;
}) {
  const [asTable, setAsTable] = useState(false);
  const shown = LEVELS.filter((l) => levels.includes(l));
  const series = shown
    .map((level) => ({ level, points: monthlyAverages(history, level) }))
    .filter((s) => s.points.length > 0);

  return (
    <div className="screen">
      <header className="topbar">
        <button type="button" className="bar-button" onClick={onBack}>
          <Icon name="back" />
          <span>{S.back}</span>
        </button>
        <h1>{S.title}</h1>
        <span className="topbar-spacer" />
      </header>
      <div className="library-scroll">
        <div className="stats-cards">
          {shown.map((level) => {
            const st = levelStats(history, level);
            const rows: [string, string][] = [
              [S.finished, String(st.finished)],
              [S.average, timeOrDash(st.averageMs)],
              [S.median, timeOrDash(st.medianMs)],
              [S.best, timeOrDash(st.bestMs)],
              [S.withoutHint, st.withoutHintPercent === null ? S.none : S.percent(st.withoutHintPercent)],
              [S.streak, String(st.streakWithoutHint)],
            ];
            return (
              <section key={level} className="stats-card">
                <h2>
                  <i style={{ background: LEVEL_COLOR[level] }} />
                  {TEXTS.levels[level]}
                </h2>
                <dl>
                  {rows.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>

        <section className="stats-chart">
          <div className="stats-chart-head">
            <h2>{S.chartTitle}</h2>
            {series.length > 0 && (
              <button type="button" className="chip" onClick={() => setAsTable(!asTable)}>
                {asTable ? S.showChart : S.showTable}
              </button>
            )}
          </div>
          {series.length === 0 ? (
            <p className="panel-help">{S.chartEmpty}</p>
          ) : asTable ? (
            <MonthlyTable series={series} />
          ) : (
            <MonthlyChart series={series} />
          )}
        </section>
      </div>
    </div>
  );
}
