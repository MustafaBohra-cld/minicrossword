export function createBoard(container, puzzle, { onSelect }) {
  const { size, cellGrid } = puzzle;
  container.style.setProperty('--n', String(size));
  const cells = new Map();

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const cell = cellGrid[r][c];
      if (cell.block) {
        const block = document.createElement('div');
        block.className = 'cell cell--block';
        block.setAttribute('aria-hidden', 'true');
        container.append(block);
        continue;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cell';
      button.dataset.row = String(r);
      button.dataset.col = String(c);

      const number = document.createElement('span');
      number.className = 'cell__num';
      if (cell.number != null) number.textContent = String(cell.number);

      const letter = document.createElement('span');
      letter.className = 'cell__letter';

      button.append(number, letter);
      button.addEventListener('click', () => onSelect(r, c));
      container.append(button);
      cells.set(`${r},${c}`, button);
    }
  }

  function describe(cell, letter, selected) {
    const position = `Row ${cell.row + 1}, column ${cell.col + 1}`;
    const value = letter ? `letter ${letter}` : 'empty';
    const entry = cell.number != null ? `, entry ${cell.number}` : '';
    const current = selected ? ', current' : '';
    return `${position}, ${value}${entry}${current}`;
  }

  return {
    render(state, game) {
      const entry = state.activeEntryId ? puzzle.entryById.get(state.activeEntryId) : null;
      const word = new Set(entry ? entry.cells.map((cell) => `${cell.row},${cell.col}`) : []);
      const wrong = new Set(state.wrong);
      const revealed = new Set(state.revealed);

      for (const [key, el] of cells) {
        const [r, c] = key.split(',').map(Number);
        const cell = cellGrid[r][c];
        const letter = state.letters[r][c] ?? '';
        el.querySelector('.cell__letter').textContent = letter;

        const selected = state.selection.row === r && state.selection.col === c;
        el.classList.toggle('is-word', word.has(key) && !selected);
        el.classList.toggle('is-selected', selected);
        el.classList.toggle('is-wrong', wrong.has(key));
        el.classList.toggle('is-revealed', revealed.has(key));
        el.tabIndex = selected ? 0 : -1;
        el.setAttribute('aria-label', describe(cell, letter, selected));
      }
    },
    focusCell(row, col) {
      const el = cells.get(`${row},${col}`);
      if (el) el.focus({ preventScroll: true });
    },
  };
}
