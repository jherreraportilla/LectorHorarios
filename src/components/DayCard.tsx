import type { DaySchedule, DayStatus } from '../types/schedule';

const CARD_STYLES: Record<DayStatus, string> = {
  work: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  off: 'bg-gray-100 border-gray-200 text-gray-700',
  vacation: 'bg-sky-50 border-sky-200 text-sky-900',
  sick: 'bg-amber-50 border-amber-200 text-amber-900',
  other: 'bg-slate-50 border-slate-200 text-slate-800',
};

const STATUS_LABELS: Record<DayStatus, string> = {
  work: 'Trabajo',
  off: 'Descanso',
  vacation: 'Vacaciones',
  sick: 'Baja',
  other: 'Otro',
};

const BADGE_STYLES: Record<DayStatus, string> = {
  work: 'bg-emerald-600 text-white',
  off: 'bg-gray-500 text-white',
  vacation: 'bg-sky-600 text-white',
  sick: 'bg-amber-500 text-white',
  other: 'bg-slate-600 text-white',
};

interface Props {
  day: DaySchedule;
  compact?: boolean;
}

export function DayCard({ day, compact = false }: Props) {
  if (compact) {
    return (
      <div
        className={`flex flex-col gap-1 rounded-lg border p-2 min-w-0 text-xs ${CARD_STYLES[day.status]}`}
      >
        <div className="flex items-baseline justify-between gap-1">
          <span className="font-semibold">{day.date || day.dayName}</span>
          <span
            className={`inline-block text-[10px] font-medium px-1.5 py-0 rounded-full ${BADGE_STYLES[day.status]}`}
          >
            {STATUS_LABELS[day.status]}
          </span>
        </div>
        {day.status === 'work' && day.timeRange && (
          <div className="font-mono text-[11px] leading-tight">{day.timeRange}</div>
        )}
        {day.status === 'other' && day.rawCode && (
          <div className="font-mono text-[10px] opacity-80 break-words">{day.rawCode}</div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border p-4 min-w-0 ${CARD_STYLES[day.status]}`}
    >
      <div>
        <div className="font-semibold leading-tight">{day.dayName}</div>
        {day.date && (
          <div className="text-xs opacity-70 mt-0.5">{day.date}</div>
        )}
      </div>
      <span
        className={`inline-block self-start text-xs font-medium px-2 py-0.5 rounded-full ${BADGE_STYLES[day.status]}`}
      >
        {STATUS_LABELS[day.status]}
      </span>
      {day.status === 'work' && day.timeRange && (
        <div className="text-sm font-mono">{day.timeRange}</div>
      )}
      {day.status === 'other' && day.rawCode && (
        <div className="text-xs font-mono opacity-80 break-words">{day.rawCode}</div>
      )}
    </div>
  );
}
