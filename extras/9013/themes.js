const family = document.querySelector('#family');
const count = document.querySelector('#count');
const previews = document.querySelector('#themes');
const template = document.querySelector('#theme-card');

async function initialize() {
  const response = await fetch('themes.json');
  if (!response.ok) throw new Error('Theme catalogue unavailable');
  const catalogue = await response.json();

  function render() {
    const selected = catalogue.filter(theme => !family.value || family.value === theme.family);
    previews.replaceChildren(...selected.map(theme => {
      const card = template.content.firstElementChild.cloneNode(true);
      card.querySelector('h2').textContent = theme.name;
      card.querySelector('p').textContent = theme.family;
      for (const [token, value] of Object.entries(theme.palette)) {
        card.style.setProperty('--preview-' + token, value);
      }
      return card;
    }));
    count.textContent = selected.length + ' themes';
  }

  family.addEventListener('change', render);
  render();
}

initialize().catch(() => { count.textContent = 'Theme catalogue unavailable. Reload to retry.'; });
