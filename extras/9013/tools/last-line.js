export const label = "Last line";
export const inspect = value => value.split(/\r\n|\r|\n/).at(-1);
