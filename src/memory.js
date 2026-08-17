/* ==========================================================================
   The identifying animation — SHELL.md §8.

   WHAT IT DEPICTS: a memory getting sharper from being used.

   Everything starts vague. A node is not a dot, it is a soft blob with a
   scatter of ghost points around where the dot would be, and it drifts,
   because an unrecalled memory is a region rather than a fact. An edge is not
   a line, it is a smear of bowed strands. Recall traces then walk the graph,
   and WHAT THEY CROSS RESOLVES: the blob contracts, the ghosts collapse onto
   one another until they read as a single definite point, the drift stops,
   a focus ring closes around it, the strands of a crossed edge converge into
   one line — and a near-duplicate node a trace lands on merges into its twin,
   which is what consolidation does to two nodes that turn out to be the same
   thing. A trace itself leaves as a smudge and arrives as a point.

   Then a forgetting sweep crosses the field and softens whatever it passes,
   and the traces sharpen it again somewhere else. Sharpness is therefore not
   a property of the graph, it is a property of which parts of it are being
   used, right now — which is the question in this page's h1, drawn rather
   than argued. The picture is meaningfully different at five seconds, at
   fifteen and at thirty, and that is the whole point of it.

   THREE THINGS HERE EXIST BECAUSE THE FIRST VERSION FAILED AT THEM, and each
   is a decision rather than a default:

   1. PLACEMENT IS BLUE NOISE, not clusters. Three hubs with jitter produced an
      irregular clump in a third of the canvas with long thin edges crossing an
      empty middle. Best-candidate sampling spreads the nodes over the whole
      field with no two crowding each other.
   2. EDGES ARE k-NEAREST-NEIGHBOUR, not random pairs, so they are short and
      local and read as a graph instead of as crossing noise. A union-find pass
      then joins any component the neighbour rule left stranded, because a
      component no walk can reach is a part of the picture that never resolves.
   3. THERE ARE SEVERAL TRACES AND THEY PREFER THE LEAST-RECENTLY-VISITED
      NEIGHBOUR. A single random walk gets trapped in a neighbourhood — the
      first version lit one corner and left the rest as haze forever, so there
      was nothing to compare the sharp part against. Coverage is now a measured
      property, not a hope: see docs in the commit for the 5 s / 15 s / 30 s
      figures.

   IT RENDERS NO DATA AND ASSERTS NOTHING. It takes no input from the document
   and writes nothing back into it: no text, no markup, no attribute, no
   custom event, no global. The two gradient sprites below are built on
   detached canvases that are never inserted anywhere. Delete the script tag
   that loads this file and every figure, chip, status row and word on the
   page is still there.

   The counts below are DELIBERATELY NOT the counts this site publishes.
   Graphonomous stores 6 node types and 17 edge types; this picture has 22
   nodes, and its edge count is emergent from the neighbour rule rather than
   chosen at all. Neither is any figure on the page and neither is anything
   measured. gpscoord.com shipped a canvas animation whose loop bound was
   published beside it as a live count of user-facing pathfinders — a
   decoration's constant sold as a metric, for months. The publication gate
   reads every constant out of this file and refuses the build if one of them
   appears as a standalone number in the page's text.
   ========================================================================== */
(function () {
  var el = document.querySelector("[data-identity-animation]");
  if (!el || !el.getContext) return;
  var ctx = el.getContext("2d");
  if (!ctx) return;

  /* ---- IDENTITY-COUNTS: read by launch-gate.mjs. Not data, not measured. ---- */
  var NODES = 22;
  var K_NEAR = 3;
  var CAND = 12;
  var GHOSTS = 8;
  var STRANDS = 3;
  var TRACES = 3;
  var HOPS = 14;
  var FPS = 24;
  var HOP_MS = 240;
  var REST_MS = 900;
  var FORGET_MS = 11000;
  var WAVE_MS = 1300;

  /* How memory behaves here, as five numbers. K is the floor a thing relaxes
     to, S is where it is right now. Use raises K, the sweep lowers it, and K
     never reaches 1, because something that could not decay would not be a
     memory.

     K_FADE is the one that makes the picture MOVE. Without it the traces
     reach every node within four seconds, every floor saturates, and the
     whole graph sits crisp forever — the opposite failure to the clumped
     first version and just as unreadable, because a viewer needs something
     vague beside the sharp part to see that anything is happening. With it a
     floor decays with a time constant near three seconds, so a node is bright
     for about a second after a trace lands, fades over the next few, and is
     picked up again a few seconds later. The sharp set is therefore always a
     MOVING SUBSET rather than the whole graph, and the wave below knocks it
     down harder on its own slower clock. */
  var K_MIN = 0.05;
  var K_CAP = 0.88;
  var LEARN = 0.34;
  var RELAX = 0.042;
  var FORGET_KEEP = 0.44;
  var K_FADE = 0.34;

  var ACC = "#ff5c9d";
  var DATA = "#5ad1c8";
  var DIM = "#e9ecf1";

  /* A seeded generator, so the picture is the same on every load. Nothing
     here is sampled, timed or counted from anything real. */
  var seed = 20260817;
  function rnd() {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  }

  /* A soft round sprite, drawn once and scaled thereafter: fill flat, then
     carve the falloff out of it. This is how a genuinely soft edge is made
     without canvas filters, which Safari only learned recently. */
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
  var glowImg = sprite(DATA);

  /* ---- placement: best-candidate blue noise over the WHOLE field ----
     Each new point is the furthest of CAND darts from everything placed so
     far. Even coverage, no lattice, no clump, and deterministic. */
  var pts = [[0.5, 0.5]];
  while (pts.length < NODES) {
    var bestX = 0;
    var bestY = 0;
    var bestD = -1;
    for (var c = 0; c < CAND; c++) {
      var cx = rnd();
      var cy = rnd();
      var near = 9e9;
      for (var pi = 0; pi < pts.length; pi++) {
        var ddx = cx - pts[pi][0];
        var ddy = cy - pts[pi][1];
        var dd = ddx * ddx + ddy * ddy;
        if (dd < near) near = dd;
      }
      if (near > bestD) {
        bestD = near;
        bestX = cx;
        bestY = cy;
      }
    }
    pts.push([bestX, bestY]);
  }

  var nodes = [];
  for (var i = 0; i < NODES; i++) {
    var g = [];
    for (var gi = 0; gi < GHOSTS; gi++) {
      var ga = rnd() * Math.PI * 2;
      var gr = 0.36 + rnd() * 0.64;
      g.push([Math.cos(ga) * gr, Math.sin(ga) * gr]);
    }
    nodes.push({
      bx: pts[i][0],
      by: pts[i][1],
      px: 0,
      py: 0,
      fx: 0.3 + rnd() * 0.6,
      fy: 0.3 + rnd() * 0.6,
      ph: rnd() * Math.PI * 2,
      g: g,
      s: K_MIN,
      k: K_MIN,
      dup: null,
      lit: 0,
      swept: 0
    });
  }

  /* Near-duplicates. A few nodes carry a second, almost-identical copy of
     themselves; landing a trace on one starts the merge. */
  for (var d = 0; d < NODES; d += 3) {
    var da = rnd() * Math.PI * 2;
    nodes[d].dup = { dx: Math.cos(da) * 0.04, dy: Math.sin(da) * 0.04, m: 0, on: false };
  }

  function dist2(a, b) {
    var dx = nodes[a].bx - nodes[b].bx;
    var dy = nodes[a].by - nodes[b].by;
    return dx * dx + dy * dy;
  }

  var links = [];
  var seen = {};
  function addLink(a, b) {
    if (a === b || a < 0 || b < 0) return;
    var key = Math.min(a, b) + ":" + Math.max(a, b);
    if (seen[key]) return;
    seen[key] = 1;
    var st = [];
    for (var si = 0; si < STRANDS; si++) {
      st.push((si - (STRANDS - 1) / 2) * 0.9 + (rnd() - 0.5) * 0.6);
    }
    links.push({ a: a, b: b, st: st, s: K_MIN, k: K_MIN, lit: 0, swept: 0 });
  }

  /* k nearest neighbours: short local edges, no long crossing chords */
  for (var n1 = 0; n1 < NODES; n1++) {
    var order = [];
    for (var n2 = 0; n2 < NODES; n2++) if (n2 !== n1) order.push([dist2(n1, n2), n2]);
    order.sort(function (p, q) {
      return p[0] - q[0];
    });
    for (var kk = 0; kk < K_NEAR && kk < order.length; kk++) addLink(n1, order[kk][1]);
  }

  /* A component nothing can walk to is a part of the picture that never
     resolves, so union-find the neighbour graph and bridge whatever is left. */
  var parent = [];
  for (var pu = 0; pu < NODES; pu++) parent.push(pu);
  function find(a) {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  }
  function union(a, b) {
    var ra = find(a);
    var rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }
  for (var lu = 0; lu < links.length; lu++) union(links[lu].a, links[lu].b);
  var joins = 0;
  while (joins++ < NODES) {
    var out = -1;
    for (var oi = 0; oi < NODES; oi++) {
      if (find(oi) !== find(0)) {
        out = oi;
        break;
      }
    }
    if (out < 0) break;
    var to = -1;
    var td = 9e9;
    for (var tj = 0; tj < NODES; tj++) {
      if (find(tj) !== find(0)) continue;
      var dz = dist2(out, tj);
      if (dz < td) {
        td = dz;
        to = tj;
      }
    }
    addLink(out, to);
    union(out, to);
  }

  var nbr = [];
  for (var q = 0; q < NODES; q++) nbr.push([]);
  for (var li = 0; li < links.length; li++) {
    nbr[links[li].a].push({ to: links[li].b, l: li });
    nbr[links[li].b].push({ to: links[li].a, l: li });
  }

  var headG = [];
  for (var hg = 0; hg < GHOSTS; hg++) {
    var hga = rnd() * Math.PI * 2;
    headG.push([Math.cos(hga) * (0.4 + rnd() * 0.6), Math.sin(hga) * (0.4 + rnd() * 0.6)]);
  }

  /* ---- recall: the only thing in here that sharpens anything ---- */
  var lastSeen = [];
  for (var vi = 0; vi < NODES; vi++) lastSeen.push(-9e9);
  var traces = [];
  for (var tt = 0; tt < TRACES; tt++) {
    traces.push({ from: -1, to: -1, l: -1, prev: -1, hop: 0, t0: 0, idle: true, wake: tt * REST_MS });
  }

  function occupied(i) {
    for (var t = 0; t < TRACES; t++) if (traces[t].from === i && !traces[t].idle) return true;
    return false;
  }

  /* The least-recently-visited node anywhere, which is what makes coverage
     even instead of leaving a corner untouched forever. */
  function coldest() {
    var best = -1;
    var bs = 9e9;
    for (var i = 0; i < NODES; i++) {
      if (occupied(i)) continue;
      if (lastSeen[i] < bs) {
        bs = lastSeen[i];
        best = i;
      }
    }
    return best < 0 ? Math.floor(rnd() * NODES) : best;
  }

  function land(i, now) {
    lastSeen[i] = now;
    nodes[i].s = 1;
    nodes[i].k = Math.min(K_CAP, nodes[i].k + LEARN);
    nodes[i].lit = 1;
    if (nodes[i].dup) nodes[i].dup.on = true;
  }

  function step(t, now) {
    if (t.hop >= HOPS) {
      t.idle = true;
      t.wake = now + REST_MS;
      t.l = -1;
      return;
    }
    var ns = nbr[t.from];
    var pick = null;
    var bs = -9e9;
    for (var i = 0; i < ns.length; i++) {
      var o = ns[i];
      if (o.to === t.prev && ns.length > 1) continue;
      /* least-recently-visited wins, with a little noise so two traces do not
         lock into the same route, and a penalty for a node another trace is
         standing on */
      var sc = (now - lastSeen[o.to]) * (0.7 + rnd() * 0.6) - (occupied(o.to) ? 6000 : 0);
      if (sc > bs) {
        bs = sc;
        pick = o;
      }
    }
    if (!pick) {
      t.idle = true;
      t.wake = now + REST_MS;
      t.l = -1;
      return;
    }
    t.l = pick.l;
    t.to = pick.to;
    t.t0 = now;
    t.hop++;
  }

  function startTrace(t, now) {
    t.idle = false;
    t.from = coldest();
    t.prev = -1;
    t.hop = 0;
    land(t.from, now);
    step(t, now);
  }

  function arrive(t, now) {
    var l = links[t.l];
    l.s = 1;
    l.k = Math.min(K_CAP, l.k + LEARN);
    l.lit = 1;
    t.prev = t.from;
    t.from = t.to;
    land(t.from, now);
    step(t, now);
  }

  function relax(dt) {
    /* Continuous forgetting, on top of the wave. Exponential so the rate does
       not depend on the frame interval. */
    var keep = Math.exp(-K_FADE * dt / 1000);
    for (var i = 0; i < NODES; i++) {
      var n = nodes[i];
      n.k = K_MIN + (n.k - K_MIN) * keep;
      n.s += (n.k - n.s) * RELAX;
      if (n.lit > 0.01) n.lit *= 0.9;
      if (n.dup && n.dup.on && n.dup.m < 1) {
        n.dup.m = Math.min(1, n.dup.m + (1 - n.dup.m) * 0.06 + 0.003);
      }
    }
    for (var j = 0; j < links.length; j++) {
      var l = links[j];
      l.k = K_MIN + (l.k - K_MIN) * keep;
      l.s += (l.k - l.s) * RELAX;
      if (l.lit > 0.01) l.lit *= 0.93;
    }
  }

  /* Forgetting is a WAVE across the field rather than a global flicker: a
     front crosses left to right and softens what it passes. It is visible,
     which is the point — a viewer should catch the cycle, not infer it. */
  var wave = -1;
  function startWave() {
    wave = 0;
    for (var i = 0; i < NODES; i++) nodes[i].swept = 0;
    for (var j = 0; j < links.length; j++) links[j].swept = 0;
  }
  function runWave(dt) {
    if (wave < 0) return;
    wave += dt / WAVE_MS;
    for (var i = 0; i < NODES; i++) {
      var n = nodes[i];
      if (!n.swept && n.bx <= wave) {
        n.k = K_MIN + (n.k - K_MIN) * FORGET_KEEP;
        n.swept = 1;
      }
    }
    for (var j = 0; j < links.length; j++) {
      var l = links[j];
      var mx = (nodes[l.a].bx + nodes[l.b].bx) / 2;
      if (!l.swept && mx <= wave) {
        l.k = K_MIN + (l.k - K_MIN) * FORGET_KEEP;
        l.swept = 1;
      }
    }
    if (wave > 1.08) wave = -1;
  }

  /* ---- paint ---- */
  var W = 0;
  var H = 0;
  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = el.clientWidth || 320;
    H = el.clientHeight || 320;
    el.width = Math.round(W * dpr);
    el.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  /* One node: a wide soft blob with its ghosts scattered around it when
     nothing has recalled it, a small bright point inside a focus ring when
     something has. The gap between those two is deliberately large — the
     first version's was too subtle to read at a glance. */
  function cloud(n, cx, cy, s, scale) {
    var vague = 1 - s;
    blob(hazeImg, cx, cy, (6.4 + vague * 26) * scale, (0.03 + vague * 0.2) * scale);
    blob(glowImg, cx, cy, (2.6 + s * 9.5) * scale, s * s * 0.55 * scale);
    ctx.fillStyle = DIM;
    for (var gi = 0; gi < GHOSTS; gi++) {
      ctx.globalAlpha = (0.18 - s * 0.1) * scale;
      disc(cx + n.g[gi][0] * vague * 17, cy + n.g[gi][1] * vague * 17, 1.7);
    }
    if (s > 0.5) {
      ctx.strokeStyle = DATA;
      ctx.globalAlpha = (s - 0.5) * 0.62 * scale;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, (3.4 + s * 3.2) * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = DATA;
    ctx.globalAlpha = (0.14 + s * 0.82) * scale;
    disc(cx, cy, (1.2 + s * 2.6) * scale);
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    var pad = 0.07;
    var i;
    var n;
    var vague;
    for (i = 0; i < NODES; i++) {
      n = nodes[i];
      var t = now / 3600;
      vague = 1 - n.s;
      /* the drift is uncertainty: a node nobody has recalled will not sit
         still, a node that has just been recalled is nailed down */
      n.px =
        (pad + n.bx * (1 - pad * 2)) * W +
        Math.sin(t * n.fx + n.ph) * W * 0.014 +
        Math.sin(now * 0.0021 + n.ph * 2.3) * vague * 2.8;
      n.py =
        (pad + n.by * (1 - pad * 2)) * H +
        Math.cos(t * n.fy + n.ph) * H * 0.014 +
        Math.cos(now * 0.0017 + n.ph * 3.1) * vague * 2.8;
    }

    /* edges: many bowed strands while vague, one definite line once used */
    ctx.lineCap = "round";
    for (var j = 0; j < links.length; j++) {
      var l = links[j];
      var A = nodes[l.a];
      var B = nodes[l.b];
      vague = 1 - l.s;
      var mx = (A.px + B.px) / 2;
      var my = (A.py + B.py) / 2;
      var dx = B.px - A.px;
      var dy = B.py - A.py;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len;
      var ny = dx / len;
      ctx.strokeStyle = DIM;
      ctx.lineWidth = 0.6 + vague * 1.15;
      ctx.globalAlpha = 0.06 + l.s * 0.04;
      for (var si = 0; si < STRANDS; si++) {
        var o = l.st[si] * vague * 16;
        ctx.beginPath();
        ctx.moveTo(A.px, A.py);
        ctx.quadraticCurveTo(mx + nx * o, my + ny * o, B.px, B.py);
        ctx.stroke();
      }
      if (l.s > 0.22) {
        ctx.strokeStyle = DATA;
        ctx.globalAlpha = (l.s - 0.22) * 0.7;
        ctx.lineWidth = 0.8 + l.s * 0.95;
        ctx.beginPath();
        ctx.moveTo(A.px, A.py);
        ctx.lineTo(B.px, B.py);
        ctx.stroke();
      }
      if (l.lit > 0.01) {
        ctx.strokeStyle = ACC;
        ctx.globalAlpha = l.lit * 0.8;
        ctx.lineWidth = 0.9 + l.s * 1.2;
        ctx.beginPath();
        ctx.moveTo(A.px, A.py);
        ctx.lineTo(B.px, B.py);
        ctx.stroke();
      }
    }

    /* nodes: a scatter that collapses into a point, and twins that merge */
    for (i = 0; i < NODES; i++) {
      n = nodes[i];
      if (n.dup && n.dup.m < 0.99) {
        var away = 1 - n.dup.m;
        cloud(n, n.px + n.dup.dx * W * away, n.py + n.dup.dy * H * away, n.s * 0.7, 0.85);
      }
      cloud(n, n.px, n.py, n.s, 1);
      if (n.lit > 0.01) {
        ctx.fillStyle = ACC;
        ctx.globalAlpha = n.lit * 0.9;
        disc(n.px, n.py, 1.6 + n.s * 2.6);
      }
    }

    /* the forgetting front, only while it is crossing */
    if (wave >= 0) {
      var fx = (pad + wave * (1 - pad * 2)) * W;
      var grad = ctx.createLinearGradient(fx - 26, 0, fx + 8, 0);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(1, "rgba(255,255,255,0.1)");
      ctx.fillStyle = grad;
      ctx.globalAlpha = 1;
      ctx.fillRect(fx - 26, 0, 34, H);
    }

    /* the recall traces: a smudge at the start of a path, a point by the end */
    for (var ti = 0; ti < TRACES; ti++) {
      var tr = traces[ti];
      if (tr.idle || tr.l < 0) continue;
      var C = nodes[tr.from];
      var D = nodes[tr.to];
      var f = Math.max(0, Math.min(1, (now - tr.t0) / HOP_MS));
      var hx = C.px + (D.px - C.px) * f;
      var hy = C.py + (D.py - C.py) * f;
      var crisp = tr.hop / HOPS;
      ctx.strokeStyle = ACC;
      ctx.globalAlpha = 0.24 + crisp * 0.55;
      ctx.lineWidth = 0.9 + crisp * 1.3;
      ctx.beginPath();
      ctx.moveTo(C.px, C.py);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      var smudge = (1 - crisp) * 9;
      ctx.fillStyle = ACC;
      for (var hi = 0; hi < GHOSTS; hi++) {
        ctx.globalAlpha = 0.11 + crisp * 0.22;
        disc(hx + headG[hi][0] * smudge, hy + headG[hi][1] * smudge, 1.1 + crisp * 1.5);
      }
    }
    ctx.globalAlpha = 1;
  }

  size();
  window.addEventListener("resize", size, { passive: true });

  /* prefers-reduced-motion: one frame, then stop. Not optional (SHELL.md
     §8.4). The still frame is a HALF-RESOLVED picture rather than the haze the
     loop starts from — a blurred first frame reads as a broken canvas, and a
     fully crisp one would not show what the animation is about. Some of it
     sharp beside some of it vague is the single image that says it. */
  function settle() {
    var clock = 0;
    for (var r = 0; r < 6; r++) {
      for (var t = 0; t < TRACES; t++) {
        var tr = traces[t];
        tr.idle = true;
        startTrace(tr, clock);
        while (!tr.idle) {
          clock += HOP_MS;
          arrive(tr, clock);
        }
      }
    }
    /* Sweep the forgetting front across HALF the field and let it settle, so
       the one frame a reduced-motion reader gets shows both states at once —
       a resolved right and a softened left, with the front between them. A
       uniformly crisp still would not say what this animation is about, and a
       uniformly hazy one reads as a broken canvas. */
    startWave();
    runWave(WAVE_MS * 0.5);
    for (var f = 0; f < 45; f++) relax(1000 / FPS);
    for (var i = 0; i < NODES; i++) {
      if (nodes[i].dup) nodes[i].dup.m = 1;
    }
    wave = -1;
  }

  var still =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still) {
    settle();
    draw(0);
    return;
  }

  /* The loop runs by default. IntersectionObserver may only PAUSE it — never
     start it — because IO does not fire in a non-compositing renderer, and an
     animation that never starts reads as a broken page. SHELL.md §6. */
  var offscreen = false;
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) {
      offscreen = !es[0].isIntersecting;
      if (!offscreen) tick(performance.now());
    }).observe(el);
  }

  var running = false;
  var last = 0;
  var lastForget = 0;

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
      if (dt > FORGET_MS) dt = 1000 / FPS;
      if (!lastForget) lastForget = now;
      if (now - lastForget >= FORGET_MS) {
        lastForget = now;
        startWave();
      }
      runWave(dt);
      for (var ti = 0; ti < TRACES; ti++) {
        var tr = traces[ti];
        if (tr.idle) {
          if (now >= tr.wake) startTrace(tr, now);
        } else if (now - tr.t0 >= HOP_MS) {
          arrive(tr, now);
        }
      }
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
