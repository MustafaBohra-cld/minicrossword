import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wordClue, MIN_ENTRY_LENGTH } from './wordbank.js';

const SIZE = 4;
const BLOCK = '#';
const ALLOWED = /^[A-Z#]$/;
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

const HERE = dirname(fileURLToPath(import.meta.url));
const PUZZLES_PATH = join(HERE, '..', 'src', 'data', 'puzzles.json');

const errors = [];
const fail = (message) => errors.push(message);

function maximalRuns(grid) {
  const across = [];
  const down = [];
  for (let r = 0; r < SIZE; r += 1) {
    let c = 0;
    while (c < SIZE) {
      if (grid[r][c] === BLOCK) { c += 1; continue; }
      const cells = [];
      while (c < SIZE && grid[r][c] !== BLOCK) { cells.push([r, c]); c += 1; }
      across.push(cells);
    }
  }
  for (let c = 0; c < SIZE; c += 1) {
    let r = 0;
    while (r < SIZE) {
      if (grid[r][c] === BLOCK) { r += 1; continue; }
      const cells = [];
      while (r < SIZE && grid[r][c] !== BLOCK) { cells.push([r, c]); r += 1; }
      down.push(cells);
    }
  }
  return { across, down };
}

function numberGrid(grid) {
  const numbers = new Map();
  let n = 0;
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (grid[r][c] === BLOCK) continue;
      const startsAcross =
        (c === 0 || grid[r][c - 1] === BLOCK) && c + 1 < SIZE && grid[r][c + 1] !== BLOCK;
      const startsDown =
        (r === 0 || grid[r - 1][c] === BLOCK) && r + 1 < SIZE && grid[r + 1][c] !== BLOCK;
      if (startsAcross || startsDown) {
        n += 1;
        numbers.set(`${r},${c}`, n);
      }
    }
  }
  return numbers;
}

function wordsOfGrid(grid) {
  const { across, down } = maximalRuns(grid);
  const spell = (cells) => cells.map(([r, c]) => grid[r][c]).join('');
  return {
    acrossCount: across.length,
    downCount: down.length,
    across: across.map(spell),
    down: down.map(spell),
  };
}

function validatePuzzle(puzzle, index) {
  const label = `puzzle #${index + 1}${puzzle && puzzle.id ? ` (id ${puzzle.id})` : ''}`;

  if (!puzzle || typeof puzzle !== 'object') {
    fail(`${label}: not an object`);
    return;
  }
  if (typeof puzzle.id !== 'string' || !puzzle.id) fail(`${label}: missing string id`);
  if (typeof puzzle.title !== 'string' || !puzzle.title) fail(`${label}: missing title`);
  if (!DIFFICULTIES.has(puzzle.difficulty)) fail(`${label}: bad difficulty "${puzzle.difficulty}"`);

  if (!Array.isArray(puzzle.grid) || puzzle.grid.length !== SIZE) {
    fail(`${label}: grid must be an array of ${SIZE} strings`);
    return;
  }
  for (let r = 0; r < SIZE; r += 1) {
    const row = puzzle.grid[r];
    if (typeof row !== 'string' || row.length !== SIZE) {
      fail(`${label}: row ${r} must be a ${SIZE}-char string`);
      return;
    }
    for (const ch of row) {
      if (!ALLOWED.test(ch)) fail(`${label}: invalid character "${ch}" in row ${r}`);
    }
  }

  const { across, down } = maximalRuns(puzzle.grid);
  const allRuns = [...across, ...down];
  for (const run of allRuns) {
    if (run.length < MIN_ENTRY_LENGTH) {
      fail(`${label}: run at ${run[0]} has length ${run.length} (< ${MIN_ENTRY_LENGTH})`);
    }
  }
  if (across.length < 2) fail(`${label}: fewer than 2 across entries`);
  if (down.length < 2) fail(`${label}: fewer than 2 down entries`);

  const spelled = wordsOfGrid(puzzle.grid);
  for (const word of [...spelled.across, ...spelled.down]) {
    if (!wordClue(word)) fail(`${label}: "${word}" is not in the wordbank`);
  }
  const dupAcross = spelled.across.filter((w, i) => spelled.across.indexOf(w) !== i);
  const dupDown = spelled.down.filter((w, i) => spelled.down.indexOf(w) !== i);
  if (dupAcross.length) fail(`${label}: duplicate across word(s) ${[...new Set(dupAcross)].join(', ')}`);
  if (dupDown.length) fail(`${label}: duplicate down word(s) ${[...new Set(dupDown)].join(', ')}`);

  const numbers = numberGrid(puzzle.grid);
  const clues = puzzle.clues;
  if (!clues || typeof clues !== 'object' || !clues.across || !clues.down) {
    fail(`${label}: missing clues.across / clues.down`);
    return;
  }

  const expected = { across: new Set(), down: new Set() };
  for (const [dir, runs] of [['across', across], ['down', down]]) {
    for (const run of runs) {
      if (run.length < 2) continue;
      const number = numbers.get(`${run[0][0]},${run[0][1]}`);
      if (!number) {
        fail(`${label}: entry at ${run[0]} has no crossword number`);
        continue;
      }
      expected[dir].add(String(number));
      const clue = clues[dir][number];
      if (typeof clue !== 'string' || !clue.trim()) {
        fail(`${label}: missing ${dir} clue for ${number} (${run.map(([r, c]) => puzzle.grid[r][c]).join('')})`);
      }
    }
  }

  for (const dir of ['across', 'down']) {
    const keys = Object.keys(clues[dir]);
    for (const key of keys) {
      if (!expected[dir].has(key)) fail(`${label}: stray ${dir} clue for number ${key}`);
    }
    for (const num of expected[dir]) {
      if (!keys.includes(num)) fail(`${label}: ${dir} entry ${num} has no clue`);
    }
  }

  const words = [...spelled.across, ...spelled.down];
  return { label, words, blocks: puzzle.grid.join('').split('').filter((x) => x === BLOCK).length };
}

function main() {
  let doc;
  try {
    doc = JSON.parse(readFileSync(PUZZLES_PATH, 'utf8'));
  } catch (error) {
    console.error(`Could not read puzzles: ${error.message}`);
    process.exit(1);
  }

  if (doc.size !== SIZE) fail(`document size must be ${SIZE}, got ${doc.size}`);
  if (doc.minEntryLength !== MIN_ENTRY_LENGTH) {
    fail(`document minEntryLength must be ${MIN_ENTRY_LENGTH}, got ${doc.minEntryLength}`);
  }
  if (!Array.isArray(doc.puzzles) || doc.puzzles.length === 0) {
    fail('document has no puzzles array');
  }

  const seenIds = new Set();
  const seenGrids = new Set();
  const reports = [];
  (doc.puzzles ?? []).forEach((puzzle, index) => {
    const report = validatePuzzle(puzzle, index);
    if (puzzle && puzzle.id) {
      if (seenIds.has(puzzle.id)) fail(`duplicate puzzle id ${puzzle.id}`);
      seenIds.add(puzzle.id);
    }
    if (puzzle && Array.isArray(puzzle.grid)) {
      const sig = puzzle.grid.join('/');
      if (seenGrids.has(sig)) fail(`duplicate grid for ${puzzle.id}`);
      seenGrids.add(sig);
    }
    if (report) reports.push(report);
  });

  for (const report of reports) {
    console.log(`  OK ${report.label}  blocks=${report.blocks}  ${report.words.join(', ')}`);
  }

  if (errors.length) {
    console.error(`\n${errors.length} problem(s) found:`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(`\n${doc.puzzles.length}/${doc.puzzles.length} puzzles valid`);
}

main();
