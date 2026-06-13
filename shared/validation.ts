// Student name validation shared by the client and server.
// A student must have at least a first and last name. Multiple students may be
// entered in one field, separated by commas, ampersands, slashes, or "and".

export function splitStudents(value: string): string[] {
  return value
    .split(/\s*(?:,|&|\/|\sand\s)\s*/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function isFullName(name: string): boolean {
  return name.trim().split(/\s+/).filter(Boolean).length >= 2;
}

/**
 * Returns an error message if any student is missing a first or last name,
 * otherwise null.
 */
export function validateStudentNames(value: string): string | null {
  const students = splitStudents(value || "");
  if (students.length === 0) {
    return "Please enter a student name.";
  }
  for (const student of students) {
    if (!isFullName(student)) {
      return `Please enter both a first and last name for "${student}".`;
    }
  }
  return null;
}
