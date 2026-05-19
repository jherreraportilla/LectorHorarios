import { useState } from 'react';
import type { HistoryEntry } from '../utils/historyStore';

interface Props {
  entries: HistoryEntry[];
  onOpen: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
  onClear: () => void;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryList({ entries, onOpen, onDelete, onClear }: Props) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-2 px-5 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-base font-semibold text-gray-900 hover:text-emerald-700"
          aria-expanded={open}
        >
          <Chevron open={open} />
          Historial <span className="text-gray-500 font-normal">({entries.length})</span>
        </button>
        {open && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-red-600 hover:text-red-700"
          >
            Vaciar
          </button>
        )}
      </header>

      {open && (
        <div className="space-y-3 px-5 pb-5">
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center gap-3 rounded-lg border border-gray-100 p-2 hover:border-emerald-200 hover:bg-emerald-50/40 transition-colors"
          >
            <button
              type="button"
              onClick={() => onOpen(entry)}
              className="flex flex-1 items-center gap-3 text-left min-w-0"
            >
              <img
                src={entry.thumbnail}
                alt=""
                className="h-14 w-14 rounded-md border border-gray-200 object-cover bg-gray-50 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 truncate">{entry.employeeName}</p>
                <p className="text-xs text-gray-600 truncate">
                  {entry.weekRange || entry.fileName}
                </p>
                <p className="text-[11px] text-gray-400">
                  {formatTimestamp(entry.createdAt)} ·{' '}
                  {entry.source === 'pdf' ? 'PDF' : 'Imagen'}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onDelete(entry)}
              aria-label="Eliminar entrada"
              className="shrink-0 rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
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
