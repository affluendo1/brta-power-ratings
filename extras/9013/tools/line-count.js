export const label = "Line count";
export const inspect = value => String(value.split(/\r\n|\r|\n/).length);
