export const label = "Last character";
export const inspect = value => [...value].at(-1) ?? "";
