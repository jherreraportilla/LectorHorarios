import type { WeekSchedule } from '../types/schedule';
import { DayCard } from './DayCard';

interface Props {
  schedule: WeekSchedule;
}

export function ScheduleView({ schedule }: Props) {
  return (
    <section className="space-y-4">
      <header className="space-y-0.5">
        <h2 className="text-xl font-semibold text-gray-900">{schedule.employeeName}</h2>
        {schedule.weekRange && (
          <p className="text-sm text-gray-600">Semana: {schedule.weekRange}</p>
        )}
      </header>

      <div
        className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4"
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(8rem, 1fr))`,
        }}
      >
        {schedule.days.map((day, i) => (
          <DayCard key={`${day.dayName}-${i}`} day={day} />
        ))}
      </div>

      {schedule.totalHours && (
        <p className="text-sm text-gray-700">
          <span className="font-medium">Horas semanales (Hor. Real):</span>{' '}
          <span className="font-mono">{schedule.totalHours}</span>
        </p>
      )}
    </section>
  );
}
