const LETTER = /^[A-Z]$/;

export function createGame(puzzle, options = {}) {
  const { size, cellGrid, cells } = puzzle;

  const letters = Array.from({ length: size }, () => Array(size).fill(''));
  if (Array.isArray(options.letters)) {
    for (let r = 0; r < size; r += 1) {
      const source = options.letters[r];
      for (let c = 0; c < size; c += 1) {
        const raw = Array.isArray(source) ? source[c] : source?.[c];
        const ch = String(raw ?? '').toUpperCase();
        if (LETTER.test(ch) && !cellGrid[r][c].block) letters[r][c] = ch;
      }
    }
  }

  const firstOpen = cells[0];
  const stored = options.selection;
  let selection =
    stored &&
    Number.isInteger(stored.row) &&
    Number.isInteger(stored.col) &&
    cellGrid[stored.row]?.[stored.col] &&
    !cellGrid[stored.row][stored.col].block
      ? { row: stored.row, col: stored.col }
      : { row: firstOpen.row, col: firstOpen.col };

  let direction = options.direction === 'down' ? 'down' : 'across';
  let status = options.status === 'won' ? 'won' : 'playing';

  const wrong = new Set();
  const revealed = new Set();
  const listeners = new Set();

  const key = (row, col) => `${row},${col}`;
  const current = () => cellGrid[selection.row][selection.col];

  function entryFor(cell, dir) {
    const id = dir === 'across' ? cell.acrossId : cell.downId;
    return id ? puzzle.entryById.get(id) : null;
  }

  function ensureDirection() {
    const cell = current();
    if (direction === 'across' && !cell.acrossId) direction = 'down';
    else if (direction === 'down' && !cell.downId) direction = 'across';
  }

  function activeEntry() {
    const cell = current();
    return entryFor(cell, direction) ?? entryFor(cell, direction === 'across' ? 'down' : 'across');
  }

  function emit() {
    const state = getState();
    for (const listener of listeners) listener(state);
  }

  function isComplete() {
    for (const cell of cells) {
      if (letters[cell.row][cell.col] !== cell.solution) return false;
    }
    return true;
  }

  function checkWin() {
    if (status === 'playing' && isComplete()) {
      status = 'won';
      emit();
      return true;
    }
    return false;
  }

  function advance() {
    const entry = activeEntry();
    const index = entry.cells.indexOf(current());
    if (index >= 0 && index < entry.cells.length - 1) {
      const next = entry.cells[index + 1];
      selection = { row: next.row, col: next.col };
    }
  }

  function getState() {
    const entry = activeEntry();
    return {
      size,
      letters: letters.map((row) => row.slice()),
      selection: { ...selection },
      direction,
      status,
      wrong: [...wrong],
      revealed: [...revealed],
      activeEntryId: entry ? entry.id : null,
    };
  }

  return {
    puzzle,

    subscribe(listener) {
      listeners.add(listener);
      listener(getState());
      return () => listeners.delete(listener);
    },

    getState,
    getLetters: () => letters,
    getSelection: () => ({ ...selection }),
    getDirection: () => direction,
    getStatus: () => status,
    getActiveEntry: activeEntry,
    isWrong: (row, col) => wrong.has(key(row, col)),
    isRevealed: (row, col) => revealed.has(key(row, col)),
    isComplete,

    selectCell(row, col) {
      const cell = cellGrid[row]?.[col];
      if (!cell || cell.block) return;
      if (selection.row === row && selection.col === col) {
        const other = direction === 'across' ? 'down' : 'across';
        if (entryFor(cell, other)) direction = other;
      } else {
        selection = { row, col };
        ensureDirection();
      }
      emit();
    },

    toggleDirection() {
      const other = direction === 'across' ? 'down' : 'across';
      if (entryFor(current(), other)) {
        direction = other;
        emit();
      }
    },

    typeLetter(ch) {
      if (status !== 'playing') return;
      const letter = String(ch).toUpperCase();
      if (!LETTER.test(letter)) return;
      const cell = current();
      letters[cell.row][cell.col] = letter;
      wrong.delete(key(cell.row, cell.col));
      revealed.delete(key(cell.row, cell.col));
      advance();
      emit();
      if (!checkWin()) return;
    },

    backspace() {
      if (status !== 'playing') return;
      const cell = current();
      const cellKey = key(cell.row, cell.col);
      if (letters[cell.row][cell.col] !== '') {
        letters[cell.row][cell.col] = '';
        wrong.delete(cellKey);
        revealed.delete(cellKey);
      } else {
        const entry = activeEntry();
        const index = entry.cells.indexOf(cell);
        if (index > 0) {
          const prev = entry.cells[index - 1];
          selection = { row: prev.row, col: prev.col };
          letters[prev.row][prev.col] = '';
          wrong.delete(key(prev.row, prev.col));
          revealed.delete(key(prev.row, prev.col));
        }
      }
      emit();
    },

    move(dRow, dCol) {
      if (status !== 'playing') return;
      let r = selection.row + dRow;
      let c = selection.col + dCol;
      while (r >= 0 && r < size && c >= 0 && c < size) {
        if (!cellGrid[r][c].block) {
          selection = { row: r, col: c };
          ensureDirection();
          emit();
          return;
        }
        r += dRow;
        c += dCol;
      }
    },

    check() {
      if (status !== 'playing') return 0;
      wrong.clear();
      for (const cell of cells) {
        const value = letters[cell.row][cell.col];
        if (value !== '' && value !== cell.solution) wrong.add(key(cell.row, cell.col));
      }
      emit();
      return wrong.size;
    },

    hint() {
      if (status !== 'playing') return null;
      const cell = current();
      let target = null;
      if (letters[cell.row][cell.col] !== cell.solution) {
        target = cell;
      } else {
        target = cells.find((c) => letters[c.row][c.col] !== c.solution) ?? null;
      }
      if (!target) return null;
      letters[target.row][target.col] = target.solution;
      revealed.add(key(target.row, target.col));
      wrong.delete(key(target.row, target.col));
      selection = { row: target.row, col: target.col };
      ensureDirection();
      emit();
      checkWin();
      return target;
    },

    reveal() {
      if (status !== 'playing') return;
      for (const cell of cells) {
        letters[cell.row][cell.col] = cell.solution;
        revealed.add(key(cell.row, cell.col));
      }
      wrong.clear();
      emit();
      checkWin();
    },
  };
}
