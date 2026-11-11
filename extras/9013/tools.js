const entries = [
  ["Line count", () => import("./tools/line-count.js")],
  ["Character count", () => import("./tools/character-count.js")],
  ["Line lengths", () => import("./tools/line-lengths.js")],
  ["First line", () => import("./tools/first-line.js")],
  ["Last line", () => import("./tools/last-line.js")],
  ["First character", () => import("./tools/first-character.js")],
  ["Last character", () => import("./tools/last-character.js")],
  ["Empty line count", () => import("./tools/empty-lines.js")],
  ["Line ending normalization", () => import("./tools/line-endings.js")],
  ["Indentation reference", () => import("./tools/indentation.js")],
  ["Word count", () => import("./tools/word-count.js")],
  ["Uppercase reference", () => import("./tools/uppercase.js")],
  ["Lowercase reference", () => import("./tools/lowercase.js")],
  ["Leading whitespace check", () => import("./tools/prefix-check.js")],
  ["Trailing whitespace check", () => import("./tools/suffix-check.js")],
  ["Whitespace count", () => import("./tools/whitespace.js")],
  ["Tab count", () => import("./tools/tab-count.js")],
  ["Unicode code point reference", () => import("./tools/code-points.js")],
];
const form = document.querySelector('form');
const menu = form.elements.tool;
const output = document.querySelector('output');
for (const [index, [label]] of entries.entries()) menu.add(new Option(label, index));
form.addEventListener('submit', async event => {
  event.preventDefault();
  const input = form.elements.text.value;
  const entry = entries[menu.value];
  if (!entry) return;
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    const { inspect } = await entry[1]();
    output.textContent = inspect(input) || 'No output';
  } catch {
    output.textContent = 'Reference tool unavailable. Try again.';
  } finally {
    button.disabled = false;
  }
});
