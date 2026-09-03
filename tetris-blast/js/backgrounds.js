/* ============================================================
   backgrounds.js — animated wallpapers drawn on their own canvas.

   Two things keep these cheap:
     1. the canvas is rendered at half resolution and stretched by
        CSS, so we push a quarter of the pixels;
     2. the whole thing updates at a capped 30fps, independent of
        the game loop, which stays at full speed.
   ============================================================ */

const Background = (function () {

  let canvas, ctx;
  let w = 0, h = 0;          // internal (half-res) size
  let current = null;
  let time = 0;
  let acc = 0;
  const STEP = 1 / 30;       // background refresh rate

  /* ---------------- individual themes ---------------- */

  const themes = {

    /* --- neon grid: scrolling magenta/cyan lattice --- */
    neon: {
      offset: 0,
      init() { this.offset = 0; },
      update(dt) { this.offset = (this.offset + dt * 22) % 40; },
      draw() {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#12002e');
        g.addColorStop(0.5, '#1b0640');
        g.addColorStop(1, '#05001a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,62,165,0.22)';
        ctx.beginPath();
        for (let x = -40 + this.offset; x < w; x += 40) {
          ctx.moveTo(x, 0); ctx.lineTo(x, h);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(34,229,255,0.18)';
        ctx.beginPath();
        for (let y = -40 + this.offset; y < h; y += 40) {
          ctx.moveTo(0, y); ctx.lineTo(w, y);
        }
        ctx.stroke();

        glowBlob(w * 0.2, h * 0.25, h * 0.5, 'rgba(255,62,165,0.16)');
        glowBlob(w * 0.8, h * 0.7, h * 0.5, 'rgba(34,229,255,0.14)');
      }
    },

    /* --- deep space: parallax starfield --- */
    starfield: {
      stars: [],
      init() {
        this.stars = [];
        const count = Math.round((w * h) / 5200);
        for (let i = 0; i < count; i++) {
          this.stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            z: Math.random() * 0.8 + 0.2,
            tw: Math.random() * Math.PI * 2
          });
        }
      },
      update(dt) {
        for (const s of this.stars) {
          s.y += dt * 16 * s.z;
          s.tw += dt * 3;
          if (s.y > h) { s.y = -2; s.x = Math.random() * w; }
        }
      },
      draw() {
        const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
        g.addColorStop(0, '#0d1436');
        g.addColorStop(1, '#01020c');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        glowBlob(w * 0.72, h * 0.28, h * 0.45, 'rgba(77,140,255,0.16)');
        glowBlob(w * 0.24, h * 0.75, h * 0.38, 'rgba(199,125,255,0.12)');

        for (const s of this.stars) {
          const a = 0.35 + 0.45 * Math.sin(s.tw) * s.z + 0.2 * s.z;
          ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0.05, a).toFixed(3) + ')';
          const r = s.z * 1.6;
          ctx.fillRect(s.x, s.y, r, r);
        }
      }
    },

    /* --- synthwave: sun over a receding grid --- */
    synthwave: {
      scroll: 0,
      init() { this.scroll = 0; },
      update(dt) { this.scroll = (this.scroll + dt * 0.42) % 1; },
      draw() {
        const horizon = h * 0.58;

        const sky = ctx.createLinearGradient(0, 0, 0, horizon);
        sky.addColorStop(0, '#150033');
        sky.addColorStop(0.6, '#3d0a5c');
        sky.addColorStop(1, '#8a1b6b');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, horizon);

        // sun with cut-out bands
        const cx = w / 2, cy = horizon - h * 0.06, rad = h * 0.16;
        const sun = ctx.createLinearGradient(0, cy - rad, 0, cy + rad);
        sun.addColorStop(0, '#ffd93d');
        sun.addColorStop(0.5, '#ff6b3d');
        sun.addColorStop(1, '#ff3ea5');
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = sun;
        ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
        ctx.fillStyle = 'rgba(21,0,51,0.85)';
        for (let i = 0; i < 7; i++) {
          const by = cy + rad * (i / 7) * 0.95;
          ctx.fillRect(cx - rad, by, rad * 2, (i + 1) * 0.55);
        }
        ctx.restore();

        // ground
        const gnd = ctx.createLinearGradient(0, horizon, 0, h);
        gnd.addColorStop(0, '#1a0033');
        gnd.addColorStop(1, '#06000f');
        ctx.fillStyle = gnd;
        ctx.fillRect(0, horizon, w, h - horizon);

        ctx.strokeStyle = 'rgba(255,62,165,0.42)';
        ctx.lineWidth = 1;

        // horizontal lines, spacing grows toward the viewer
        ctx.beginPath();
        for (let i = 0; i < 14; i++) {
          const t = (i + this.scroll) / 14;
          const y = horizon + (h - horizon) * t * t;
          ctx.moveTo(0, y); ctx.lineTo(w, y);
        }
        ctx.stroke();

        // verticals converging on the vanishing point
        ctx.strokeStyle = 'rgba(34,229,255,0.30)';
        ctx.beginPath();
        for (let i = -10; i <= 10; i++) {
          ctx.moveTo(cx + i * (w / 10), h);
          ctx.lineTo(cx + i * 6, horizon);
        }
        ctx.stroke();
      }
    },

    /* --- aurora: drifting light ribbons --- */
    aurora: {
      t: 0,
      init() { this.t = 0; },
      update(dt) { this.t += dt * 0.5; },
      draw() {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#02121a');
        g.addColorStop(1, '#000a10');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        const bands = [
          { c: 'rgba(77,255,136,0.16)',  amp: h * 0.09, off: 0.0, sp: 1.0 },
          { c: 'rgba(34,229,255,0.14)',  amp: h * 0.12, off: 1.7, sp: 0.7 },
          { c: 'rgba(199,125,255,0.11)', amp: h * 0.07, off: 3.1, sp: 1.3 }
        ];

        for (const b of bands) {
          const mid = h * 0.45 + Math.sin(this.t * 0.4 + b.off) * h * 0.06;
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let x = 0; x <= w; x += 16) {
            const y = mid
                + Math.sin(x * 0.006 + this.t * b.sp + b.off) * b.amp
                + Math.sin(x * 0.017 - this.t * b.sp * 0.6) * b.amp * 0.4;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fillStyle = b.c;
          ctx.fill();
        }

        glowBlob(w * 0.5, h * 0.15, h * 0.5, 'rgba(77,255,136,0.07)');
      }
    },

    /* --- deep blue: underwater light shafts and bubbles --- */
    ocean: {
      bubbles: [],
      t: 0,
      init() {
        this.t = 0;
        this.bubbles = [];
        const count = Math.round((w * h) / 16000);
        for (let i = 0; i < count; i++) {
          this.bubbles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: 1 + Math.random() * 3.5,
            sp: 8 + Math.random() * 22,
            wob: Math.random() * Math.PI * 2
          });
        }
      },
      update(dt) {
        this.t += dt;
        for (const b of this.bubbles) {
          b.y -= dt * b.sp;
          b.wob += dt * 1.6;
          if (b.y < -6) { b.y = h + 6; b.x = Math.random() * w; }
        }
      },
      draw() {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#0a58b0');
        g.addColorStop(0.45, '#0b2f80');
        g.addColorStop(1, '#020a2e');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        // light shafts from the surface
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          const base = (w / 5) * i + Math.sin(this.t * 0.28 + i) * 28;
          const width = 34 + Math.sin(this.t * 0.5 + i * 2) * 12;
          const shaft = ctx.createLinearGradient(base, 0, base + width * 2, h);
          shaft.addColorStop(0, 'rgba(140,215,255,0.16)');
          shaft.addColorStop(1, 'rgba(140,215,255,0)');
          ctx.fillStyle = shaft;
          ctx.beginPath();
          ctx.moveTo(base, 0);
          ctx.lineTo(base + width, 0);
          ctx.lineTo(base + width * 2.6, h);
          ctx.lineTo(base + width * 1.2, h);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // bubbles
        ctx.strokeStyle = 'rgba(190,235,255,0.42)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const b of this.bubbles) {
          const x = b.x + Math.sin(b.wob) * 5;
          ctx.moveTo(x + b.r, b.y);
          ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
        }
        ctx.stroke();
      }
    },

    /* --- data rain: falling glyph columns --- */
    matrix: {
      cols: [],
      colW: 12,
      selfClears: true,
      init() {
        this.cols = [];
        const n = Math.ceil(w / this.colW);
        for (let i = 0; i < n; i++) {
          this.cols.push({
            y: Math.random() * h,
            sp: 90 + Math.random() * 190,
            ch: randGlyph()
          });
        }
        ctx.fillStyle = '#010801';
        ctx.fillRect(0, 0, w, h);
      },
      update(dt) {
        for (const c of this.cols) {
          c.y += dt * c.sp;
          if (c.y > h + 20) { c.y = -20 - Math.random() * 120; c.sp = 90 + Math.random() * 190; }
          if (Math.random() < 0.30) c.ch = randGlyph();
        }
      },
      draw() {
        // translucent wash instead of a clear: leaves the trails
        ctx.fillStyle = 'rgba(1,8,1,0.20)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = '11px monospace';
        ctx.textBaseline = 'top';
        for (let i = 0; i < this.cols.length; i++) {
          const c = this.cols[i];
          const x = i * this.colW;
          ctx.fillStyle = 'rgba(200,255,210,0.95)';
          ctx.fillText(c.ch, x, c.y);
          ctx.fillStyle = 'rgba(77,255,136,0.42)';
          ctx.fillText(c.ch, x, c.y - 12);
          ctx.fillStyle = 'rgba(40,180,80,0.20)';
          ctx.fillText(c.ch, x, c.y - 24);
        }
      }
    }
  };

  /* ---------------- helpers ---------------- */

  function randGlyph() {
    return String.fromCharCode(0x30a1 + Math.floor(Math.random() * 88));
  }

  function glowBlob(x, y, r, colour) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colour);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function resize() {
    w = Math.max(2, Math.ceil(window.innerWidth / 2));
    h = Math.max(2, Math.ceil(window.innerHeight / 2));
    canvas.width = w;
    canvas.height = h;
    if (current) current.init();
  }

  /* ---------------- public API ---------------- */

  return {
    init(el) {
      canvas = el;
      ctx = canvas.getContext('2d');
      window.addEventListener('resize', resize);
      resize();
      this.set('neon');
    },

    set(id) {
      current = themes[id] || themes.neon;
      time = 0;
      current.init();
      // paint one frame right away so the switch feels instant
      current.draw();
    },

    update(dt) {
      if (!current) return;
      acc += dt;
      if (acc < STEP) return;
      const step = Math.min(acc, 0.1);
      acc = 0;
      time += step;
      current.update(step);
      if (!current.selfClears) ctx.clearRect(0, 0, w, h);
      current.draw();
    }
  };
})();
