export const label = "Whitespace count";
export const inspect = value => String((value.match(/\s/gu) ?? []).length);
