import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buckets, wordClue, MIN_ENTRY_LENGTH } from './wordbank.js';

const SIZE = 4;
const CELLS = SIZE * SIZE;
const BLOCK = '#';
const MIN_PER_DIRECTION = 2;
const SOLUTIONS_PER_PATTERN = 24;
const GEOMETRY_FALLBACK = 6;
const MAX_PER_PATTERN = 3;
const MAX_FULL_SQUARES = 2;
const SHAPE_BORDER_PENALTY = 100;
const SHAPE_BLOCK_WEIGHT = 5;
const SHAPE_ASYMMETRY_PENALTY = 2;
const DEGENERATE_PENALTY = 1000;
const SHARED_WORD_PENALTY = 25;
const FULL_SQUARE_BONUS = -120;
const REUSE_PENALTY = 20;
const HEAVY_REUSE_PENALTY = 40;
const NODE_CAP = 300000;
const TARGET = 10;

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(HERE, '..', 'src', 'data', 'puzzles.json');

const TITLES = [
  'Warm Up',
  'Sunny Side',
  'Green Thumb',
  'Snack Break',
  'Ocean Breeze',
  'Game Night',
  'Garden Path',
  'Story Time',
  'Mountain Air',
  'Final Round',
  'Lucky Day',
  'Quiet Corner',
];

function emptyLetters() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(' '));
}

function buildBlocks(mask) {
  const letters = emptyLetters();
  for (let i = 0; i < CELLS; i += 1) {
    if (mask & (1 << i)) letters[Math.floor(i / SIZE)][i % SIZE] = BLOCK;
  }
  return letters;
}

function isSymmetric(letters) {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const mirrored = letters[SIZE - 1 - r][SIZE - 1 - c];
      if ((letters[r][c] === BLOCK) !== (mirrored === BLOCK)) return false;
    }
  }
  return true;
}

function hasBorderLine(letters) {
  for (let i = 0; i < SIZE; i += 1) {
    if (letters[i].every((x) => x === BLOCK)) return true;
    if (letters.every((row) => row[i] === BLOCK)) return true;
  }
  return false;
}

function runs(letters) {
  const across = [];
  const down = [];
  for (let r = 0; r < SIZE; r += 1) {
    let c = 0;
    while (c < SIZE) {
      if (letters[r][c] === BLOCK) { c += 1; continue; }
      const cells = [];
      while (c < SIZE && letters[r][c] !== BLOCK) { cells.push([r, c]); c += 1; }
      across.push(cells);
    }
  }
  for (let c = 0; c < SIZE; c += 1) {
    let r = 0;
    while (r < SIZE) {
      if (letters[r][c] === BLOCK) { r += 1; continue; }
      const cells = [];
      while (r < SIZE && letters[r][c] !== BLOCK) { cells.push([r, c]); r += 1; }
      down.push(cells);
    }
  }
  return { across, down };
}

function validPattern(letters) {
  const { across, down } = runs(letters);
  const all = [...across, ...down];
  if (all.some((cells) => cells.length < MIN_ENTRY_LENGTH)) return null;
  if (across.length < MIN_PER_DIRECTION || down.length < MIN_PER_DIRECTION) return null;
  const blocks = letters.flat().filter((x) => x === BLOCK).length;
  const entries = [
    ...across.map((cells) => ({ dir: 'across', cells })),
    ...down.map((cells) => ({ dir: 'down', cells })),
  ];
  return { across, down, entries, blocks };
}

function collectSolutions(entries, limit, accept = () => true) {
  const cellMap = new Map();
  entries.forEach((entry, i) => {
    for (const [r, c] of entry.cells) {
      const key = `${r},${c}`;
      if (!cellMap.has(key)) cellMap.set(key, []);
      cellMap.get(key).push(i);
    }
  });

  const assign = new Array(entries.length).fill(null);
  const solutions = [];
  let nodes = 0;

  function consistent(i, word) {
    const entry = entries[i];
    for (let j = 0; j < entry.cells.length; j += 1) {
      const [r, c] = entry.cells[j];
      for (const other of cellMap.get(`${r},${c}`)) {
        if (other === i || assign[other] == null) continue;
        const k = entries[other].cells.findIndex(([rr, cc]) => rr === r && cc === c);
        if (assign[other][k] !== word[j]) return false;
      }
    }
    return true;
  }

  function dirHasDuplicate(i, word) {
    const dir = entries[i].dir;
    for (let oi = 0; oi < entries.length; oi += 1) {
      if (oi !== i && entries[oi].dir === dir && assign[oi] === word) return true;
    }
    return false;
  }

  function candidates(i) {
    const list = buckets.get(entries[i].cells.length);
    if (!list) return [];
    return list.filter((w) => consistent(i, w) && !dirHasDuplicate(i, w));
  }

  function solve() {
    if (solutions.length >= limit || nodes > NODE_CAP) return;
    nodes += 1;
    let best = -1;
    let bestC = null;
    for (let i = 0; i < entries.length; i += 1) {
      if (assign[i] != null) continue;
      const c = candidates(i);
      if (c.length === 0) return;
      if (bestC === null || c.length < bestC.length) {
        best = i;
        bestC = c;
        if (c.length === 1) break;
      }
    }
    if (best === -1) {
      if (accept(assign)) solutions.push(assign.slice());
      return;
    }
    for (const word of bestC) {
      assign[best] = word;
      solve();
      assign[best] = null;
      if (solutions.length >= limit || nodes > NODE_CAP) return;
    }
  }

  solve();
  return solutions;
}

function numberCells(grid) {
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

function makePuzzle(pattern, assign, id) {
  const grid = pattern.letters.map((row) => row.slice());
  pattern.entries.forEach((entry, i) => {
    entry.cells.forEach(([r, c], j) => {
      grid[r][c] = assign[i][j];
    });
  });

  const numbers = numberCells(grid);
  const clues = { across: {}, down: {} };
  for (let i = 0; i < pattern.entries.length; i += 1) {
    const entry = pattern.entries[i];
    const [r, c] = entry.cells[0];
    const number = numbers.get(`${r},${c}`);
    if (!number) throw new Error(`entry without number at ${r},${c}`);
    const clue = wordClue(assign[i]);
    if (!clue) throw new Error(`missing clue for ${assign[i]}`);
    clues[entry.dir][number] = clue;
  }

  return {
    id: String(id).padStart(3, '0'),
    title: TITLES[(id - 1) % TITLES.length],
    difficulty: pattern.blocks <= 1 ? 'easy' : pattern.blocks <= 4 ? 'medium' : 'hard',
    grid: grid.map((row) => row.join('')),
    clues,
  };
}

function signature(words) {
  return words.slice().sort().join(',');
}

function isDegenerate(entries, assign) {
  const wordsFor = (dir) =>
    entries
      .filter((e) => e.dir === dir)
      .map((e) => assign[entries.indexOf(e)])
      .slice()
      .sort()
      .join(',');
  return wordsFor('across') === wordsFor('down');
}

function sharedCount(entries, assign) {
  const across = new Set();
  const down = new Set();
  entries.forEach((entry, i) => {
    (entry.dir === 'across' ? across : down).add(assign[i]);
  });
  let n = 0;
  for (const word of across) if (down.has(word)) n += 1;
  return n;
}

function main() {
  const patterns = [];
  for (let mask = 0; mask < (1 << CELLS); mask += 1) {
    const letters = buildBlocks(mask);
    const info = validPattern(letters);
    if (info) {
      patterns.push({ letters, ...info, symmetric: isSymmetric(letters), border: hasBorderLine(letters) });
    }
  }
  patterns.sort((a, b) => {
    const scoreA = (a.border ? 10 : 0) + a.blocks;
    const scoreB = (b.border ? 10 : 0) + b.blocks;
    if (scoreA !== scoreB) return scoreA - scoreB;
    if (a.symmetric !== b.symmetric) return a.symmetric ? -1 : 1;
    return 0;
  });

  const nonDegen = (pattern) => (assign) => !isDegenerate(pattern.entries, assign);

  const candidates = [];
  const candidateSigs = new Set();
  for (const pattern of patterns) {
    const fresh = collectSolutions(pattern.entries, SOLUTIONS_PER_PATTERN, nonDegen(pattern));
    const fallback = collectSolutions(pattern.entries, GEOMETRY_FALLBACK);
    for (const assign of [...fresh, ...fallback]) {
      const words = pattern.entries.map((e, i) => assign[i]);
      const sig = signature(words);
      if (candidateSigs.has(sig)) continue;
      candidateSigs.add(sig);
      const degenerate = isDegenerate(pattern.entries, assign);
      const fullSquare = pattern.blocks === 0 && !degenerate;
      candidates.push({
        pattern,
        assign,
        words,
        sig,
        degenerate,
        shared: sharedCount(pattern.entries, assign),
        shapeScore:
          (fullSquare ? FULL_SQUARE_BONUS : 0) +
          (pattern.border ? SHAPE_BORDER_PENALTY : 0) +
          pattern.blocks * SHAPE_BLOCK_WEIGHT +
          (pattern.symmetric ? 0 : SHAPE_ASYMMETRY_PENALTY),
      });
    }
  }

  console.log(`valid patterns:  ${patterns.length}`);
  console.log(`candidate fills: ${candidates.length}`);

  const chosen = [];
  const chosenSigs = new Set();
  const usedWords = new Map();
  const patternUse = new Map();
  const patternKey = (pattern) => pattern.letters.map((row) => row.join('')).join('/');

  while (chosen.length < TARGET) {
    let best = null;
    let bestCost = Infinity;
    for (const cand of candidates) {
      if (chosenSigs.has(cand.sig)) continue;
      const cap = cand.pattern.blocks === 0 ? MAX_FULL_SQUARES : MAX_PER_PATTERN;
      if ((patternUse.get(patternKey(cand.pattern)) ?? 0) >= cap) continue;
      let reuse = 0;
      let heavy = 0;
      for (const w of cand.words) {
        const n = usedWords.get(w) ?? 0;
        if (n > 0) reuse += 1;
        if (n > 1) heavy += 1;
      }
      const cost =
        cand.shapeScore +
        (cand.degenerate ? DEGENERATE_PENALTY : 0) +
        cand.shared * SHARED_WORD_PENALTY +
        reuse * REUSE_PENALTY +
        heavy * HEAVY_REUSE_PENALTY;
      if (cost < bestCost) {
        bestCost = cost;
        best = cand;
      }
    }
    if (!best) break;
    chosenSigs.add(best.sig);
    patternUse.set(patternKey(best.pattern), (patternUse.get(patternKey(best.pattern)) ?? 0) + 1);
    for (const w of best.words) usedWords.set(w, (usedWords.get(w) ?? 0) + 1);
    chosen.push(best);
  }

  const puzzles = chosen.map((c, i) => makePuzzle(c.pattern, c.assign, i + 1));

  const doc = { version: 1, size: SIZE, minEntryLength: MIN_ENTRY_LENGTH, puzzles };
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');

  console.log(`\nwrote ${puzzles.length}/${TARGET} puzzles to ${OUT_PATH}\n`);
  puzzles.forEach((p, i) => {
    const blocks = p.grid.join('').split('').filter((x) => x === BLOCK).length;
    const tag = chosen[i].degenerate ? ' [symmetric fill]' : '';
    console.log(`#${p.id} ${p.title} [${p.difficulty}] blocks=${blocks}${tag}`);
    p.grid.forEach((row) => console.log(`    ${row.split('').join(' ')}`));
    const across = Object.entries(p.clues.across).sort((a, b) => a[0] - b[0]);
    const down = Object.entries(p.clues.down).sort((a, b) => a[0] - b[0]);
    console.log(`    A: ${across.map(([n, c]) => `${n}. ${c}`).join(' | ')}`);
    console.log(`    D: ${down.map(([n, c]) => `${n}. ${c}`).join(' | ')}`);
    console.log('');
  });
}

main();
