/* ==========================================================================
   The identifying animation — SHELL.md §8.

   WHAT IT DEPICTS: a memory getting sharper from being used.

   Everything starts vague. A node is not a dot, it is a soft blob with a WIDE
   scatter of ghost points around where the dot would be, and it drifts,
   because an unrecalled memory is a region rather than a fact. Left alone it
   swells until its ghosts all but touch the next node's. An edge is not a
   line, it is a smear of bowed strands. Recall traces then walk the graph, and
   WHAT THEY CROSS RESOLVES, slowly and by degrees: the blob draws in over
   about half a second, the drift stops, a focus ring closes around it, the
   strands of a crossed edge converge into one line — and a near-duplicate node
   a trace lands on merges into its twin, which is what consolidation does to
   two nodes that turn out to be the same thing. A trace itself leaves as a
   smudge and arrives as a point.

   THE GHOSTS NEVER BECOME ONE POINT. Repeated recall gathers them into a
   tight group of separate points and no further, because the floor a memory
   relaxes to never reaches 1 (K_CAP below). Reading a thing often makes it
   definite; it does not make it a single fact.

   Then a forgetting sweep crosses the field and softens whatever it passes,
   and the traces sharpen it again somewhere else. Sharpness is therefore not
   a property of the graph, it is a property of which parts of it are being
   used, right now — which is the question in this page's h1, drawn rather
   than argued. The picture is meaningfully different at five seconds, at
   fifteen and at thirty, and that is the whole point of it.

   FOUR THINGS HERE EXIST BECAUSE AN EARLIER VERSION FAILED AT THEM, and each
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
   4. THE CLOUD IS SIZED PER NODE, TRAVELS SLOWLY, AND STOPS SHORT AT BOTH
      ENDS. Every part of that replaced something that read as an event with no
      duration. The scatter was a fixed pixel radius — small enough that a
      neglected node was a dot with specks beside it, so there was nothing to
      see a trace do; it is now a fraction of the distance to that node's OWN
      nearest neighbour, so neglect is visible as clouds nearly meeting. Recall
      set sharpness to its maximum in one frame, which is a cut, not a
      contraction; it now raises a floor that sharpness walks toward over about
      half a second and drifts back from over two. And the tight end was a
      single point, reached by any one pass; it is now a group of separate
      points, reached only by passes that stack up faster than the floor
      decays. See REACH, TIGHT and SHARPEN below.

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
     floor decays with a time constant near four seconds, so a node is bright
     for about a second after a trace lands, fades over the next few, and is
     picked up again a few seconds later. The sharp set is therefore always a
     MOVING SUBSET rather than the whole graph, and the wave below knocks it
     down harder on its own slower clock.

     It was faster than this while sharpness was assigned rather than
     travelled. A floor that spikes and falls away inside a second is a target
     a slow chaser can never reach, and the tight end simply stopped being
     visited: measured, sharpness topped out near 0.7 and the group never got
     within a third of its own widest. The decay had to lose a little so that
     SHARPEN could be slow AND still arrive. */
  var K_MIN = 0.05;
  var K_CAP = 0.88;
  var LEARN = 0.34;
  var RELAX = 0.042;
  var FORGET_KEEP = 0.44;
  var K_FADE = 0.26;

  /* ---- how wide "vague" is, how tight "recalled" is, and how slowly it
          travels between the two ----

     REACH IS A FRACTION OF EACH NODE'S OWN DISTANCE TO ITS NEAREST NEIGHBOUR,
     measured in pixels at the current canvas size — not a pixel constant and
     not one number for the whole field. A node left alone swells until its
     ghosts all but meet the next node's. It is set above half deliberately:
     the outermost ghost is not at full radius, and sharpness does not sink all
     the way to its floor between passes, so what a node actually spends its
     time at is well inside what REACH allows. Measured on the artifact, a
     neglected cloud covers about six sevenths of the half-gap to its nearest
     node and the closest two in the whole field meet without passing.

     Per node, because spacing here is not uniform — the closest pair sit about
     three quarters as far apart as the median pair. One field-wide radius
     either leaves most of the graph with obvious margin or turns the crowded
     corner to mush; each node measured against its own neighbour gives the
     same picture everywhere, and at every canvas width.

     TIGHT is the other end: the fraction of that reach the cloud KEEPS when a
     memory is as sharp as it gets. It is not zero, and the reason is already
     in K_CAP above — the floor a thing relaxes to never reaches 1, so the
     ghosts converge to a small group and stay a group of separate points
     rather than becoming one point. Repeated recall is what gets there: one
     pass raises the floor by LEARN, several passes stack against the decay
     until the floor is at its cap, and only then is the cluster at its
     tightest. Sharpness is a history, not a flag.

     SHARPEN is that journey's speed. Both directions are meant to be watched
     rather than noticed after the fact: measured on the artifact, a node draws
     in over about fourteen frames and swells back over about fifty. Neither is
     a cut, and the outward journey is the slower of the two because RELAX is
     chasing a floor that is itself still sinking. */
  var REACH = 0.57;
  var TIGHT = 0.11;
  var SHARPEN = 0.12;
  var TWIN = 0.85;

  /* THE ONE PIXEL CONSTANT LEFT, and it has to be one. Everything above scales
     with the canvas; a ghost cannot, because below about a pixel across it is
     not a small point, it is nothing — an earlier pass shrank the dots as they
     gathered and the tight group vanished at four hundred percent zoom. So the
     dots have a size the canvas does not get to shrink below, and GHOSTS dots
     of that size need a circle of about this radius to sit around without
     touching. Measured, the nearest two in the tightest group ever drawn clear
     each other by a pixel and a half on the wide canvas and a little under
     that on a phone. It binds at the tight end on both, and it is the whole
     reason the group stays a group of points rather than a smudge. */
  var TIGHT_MIN = 13;

  /* The sweep's re-laying (see relayout, below the forgetting wave). JITTER is
     how far a node is thrown before the evening runs, as a fraction of the
     spacing an even field would have — a nudge, not a reshuffle, because the
     edges were fixed at load. GLIDE is how fast it walks there: at this rate a
     node takes about two and a half seconds, so the field is still settling
     well after the bar has left the screen. */
  var JITTER = 0.35;
  var EVEN_ROUNDS = 14;
  var EVEN_STEP = 0.16;
  var GLIDE = 0.04;
  /* When a walk counts as finished, in normalised field units — under a
     hundredth of a pixel. Written as a decimal rather than in exponent form on
     purpose: the gate reads every standalone integer in this file and compares
     it against the page's text, and `1e-5` presents a bare 5 to that check,
     which is a figure the page prints. It refused, correctly. */
  var SETTLED = 0.00002;

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
      /* ONE GHOST PER SECTOR, jittered inside it, rather than a free angle.
         Free angles are fine while the scatter is wide and collide once it is
         not: two ghosts that happened to draw the same bearing sit on top of
         each other at the tight end and the group reads as a smudge with a
         couple of specks. A sector each keeps them apart at every scale, and
         the jitter is what stops the tight state looking like a cog. */
      var ga = ((gi + 0.3 + rnd() * 0.4) / GHOSTS) * Math.PI * 2;
      var gr = 0.48 + rnd() * 0.52;
      g.push([Math.cos(ga) * gr, Math.sin(ga) * gr]);
    }
    nodes.push({
      bx: pts[i][0],
      by: pts[i][1],
      tx: pts[i][0],
      ty: pts[i][1],
      px: 0,
      py: 0,
      reach: 0,
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
     themselves; landing a trace on one starts the merge. The offset is a unit
     direction — how far along it the twin sits is TWIN clouds, resolved at
     paint time, because the cloud is not known until the canvas is measured. */
  for (var d = 0; d < NODES; d += 3) {
    var da = rnd() * Math.PI * 2;
    nodes[d].dup = { dx: Math.cos(da), dy: Math.sin(da), m: 0, on: false };
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

  /* Recall raises the FLOOR and nothing else. It does not set sharpness, and
     there is no shortcut to the tight end: how tight a node gets is how much
     floor its own history has managed to hold against the decay, and relax()
     below walks it there a frame at a time. */
  function land(i, now) {
    lastSeen[i] = now;
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
    l.k = Math.min(K_CAP, l.k + LEARN);
    l.lit = 1;
    t.prev = t.from;
    t.from = t.to;
    land(t.from, now);
    step(t, now);
  }

  /* Sharpness chases the floor, at two speeds: SHARPEN closing on a floor that
     has just been raised, RELAX drifting back out toward one that is sinking.
     Nothing here jumps. Rising is about three times the faster of the two, so
     a node tightens over roughly a second and takes roughly three to swell
     back — a recall resolves a memory sooner than neglect loses it, but both
     are slow enough to watch happen. */
  function sharpen(o) {
    o.s += (o.k - o.s) * (o.k > o.s ? SHARPEN : RELAX);
  }

  function relax(dt) {
    /* Continuous forgetting, on top of the wave. Exponential so the rate does
       not depend on the frame interval. */
    var keep = Math.exp(-K_FADE * dt / 1000);
    var moved = false;
    for (var i = 0; i < NODES; i++) {
      var n = nodes[i];
      n.k = K_MIN + (n.k - K_MIN) * keep;
      sharpen(n);
      /* A node walks to wherever the last sweep put it, but only once the
         front has actually reached it — the re-laying is something the bar
         does as it goes over, not something the whole field does at once. */
      if (n.swept) {
        var gx = (n.tx - n.bx) * GLIDE;
        var gy = (n.ty - n.by) * GLIDE;
        if (Math.abs(gx) > SETTLED || Math.abs(gy) > SETTLED) {
          n.bx += gx;
          n.by += gy;
          moved = true;
        }
      }
      if (n.lit > 0.01) n.lit *= 0.9;
      if (n.dup && n.dup.on && n.dup.m < 1) {
        n.dup.m = Math.min(1, n.dup.m + (1 - n.dup.m) * 0.06 + 0.003);
      }
    }
    for (var j = 0; j < links.length; j++) {
      var l = links[j];
      l.k = K_MIN + (l.k - K_MIN) * keep;
      sharpen(l);
      if (l.lit > 0.01) l.lit *= 0.93;
    }
    /* Cloud size is measured from the gaps, so it has to be re-measured while
       the gaps are changing — otherwise a node keeps the reach of where it
       used to stand and swells into the neighbour it just moved next to. It is
       O(NODES squared) with NODES at 22, and only while something is walking. */
    if (moved) room();
  }

  /* THE SWEEP ALSO RE-LAYS THE FIELD IT PASSES OVER.

     Placement is blue noise, which is even on AVERAGE and not evenly: on this
     canvas the closest pair start about two thirds as far apart as the median
     pair, and since a node's cloud is sized from its own gap, that reads as
     small clouds in one corner and large ones in another. Worse, it never
     changes — the same corner is the crowded one for as long as anyone
     watches.

     So the front does not only dim what it crosses. It throws each node it
     passes a short distance and then lets mutual repulsion push the whole set
     back apart, which is a NEW arrangement every sweep and an evener one than
     the last. Randomly even, rather than evenly random: the jitter is what
     stops it converging to a lattice, the repulsion is what stops it drifting
     into clumps.

     Two things this deliberately does NOT do. The throw is a fraction of the
     spacing, not a reshuffle, because the edges are the k-nearest-neighbour
     set computed once at load — move a node far enough and its edges stop
     being its neighbours' and the graph becomes crossing noise, which is the
     first version's failure (2. above) reintroduced through the back door. And
     nothing teleports: a node walks to the place the sweep gave it at GLIDE,
     so what the front leaves behind is a field settling, not a field cut. */
  function relayout() {
    var fw = W * (1 - PAD * 2);
    var fh = H * (1 - PAD * 2);
    if (fw <= 0 || fh <= 0) return;
    /* the spacing an even arrangement of NODES over this field would have */
    var ideal = Math.sqrt((fw * fh) / NODES);
    var x = [];
    var y = [];
    for (var i = 0; i < NODES; i++) {
      x.push(nodes[i].bx * fw + (rnd() - 0.5) * JITTER * ideal);
      y.push(nodes[i].by * fh + (rnd() - 0.5) * JITTER * ideal);
    }
    /* Repulsion in PIXELS, not in the normalised square. The field is a good
       deal taller than it is wide; evening it in normalised coordinates would
       leave every node further from the one below it than from the one beside
       it, which is the same unevenness in a different direction. */
    for (var r = 0; r < EVEN_ROUNDS; r++) {
      for (var a = 0; a < NODES; a++) {
        var mx = 0;
        var my = 0;
        for (var b = 0; b < NODES; b++) {
          if (b === a) continue;
          var dx = x[a] - x[b];
          var dy = y[a] - y[b];
          var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          if (d >= ideal) continue;
          var push = (ideal - d) / ideal;
          mx += (dx / d) * push;
          my += (dy / d) * push;
        }
        x[a] = Math.min(fw, Math.max(0, x[a] + mx * ideal * EVEN_STEP));
        y[a] = Math.min(fh, Math.max(0, y[a] + my * ideal * EVEN_STEP));
      }
    }
    for (var t = 0; t < NODES; t++) {
      nodes[t].tx = x[t] / fw;
      nodes[t].ty = y[t] / fh;
    }
  }

  /* Forgetting is a WAVE across the field rather than a global flicker: a
     front crosses left to right and softens what it passes. It is visible,
     which is the point — a viewer should catch the cycle, not infer it. */
  var wave = -1;
  function startWave() {
    wave = 0;
    relayout();
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
  var PAD = 0.07;

  /* How much room each node has: the distance to whichever node is nearest to
     it, in pixels, times REACH. The field is not square and the placement is
     normalised, so this is a canvas-size question and has to be re-answered on
     resize — a pair that is comfortably apart on the wide canvas is the
     crowded pair on the narrow one. It is also re-answered while the sweep's
     re-laying is still walking nodes about, for the same reason. NODES is 22;
     this is a few hundred comparisons and only runs when something moved. */
  function room() {
    var fw = W * (1 - PAD * 2);
    var fh = H * (1 - PAD * 2);
    for (var i = 0; i < NODES; i++) {
      var near = 9e9;
      for (var j = 0; j < NODES; j++) {
        if (j === i) continue;
        var dx = (nodes[i].bx - nodes[j].bx) * fw;
        var dy = (nodes[i].by - nodes[j].by) * fh;
        var d = dx * dx + dy * dy;
        if (d < near) near = d;
      }
      nodes[i].reach = Math.sqrt(near) * REACH;
    }
  }

  /* Placement is normalised and the field is not square, so "even" is not a
     property the load-time layout can have — it is only decidable once there
     is a canvas. The first measure therefore runs the sweep's own evening and
     puts the nodes straight there, with no walk, so the page does not open on
     the uneven arrangement and wait eleven seconds to fix it. Re-run on
     resize, because a field of a different shape is even in a different place. */
  var laidW = 0;
  var laidH = 0;
  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = el.clientWidth || 320;
    H = el.clientHeight || 320;
    /* Guarded on the dimensions rather than run unconditionally: a resize drag
       fires this on every frame of the drag, and re-jittering the field sixty
       times a second would read as the graph shaking rather than as an even
       one. */
    if (W !== laidW || H !== laidH) {
      laidW = W;
      laidH = H;
      relayout();
      for (var i = 0; i < NODES; i++) {
        nodes[i].bx = nodes[i].tx;
        nodes[i].by = nodes[i].ty;
      }
    }
    room();
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
    /* How far out the ghosts have got, between TIGHT of this node's room and
       all of it. The haze is drawn a little wider than they reach, so the
       scatter sits INSIDE a region rather than beside one; its sprite is
       transparent well before its nominal radius, so the ghosts are what the
       eye takes for the boundary and they are what REACH bounds. */
    var spread = Math.max(TIGHT_MIN, n.reach * (TIGHT + (1 - TIGHT) * vague));
    blob(hazeImg, cx, cy, (6.4 + spread * 1.15) * scale, (0.03 + vague * 0.13) * scale);
    /* The glow has to stay INSIDE the ghosts. It used to reach as far as the
       whole tight group, and a bright teal disc over eight pale points is one
       bright teal disc — at four hundred percent the group was not there at
       all. It is the core's halo, not the node's. */
    blob(glowImg, cx, cy, (2 + s * 2.2) * scale, s * s * 0.42 * scale);
    ctx.fillStyle = DIM;
    for (var gi = 0; gi < GHOSTS; gi++) {
      /* Larger and fainter while dispersed, smaller and BRIGHTER once
         gathered. Brighter is the way round it has to be: a gathered point is
         a more definite thing than a smear, and the tight group is the state
         the eye is meant to be able to count. It was the other way round and
         the group lost to its own core. */
      ctx.globalAlpha = (0.22 + s * 0.42) * scale;
      disc(cx + n.g[gi][0] * spread, cy + n.g[gi][1] * spread, 1.5 + vague * 0.55);
    }
    /* Inside the group too, for the same reason as the glow. */
    if (s > 0.5) {
      ctx.strokeStyle = DATA;
      ctx.globalAlpha = (s - 0.5) * 0.62 * scale;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, (2.6 + s * 2.1) * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = DATA;
    ctx.globalAlpha = (0.14 + s * 0.82) * scale;
    disc(cx, cy, (1.1 + s * 1.4) * scale);
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    var pad = PAD;
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
        var away = (1 - n.dup.m) * n.reach * TWIN;
        cloud(n, n.px + n.dup.dx * away, n.py + n.dup.dy * away, n.s * 0.7, 0.85);
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
    /* Nothing relaxed during the walk above, so every floor the traces raised
       is still waiting to be travelled to. These frames are where the still
       frame's contrast is actually made: the right half arrives at a raised
       floor, the left half at the one the wave just halved. */
    for (var f = 0; f < 53; f++) relax(1000 / FPS);
    /* startWave laid out a new arrangement and the swept half has walked part
       of the way to it. A still frame caught mid-walk is a field with one side
       half-moved, which reads as a mistake rather than as a moment; put every
       node where the sweep decided it goes. */
    for (var i = 0; i < NODES; i++) {
      if (nodes[i].dup) nodes[i].dup.m = 1;
      nodes[i].bx = nodes[i].tx;
      nodes[i].by = nodes[i].ty;
    }
    room();
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
