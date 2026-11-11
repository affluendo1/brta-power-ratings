export const label = "Trailing whitespace check";
export const inspect = value => /\s$/.test(value) ? "Present" : "Absent";
