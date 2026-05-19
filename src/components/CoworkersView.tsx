import { useState } from 'react';
import type {
  CoworkerHit,
  CoworkersByDay,
  MatchKind,
  ShiftSegment,
} from '../utils/coworkers';

interface Props {
  groups: CoworkersByDay[];
}

const MATCH_LABEL: Record<MatchKind, string> = {
  sameShift: 'Mismo turno',
  sameEnd: 'Misma salida',
  overlap: 'Solapa',
};

const MATCH_STYLE: Record<MatchKind, string> = {
  sameShift: 'bg-emerald-600 text-white',
  sameEnd: 'bg-emerald-100 text-emerald-800',
  overlap: 'bg-gray-200 text-gray-700',
};

function formatSegments(segs: ShiftSegment[]): string {
  return segs.map((s) => `${s.start} – ${s.end}`).join(' · ');
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 2) return full;
  return `${parts[0]} ${parts[1]}`;
}

export function CoworkersView({ groups }: Props) {
  const [open, setOpen] = useState(false);
  const workDays = groups.filter((g) => g.mySegments.length > 0);
  if (workDays.length === 0) return null;

  const totalHits = workDays.reduce((sum, g) => sum + g.hits.length, 0);

  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-2 px-5 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left text-base font-semibold text-gray-900 hover:text-emerald-700"
          aria-expanded={open}
        >
          <Chevron open={open} />
          <span>
            Compañeros por día{' '}
            <span className="text-gray-500 font-normal">({totalHits})</span>
          </span>
        </button>
      </header>

      {open && (
        <div className="space-y-4 px-5 pb-5">
          <p className="text-xs text-gray-500">
            Mismo turno, misma salida o solape de horas.
          </p>
          {workDays.map((g) => (
            <DayGroup key={`${g.dayName}-${g.date}`} group={g} />
          ))}
        </div>
      )}
    </section>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function DayGroup({ group }: { group: CoworkersByDay }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-800">
          {group.dayName}
          {group.date && <span className="ml-2 font-normal text-gray-500">{group.date}</span>}
        </h3>
        <span className="font-mono text-xs text-gray-600">{formatSegments(group.mySegments)}</span>
      </div>
      {group.hits.length === 0 ? (
        <p className="text-xs italic text-gray-500">
          Nadie con misma salida ni solape este día.
        </p>
      ) : (
        <ul className="space-y-1">
          {group.hits.map((hit) => (
            <CoworkerRow key={`${hit.name}-${hit.match}`} hit={hit} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CoworkerRow({ hit }: { hit: CoworkerHit }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate" title={hit.name}>
          {shortName(hit.name)}
        </p>
        <p className="font-mono text-[11px] text-gray-600">{formatSegments(hit.segments)}</p>
      </div>
      <span
        className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${MATCH_STYLE[hit.match]}`}
      >
        {MATCH_LABEL[hit.match]}
      </span>
    </li>
  );
}