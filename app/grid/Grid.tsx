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

/** Marques ajoutées par les aides et l'indice (chaque ensemble peut être vide). */
export interface GridMarks {
  /** Ligne, colonne et bloc de la case sélectionnée. */
  units: ReadonlySet<number>;
  /** Cases qui contiennent le chiffre de la case sélectionnée. */
  sameDigit: ReadonlySet<number>;
  /** Cases en conflit (doublon ou somme impossible). */
  conflicts: ReadonlySet<number>;
  /** Chiffres faux trouvés par la vérification. */
  wrong: ReadonlySet<number>;
  /** Cases utilisées par l'indice en cours. */
  hint: ReadonlySet<number>;
  virtualCages: readonly { id: number; sum: number; cells: readonly number[] }[];
}

const VIRTUAL_INSET = 15;

interface Props {
  puzzle: Puzzle;
  marks: GridMarks;
  values: readonly number[];
  notes: readonly (readonly number[])[];
  selection: readonly number[];
  /** Dernière case touchée : sa cage est surlignée. */
  focus: number | null;
  /** Grille masquée (pause) : seules les cages restent visibles. */
  hidden: boolean;
  /** Notes en ligne (ordre de saisie) ou en grille 3 × 3 (réglage, section 7.2). */
  notesLayout?: 'inline' | 'grid';
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

/** Notes en grille 3 × 3 (réglage) : chaque chiffre a sa place fixe, du 1 en haut à gauche au 9. */
function GridNotes({ cell, notes }: { cell: number; notes: readonly number[] }) {
  const left = colOf(cell) * CELL;
  const top = rowOf(cell) * CELL;
  return (
    <>
      {notes.map((d) => (
        <text
          key={d}
          x={left + 27 + ((d - 1) % 3) * 25}
          y={top + 42 + Math.floor((d - 1) / 3) * 23}
          fontSize={19}
          className="note"
          textAnchor="middle"
        >
          {d}
        </text>
      ))}
    </>
  );
}

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

/** Un carré de fond par case, avec la classe CSS donnée. */
function CellRects({
  cells,
  className,
  prefix,
}: {
  cells: Iterable<number>;
  className: string;
  prefix: string;
}) {
  return (
    <>
      {[...cells].map((cell) => (
        <rect
          key={prefix + cell}
          x={colOf(cell) * CELL}
          y={rowOf(cell) * CELL}
          width={CELL}
          height={CELL}
          className={className}
        />
      ))}
    </>
  );
}

/** Cages virtuelles : pointillé d'une autre couleur, tracé plus à l'intérieur, somme en bas à gauche. */
function VirtualCages({ cages }: { cages: GridMarks['virtualCages'] }) {
  return (
    <>
      {cages.map((cage) => {
        const path = segmentsPath(
          cageSegments({ cages: [{ sum: cage.sum, cells: [...cage.cells] }] }, 0, VIRTUAL_INSET),
        );
        const anchor = Math.min(...cage.cells);
        const x = colOf(anchor) * CELL;
        const y = rowOf(anchor) * CELL;
        const width = String(cage.sum).length * SUM_FONT * 0.6 + 6;
        return (
          <g key={cage.id}>
            <path d={path} className="virtual-cage-line" />
            <rect
              x={x + VIRTUAL_INSET + 2}
              y={y + CELL - VIRTUAL_INSET - SUM_FONT - 3}
              width={width}
              height={SUM_FONT + 2}
              className="virtual-sum-bg"
            />
            <text
              x={x + VIRTUAL_INSET + 5}
              y={y + CELL - VIRTUAL_INSET - 5}
              fontSize={SUM_FONT}
              className="virtual-sum"
            >
              {cage.sum}
            </text>
          </g>
        );
      })}
    </>
  );
}

export function Grid({
  puzzle,
  marks,
  values,
  notes,
  selection,
  focus,
  hidden,
  notesLayout,
  onSelect,
}: Props) {
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
      {!hidden && (
        <>
          <CellRects cells={marks.units} className="unit-highlight" prefix="u" />
          {focusCage >= 0 && (
            <CellRects cells={puzzle.cages[focusCage].cells} className="cage-highlight" prefix="c" />
          )}
          <CellRects cells={marks.sameDigit} className="same-digit" prefix="d" />
          <CellRects cells={marks.hint} className="hint-highlight" prefix="h" />
          <CellRects cells={selection} className="selected-fill" prefix="s" />
          <CellRects cells={marks.conflicts} className="conflict-fill" prefix="x" />
          <CellRects cells={marks.wrong} className="wrong-fill" prefix="w" />
        </>
      )}
      <Frame puzzle={puzzle} />
      {!hidden && <VirtualCages cages={marks.virtualCages} />}
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
              className={marks.wrong.has(cell) || marks.conflicts.has(cell) ? 'digit error' : 'digit'}
            >
              {value}
            </text>
          ) : notes[cell].length > 0 ? (
            notesLayout === 'grid' ? (
              <GridNotes key={`n${cell}`} cell={cell} notes={notes[cell]} />
            ) : (
              <Notes key={`n${cell}`} cell={cell} notes={notes[cell]} />
            )
          ) : null,
        )}
    </svg>
  );
}
