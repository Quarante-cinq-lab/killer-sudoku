/**
 * La grille de jeu, dessinée en SVG (net à toutes les tailles). Un toucher sélectionne une case ;
 * un glissé du doigt ou de l'Apple Pencil en sélectionne plusieurs.
 */
import { memo, useMemo, useRef } from 'react';
import { cageAnchor, cageIndexByCell, colOf, rowOf, type Puzzle } from '../../engine/model';
import { CELL, GRID, cageSegments, cellAtPoint, cellNearPoint, segmentsPath } from './geometry';

/** Retrait du liseré des cages et taille des textes, en unités de la grille (une case = 100). */
const CAGE_INSET = 7;
const SUM_FONT = 19;
const DIGIT_FONT = 60;
const NOTE_FONT = 24;

interface Props {
  puzzle: Puzzle;
  values: readonly number[];
  notes: readonly (readonly number[])[];
  selection: readonly number[];
  /** Dernière case touchée : sa cage est surlignée. */
  focus: number | null;
  /** Grille masquée (pause) : seules les cages restent visibles. */
  hidden: boolean;
  onSelect: (cells: number[], focus: number) => void;
}

/** Partie fixe de la grille (traits, cages, sommes) : calculée une seule fois par grille. */
const Frame = memo(function Frame({ puzzle }: { puzzle: Puzzle }) {
  const cages = useMemo(
    () =>
      puzzle.cages.map((cage, i) => ({
        path: segmentsPath(cageSegments(puzzle, i, CAGE_INSET)),
        anchor: cageAnchor(cage),
        sum: cage.sum,
      })),
    [puzzle],
  );
  const lines = [1, 2, 4, 5, 7, 8].map((i) => i * CELL);
  const thick = [0, 3, 6, 9].map((i) => i * CELL);
  return (
    <g>
      {lines.map((p) => (
        <g key={p} className="grid-thin">
          <line x1={p} y1={0} x2={p} y2={GRID} />
          <line x1={0} y1={p} x2={GRID} y2={p} />
        </g>
      ))}
      {cages.map((c) => (
        <path key={c.anchor} d={c.path} className="cage-line" />
      ))}
      {thick.map((p) => (
        <g key={p} className="grid-thick">
          <line x1={p} y1={0} x2={p} y2={GRID} />
          <line x1={0} y1={p} x2={GRID} y2={p} />
        </g>
      ))}
      {cages.map((c) => {
        const x = colOf(c.anchor) * CELL;
        const y = rowOf(c.anchor) * CELL;
        const width = String(c.sum).length * SUM_FONT * 0.6 + 6;
        return (
          <g key={c.anchor} className="cage-sum">
            <rect x={x + 3} y={y + 3} width={width} height={SUM_FONT + 3} />
            <text x={x + 6} y={y + 3 + SUM_FONT - 2} fontSize={SUM_FONT}>
              {c.sum}
            </text>
          </g>
        );
      })}
    </g>
  );
});

function Notes({ cell, notes }: { cell: number; notes: readonly number[] }) {
  const x = (colOf(cell) + 0.5) * CELL;
  const top = rowOf(cell) * CELL;
  // Notes en ligne, dans l'ordre de saisie : une ligne jusqu'à 5 notes, deux au-delà.
  const lines = notes.length <= 5 ? [notes] : [notes.slice(0, 5), notes.slice(5)];
  const baselines = lines.length === 1 ? [top + 62] : [top + 54, top + 80];
  return (
    <>
      {lines.map((line, i) => (
        <text key={i} x={x} y={baselines[i]} fontSize={NOTE_FONT} className="note" textAnchor="middle">
          {line.join('')}
        </text>
      ))}
    </>
  );
}

export function Grid({ puzzle, values, notes, selection, focus, hidden, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<number[] | null>(null);
  const owner = useMemo(() => cageIndexByCell(puzzle), [puzzle]);

  /** Convertit la position du doigt en coordonnées de la grille. */
  const toGrid = (event: React.PointerEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (hidden) return;
    const p = toGrid(event);
    const cell = p ? cellAtPoint(p.x, p.y) : -1;
    if (cell < 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = [cell];
    onSelect([cell], cell);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const cells = drag.current;
    const p = cells ? toGrid(event) : null;
    if (!cells || !p) return;
    const cell = cellNearPoint(p.x, p.y);
    if (cell < 0 || cells.includes(cell)) return;
    cells.push(cell);
    onSelect([...cells], cell);
  };

  const endDrag = () => {
    drag.current = null;
  };

  const focusCage = focus === null ? -1 : owner[focus];
  return (
    <svg
      ref={svgRef}
      className="grid"
      viewBox={`-4 -4 ${GRID + 8} ${GRID + 8}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <rect x={0} y={0} width={GRID} height={GRID} className="grid-bg" />
      {!hidden &&
        focusCage >= 0 &&
        puzzle.cages[focusCage].cells.map((cell) => (
          <rect
            key={`c${cell}`}
            x={colOf(cell) * CELL}
            y={rowOf(cell) * CELL}
            width={CELL}
            height={CELL}
            className="cage-highlight"
          />
        ))}
      {!hidden &&
        selection.map((cell) => (
          <rect
            key={`s${cell}`}
            x={colOf(cell) * CELL}
            y={rowOf(cell) * CELL}
            width={CELL}
            height={CELL}
            className="selected-fill"
          />
        ))}
      <Frame puzzle={puzzle} />
      {!hidden &&
        selection.map((cell) => (
          <rect
            key={`b${cell}`}
            x={colOf(cell) * CELL + 4}
            y={rowOf(cell) * CELL + 4}
            width={CELL - 8}
            height={CELL - 8}
            rx={6}
            className="selected-border"
          />
        ))}
      {!hidden &&
        values.map((value, cell) =>
          value ? (
            <text
              key={`v${cell}`}
              x={(colOf(cell) + 0.5) * CELL}
              y={(rowOf(cell) + 0.5) * CELL + DIGIT_FONT * 0.36}
              fontSize={DIGIT_FONT}
              textAnchor="middle"
              className="digit"
            >
              {value}
            </text>
          ) : notes[cell].length > 0 ? (
            <Notes key={`n${cell}`} cell={cell} notes={notes[cell]} />
          ) : null,
        )}
    </svg>
  );
}
