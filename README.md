# Mini Crossword (4×4)

A cozy, kid-to-family-friendly 4×4 mini crossword you can play in the browser.
Built with **Vite + vanilla JavaScript + plain CSS** — no framework, no backend, no external assets.

## Requirements

- Node.js 18+ (tested on 24)

## Commands

```bash
npm install            # install dev dependencies (Vite)

npm run dev            # start the dev server on http://localhost:5173
npm run build          # production build into dist/
npm run preview        # serve the production build locally

npm test               # run the core game-logic test suite (node --test)
npm run validate:puzzles   # verify every puzzle in puzzles.json
npm run generate:puzzles   # regenerate puzzles.json from the wordbank
```

## How to play

- Tap or click a cell to select it; tap the **same** cell again to switch between Across and Down.
- Type with the **on-screen keyboard** on touch devices, or your **physical keyboard** on desktop.
- `Backspace` deletes, `arrow keys` move, `Space`/`Enter` toggles the direction.
- **Check** marks wrong letters (with a strike-through), **Hint** reveals one letter, **Reveal** fills the puzzle.
- Finish the grid to see your time and move on with **Next puzzle**. Progress is saved to `localStorage`,
  so a refresh resumes the puzzle you were on.

## Project structure

```
src/
  main.js            app bootstrap: wires core <-> ui, timer, persistence
  core/
    puzzle.js        parse a puzzle, derive numbering and across/down entries
    game.js          pure game state: selection, typing, check/hint/reveal, win detection
    storage.js       localStorage save/restore (current puzzle only)
    timer.js         elapsed-time stopwatch + m:ss formatting
  ui/
    board.js         grid rendering, highlighting, cell states
    clue.js          active-clue bar + clue list
    keyboard.js      on-screen QWERTY keyboard
    controls.js      Check / Hint / Reveal / Next buttons
    win.js           win dialog (time + Next puzzle)
  data/
    puzzles.json     the 10 puzzles (generated, then validated)
  styles/            tokens, base, layout, board
scripts/
  wordbank.js        curated word -> clue map (3 and 4 letter words)
  generate-puzzles.mjs   solves interlocking grids and writes puzzles.json
  validate-puzzles.mjs   independent correctness check for puzzles.json
tests/
  core.test.mjs      node:test suite for the game-logic
```

## Puzzle format (`src/data/puzzles.json`)

```json
{
  "version": 1,
  "size": 4,
  "minEntryLength": 3,
  "puzzles": [
    {
      "id": "001",
      "title": "Warm Up",
      "difficulty": "easy",
      "grid": ["CALM", "AREA", "SEAT", "TAPE"],
      "clues": { "across": { "1": "..." }, "down": { "1": "..." } }
    }
  ]
}
```

- `#` in a grid row is a black block; any other character is the solution letter.
- Crossword numbers are **derived** from the grid, not stored.
- Answers are read straight from `grid`, so a puzzle can never disagree with itself.

### Adding puzzles

1. Add words and clues to `scripts/wordbank.js`.
2. Run `npm run generate:puzzles` to search for new valid grids.
3. Run `npm run validate:puzzles` to confirm every entry is a real word and interlocks.

## Wrapping for Android later (deferred)

Nothing Capacitor-specific is included yet. The build is already wrapper-ready:

- `vite.config.js` sets `base: './'` so asset URLs are relative.
- The layout is responsive and touch-friendly, with `viewport-fit=cover` and safe-area insets.

When you want the Android app:

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap init "Mini Crossword" com.example.minicrossword --web-dir=dist
npm run build
npx cap add android
npx cap sync
npx cap open android
```

## Notes

- Colors use the `oklch()` color space (supported by modern evergreen browsers / Android WebView 111+).
- The puzzle generator's fully-filled search can take ~30–40s; it is a one-time content step, not part of `dev`/`build`.
