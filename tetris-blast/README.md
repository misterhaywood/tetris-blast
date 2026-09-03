# TETRIS BLAST

A full-speed Tetris built on `<canvas>`. Clear a line and a pixel-art fighter
sweeps in, winds up, and blasts the row off the board.

No frameworks, no build step, no dependencies. Open `index.html` and play.

---

## Play

**Locally** — double-click `index.html`. That's the whole install.

**On the web** — push to GitHub and turn on Pages (see below).

## Controls

| Key | Action |
| --- | --- |
| `←` `→` | Move (hold for auto-repeat) |
| `↓` | Soft drop |
| `↑` or `X` | Rotate clockwise |
| `Z` | Rotate counter-clockwise |
| `Space` | Hard drop |
| `C` | Hold piece |
| `P` | Pause |
| `Enter` | Start / restart |

Touch controls appear automatically on narrow screens.

## What's in it

**Proper Tetris rules.** 7-bag randomiser so you never get starved of an I-piece,
ghost piece, hold slot, three-piece preview, wall kicks, 500 ms lock delay with
15 movement resets, DAS and ARR tuned for stack-building, and combo scoring.

**Six animated themes.** Neon Grid, Deep Space, Synthwave, Aurora, Deep Blue,
Data Rain. Switch any time from the sidebar; the choice applies instantly.

**Six fighters.** Karateka, Blaze, Shinobi, Hexer, Titan and Volt — 20x24
arcade-style pixel art, each with its own palette, beam colour and shout.

These are original archetypes rather than lifts from real fighting games. A
recognisable Ryu or Scorpion sprite is the one asset in this project you
couldn't legally publish, and the whole point is that you can push this to a
public repo. The style is the arcade look, not any specific character.

**Locked-in loadout.** Theme and fighter are picked on the title screen and then
frozen — the panels grey out and the buttons disable while you play. Game over
returns you to the title card rather than restarting, so the pickers are live
again and you can switch before the next run.

## Why it doesn't lag

The earlier single-file version drove ~200 `<div>` elements and re-wrote their
inline styles every tick, while CSS keyframes animated glows and hue rotations on
top. That forces the browser to recalculate style, re-layout and re-paint the
whole tree several times a second, which is where the stutter came from.

This version fixes it structurally:

- **The board is one canvas.** No box-shadows, no per-cell gradients, no filters.
- **Everything repeated is cached.** Each block colour is rasterised once into a
  32x32 tile, the empty well is pre-rendered as a single image, and each
  fighter's sprite, beam, charge orb and halo are built once on selection.
  Drawing a cell is one `drawImage` instead of five `fillRect`s, and no gradient
  is ever constructed during a frame.
- **Idle frames are skipped.** The renderer keeps a signature of the game state
  and paints only when it changes or an effect is live. Sitting on the title
  screen or holding a piece paints roughly 1 frame in 60 instead of 60.
- **The wallpaper stops when the tab is hidden.**
- **One `requestAnimationFrame` loop** drives gameplay, effects and rendering,
  with delta timing so speed doesn't depend on refresh rate.
- **Backgrounds render at half resolution** on their own canvas and refresh at a
  capped 30 fps, independent of the game. Quarter the pixels, half the frames.
- **CSS stays static.** Nothing in the stylesheet animates, so the compositor has
  no layers to keep alive.
- **The HUD only touches the DOM when a number actually changes**, instead of
  every frame.

## Project layout

```
tetris-blast/
├── index.html          markup and canvas elements
├── css/
│   └── style.css       layout and chrome (deliberately static)
└── js/
    ├── config.js       constants, pieces, themes, fighters, word banks
    ├── sprites.js      16x16 pixel art and the sprite blitter
    ├── backgrounds.js  the six animated wallpapers
    ├── effects.js      fighter timeline, beams, particles, text, shake
    ├── game.js         rules only — no rendering, no input
    ├── renderer.js     draws the board and previews
    └── main.js         loop, input, HUD wiring
```

`game.js` has no reference to the DOM, which is what makes the rules testable on
their own and easy to change without breaking the visuals.

## Opening in IntelliJ IDEA / WebStorm

> Full step-by-step, including GitHub and Pages: see **[SETUP.md](SETUP.md)**.

1. **File → Open**, pick the `tetris-blast` folder.
2. Open `index.html`, then click a browser icon in the top-right of the editor
   (or right-click → **Open in Browser**). IDEA serves it on its built-in web
   server, so live-edit works — save a file and the page refreshes.

No run configuration, npm install, or SDK needed. It's a static project.

## Publishing to GitHub Pages

```bash
cd tetris-blast
git init
git add .
git commit -m "Tetris Blast"
git branch -M main
git remote add origin https://github.com/<you>/tetris-blast.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
The game goes live at `https://<you>.github.io/tetris-blast/`.

## Tweaking it

Almost everything worth changing lives in `js/config.js`:

- `gravityFor(level)` — the drop-speed curve
- `LOCK_DELAY`, `DAS_DELAY`, `ARR_RATE` — feel
- `PIECES` — tetromino colours
- `FIGHTERS` — palettes, beam colours, shouts
- `WORDS` — the impact text banks
- `THEMES` — which backgrounds appear in the picker

Adding a fighter is a palette object plus three beam colours — the sprite art in
`js/sprites.js` is shared, so a new character is about twelve lines. Adding a
background is one entry in `THEMES` plus one object in `backgrounds.js` with
`init`, `update` and `draw`.

The two sprite poses live in `js/sprites.js` as plain arrays of strings, one
character per pixel, with the legend at the top of the file. Edit them like
ASCII art — every row must stay 20 characters and there must be 24 rows.

## License

MIT.
