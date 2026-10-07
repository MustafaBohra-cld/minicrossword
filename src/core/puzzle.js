export const BLOCK = '#';

export function parsePuzzle(source) {
  const size = source.grid.length;
  const solution = source.grid.map((row) => row.split(''));
  const cellGrid = Array.from({ length: size }, () => Array(size).fill(null));
  const cells = [];

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const ch = solution[r][c];
      const block = ch === BLOCK;
      const cell = {
        row: r,
        col: c,
        block,
        solution: block ? null : ch,
        number: null,
        acrossId: null,
        downId: null,
      };
      cellGrid[r][c] = cell;
      if (!block) cells.push(cell);
    }
  }

  const collectRuns = (dir) => {
    const runs = [];
    const major = size;
    for (let a = 0; a < major; a += 1) {
      let b = 0;
      while (b < major) {
        const row = dir === 'across' ? a : b;
        const col = dir === 'across' ? b : a;
        if (cellGrid[row][col].block) {
          b += 1;
          continue;
        }
        const run = [];
        while (b < major) {
          const rr = dir === 'across' ? a : b;
          const cc = dir === 'across' ? b : a;
          if (cellGrid[rr][cc].block) break;
          run.push(cellGrid[rr][cc]);
          b += 1;
        }
        runs.push(run);
      }
    }
    return runs;
  };

  const acrossRuns = collectRuns('across');
  const downRuns = collectRuns('down');

  let counter = 0;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const cell = cellGrid[r][c];
      if (cell.block) continue;
      const startsAcross = (c === 0 || cellGrid[r][c - 1].block) && c + 1 < size && !cellGrid[r][c + 1].block;
      const startsDown = (r === 0 || cellGrid[r - 1][c].block) && r + 1 < size && !cellGrid[r + 1][c].block;
      if (startsAcross || startsDown) {
        counter += 1;
        cell.number = counter;
      }
    }
  }

  const buildEntries = (dir, runs) => {
    const list = [];
    for (const run of runs) {
      if (run.length < 2) continue;
      const start = run[0];
      const id = `${dir}:${start.number}`;
      const entry = {
        id,
        dir,
        number: start.number,
        cells: run,
        answer: run.map((cell) => cell.solution).join(''),
        clue: (source.clues?.[dir]?.[String(start.number)] ?? '').trim(),
      };
      for (const cell of run) {
        if (dir === 'across') cell.acrossId = id;
        else cell.downId = id;
      }
      list.push(entry);
    }
    return list;
  };

  const across = buildEntries('across', acrossRuns);
  const down = buildEntries('down', downRuns);
  const entryById = new Map();
  for (const entry of [...across, ...down]) entryById.set(entry.id, entry);

  const starts = cells.filter((cell) => cell.number != null).length;

  return {
    id: source.id,
    title: source.title,
    difficulty: source.difficulty,
    size,
    solution,
    cellGrid,
    cells,
    across,
    down,
    entryById,
    numbers: starts,
    entryAt(row, col, dir) {
      const cell = cellGrid[row][col];
      const id = dir === 'across' ? cell.acrossId : cell.downId;
      return id ? entryById.get(id) : null;
    },
  };
}
