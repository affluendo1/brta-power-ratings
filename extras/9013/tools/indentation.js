export const label = "Indentation reference";
export const inspect = value => value.split(/\r\n|\r|\n/).map(line => line.match(/^[ \t]*/)[0].length).join("\n");
