export type DayStatus = 'work' | 'off' | 'vacation' | 'sick' | 'other';

export interface DaySchedule {
  dayName: string;
  date: string;
  status: DayStatus;
  timeRange?: string;
  rawCode?: string;
}

export interface WeekSchedule {
  employeeName: string;
  weekRange: string;
  totalHours: string;
  days: DaySchedule[];
}
