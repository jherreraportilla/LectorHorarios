export type DayStatus = 'work' | 'off' | 'vacation' | 'sick' | 'other';

export type ScheduleFormat = 'weekly' | 'monthly';

export interface DaySchedule {
  dayName: string;
  date: string;
  status: DayStatus;
  timeRange?: string;
  rawCode?: string;
}

export interface EmployeeDay {
  dayName: string;
  date: string;
  status: DayStatus;
  timeRange?: string;
}

export interface EmployeeWeek {
  name: string;
  days: EmployeeDay[];
}

export interface WeekSchedule {
  employeeName: string;
  weekRange: string;
  totalHours: string;
  days: DaySchedule[];
  format: ScheduleFormat;
  allEmployees?: EmployeeWeek[];
}
