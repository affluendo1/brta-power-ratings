export const label = "Tab count";
export const inspect = value => String((value.match(/\t/g) ?? []).length);
