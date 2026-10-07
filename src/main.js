import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/board.css';

import data from './data/puzzles.json';
import { parsePuzzle } from './core/puzzle.js';
import { createGame } from './core/game.js';
import { createTimer, formatTime } from './core/timer.js';
import { loadState, saveState } from './core/storage.js';
import { createBoard } from './ui/board.js';
import { createClueView } from './ui/clue.js';
import { createKeyboard } from './ui/keyboard.js';
import { createControls } from './ui/controls.js';
import { createWin } from './ui/win.js';

const puzzles = data.puzzles;
const clampIndex = (value) =>
  Number.isInteger(value) && value >= 0 && value < puzzles.length ? value : 0;

const els = {
  title: document.getElementById('puzzle-title'),
  sub: document.getElementById('puzzle-sub'),
  timer: document.getElementById('timer'),
  board: document.getElementById('board'),
  cluebar: document.getElementById('cluebar'),
  clueLists: document.getElementById('clue-lists'),
  controls: document.getElementById('controls'),
  keyboard: document.getElementById('keyboard'),
  win: document.getElementById('win'),
};

let game = null;
let board = null;
let clueView = null;
let controls = null;
let win = null;
const timer = createTimer();
let puzzleIndex = 0;
let started = false;
let paused = false;
let saveHandle = null;

function persist() {
  if (!game) return;
  const state = game.getState();
  saveState({
    version: 1,
    puzzleId: game.puzzle.id,
    puzzleIndex,
    letters: state.letters,
    selection: state.selection,
    direction: state.direction,
    elapsedMs: Math.round(timer.millis()),
    won: state.status === 'won',
  });
}

function schedulePersist() {
  if (saveHandle) clearTimeout(saveHandle);
  saveHandle = setTimeout(() => {
    saveHandle = null;
    persist();
  }, 200);
}

function ensureStarted() {
  if (!started && game && game.getStatus() === 'playing') {
    started = true;
    timer.start();
  }
}

function focusSelected() {
  const selection = game.getSelection();
  board.focusCell(selection.row, selection.col);
}

function handleSelect(row, col) {
  ensureStarted();
  game.selectCell(row, col);
}

function handleEntrySelect(entry) {
  ensureStarted();
  const first = entry.cells[0];
  const selection = game.getSelection();
  const sameCell = selection.row === first.row && selection.col === first.col;
  if (!sameCell) game.selectCell(first.row, first.col);
  if (game.getDirection() !== entry.dir) game.toggleDirection();
  focusSelected();
}

function render() {
  const state = game.getState();
  board.render(state, game);
  clueView.render(state);
  controls.render(state);
  win.render(state, `${game.puzzle.title} solved!`, formatTime(timer.millis()));
  els.timer.textContent = formatTime(timer.millis());
  schedulePersist();
}

function loadPuzzle(index, restore = null) {
  puzzleIndex = clampIndex(index);
  const source = puzzles[puzzleIndex];
  const puzzle = parsePuzzle(source);
  els.title.textContent = puzzle.title;
  els.sub.textContent = `Puzzle ${puzzle.id} \u00B7 ${puzzle.difficulty}`;

  const validRestore = restore && restore.puzzleId === source.id ? restore : null;
  game = createGame(puzzle, {
    letters: validRestore?.letters,
    selection: validRestore?.selection,
    direction: validRestore?.direction,
    status: validRestore?.won ? 'won' : 'playing',
  });

  timer.reset(validRestore?.elapsedMs ?? 0);
  started = Boolean(validRestore?.won);
  paused = false;

  els.board.replaceChildren();
  board = createBoard(els.board, puzzle, { onSelect: handleSelect });

  els.clueLists.replaceChildren();
  clueView = createClueView({
    bar: els.cluebar,
    list: els.clueLists,
    puzzle,
    onSelectEntry: handleEntrySelect,
  });

  win.reset();
  game.subscribe((state) => {
    if (state.status === 'won' && timer.isRunning()) {
      timer.stop();
      started = true;
    }
    render();
  });
}

function nextPuzzle() {
  loadPuzzle((puzzleIndex + 1) % puzzles.length);
}

controls = createControls(els.controls, {
  onCheck: () => {
    ensureStarted();
    game.check();
  },
  onHint: () => {
    ensureStarted();
    game.hint();
  },
  onReveal: () => {
    ensureStarted();
    game.reveal();
  },
  onNext: nextPuzzle,
});

createKeyboard(els.keyboard, {
  onLetter: (letter) => {
    ensureStarted();
    game.typeLetter(letter);
  },
  onBackspace: () => {
    ensureStarted();
    game.backspace();
  },
});

win = createWin(els.win, {
  onNext: nextPuzzle,
  onClose: focusSelected,
});

document.addEventListener('keydown', (event) => {
  if (!game) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (!els.win.hidden) return;

  const active = document.activeElement;
  const onCell = Boolean(active && active.classList && active.classList.contains('cell'));
  const onOtherButton = Boolean(active && active.tagName === 'BUTTON') && !onCell;
  const key = event.key;

  if (key.length === 1 && /[a-zA-Z]/.test(key)) {
    ensureStarted();
    game.typeLetter(key);
    event.preventDefault();
    return;
  }
  if (key === 'Backspace' || key === 'Delete') {
    ensureStarted();
    game.backspace();
    event.preventDefault();
    return;
  }
  if (key === 'ArrowLeft') { ensureStarted(); game.move(0, -1); focusSelected(); event.preventDefault(); return; }
  if (key === 'ArrowRight') { ensureStarted(); game.move(0, 1); focusSelected(); event.preventDefault(); return; }
  if (key === 'ArrowUp') { ensureStarted(); game.move(-1, 0); focusSelected(); event.preventDefault(); return; }
  if (key === 'ArrowDown') { ensureStarted(); game.move(1, 0); focusSelected(); event.preventDefault(); return; }
  if ((key === ' ' || key === 'Enter') && !onOtherButton) {
    ensureStarted();
    game.toggleDirection();
    event.preventDefault();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (timer.isRunning()) {
      timer.stop();
      paused = true;
    }
    persist();
  } else if (paused && game && game.getStatus() === 'playing') {
    timer.start();
    paused = false;
  }
});

window.addEventListener('pagehide', persist);

setInterval(() => {
  els.timer.textContent = formatTime(timer.millis());
}, 250);

const saved = loadState();
loadPuzzle(Number.isInteger(saved?.puzzleIndex) ? saved.puzzleIndex : 0, saved);
