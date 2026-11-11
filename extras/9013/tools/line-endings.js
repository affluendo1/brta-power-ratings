export const label = "Line ending normalization";
export const inspect = value => value.replace(/\r\n|\r/g, "\n");
