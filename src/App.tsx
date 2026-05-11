import { useState } from 'react';
import { EmployeeSearch } from './components/EmployeeSearch';
import { ScheduleView } from './components/ScheduleView';
import { UploadZone } from './components/UploadZone';
import type { WeekSchedule } from './types/schedule';
import { extractPositionedText, type PositionedText } from './utils/pdfParser';
import { debugRowDump, parseSchedule } from './utils/scheduleParser';

export default function App() {
  const [query, setQuery] = useState('');
  const [schedule, setSchedule] = useState<WeekSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastItems, setLastItems] = useState<PositionedText[] | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setShowDebug(false);
    if (!query.trim()) {
      setError('Introduce tu nombre o número de empleado antes de subir el PDF.');
      return;
    }
    setLoading(true);
    setSchedule(null);
    try {
      const items = await extractPositionedText(file);
      setLastItems(items);
      const parsed = parseSchedule(items, query.trim());
      setSchedule(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el PDF.');
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

  const debugLines = lastItems ? debugRowDump(lastItems) : [];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Lector de Horarios</h1>
          <p className="text-sm text-gray-600">
            Sube tu cuadrante semanal y consulta solo tus turnos.
          </p>
        </header>

        <div className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <EmployeeSearch value={query} onChange={setQuery} />
          <UploadZone onFile={handleFile} disabled={loading} />

          {loading && <p className="text-sm text-gray-600">Procesando…</p>}

          {error && (
            <div className="space-y-2">
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
              {lastItems && (
                <button
                  type="button"
                  onClick={() => setShowDebug((v) => !v)}
                  className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                >
                  {showDebug ? 'Ocultar' : 'Mostrar'} contenido detectado
                </button>
              )}
              {showDebug && debugLines.length > 0 && (
                <pre className="max-h-80 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-snug font-mono whitespace-pre-wrap">
                  {debugLines.join('\n')}
                </pre>
              )}
            </div>
          )}

          {schedule && (
            <button
              type="button"
              onClick={reset}
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              Subir otro PDF
            </button>
          )}
        </div>

        {schedule && <ScheduleView schedule={schedule} />}
      </div>
    </div>
  );
}
