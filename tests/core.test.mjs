import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePuzzle } from '../src/core/puzzle.js';
import { createGame } from '../src/core/game.js';
import { formatTime } from '../src/core/timer.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const doc = JSON.parse(readFileSync(join(HERE, '..', 'src', 'data', 'puzzles.json'), 'utf8'));

function parseAll() {
  return doc.puzzles.map((source) => parsePuzzle(source));
}

// Re-select a cell without triggering the same-cell direction toggle.
function select(game, cell) {
  const other = game.puzzle.cells.find((c) => c.row !== cell.row || c.col !== cell.col);
  game.selectCell(other.row, other.col);
  game.selectCell(cell.row, cell.col);
}

function blockedPuzzle() {
  return parseAll().find((p) => p.cellGrid.flat().some((c) => c.block));
}

test('document shape', () => {
  assert.equal(doc.version, 1);
  assert.equal(doc.size, 4);
  assert.equal(doc.minEntryLength, 3);
  assert.ok(Array.isArray(doc.puzzles));
  assert.ok(doc.puzzles.length >= 1);
});

test('every puzzle parses with consistent entries and clues', () => {
  for (const source of doc.puzzles) {
    const puzzle = parsePuzzle(source);
    assert.equal(puzzle.size, 4);
    assert.ok(puzzle.across.length >= 2, `${source.id} needs across entries`);
    assert.ok(puzzle.down.length >= 2, `${source.id} needs down entries`);
    for (const entry of [...puzzle.across, ...puzzle.down]) {
      assert.ok(entry.answer.length >= doc.minEntryLength, `${source.id} ${entry.id} too short`);
      assert.ok(entry.clue.length > 0, `${source.id} ${entry.id} missing clue`);
      const fromGrid = entry.cells.map((c) => puzzle.solution[c.row][c.col]).join('');
      assert.equal(entry.answer, fromGrid, `${source.id} ${entry.id} answer mismatch`);
    }
  }
});

test('edges of the grid are only black or belong to a crossing word', () => {
  for (const puzzle of parseAll()) {
    for (const cell of puzzle.cells) {
      assert.ok(cell.acrossId || cell.downId, 'white cell with no entry');
    }
  }
});

test('selection toggles direction on the same cell', () => {
  const game = createGame(parseAll()[0]);
  const first = game.getSelection();
  game.selectCell(first.row, first.col);
  assert.equal(game.getDirection(), 'down');
  game.selectCell(first.row, first.col);
  assert.equal(game.getDirection(), 'across');
});

test('typing stores a letter and auto-advances', () => {
  const game = createGame(parseAll()[0]);
  const entry = game.getActiveEntry();
  select(game, entry.cells[0]);
  game.typeLetter('Q');
  assert.equal(game.getLetters()[entry.cells[0].row][entry.cells[0].col], 'Q');
  assert.deepEqual(game.getSelection(), { row: entry.cells[1].row, col: entry.cells[1].col });
});

test('invalid input is ignored', () => {
  const game = createGame(parseAll()[0]);
  const before = JSON.stringify(game.getState().letters);
  game.typeLetter('1');
  game.typeLetter('!');
  game.typeLetter('ab');
  assert.equal(JSON.stringify(game.getState().letters), before);
});

test('check flags only the wrong filled cells', () => {
  const game = createGame(parseAll()[0]);
  const entry = game.getActiveEntry();
  select(game, entry.cells[0]);
  const wrong = entry.answer[0] === 'Z' ? 'Q' : 'Z';
  game.typeLetter(wrong);
  assert.equal(game.check(), 1);
  assert.ok(game.isWrong(entry.cells[0].row, entry.cells[0].col));
  assert.ok(!game.isWrong(entry.cells[1].row, entry.cells[1].col));
});

test('hint fills the selected cell and clears its wrong mark', () => {
  const game = createGame(parseAll()[0]);
  const entry = game.getActiveEntry();
  select(game, entry.cells[0]);
  game.typeLetter('Z');
  select(game, entry.cells[0]);
  game.hint();
  assert.equal(game.getLetters()[entry.cells[0].row][entry.cells[0].col], entry.answer[0]);
  assert.ok(!game.isWrong(entry.cells[0].row, entry.cells[0].col));
});

test('backspace clears the current cell, then steps back', () => {
  const game = createGame(parseAll()[0]);
  const entry = game.getActiveEntry();
  select(game, entry.cells[0]);
  game.typeLetter('A');
  game.typeLetter('B');
  select(game, entry.cells[1]);
  game.backspace();
  assert.equal(game.getLetters()[entry.cells[1].row][entry.cells[1].col], '');
  game.backspace();
  assert.equal(game.getLetters()[entry.cells[0].row][entry.cells[0].col], '');
  assert.deepEqual(game.getSelection(), { row: entry.cells[0].row, col: entry.cells[0].col });
});

test('arrow keys move the selection and skip blocks', () => {
  const game = createGame(blockedPuzzle());
  const start = game.getSelection();
  game.move(0, 1);
  const after = game.getSelection();
  assert.ok(after.row !== start.row || after.col !== start.col);
  const cell = game.puzzle.cellGrid[after.row][after.col];
  assert.ok(!cell.block, 'selection never lands on a block');
});

test('the grid never selects a black cell on tap', () => {
  const puzzle = blockedPuzzle();
  const game = createGame(puzzle);
  const block = puzzle.cellGrid.flat().find((c) => c.block);
  const before = game.getSelection();
  game.selectCell(block.row, block.col);
  assert.deepEqual(game.getSelection(), before);
});

test('filling every cell wins', () => {
  const game = createGame(parseAll()[0]);
  for (const cell of game.puzzle.cells) {
    select(game, cell);
    game.typeLetter(cell.solution);
  }
  assert.equal(game.getStatus(), 'won');
  assert.ok(game.isComplete());
});

test('reveal wins the puzzle', () => {
  const game = createGame(parseAll()[1]);
  game.reveal();
  assert.equal(game.getStatus(), 'won');
});

test('a wrong letter does not win the puzzle', () => {
  const game = createGame(parseAll()[0]);
  for (const cell of game.puzzle.cells) {
    select(game, cell);
    game.typeLetter(cell.solution === 'A' ? 'B' : 'A');
  }
  assert.notEqual(game.getStatus(), 'won');
});

test('stored letters are sanitised and blocks stay empty', () => {
  const puzzle = blockedPuzzle();
  const letters = ['ZZZZ', 'ZZZZ', 'ZZZZ', 'ZZZZ'];
  const game = createGame(puzzle, { letters });
  for (const cell of puzzle.cellGrid.flat()) {
    const value = game.getLetters()[cell.row][cell.col];
    if (cell.block) assert.equal(value, '');
    else assert.equal(value, 'Z');
  }
});

test('saved state round-trips letters in any column', () => {
  const puzzle = parseAll()[0];
  const game = createGame(puzzle);
  const lastInRow = puzzle.cellGrid[0][3];
  select(game, lastInRow);
  game.typeLetter('R');
  const state = game.getState();
  assert.equal(state.letters[0][3], 'R');
  assert.equal(state.letters[0][1], '', 'empty cells keep their position');
  const restored = createGame(puzzle, {
    letters: state.letters,
    selection: state.selection,
    direction: state.direction,
  });
  assert.equal(restored.getLetters()[0][3], 'R');
  assert.equal(restored.getLetters()[0][0], '');
});

test('input is ignored once the puzzle is won', () => {
  const game = createGame(parseAll()[0]);
  game.reveal();
  const snapshot = JSON.stringify(game.getState().letters);
  select(game, game.puzzle.cells[0]);
  game.typeLetter('Q');
  game.backspace();
  assert.equal(JSON.stringify(game.getState().letters), snapshot);
});

test('a won puzzle restores as won and does not accept input', () => {
  const source = doc.puzzles[0];
  const solved = createGame(parsePuzzle(source));
  solved.reveal();
  const restored = createGame(parsePuzzle(source), {
    letters: solved.getState().letters,
    status: 'won',
  });
  assert.equal(restored.getStatus(), 'won');
});

test('formatTime renders m:ss', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(1000), '0:01');
  assert.equal(formatTime(65000), '1:05');
  assert.equal(formatTime(600000), '10:00');
});
