export const label = "Empty line count";
export const inspect = value => String(value.split(/\r\n|\r|\n/).filter(line => line === "").length);
/* BRTA Power Ratings 9.9g */
