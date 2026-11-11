export const label = "Word count";
export const inspect = value => String(value.trim().split(/\s+/).filter(Boolean).length);
