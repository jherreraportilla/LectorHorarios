import { useEffect, useState } from 'react';
import { CoworkersView } from './components/CoworkersView';
import { DebugDump } from './components/DebugDump';
import { EmployeeSearch } from './components/EmployeeSearch';
import { HistoryList } from './components/HistoryList';
import { IosInstallHint } from './components/IosInstallHint';
import { ScheduleView } from './components/ScheduleView';
import { UploadZone } from './components/UploadZone';
import type { WeekSchedule } from './types/schedule';
import {
  deleteHistoryEntry,
  clearHistory,
  type HistoryEntry,
  listHistory,
  saveHistoryEntry,
} from './utils/historyStore';
import { buildCoworkers } from './utils/coworkers';
import { extractPositionedText, type PositionedText } from './utils/pdfParser';
import { debugRowDump, parseSchedule } from './utils/scheduleParser';
import { generateThumbnail } from './utils/thumbnail';

function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
}

export default function App() {
  const [query, setQuery] = useState('');
  const [schedule, setSchedule] = useState<WeekSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string>('Procesando…');
  const [lastItems, setLastItems] = useState<PositionedText[] | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [highQualityOcr, setHighQualityOcr] = useState(false);

  useEffect(() => {
    listHistory().then(setHistory).catch(() => setHistory([]));
  }, []);

  async function handleFile(file: File) {
    setError(null);
    setShowDebug(false);
    if (!query.trim()) {
      setError('Introduce tu nombre o número de empleado antes de subir el archivo.');
      return;
    }
    setLoading(true);
    setSchedule(null);
    try {
      const isPdf = isPdfFile(file);
      setLoadingMsg(isPdf ? 'Leyendo PDF…' : 'Reconociendo texto de la imagen (puede tardar)…');
      let items: PositionedText[];
      if (isPdf) {
        items = await extractPositionedText(file);
      } else {
        const { extractPositionedTextFromImage } = await import('./utils/imageOcr');
        items = await extractPositionedTextFromImage(
          file,
          (p) => {
            const pct = Math.round(p.progress * 100);
            setLoadingMsg(`OCR: ${p.status} (${pct}%)`);
          },
          highQualityOcr
        );
      }
      setLastItems(items);
      const parsed = parseSchedule(items, query.trim());
      setSchedule(parsed);

      try {
        const thumbnail = await generateThumbnail(file);
        const entry = await saveHistoryEntry({
          query: query.trim(),
          employeeName: parsed.employeeName,
          weekRange: parsed.weekRange,
          source: isPdf ? 'pdf' : 'image',
          fileName: file.name,
          thumbnail,
          schedule: parsed,
        });
        setHistory((prev) => [entry, ...prev]);
      } catch (storeErr) {
        console.warn('No se pudo guardar en el historial', storeErr);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el archivo.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setSchedule(null);
    setError(null);
    setShowDebug(false);
    setLastItems(null);
  }

  function openFromHistory(entry: HistoryEntry) {
    setError(null);
    setShowDebug(false);
    setLastItems(null);
    setQuery(entry.query);
    setSchedule(entry.schedule);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeFromHistory(entry: HistoryEntry) {
    await deleteHistoryEntry(entry.id);
    setHistory((prev) => prev.filter((e) => e.id !== entry.id));
  }

  async function vaciarHistorial() {
    if (!confirm('¿Vaciar todo el historial?')) return;
    await clearHistory();
    setHistory([]);
  }

  const debugLines = lastItems ? debugRowDump(lastItems) : [];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Lector de Horarios</h1>
          <p className="text-sm text-gray-600">
            Sube tu cuadrante semanal o mensual y consulta solo tus turnos.
          </p>
        </header>

        <IosInstallHint />

        <div className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <EmployeeSearch value={query} onChange={setQuery} />
          <UploadZone onFile={handleFile} disabled={loading} />

          <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={highQualityOcr}
              onChange={(e) => setHighQualityOcr(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>
              <span className="font-medium text-gray-800">Modo calidad superior</span>
              <span className="block text-gray-500">
                Sólo para imágenes. Tarda 3-4× más pero suele leer mejor dígitos
                pequeños o fotos algo borrosas.
              </span>
            </span>
          </label>

          {loading && <p className="text-sm text-gray-600">{loadingMsg}</p>}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {lastItems && (
            <div className="flex flex-wrap gap-3">
              {schedule && (
                <button
                  type="button"
                  onClick={reset}
                  className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                >
                  Subir otro archivo
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowDebug((v) => !v)}
                className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
              >
                {showDebug ? 'Ocultar' : 'Mostrar'} contenido detectado (depuración)
              </button>
            </div>
          )}

          {showDebug && debugLines.length > 0 && <DebugDump lines={debugLines} />}
        </div>

        {schedule && <ScheduleView schedule={schedule} />}

        {schedule && schedule.allEmployees && (
          <CoworkersView
            groups={buildCoworkers(schedule.days, schedule.allEmployees, schedule.employeeName)}
          />
        )}

        <HistoryList
          entries={history}
          onOpen={openFromHistory}
          onDelete={removeFromHistory}
          onClear={vaciarHistorial}
        />
      </div>
    </div>
  );
}