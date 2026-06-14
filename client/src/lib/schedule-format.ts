const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export function targetLabel(
  frequency: "monthly" | "biweekly" | "weekly" | "none",
  target: "previous" | "current" | "next",
): string {
  const unit = frequency === "monthly" ? "month" : frequency === "none" ? "period" : frequency === "weekly" ? "week" : "period";
  return `${target} ${unit}`;
}

export interface ScheduleInput {
  reminderFrequency: string;
  reminderDayOfMonth: number | null;
  reminderDayOfWeek: number | null;
  reminderTargetOffset?: string | null;
}

export function formatSchedule(f: ScheduleInput): string {
  const target = (f.reminderTargetOffset as "previous" | "current" | "next" | undefined) ?? "previous";
  if (f.reminderFrequency === "monthly") {
    const day = f.reminderDayOfMonth ?? 1;
    return `Monthly (${day}${getOrdinalSuffix(day)}, ${target} month)`;
  }
  if (f.reminderFrequency === "biweekly") {
    return `Every 2 weeks (${target} period)`;
  }
  if (f.reminderFrequency === "weekly") {
    const dow = f.reminderDayOfWeek ?? 1;
    return `Weekly (${DAYS_OF_WEEK[dow]}, ${target} week)`;
  }
  return "No reminders";
}
