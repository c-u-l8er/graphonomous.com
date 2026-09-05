/* ==========================================================================
   The identifying animation — SHELL.md §8.

   WHAT IT DEPICTS: a self-model getting simpler as it learns.

   The field is a system's observations: soft points, each one vague until
   something has recently observed it. Observation walks the field and what
   it touches becomes definite for a while, then softens again. Above the
   observations sit a few LAWS — larger, brighter, and empty until they have
   earned something. A reduction pulse gathers the observations near a law
   into it: each one grows a tether to the law, dims to a small settled point,
   and the law swells by what it now explains. That is the whole subject —
   many facts, few laws, the tethers being the explanation.

   THE LAWS DO NOT KEEP WHAT THEY EARN. Explanation decays, so a fact that was
   explained a while ago drifts loose again and has to be re-earned; and every
   so often a counterexample lands — a tethered fact flashes, its tether
   snaps, and the law that held it shrinks. The explained set is therefore a
   moving subset, never the whole field, which is what keeps the picture
   readable: a viewer needs a loose fact beside a tethered one to see what a
   tether is.

   IT RENDERS NO DATA AND ASSERTS NOTHING. It takes no input from the
   document and writes nothing back into it: no text, no markup, no
   attribute, no event, no global. The gradient sprites are built on detached
   canvases that are never inserted anywhere. Delete the script tag that loads
   this file and every figure, chip, status row and word on the page is
   still there.

   The counts below are deliberately not counts this site publishes. The
   publication gate reads every constant out of this file and refuses the
   build if one of them appears on the page without a witness of its own.
   ========================================================================== */
(function () {
  var el = document.querySelector("[data-identity-animation]");
  if (!el || !el.getContext) return;
  var ctx = el.getContext("2d");
  if (!ctx) return;

  /* ---- IDENTITY-COUNTS: read by launch-gate.mjs. Not data, not measured. ---- */
  var NODES = 27;
  var LAWS = 4;
  var CAND = 12;
  var GHOSTS = 7;
  var FPS = 24;
  var OBSERVE_MS = 210;
  var REDUCE_MS = 2600;
  var BREAK_MS = 3900;
  var GATHER = 6;

  /* the floors and rates. S is how recently observed a fact is; E is how
     explained it is. Both decay, on different clocks, so that the crisp set
     and the tethered set are two different moving subsets. */
  var S_GAIN = 0.9;
  var S_FADE = 0.31;
  var E_GAIN = 0.045;
  var E_FADE = 0.055;
  var E_MIN = 0.03;
  var PAD = 0.09;
  var SETTLED = 0.00002;

  var ACC = "#ff5c9d";
  var DATA = "#5ad1c8";
  var DIM = "#e9ecf1";
  var WARN = "#f5c451";

  /* seeded, so the picture is the same on every load; nothing here is
     sampled, timed or counted from anything real */
  var seed = 20260905;
  function rnd() {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  }

  /* a soft round sprite, drawn once and scaled: fill flat, carve the falloff */
  function sprite(color) {
    var c = document.createElement("canvas");
    var sz = 64;
    c.width = sz;
    c.height = sz;
    var g = c.getContext("2d");
    g.fillStyle = color;
    g.fillRect(0, 0, sz, sz);
    g.globalCompositeOperation = "destination-out";
    var rg = g.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
    rg.addColorStop(0, "rgba(0,0,0,0)");
    rg.addColorStop(0.38, "rgba(0,0,0,0.42)");
    rg.addColorStop(0.72, "rgba(0,0,0,0.86)");
    rg.addColorStop(1, "rgba(0,0,0,1)");
    g.fillStyle = rg;
    g.fillRect(0, 0, sz, sz);
    return c;
  }
  var hazeImg = sprite(DIM);
  var lawImg = sprite(ACC);
  var warnImg = sprite(WARN);

  /* ---- placement: best-candidate blue noise over the whole field ---- */
  var pts = [[0.5, 0.5]];
  while (pts.length < NODES + LAWS) {
    var bestX = 0;
    var bestY = 0;
    var bestD = -1;
    for (var c = 0; c < CAND; c++) {
      var cx = rnd();
      var cy = rnd();
      var near = 9e9;
      for (var p = 0; p < pts.length; p++) {
        var dx = pts[p][0] - cx;
        var dy = pts[p][1] - cy;
        var d = dx * dx + dy * dy;
        if (d < near) near = d;
      }
      if (near > bestD) {
        bestD = near;
        bestX = cx;
        bestY = cy;
      }
    }
    pts.push([bestX, bestY]);
  }

  /* the last LAWS points become laws: they are the most spread out of the
     set, which keeps each law over its own neighbourhood */
  var nodes = [];
  var laws = [];
  var i;
  for (i = 0; i < NODES; i++) {
    nodes.push({
      bx: pts[i][0], by: pts[i][1], px: 0, py: 0,
      s: 0.1 + rnd() * 0.2, e: 0, law: -1, flash: 0, seen: 0,
      ph: rnd() * Math.PI * 2, fx: 0.6 + rnd() * 0.5, fy: 0.6 + rnd() * 0.5,
      g: []
    });
    for (var k = 0; k < GHOSTS; k++) {
      var a = rnd() * Math.PI * 2;
      var r = 0.35 + rnd() * 0.65;
      nodes[i].g.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }
  for (i = 0; i < LAWS; i++) {
    laws.push({ bx: pts[NODES + i][0], by: pts[NODES + i][1], px: 0, py: 0, held: 0, ph: rnd() * Math.PI * 2 });
  }
  /* each fact's nearest laws, in order, so a reduction can gather by nearness */
  for (i = 0; i < NODES; i++) {
    var order = [];
    for (var l = 0; l < LAWS; l++) {
      var ddx = laws[l].bx - nodes[i].bx;
      var ddy = laws[l].by - nodes[i].by;
      order.push([ddx * ddx + ddy * ddy, l]);
    }
    order.sort(function (u, v) { return u[0] - v[0]; });
    nodes[i].near = order;
  }

  var W = 320;
  var H = 320;
  var reach = 0;
  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = el.clientWidth || 320;
    H = el.clientHeight || 320;
    el.width = Math.round(W * dpr);
    el.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    reach = Math.min(W, H) / 11;
  }
  size();
  window.addEventListener("resize", size);

  /* ---- the three kinds of event ---- */

  /* observation: the least-recently-seen fact becomes crisp */
  function observe(now) {
    var pick = 0;
    var oldest = 9e18;
    for (var j = 0; j < NODES; j++) {
      var age = nodes[j].seen + rnd() * 400;
      if (age < oldest) { oldest = age; pick = j; }
    }
    var n = nodes[pick];
    n.seen = now;
    n.s = Math.min(1, n.s + S_GAIN);
  }

  /* reduction: one law gathers the GATHER nearest loose facts */
  var nextLaw = 0;
  function reduce() {
    var l = nextLaw;
    nextLaw = (nextLaw + 1) % LAWS;
    var got = 0;
    var cands = [];
    for (var j = 0; j < NODES; j++) {
      var n = nodes[j];
      if (n.law === -1 || n.e < 0.2) cands.push([n.near[0][1] === l ? 0 : n.near[1][1] === l ? 1 : 2, j]);
    }
    cands.sort(function (u, v) { return u[0] - v[0]; });
    for (var q = 0; q < cands.length && got < GATHER; q++) {
      var n2 = nodes[cands[q][1]];
      if (n2.near[0][1] !== l && n2.near[1][1] !== l) continue;
      n2.law = l;
      n2.rising = true;
      got++;
    }
  }

  /* counterexample: a tethered fact flashes and comes loose */
  function counterexample() {
    var held = [];
    for (var j = 0; j < NODES; j++) if (nodes[j].law !== -1 && nodes[j].e > 0.5) held.push(j);
    if (!held.length) return;
    var n = nodes[held[Math.floor(rnd() * held.length)]];
    n.flash = 1;
    n.rising = false;
    n.e = Math.min(n.e, 0.5);
    n.s = 1;
  }

  /* the decays, and the tethers growing toward their laws */
  function relax(dt) {
    var k = dt / 1000;
    for (var j = 0; j < NODES; j++) {
      var n = nodes[j];
      n.s = Math.max(0.05, n.s - (n.s - 0.05) * S_FADE * k);
      if (n.flash > 0) n.flash = Math.max(0, n.flash - k * 1.4);
      if (n.rising) {
        n.e = Math.min(1, n.e + E_GAIN * k * 12);
        if (n.e >= 1) n.rising = false;
      } else if (n.law !== -1) {
        n.e = n.e - (n.e - E_MIN) * E_FADE * k;
        if (n.e < 0.08) { n.law = -1; n.e = 0; }
      }
    }
    for (var l = 0; l < LAWS; l++) {
      var sum = 0;
      for (var j2 = 0; j2 < NODES; j2++) if (nodes[j2].law === l) sum += nodes[j2].e;
      laws[l].held += (sum - laws[l].held) * Math.min(1, k * 2.2);
    }
  }

  function blob(img, x, y, r, a) {
    if (a <= 0.004 || r <= 0.2) return;
    ctx.globalAlpha = a;
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  }
  function disc(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    var t = now / 3600;
    var j;
    var n;
    var l;
    for (j = 0; j < NODES; j++) {
      n = nodes[j];
      var loose = 1 - n.e;
      n.px = (PAD + n.bx * (1 - PAD * 2)) * W + Math.sin(t * n.fx + n.ph) * W * 0.012 * loose;
      n.py = (PAD + n.by * (1 - PAD * 2)) * H + Math.cos(t * n.fy + n.ph) * H * 0.012 * loose;
    }
    for (l = 0; l < LAWS; l++) {
      laws[l].px = (PAD + laws[l].bx * (1 - PAD * 2)) * W + Math.sin(t * 0.7 + laws[l].ph) * W * 0.006;
      laws[l].py = (PAD + laws[l].by * (1 - PAD * 2)) * H + Math.cos(t * 0.6 + laws[l].ph) * H * 0.006;
    }

    /* tethers: an explanation is a line from a fact to its law */
    ctx.lineCap = "round";
    for (j = 0; j < NODES; j++) {
      n = nodes[j];
      if (n.law === -1 || n.e <= 0.02) continue;
      var L = laws[n.law];
      ctx.globalAlpha = 0.16 + 0.5 * n.e;
      ctx.strokeStyle = n.flash > 0 ? WARN : DATA;
      ctx.lineWidth = 0.6 + 1.1 * n.e;
      ctx.beginPath();
      ctx.moveTo(n.px, n.py);
      var mx = (n.px + L.px) / 2 + (n.py - L.py) * 0.12 * (1 - n.e);
      var my = (n.py + L.py) / 2 - (n.px - L.px) * 0.12 * (1 - n.e);
      ctx.quadraticCurveTo(mx, my, L.px, L.py);
      ctx.stroke();
    }

    /* facts: haze and ghosts while loose, one settled point while explained */
    for (j = 0; j < NODES; j++) {
      n = nodes[j];
      var vague = 1 - Math.max(n.s, n.e * 0.85);
      var spread = reach * (0.18 + 0.82 * vague);
      blob(hazeImg, n.px, n.py, spread * 1.5, 0.05 + 0.1 * vague);
      ctx.fillStyle = DIM;
      for (var g = 0; g < GHOSTS; g++) {
        ctx.globalAlpha = 0.18 + 0.3 * vague;
        disc(n.px + n.g[g][0] * spread, n.py + n.g[g][1] * spread, 0.8 + 0.5 * vague);
      }
      ctx.globalAlpha = 0.45 + 0.55 * (1 - vague);
      ctx.fillStyle = n.e > 0.5 ? DATA : DIM;
      disc(n.px, n.py, 1.4 + 1.3 * (1 - vague));
      if (n.s > 0.5) {
        ctx.globalAlpha = (n.s - 0.5) * 1.3;
        ctx.strokeStyle = ACC;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(n.px, n.py, 5 + 3 * (1 - n.s), 0, Math.PI * 2);
        ctx.stroke();
      }
      if (n.flash > 0) blob(warnImg, n.px, n.py, reach * 0.9 * n.flash, 0.7 * n.flash);
    }

    /* laws: a law is as big as what it explains, and empty when it explains nothing */
    for (l = 0; l < LAWS; l++) {
      var Lw = laws[l];
      var held = Lw.held;
      var rr = 3 + Math.sqrt(held) * 3.2;
      blob(lawImg, Lw.px, Lw.py, rr * 3.4, 0.14 + Math.min(0.5, held * 0.09));
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = ACC;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(Lw.px, Lw.py, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.25 + Math.min(0.75, held * 0.14);
      ctx.fillStyle = ACC;
      disc(Lw.px, Lw.py, Math.max(1.2, rr * 0.45));
    }
    ctx.globalAlpha = 1;
  }

  /* the still frame a reduced-motion reader gets: several cycles run without
     drawing, so the one frame shows loose facts beside tethered ones and a
     law that has earned something */
  function settle() {
    var clock = 0;
    for (var round = 0; round < 40; round++) {
      observe(clock);
      if (round % 12 === 6) reduce();
      if (round % 19 === 18) counterexample();
      clock += OBSERVE_MS;
      relax(OBSERVE_MS);
    }
    for (var f = 0; f < 30; f++) relax(1000 / FPS);
  }

  var still =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still) {
    settle();
    draw(0);
    return;
  }

  /* The loop runs by default. IntersectionObserver may only PAUSE it — never
     start it — because IO does not fire in a non-compositing renderer. */
  var offscreen = false;
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) {
      offscreen = !es[0].isIntersecting;
      if (!offscreen) tick(performance.now());
    }).observe(el);
  }

  var running = false;
  var last = 0;
  var lastObserve = 0;
  var lastReduce = 0;
  var lastBreak = 0;

  function tick(now) {
    if (running) return;
    running = true;
    frame(now);
  }

  function frame(now) {
    if (document.hidden || offscreen) {
      running = false;
      return;
    }
    var dt = now - last;
    if (dt >= 1000 / FPS) {
      last = now;
      if (dt > BREAK_MS) dt = 1000 / FPS;
      if (!lastObserve) { lastObserve = now; lastReduce = now; lastBreak = now; }
      if (now - lastObserve >= OBSERVE_MS) { lastObserve = now; observe(now); }
      if (now - lastReduce >= REDUCE_MS) { lastReduce = now; reduce(); }
      if (now - lastBreak >= BREAK_MS) { lastBreak = now; counterexample(); }
      relax(dt);
      draw(now);
    }
    requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) tick(performance.now());
  });

  tick(performance.now());
})();
