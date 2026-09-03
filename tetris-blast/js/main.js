/* ============================================================
   main.js — boots everything, owns the loop and the input.
   ============================================================ */

(function () {

  /* ---------------- element handles ---------------- */

  const gameCanvas = document.getElementById('game-canvas');
  const nextCanvas = document.getElementById('next-canvas');
  const holdCanvas = document.getElementById('hold-canvas');
  const fighterCanvas = document.getElementById('fighter-canvas');

  const nextCtx = nextCanvas.getContext('2d');
  const holdCtx = holdCanvas.getContext('2d');
  const fighterCtx = fighterCanvas.getContext('2d');

  const overlay = document.getElementById('overlay');
  const overlayIcon = document.getElementById('overlay-icon');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayBody = document.getElementById('overlay-body');
  const startBtn = document.getElementById('start-btn');

  const uiScore = document.getElementById('ui-score');
  const uiBest = document.getElementById('ui-best');
  const uiLevel = document.getElementById('ui-level');
  const uiLines = document.getElementById('ui-lines');
  const uiCombo = document.getElementById('ui-combo');

  const themeButtons = document.getElementById('theme-buttons');
  const themeName = document.getElementById('theme-name');
  const fighterName = document.getElementById('fighter-name');
  const fighterBtn = document.getElementById('fighter-btn');
  const themePanel = document.getElementById('theme-panel');
  const fighterPanel = document.getElementById('fighter-panel');

  /* ---------------- selections ---------------- */

  let themeIndex = 0;
  let fighterIndex = 0;
  let activeFighter = null;   // locked in at kickoff, can't change mid-run
  const currentFighter = () => FIGHTERS[fighterIndex];

  /* ---------------- setup ---------------- */

  Renderer.init(gameCanvas);
  Background.init(document.getElementById('bg-canvas'));

  THEMES.forEach((theme, i) => {
    const b = document.createElement('button');
    b.style.background = theme.swatch;
    b.title = theme.name;
    if (i === 0) b.classList.add('active');
    b.addEventListener('click', () => setTheme(i));
    themeButtons.appendChild(b);
  });

  function setTheme(i) {
    if (controlsLocked) return;
    themeIndex = i;
    Background.set(THEMES[i].id);
    Renderer.invalidate();
    themeName.textContent = THEMES[i].name;
    Array.prototype.forEach.call(themeButtons.children, (el, k) => {
      el.classList.toggle('active', k === i);
    });
  }

  function setFighter(i) {
    if (controlsLocked && activeFighter) return;
    fighterIndex = (i + FIGHTERS.length) % FIGHTERS.length;
    FX.warm(currentFighter());
    fighterName.textContent = currentFighter().name;
    drawFighterPortrait(fighterCtx, currentFighter(),
        fighterCanvas.width, fighterCanvas.height);
  }

  fighterBtn.addEventListener('click', () => setFighter(fighterIndex + 1));

  /* Theme and fighter are chosen before the round and then frozen,
     so a run can't be restyled halfway through. They unlock again
     on game over. */
  let controlsLocked = false;

  function setControlsLocked(locked) {
    controlsLocked = locked;
    fighterBtn.disabled = locked;
    fighterBtn.textContent = locked ? 'LOCKED' : 'CHANGE';
    themePanel.classList.toggle('locked', locked);
    fighterPanel.classList.toggle('locked', locked);
    Array.prototype.forEach.call(themeButtons.children, el => { el.disabled = locked; });
  }

  setTheme(0);
  setFighter(0);

  /* ---------------- game callbacks ---------------- */

  Game.state.onClear = function (rows, grid) {
    FX.lineClear(rows, activeFighter || currentFighter(), grid);
  };

  Game.state.onLevelUp = function (level) {
    FX.pushText('LEVEL ' + level, BOARD_W / 2, BOARD_H * 0.6, 14,
        '#ffd93d', '#ff9f1c', 1.1);
    FX.addShake(7);
  };

  Game.state.onGameOver = function () {
    setControlsLocked(false);
    showOverlay('over', '💀', 'GAME OVER',
        'SCORE ' + Game.state.score.toLocaleString() +
        '<br>LINES ' + Game.state.lines +
        '<br>LEVEL ' + Game.state.level +
        '<br><br>BACK TO START TO SWITCH<br>THEME OR FIGHTER',
        'BACK TO START');
  };

  /* ---------------- overlay ---------------- */

  /* 'title' | 'paused' | 'over' — decides what the overlay button
     and the Enter key do next. */
  let overlayMode = 'title';

  function showOverlay(mode, icon, title, body, btn) {
    overlayMode = mode;
    overlayIcon.textContent = icon;
    overlayTitle.textContent = title;
    overlayBody.innerHTML = body;
    startBtn.textContent = btn;
    overlay.classList.remove('hidden');
  }

  function hideOverlay() { overlay.classList.add('hidden'); }

  /* Back to the title card. Called after a game over instead of
     restarting straight away, so the theme and fighter pickers are
     available again before the next run. */
  function showTitle() {
    FX.reset();
    activeFighter = null;
    setControlsLocked(false);
    Game.toMenu();
    Renderer.invalidate();
    showOverlay('title', '🎮', 'TETRIS BLAST',
        'CLEAR LINES TO UNLEASH YOUR FIGHTER<br>THEME AND FIGHTER LOCK IN AT START',
        'PRESS ENTER');
  }

  function beginGame() {
    FX.reset();
    activeFighter = currentFighter();
    FX.warm(activeFighter);
    setControlsLocked(true);
    Renderer.invalidate();
    Game.start();
    hideOverlay();
  }

  function advanceOverlay() {
    if (overlayMode === 'paused') { Game.togglePause(); hideOverlay(); return; }
    if (overlayMode === 'over')   { showTitle(); return; }
    beginGame();
  }

  startBtn.addEventListener('click', advanceOverlay);

  /* ---------------- input ---------------- */

  const held = { left: false, right: false, soft: false };
  const timer = { left: 0, right: 0, soft: 0 };
  const started = { left: false, right: false };

  function pressLeft()  { Game.move(-1); }
  function pressRight() { Game.move(1); }

  function handleDAS(dt) {
    if (Game.state.phase !== 'playing') return;

    // horizontal: initial tap, pause, then rapid repeat
    ['left', 'right'].forEach(dir => {
      if (!held[dir]) { timer[dir] = 0; started[dir] = false; return; }
      if (!started[dir]) {
        started[dir] = true;
        timer[dir] = 0;
        dir === 'left' ? pressLeft() : pressRight();
        return;
      }
      timer[dir] += dt;
      if (timer[dir] < DAS_DELAY) return;

      let over = timer[dir] - DAS_DELAY;
      let guard = 0;
      while (over >= 0 && guard++ < 12) {
        dir === 'left' ? pressLeft() : pressRight();
        over -= ARR_RATE;
      }
      timer[dir] = DAS_DELAY + over;
    });

    // soft drop repeats immediately
    if (held.soft) {
      timer.soft += dt;
      while (timer.soft >= SOFT_RATE) {
        timer.soft -= SOFT_RATE;
        Game.softDrop();
      }
    } else {
      timer.soft = 0;
    }
  }

  const downKeys = {};

  window.addEventListener('keydown', e => {
    const k = e.key;

    if (k === 'Enter') {
      e.preventDefault();
      if (Game.state.phase === 'playing' || Game.state.phase === 'clearing') return;
      advanceOverlay();
      return;
    }

    if (k === 'p' || k === 'P') {
      e.preventDefault();
      if (Game.state.phase === 'playing' || Game.state.phase === 'clearing') {
        Game.togglePause();
        showOverlay('paused', '⏸', 'PAUSED', 'TAKE YOUR TIME', 'RESUME');
      } else if (Game.state.phase === 'paused') {
        Game.togglePause();
        hideOverlay();
      }
      return;
    }

    if (Game.state.phase !== 'playing' && Game.state.phase !== 'clearing') return;
    if (downKeys[k]) { if (k.indexOf('Arrow') === 0 || k === ' ') e.preventDefault(); return; }
    downKeys[k] = true;

    switch (k) {
      case 'ArrowLeft':  e.preventDefault(); held.left = true; break;
      case 'ArrowRight': e.preventDefault(); held.right = true; break;
      case 'ArrowDown':  e.preventDefault(); held.soft = true; Game.softDrop(); break;
      case 'ArrowUp':
      case 'x': case 'X': e.preventDefault(); Game.rotate(1); break;
      case 'z': case 'Z': e.preventDefault(); Game.rotate(-1); break;
      case 'c': case 'C': e.preventDefault(); Game.hold(); break;
      case ' ':
        e.preventDefault();
        if (Game.hardDrop() > 0) FX.addShake(4);
        break;
    }
  });

  window.addEventListener('keyup', e => {
    downKeys[e.key] = false;
    if (e.key === 'ArrowLeft')  { held.left = false; started.left = false; }
    if (e.key === 'ArrowRight') { held.right = false; started.right = false; }
    if (e.key === 'ArrowDown')  { held.soft = false; }
  });

  window.addEventListener('blur', () => {
    held.left = held.right = held.soft = false;
    started.left = started.right = false;
    for (const k in downKeys) downKeys[k] = false;
  });

  /* touch pad */
  document.querySelectorAll('#touchpad button').forEach(btn => {
    const act = btn.dataset.act;
    const down = e => {
      e.preventDefault();
      if (Game.state.phase === 'menu' || Game.state.phase === 'over') { advanceOverlay(); return; }
      if (act === 'left')   held.left = true;
      if (act === 'right')  held.right = true;
      if (act === 'soft')   { held.soft = true; Game.softDrop(); }
      if (act === 'rotate') Game.rotate(1);
      if (act === 'hold')   Game.hold();
      if (act === 'hard')   { if (Game.hardDrop() > 0) FX.addShake(4); }
    };
    const up = e => {
      e.preventDefault();
      if (act === 'left')  { held.left = false; started.left = false; }
      if (act === 'right') { held.right = false; started.right = false; }
      if (act === 'soft')  held.soft = false;
    };
    btn.addEventListener('touchstart', down, { passive: false });
    btn.addEventListener('touchend', up, { passive: false });
    btn.addEventListener('mousedown', down);
    btn.addEventListener('mouseup', up);
    btn.addEventListener('mouseleave', up);
  });

  /* ---------------- HUD (only touch the DOM on change) ---------------- */

  const shown = { score: -1, best: -1, level: -1, lines: -1, combo: -1, hold: '?', holdUsed: null, queue: '' };

  function syncHUD() {
    const s = Game.state;
    if (s.score !== shown.score) { uiScore.textContent = s.score.toLocaleString(); shown.score = s.score; }
    if (s.best !== shown.best)   { uiBest.textContent = s.best.toLocaleString(); shown.best = s.best; }
    if (s.level !== shown.level) { uiLevel.textContent = s.level; shown.level = s.level; }
    if (s.lines !== shown.lines) { uiLines.textContent = s.lines; shown.lines = s.lines; }
    if (s.combo !== shown.combo) { uiCombo.textContent = s.combo > 1 ? s.combo + 'x' : '0'; shown.combo = s.combo; }

    const qKey = s.queue.slice(0, 3).join('');
    if (qKey !== shown.queue) {
      Renderer.drawNext(nextCtx, s.queue, nextCanvas.width, nextCanvas.height);
      shown.queue = qKey;
    }
    if (s.hold !== shown.hold || s.holdUsed !== shown.holdUsed) {
      Renderer.drawHold(holdCtx, s.hold, s.holdUsed, holdCanvas.width, holdCanvas.height);
      shown.hold = s.hold;
      shown.holdUsed = s.holdUsed;
    }
  }

  /* ---------------- loop ---------------- */

  let last = performance.now();

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;          // tab was backgrounded: don't fast-forward

    if (!document.hidden) Background.update(dt);

    if (Game.state.phase !== 'paused') {
      handleDAS(dt);
      Game.update(dt);
      FX.update(dt);
    }

    Renderer.draw(Game.state);
    syncHUD();

    requestAnimationFrame(frame);
  }

  // first paint of the empty well
  Game.state.grid = (function () {
    const g = [];
    for (let r = 0; r < ROWS; r++) g.push(new Array(COLS).fill(null));
    return g;
  })();

  syncHUD();
  requestAnimationFrame(frame);
})();
