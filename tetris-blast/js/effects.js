/* ============================================================
   effects.js — everything that flies across the board.

   Performance note: nothing here builds a gradient at draw time.
   Beams, charge orbs and the fighter halo are rasterised once per
   fighter into offscreen canvases and then stamped with a single
   drawImage, stretched as needed. A four-line clear is a couple of
   dozen drawImage calls plus a flat particle loop.
   ============================================================ */

const FX = (function () {

  /* ---------------- fighter timeline (seconds) ---------------- */

  const T_CHARGE = 0.18;
  const T_FIRE   = 0.32;
  const T_HOLD   = 0.64;
  const T_EXIT   = 0.68;
  const T_END    = 1.02;

  const SCALE   = 3;                   // sprite pixels -> screen pixels
  const CHAR_W  = SPRITE_W * SCALE;    // 60
  const CHAR_H  = SPRITE_H * SCALE;    // 72
  const PARK_X  = BOARD_W - CHAR_W - 8;
  const START_X = BOARD_W + 70;
  const EXIT_X  = -CHAR_W - 40;

  /* ---------------- state ---------------- */

  const beams     = [];
  const particles = [];
  const rings     = [];
  const texts     = [];

  let fighter = null;
  const shake = { mag: 0, x: 0, y: 0 };

  /* ---------------- texture cache ---------------- */

  const tex = {};   // fighter.id -> { beam, orb, halo }

  function makeCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  const BEAM_TEX_W = 256;
  const BEAM_TEX_H = 44;

  function buildTextures(def) {
    if (tex[def.id]) return tex[def.id];

    /* --- beam: glow envelope plus a hot core, drawn once --- */
    const beam = makeCanvas(BEAM_TEX_W, BEAM_TEX_H);
    const bc = beam.getContext('2d');

    const glow = bc.createLinearGradient(0, 0, BEAM_TEX_W, 0);
    glow.addColorStop(0.00, 'rgba(255,255,255,0)');
    glow.addColorStop(0.12, def.beam.outer);
    glow.addColorStop(0.48, def.beam.mid);
    glow.addColorStop(1.00, 'rgba(255,255,255,0)');
    bc.fillStyle = glow;
    roundRectPath(bc, 0, 3, BEAM_TEX_W, BEAM_TEX_H - 6, (BEAM_TEX_H - 6) / 2);
    bc.fill();

    const core = bc.createLinearGradient(0, 0, BEAM_TEX_W, 0);
    core.addColorStop(0.00, 'rgba(255,255,255,0)');
    core.addColorStop(0.20, def.beam.core);
    core.addColorStop(0.86, def.beam.core);
    core.addColorStop(1.00, 'rgba(255,255,255,0)');
    bc.fillStyle = core;
    roundRectPath(bc, 0, BEAM_TEX_H / 2 - 5, BEAM_TEX_W, 10, 5);
    bc.fill();

    /* --- charge orb --- */
    const orb = makeCanvas(64, 64);
    const oc = orb.getContext('2d');
    const og = oc.createRadialGradient(32, 32, 0, 32, 32, 32);
    og.addColorStop(0.00, def.beam.core);
    og.addColorStop(0.35, def.beam.mid);
    og.addColorStop(1.00, 'rgba(0,0,0,0)');
    oc.fillStyle = og;
    oc.fillRect(0, 0, 64, 64);

    /* --- soft halo so the sprite reads against the stack --- */
    const halo = makeCanvas(128, 128);
    const hc = halo.getContext('2d');
    const hg = hc.createRadialGradient(64, 64, 0, 64, 64, 64);
    hg.addColorStop(0.00, hexAlpha(def.beam.mid, 0.34));
    hg.addColorStop(1.00, 'rgba(0,0,0,0)');
    hc.fillStyle = hg;
    hc.fillRect(0, 0, 128, 128);

    tex[def.id] = { beam, orb, halo };
    return tex[def.id];
  }

  /* ---------------- easing ---------------- */

  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeIn  = t => t * t * t;
  const clamp01 = t => t < 0 ? 0 : t > 1 ? 1 : t;

  /* ---------------- spawning ---------------- */

  function lineClear(rows, def, grid) {
    buildTextures(def);
    SpriteCache.get(def, 'ready', SCALE);
    SpriteCache.get(def, 'fire', SCALE);

    const midRow = rows.reduce((a, b) => a + b, 0) / rows.length;
    let y = (midRow + 0.5) * CELL - CHAR_H / 2;
    y = Math.max(4, Math.min(BOARD_H - CHAR_H - 4, y));

    fighter = { def: def, t: 0, x: START_X, y: y, rows: rows.slice(), fired: false };

    addShake(rows.length >= 4 ? 15 : 5 + rows.length * 2.5);

    const bank = WORDS[Math.min(rows.length, 4)];
    const word = bank[(Math.random() * bank.length) | 0];
    // Press Start 2P is fixed-width at about 1em per glyph, so size
    // the text down until the longest phrase clears the well.
    const size = Math.min(18, Math.floor((BOARD_W - 24) / word.length));
    pushText(word, BOARD_W / 2, BOARD_H * 0.42, size, '#ffffff', def.beam.mid, 1.15);

    for (const r of rows) {
      for (let c = 0; c < COLS; c++) {
        const colour = (grid[r] && grid[r][c]) || def.beam.mid;
        burst(c * CELL + CELL / 2, r * CELL + CELL / 2, 3, colour);
      }
    }
  }

  function burst(x, y, count, colour) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 200;
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp - 90,
        vy: Math.sin(a) * sp - 40,
        life: 0,
        max: 0.45 + Math.random() * 0.35,
        size: 2 + Math.random() * 4,
        colour: colour
      });
    }
  }

  function fireBeams(f) {
    const originX = f.x + SPRITE_HAND.x * SCALE;
    const t = buildTextures(f.def);

    f.rows.forEach((row, i) => {
      const y = row * CELL + CELL / 2;
      beams.push({ y: y, originX: originX, t: -i * 0.05, dur: 0.40, tex: t.beam, core: f.def.beam.core });
      rings.push({ x: originX, y: y, t: -i * 0.05, dur: 0.45, colour: f.def.beam.mid });
      burst(originX, y, 5, f.def.beam.core);
    });

    // the shout lands with the shot
    const s = Math.min(12, Math.floor((BOARD_W - 40) / f.def.shout.length));
    pushText(f.def.shout, BOARD_W / 2, BOARD_H * 0.29, s, f.def.beam.mid, '#ffffff', 0.85);
  }

  function pushText(text, x, y, size, fill, glow, dur) {
    texts.push({ text, x, y, size, fill, glow, t: 0, dur: dur || 1 });
  }

  function addShake(mag) { shake.mag = Math.max(shake.mag, mag); }

  /* ---------------- update ---------------- */

  function update(dt) {
    if (fighter) {
      const f = fighter;
      f.t += dt;

      if (f.t < T_CHARGE) {
        f.x = START_X + (PARK_X - START_X) * easeOut(clamp01(f.t / T_CHARGE));
      } else if (f.t < T_EXIT) {
        f.x = PARK_X;
      } else {
        f.x = PARK_X + (EXIT_X - PARK_X) * easeIn(clamp01((f.t - T_EXIT) / (T_END - T_EXIT)));
      }

      if (!f.fired && f.t >= T_FIRE) {
        f.fired = true;
        fireBeams(f);
        addShake(10);
      }

      if (f.t >= T_END) fighter = null;
    }

    for (let i = beams.length - 1; i >= 0; i--) {
      beams[i].t += dt;
      if (beams[i].t > beams[i].dur) beams.splice(i, 1);
    }

    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i].t += dt;
      if (rings[i].t > rings[i].dur) rings.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 620 * dt;
      p.vx *= 0.985;
    }

    for (let i = texts.length - 1; i >= 0; i--) {
      texts[i].t += dt;
      if (texts[i].t > texts[i].dur) texts.splice(i, 1);
    }

    if (shake.mag > 0.1) {
      shake.x = (Math.random() * 2 - 1) * shake.mag;
      shake.y = (Math.random() * 2 - 1) * shake.mag;
      shake.mag *= Math.pow(0.0016, dt);
    } else {
      shake.mag = 0; shake.x = 0; shake.y = 0;
    }
  }

  function isActive() {
    return !!fighter || beams.length > 0 || particles.length > 0 ||
        rings.length > 0 || texts.length > 0 || shake.mag > 0;
  }

  /* ---------------- draw ---------------- */

  function drawBeams(ctx) {
    if (!beams.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const b of beams) {
      if (b.t < 0) continue;
      const p = clamp01(b.t / b.dur);
      const reach = easeOut(Math.min(1, p * 1.5));
      const head = b.originX - reach * (b.originX + 40);
      const len = b.originX - head;
      if (len <= 1) continue;

      const fade = p > 0.62 ? 1 - (p - 0.62) / 0.38 : 1;
      if (fade <= 0) continue;

      ctx.globalAlpha = fade;
      ctx.drawImage(b.tex, head, b.y - BEAM_TEX_H / 2, len, BEAM_TEX_H);

      ctx.fillStyle = b.core;
      ctx.beginPath();
      ctx.arc(head + 8, b.y, 11 * fade, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawRings(ctx) {
    if (!rings.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of rings) {
      if (r.t < 0) continue;
      const p = clamp01(r.t / r.dur);
      ctx.globalAlpha = (1 - p) * 0.8;
      ctx.strokeStyle = r.colour;
      ctx.lineWidth = 3 * (1 - p) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 6 + easeOut(p) * 52, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles(ctx) {
    if (!particles.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    let last = null;
    for (const p of particles) {
      const k = 1 - p.life / p.max;
      ctx.globalAlpha = k;
      if (p.colour !== last) { ctx.fillStyle = p.colour; last = p.colour; }
      const s = p.size * k + 0.6;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.restore();
  }

  function drawFighter(ctx) {
    if (!fighter) return;
    const f = fighter;
    const t = buildTextures(f.def);
    const firing = f.t >= T_FIRE && f.t < T_HOLD;

    let alpha = 1;
    if (f.t < 0.09) alpha = f.t / 0.09;
    else if (f.t > T_EXIT) alpha = 1 - clamp01((f.t - T_EXIT) / (T_END - T_EXIT));

    // halo
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    const gx = f.x + CHAR_W / 2, gy = f.y + CHAR_H / 2;
    ctx.drawImage(t.halo, gx - CHAR_H * 0.85, gy - CHAR_H * 0.85, CHAR_H * 1.7, CHAR_H * 1.7);

    // charge orb during the wind-up
    if (f.t >= T_CHARGE && f.t < T_FIRE) {
      const p = (f.t - T_CHARGE) / (T_FIRE - T_CHARGE);
      const r = 12 + 26 * p;
      const ox = f.x + SPRITE_HAND.x * SCALE;
      const oy = f.y + SPRITE_HAND.y * SCALE;
      ctx.drawImage(t.orb, ox - r, oy - r, r * 2, r * 2);
    }
    ctx.restore();

    const img = SpriteCache.get(f.def, firing ? 'fire' : 'ready', SCALE);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(f.x), Math.round(f.y));
    ctx.restore();
  }

  function drawTexts(ctx) {
    if (!texts.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    for (const t of texts) {
      const p = t.t / t.dur;
      const pop = p < 0.18 ? easeOut(p / 0.18) : 1;
      const scale = 0.4 + pop * 0.6;
      const alpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;

      ctx.globalAlpha = alpha;
      ctx.save();
      ctx.translate(t.x, t.y - p * 26);
      ctx.scale(scale, scale);
      ctx.font = t.size + "px 'Press Start 2P', monospace";
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.strokeText(t.text, 0, 0);
      ctx.lineWidth = 3;
      ctx.strokeStyle = t.glow;
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.fill;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  /* ---------------- helpers ---------------- */

  function hexAlpha(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ---------------- public API ---------------- */

  return {
    lineClear,
    burst,
    pushText,
    addShake,
    update,
    isActive,
    shake,
    warm(def) { buildTextures(def); SpriteCache.get(def, 'ready', SCALE); SpriteCache.get(def, 'fire', SCALE); },
    drawUnderPieces(ctx) { drawRings(ctx); },
    drawOverPieces(ctx) {
      drawBeams(ctx);
      drawParticles(ctx);
      drawFighter(ctx);
      drawTexts(ctx);
    },
    reset() {
      beams.length = 0;
      particles.length = 0;
      rings.length = 0;
      texts.length = 0;
      fighter = null;
      shake.mag = 0; shake.x = 0; shake.y = 0;
    }
  };
})();
