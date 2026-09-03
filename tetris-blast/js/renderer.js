/* ============================================================
   renderer.js — draws the board onto the game canvas.

   Three things keep this cheap:

   1. Every block face is rasterised once per colour into a 32x32
      offscreen tile. Drawing a cell is one drawImage instead of
      five fillRects, so a full stack is ~200 stamps.
   2. The empty well (background wash + grid lines) is pre-rendered
      once and blitted in a single call.
   3. Frames are skipped entirely when nothing has changed —
      see needsRedraw(). Sitting on the title screen or holding a
      piece still costs almost nothing.
   ============================================================ */

const Renderer = (function () {

  let ctx;

  /* ---------------- colour helpers ---------------- */

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amount > 0) {
      r += (255 - r) * amount; g += (255 - g) * amount; b += (255 - b) * amount;
    } else {
      r *= (1 + amount); g *= (1 + amount); b *= (1 + amount);
    }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  function newCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv;
  }

  /* ---------------- tile cache ---------------- */

  const tiles = {};   // colour -> canvas
  const ghosts = {};  // colour -> canvas

  function tile(colour) {
    if (tiles[colour]) return tiles[colour];
    const cv = newCanvas(CELL, CELL);
    const c = cv.getContext('2d');

    c.fillStyle = colour;
    c.fillRect(1, 1, CELL - 2, CELL - 2);
    c.fillStyle = shade(colour, 0.45);            // top / left bevel
    c.fillRect(1, 1, CELL - 2, 3);
    c.fillRect(1, 1, 3, CELL - 2);
    c.fillStyle = shade(colour, -0.42);           // bottom / right bevel
    c.fillRect(1, CELL - 4, CELL - 2, 3);
    c.fillRect(CELL - 4, 1, 3, CELL - 2);
    c.fillStyle = shade(colour, 0.12);            // inner face
    c.fillRect(5, 5, CELL - 10, CELL - 10);

    tiles[colour] = cv;
    return cv;
  }

  function ghostTile(colour) {
    if (ghosts[colour]) return ghosts[colour];
    const cv = newCanvas(CELL, CELL);
    const c = cv.getContext('2d');
    c.globalAlpha = 0.10;
    c.fillStyle = colour;
    c.fillRect(3, 3, CELL - 6, CELL - 6);
    c.globalAlpha = 0.32;
    c.strokeStyle = colour;
    c.lineWidth = 2;
    c.strokeRect(4, 4, CELL - 8, CELL - 8);
    ghosts[colour] = cv;
    return cv;
  }

  /* ---------------- pre-rendered well ---------------- */

  let wellCanvas = null;

  function buildWell() {
    wellCanvas = newCanvas(BOARD_W, BOARD_H);
    const c = wellCanvas.getContext('2d');
    c.fillStyle = 'rgba(4,2,16,0.62)';
    c.fillRect(0, 0, BOARD_W, BOARD_H);
    c.strokeStyle = 'rgba(255,255,255,0.045)';
    c.lineWidth = 1;
    c.beginPath();
    for (let x = 1; x < COLS; x++) { c.moveTo(x * CELL + 0.5, 0); c.lineTo(x * CELL + 0.5, BOARD_H); }
    for (let y = 1; y < ROWS; y++) { c.moveTo(0, y * CELL + 0.5); c.lineTo(BOARD_W, y * CELL + 0.5); }
    c.stroke();
  }

  function init(canvas) {
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    buildWell();
    for (const k of PIECE_KEYS) { tile(PIECES[k].color); ghostTile(PIECES[k].color); }
  }

  /* ---------------- board pieces ---------------- */

  function drawStack(s) {
    const clearing = s.phase === 'clearing';
    const t = clearing ? s.clearTimer / CLEAR_TIME : 0;

    for (let r = 0; r < ROWS; r++) {
      const isClearing = clearing && s.clearingRows.indexOf(r) !== -1;

      let squash = 1, flash = 0;
      if (isClearing) {
        if (t < 0.60)      flash = 0;
        else if (t < 0.78) flash = (t - 0.60) / 0.18;
        else { flash = 1; squash = 1 - (t - 0.78) / 0.22; }
        if (squash <= 0.02) continue;
      }

      const h = CELL * squash;
      const yOff = (CELL - h) / 2;

      for (let c = 0; c < COLS; c++) {
        const colour = s.grid[r][c];
        if (!colour) continue;
        const x = c * CELL, y = r * CELL + yOff;

        if (squash === 1) ctx.drawImage(tile(colour), x, y);
        else {
          ctx.globalAlpha = squash;
          ctx.drawImage(tile(colour), x, y, CELL, h);
          ctx.globalAlpha = 1;
        }

        if (flash > 0) {
          ctx.globalAlpha = flash * 0.85;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + 1, y + 1, CELL - 2, Math.max(1, h - 2));
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  function drawGhost(s) {
    if (!s.piece) return;
    const gy = Game.ghostY();
    if (gy === s.piece.y) return;
    const img = ghostTile(s.piece.colour);
    const m = s.piece.matrix;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const y = gy + r;
        if (y < 0) continue;
        ctx.drawImage(img, (s.piece.x + c) * CELL, y * CELL);
      }
    }
  }

  function drawPiece(s) {
    if (!s.piece) return;
    const p = s.piece;
    // pulse while resting on the stack, so the lock delay is visible
    const img = tile(p.colour);
    const m = p.matrix;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const y = p.y + r;
        if (y < 0) continue;
        ctx.drawImage(img, (p.x + c) * CELL, y * CELL);
      }
    }
    if (s.landed) {
      const a = 0.10 + 0.14 * Math.sin(performance.now() / 70);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = '#ffffff';
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          if (!m[r][c]) continue;
          const y = p.y + r;
          if (y < 0) continue;
          ctx.fillRect((p.x + c) * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  function stackTop(s) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) if (s.grid[r][c]) return r;
    }
    return ROWS;
  }

  function drawDanger(s) {
    if (stackTop(s) > 4) return;
    const a = 0.09 + 0.09 * Math.sin(performance.now() / 220);
    ctx.fillStyle = 'rgba(255,60,90,' + a.toFixed(3) + ')';
    ctx.fillRect(0, 0, BOARD_W, 4 * CELL);
  }

  /* ---------------- dirty tracking ---------------- */

  let lastSig = '';

  function signature(s) {
    const p = s.piece;
    return s.phase + '|' + s.version + '|' +
        (p ? p.x + ',' + p.y + ',' + p.rot + ',' + p.key : '-') + '|' +
        (s.landed ? 1 : 0) + '|' +
        (s.phase === 'clearing' ? Math.round(s.clearTimer * 60) : 0);
  }

  /**
   * Redraw only when something actually moved. Returns true if a
   * frame was painted, which the loop uses for its FPS readout.
   */
  function draw(s, force) {
    const sig = signature(s);
    const animating = FX.isActive() || s.landed || stackTop(s) <= 4;

    if (!force && !animating && sig === lastSig) return false;
    lastSig = sig;

    ctx.clearRect(0, 0, BOARD_W, BOARD_H);
    ctx.save();
    ctx.translate(Math.round(FX.shake.x), Math.round(FX.shake.y));

    ctx.drawImage(wellCanvas, 0, 0);
    drawDanger(s);
    FX.drawUnderPieces(ctx);
    drawStack(s);
    drawGhost(s);
    drawPiece(s);
    FX.drawOverPieces(ctx);

    ctx.restore();
    return true;
  }

  function invalidate() { lastSig = ''; }

  /* ---------------- previews ---------------- */

  function drawMini(context, key, cx, cy, cell) {
    const def = PIECES[key];
    const m = def.matrix;

    let minR = 99, maxR = -1, minC = 99, maxC = -1;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c]) {
          if (r < minR) minR = r; if (r > maxR) maxR = r;
          if (c < minC) minC = c; if (c > maxC) maxC = c;
        }
      }
    }

    const ox = cx - (maxC - minC + 1) * cell / 2;
    const oy = cy - (maxR - minR + 1) * cell / 2;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (!m[r][c]) continue;
        context.drawImage(tile(def.color),
            ox + (c - minC) * cell, oy + (r - minR) * cell, cell, cell);
      }
    }
  }

  function drawNext(context, queue, w, h) {
    context.clearRect(0, 0, w, h);
    const slot = h / 3;
    for (let i = 0; i < Math.min(3, queue.length); i++) {
      context.globalAlpha = i === 0 ? 1 : 0.55;
      drawMini(context, queue[i], w / 2, slot * i + slot / 2, i === 0 ? 20 : 15);
    }
    context.globalAlpha = 1;
  }

  function drawHold(context, key, used, w, h) {
    context.clearRect(0, 0, w, h);
    if (!key) return;
    context.globalAlpha = used ? 0.3 : 1;
    drawMini(context, key, w / 2, h / 2, 19);
    context.globalAlpha = 1;
  }

  return { init, draw, invalidate, drawNext, drawHold };
})();
