export function createClueView({ bar, list, puzzle, onSelectEntry }) {
  const tagEl = bar.querySelector('#active-tag');
  const textEl = bar.querySelector('#active-clue');

  const items = new Map();
  for (const dir of ['across', 'down']) {
    const group = document.createElement('div');
    group.className = 'clue-group';

    const title = document.createElement('h2');
    title.className = 'clue-group__title';
    title.textContent = dir === 'across' ? 'Across' : 'Down';

    const ul = document.createElement('ul');
    ul.className = 'clue-list';

    for (const entry of puzzle[dir]) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'clue';
      button.dataset.entry = entry.id;

      const num = document.createElement('span');
      num.className = 'clue__num';
      num.textContent = String(entry.number);

      const text = document.createElement('span');
      text.className = 'clue__text';
      text.textContent = entry.clue;

      button.append(num, text);
      button.addEventListener('click', () => onSelectEntry(entry));
      li.append(button);
      ul.append(li);
      items.set(entry.id, button);
    }

    group.append(title, ul);
    list.append(group);
  }

  let activeId = null;

  return {
    render(state) {
      const entry = state.activeEntryId ? puzzle.entryById.get(state.activeEntryId) : null;
      const id = entry ? entry.id : null;
      if (id === activeId) return;

      if (entry) {
        tagEl.textContent = entry.dir === 'across' ? 'Across' : 'Down';
        textEl.textContent = `${entry.number}. ${entry.clue}`;
      }

      if (activeId != null) items.get(activeId)?.classList.remove('is-active');
      if (id != null) items.get(id)?.classList.add('is-active');
      activeId = id;
    },
  };
}
