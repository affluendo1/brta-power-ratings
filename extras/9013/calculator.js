const form = document.querySelector('form');
const result = document.querySelector('output');

async function initialize() {
  const response = await fetch('answers.json');
  if (!response.ok) throw new Error('Answer table unavailable');
  const { operands, answers } = await response.json();
  for (const value of operands) {
    form.elements.left.add(new Option(value, value));
    form.elements.right.add(new Option(value, value));
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const { left, right, operator } = form.elements;
    result.textContent = answers[operator.value]?.[left.value]?.[right.value] ?? 'Unavailable';
  });
  form.querySelector('button').disabled = false;
  result.textContent = 'Ready';
}

initialize().catch(() => { result.textContent = 'Answer table unavailable. Reload to retry.'; });
