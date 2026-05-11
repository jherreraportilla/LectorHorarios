import type { DaySchedule, WeekSchedule } from '../types/schedule';
import { DayCard } from './DayCard';

const DAY_ORDER = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

interface Props {
  schedule: WeekSchedule;
}

export function ScheduleView({ schedule }: Props) {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-gray-900">{schedule.employeeName}</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          {schedule.weekRange && <span>{schedule.weekRange}</span>}
          {schedule.format === 'monthly' && (
            <span className="inline-block rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium px-2 py-0.5">
              Vista mensual
            </span>
          )}
        </div>
        {schedule.totalHours && (
          <p className="text-sm text-gray-700">
            <span className="font-medium">
              {schedule.format === 'monthly' ? 'Horas mensuales' : 'Horas semanales'} (Hor. Real):
            </span>{' '}
            <span className="font-mono">{schedule.totalHours}</span>
          </p>
        )}
      </header>

      {schedule.format === 'monthly' ? (
        <MonthlyGrid days={schedule.days} />
      ) : (
        <WeeklyRow days={schedule.days} />
      )}
    </section>
  );
}

function WeeklyRow({ days }: { days: DaySchedule[] }) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(8rem, 1fr))` }}
    >
      {days.map((day, i) => (
        <DayCard key={`${day.dayName}-${i}`} day={day} />
      ))}
    </div>
  );
}

interface WeekGroup {
  index: number;
  slots: (DaySchedule | null)[];
}

function groupIntoWeeks(days: DaySchedule[]): WeekGroup[] {
  const weeks: WeekGroup[] = [];
  let current: (DaySchedule | null)[] = new Array(7).fill(null);
  let hasContent = false;
  let started = false;

  for (const day of days) {
    const idx = DAY_ORDER.indexOf(day.dayName);
    if (idx === -1) continue;
    if (started && idx === 0) {
      weeks.push({ index: weeks.length + 1, slots: current });
      current = new Array(7).fill(null);
      hasContent = false;
    }
    current[idx] = day;
    hasContent = true;
    started = true;
  }
  if (hasContent) weeks.push({ index: weeks.length + 1, slots: current });
  return weeks;
}

function weekRangeLabel(slots: (DaySchedule | null)[]): string {
  const filled = slots.filter((d): d is DaySchedule => d !== null);
  if (filled.length === 0) return '';
  const first = filled[0].date;
  const last = filled[filled.length - 1].date;
  if (!first || !last) return first || last || '';
  if (first === last) return first;
  const [firstDay, firstMonth] = first.split(' ');
  const [lastDay, lastMonth] = last.split(' ');
  if (firstMonth && firstMonth === lastMonth) {
    return `${firstDay}–${lastDay} ${lastMonth}`;
  }
  return `${first} – ${last}`;
}

function MonthlyGrid({ days }: { days: DaySchedule[] }) {
  const weeks = groupIntoWeeks(days);

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="min-w-[44rem] space-y-4">
        <div className="grid grid-cols-7 gap-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
          {DAY_ORDER.map((name) => (
            <div key={name} className="px-1">{name}</div>
          ))}
        </div>

        {weeks.map((week) => (
          <div key={week.index} className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-600">
              Semana {week.index}
              {weekRangeLabel(week.slots) && (
                <span className="font-normal text-gray-500"> · {weekRangeLabel(week.slots)}</span>
              )}
            </h3>
            <div className="grid grid-cols-7 gap-2">
              {week.slots.map((day, idx) =>
                day ? (
                  <DayCard key={idx} day={day} compact />
                ) : (
                  <div
                    key={idx}
                    className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50"
                  />
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
