export const label = "Line lengths";
export const inspect = value => value.split(/\r\n|\r|\n/).map(line => [...line].length).join("\n");
