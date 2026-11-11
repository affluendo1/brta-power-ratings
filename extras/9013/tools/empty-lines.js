export const label = "Empty line count";
export const inspect = value => String(value.split(/\r\n|\r|\n/).filter(line => line === "").length);
