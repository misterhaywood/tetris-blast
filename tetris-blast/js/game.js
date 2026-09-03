/* ============================================================
   game.js — rules only. Knows nothing about canvases or keys.

   States: menu | playing | clearing | paused | over
   ============================================================ */

const Game = (function () {

  const state = {
    phase: 'menu',
    grid: [],            // grid[row][col] = colour string or null
    piece: null,         // { key, matrix, x, y, colour, light }
    hold: null,          // piece key
    holdUsed: false,
    queue: [],           // upcoming piece keys
    bag: [],
    score: 0,
    best: 0,
    lines: 0,
    level: 1,
    combo: 0,
    gravityAcc: 0,
    lockTimer: 0,
    lockResets: 0,
    landed: false,
    clearTimer: 0,
    clearingRows: [],
    version: 0,          // bumps whenever the settled stack changes
    spawnTimer: 0,
    fighterIndex: 0,
    onClear: null,       // callback(rows, gridSnapshot)
    onGameOver: null,
    onLevelUp: null
  };

  /* ---------------- board helpers ---------------- */

  function emptyGrid() {
    const g = [];
    for (let r = 0; r < ROWS; r++) g.push(new Array(COLS).fill(null));
    return g;
  }

  function refillBag() {
    const bag = PIECE_KEYS.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = bag[i]; bag[i] = bag[j]; bag[j] = t;
    }
    state.bag = bag;
  }

  function nextKey() {
    if (state.bag.length === 0) refillBag();
    return state.bag.pop();
  }

  function fillQueue() {
    while (state.queue.length < 3) state.queue.push(nextKey());
  }

  function makePiece(key) {
    const def = PIECES[key];
    const matrix = def.matrix.map(row => row.slice());
    return {
      key: key,
      matrix: matrix,
      rot: 0,            // 0-3, only used by the renderer's dirty check
      colour: def.color,
      light: def.light,
      x: Math.floor((COLS - matrix[0].length) / 2),
      y: key === 'I' ? -1 : 0
    };
  }

  function collides(matrix, px, py) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const x = px + c, y = py + r;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && state.grid[y][x]) return true;
      }
    }
    return false;
  }

  function rotateMatrix(m, dir) {
    const n = m.length;
    const out = [];
    for (let r = 0; r < n; r++) out.push(new Array(n).fill(0));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (dir > 0) out[c][n - 1 - r] = m[r][c];
        else         out[n - 1 - c][r] = m[r][c];
      }
    }
    return out;
  }

  function ghostY() {
    if (!state.piece) return 0;
    let y = state.piece.y;
    while (!collides(state.piece.matrix, state.piece.x, y + 1)) y++;
    return y;
  }

  /* ---------------- lifecycle ---------------- */

  function spawn() {
    fillQueue();
    const key = state.queue.shift();
    fillQueue();
    state.piece = makePiece(key);
    state.holdUsed = false;
    state.landed = false;
    state.lockTimer = 0;
    state.lockResets = 0;
    state.gravityAcc = 0;

    if (collides(state.piece.matrix, state.piece.x, state.piece.y)) {
      state.phase = 'over';
      state.piece = null;
      if (state.score > state.best) state.best = state.score;
      if (state.onGameOver) state.onGameOver();
    }
  }

  /* Drop back to the title screen: board wiped, run stats reset,
     best score kept. Used by "back to start" after a game over so
     the theme and fighter pickers become available again. */
  function toMenu() {
    state.phase = 'menu';
    state.grid = emptyGrid();
    state.piece = null;
    state.hold = null;
    state.holdUsed = false;
    state.queue = [];
    state.bag = [];
    state.score = 0;
    state.lines = 0;
    state.level = 1;
    state.combo = 0;
    state.clearingRows = [];
    state.clearTimer = 0;
    state.version++;
  }

  function start() {
    state.grid = emptyGrid();
    state.piece = null;
    state.hold = null;
    state.holdUsed = false;
    state.queue = [];
    state.bag = [];
    state.score = 0;
    state.lines = 0;
    state.level = 1;
    state.combo = 0;
    state.version = 0;
    state.clearingRows = [];
    state.clearTimer = 0;
    state.spawnTimer = 0;
    state.phase = 'playing';
    refillBag();
    fillQueue();
    spawn();
  }

  function lockPiece() {
    const p = state.piece;
    for (let r = 0; r < p.matrix.length; r++) {
      for (let c = 0; c < p.matrix[r].length; c++) {
        if (!p.matrix[r][c]) continue;
        const y = p.y + r, x = p.x + c;
        if (y >= 0 && y < ROWS) state.grid[y][x] = p.colour;
      }
    }
    state.piece = null;
    state.version++;

    const full = [];
    for (let r = 0; r < ROWS; r++) {
      let complete = true;
      for (let c = 0; c < COLS; c++) if (!state.grid[r][c]) { complete = false; break; }
      if (complete) full.push(r);
    }

    if (full.length) {
      state.combo++;
      state.score += LINE_SCORE[Math.min(full.length, 4)] * state.level;
      if (state.combo > 1) state.score += COMBO_BONUS * (state.combo - 1) * state.level;

      state.clearingRows = full;
      state.clearTimer = 0;
      state.phase = 'clearing';

      if (state.onClear) state.onClear(full, state.grid);
    } else {
      state.combo = 0;
      state.spawnTimer = 0;
      state.phase = 'playing';
      spawn();
    }
  }

  function finishClear() {
    const rows = state.clearingRows;
    const kept = [];
    for (let r = 0; r < ROWS; r++) if (rows.indexOf(r) === -1) kept.push(state.grid[r]);
    while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(null));
    state.grid = kept;
    state.version++;

    state.lines += rows.length;
    const newLevel = Math.min(20, Math.floor(state.lines / 10) + 1);
    if (newLevel > state.level) {
      state.level = newLevel;
      if (state.onLevelUp) state.onLevelUp(newLevel);
    }

    state.clearingRows = [];
    state.phase = 'playing';
    spawn();
  }

  /* ---------------- actions ---------------- */

  function canAct() {
    return state.phase === 'playing' && state.piece;
  }

  function touchLock() {
    // moving or rotating while landed refreshes the lock delay
    if (state.landed && state.lockResets < LOCK_RESETS) {
      state.lockTimer = 0;
      state.lockResets++;
    }
  }

  function move(dx) {
    if (!canAct()) return false;
    if (collides(state.piece.matrix, state.piece.x + dx, state.piece.y)) return false;
    state.piece.x += dx;
    touchLock();
    return true;
  }

  function rotate(dir) {
    if (!canAct()) return false;
    const p = state.piece;
    if (p.key === 'O') return false;
    const rotated = rotateMatrix(p.matrix, dir);
    for (const k of KICKS) {
      if (!collides(rotated, p.x + k[0], p.y + k[1])) {
        p.matrix = rotated;
        p.rot = (p.rot + (dir > 0 ? 1 : 3)) % 4;
        p.x += k[0];
        p.y += k[1];
        touchLock();
        return true;
      }
    }
    return false;
  }

  function softDrop() {
    if (!canAct()) return false;
    if (collides(state.piece.matrix, state.piece.x, state.piece.y + 1)) return false;
    state.piece.y++;
    state.score += SOFT_DROP_PT;
    state.gravityAcc = 0;
    return true;
  }

  function hardDrop() {
    if (!canAct()) return 0;
    let d = 0;
    while (!collides(state.piece.matrix, state.piece.x, state.piece.y + 1)) {
      state.piece.y++;
      d++;
    }
    state.score += d * HARD_DROP_PT;
    lockPiece();
    return d;
  }

  function hold() {
    if (!canAct() || state.holdUsed) return false;
    const cur = state.piece.key;
    if (state.hold) {
      const swap = state.hold;
      state.hold = cur;
      state.piece = makePiece(swap);
    } else {
      state.hold = cur;
      fillQueue();
      const key = state.queue.shift();
      fillQueue();
      state.piece = makePiece(key);
    }
    state.holdUsed = true;
    state.landed = false;
    state.lockTimer = 0;
    state.lockResets = 0;
    state.gravityAcc = 0;
    if (collides(state.piece.matrix, state.piece.x, state.piece.y)) {
      state.phase = 'over';
      if (state.score > state.best) state.best = state.score;
      if (state.onGameOver) state.onGameOver();
    }
    return true;
  }

  function togglePause() {
    if (state.phase === 'playing' || state.phase === 'clearing') {
      state._resume = state.phase;
      state.phase = 'paused';
      return true;
    }
    if (state.phase === 'paused') {
      state.phase = state._resume || 'playing';
      return false;
    }
    return false;
  }

  /* ---------------- tick ---------------- */

  function update(dt) {
    if (state.phase === 'clearing') {
      state.clearTimer += dt;
      if (state.clearTimer >= CLEAR_TIME) finishClear();
      return;
    }

    if (state.phase !== 'playing' || !state.piece) return;

    const grounded = collides(state.piece.matrix, state.piece.x, state.piece.y + 1);

    if (grounded) {
      state.landed = true;
      state.lockTimer += dt;
      if (state.lockTimer >= LOCK_DELAY) lockPiece();
    } else {
      state.landed = false;
      state.lockTimer = 0;
      state.gravityAcc += dt;
      const step = gravityFor(state.level);
      while (state.gravityAcc >= step) {
        state.gravityAcc -= step;
        if (collides(state.piece.matrix, state.piece.x, state.piece.y + 1)) break;
        state.piece.y++;
      }
    }
  }

  /* ---------------- public ---------------- */

  return {
    state,
    start,
    toMenu,
    update,
    move,
    rotate,
    softDrop,
    hardDrop,
    hold,
    togglePause,
    ghostY,
    collides
  };
})();
