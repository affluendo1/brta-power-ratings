export const label = "Unicode code point reference";
export const inspect = value => [...value].map(letter => "U+" + letter.codePointAt(0).toString(16).toUpperCase().padStart(4,"0")).join(" ");
