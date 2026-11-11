export const label = "Leading whitespace check";
export const inspect = value => /^\s/.test(value) ? "Present" : "Absent";
