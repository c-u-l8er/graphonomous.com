(function () {
var el = document.querySelector("[data-identity-animation]");
if (!el || !el.getContext) return;
var ctx = el.getContext("2d");
if (!ctx) return;
var NODES = 16;
var LINKS = 26;
var GHOSTS = 8;
var STRANDS = 3;
var CLUSTERS = 3;
var HOPS = 11;
var FPS = 24;
var HOP_MS = 235;
var RECALL_MS = 2100;
var FORGET_MS = 12000;
var K_MIN = 0.06;
var K_CAP = 0.92;
var LEARN = 0.31;
var RELAX = 0.055;
var FORGET_KEEP = 0.68;
var ACC = "#ff5c9d";
var DATA = "#5ad1c8";
var DIM = "#e9ecf1";
var seed = 20260817;
function rnd() {
seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
return (seed >>> 0) / 4294967296;
}
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
var hub = [];
for (var c = 0; c < CLUSTERS; c++) {
var ha = (c / CLUSTERS) * Math.PI * 2 - 0.95;
hub.push([0.5 + Math.cos(ha) * 0.235, 0.5 + Math.sin(ha) * 0.255]);
}
var nodes = [];
for (var i = 0; i < NODES; i++) {
var h = hub[i % CLUSTERS];
var g = [];
for (var gi = 0; gi < GHOSTS; gi++) {
var ga = rnd() * Math.PI * 2;
var gr = 0.36 + rnd() * 0.64;
g.push([Math.cos(ga) * gr, Math.sin(ga) * gr]);
}
nodes.push({
c: i % CLUSTERS,
bx: h[0] + (rnd() - 0.5) * 0.36,
by: h[1] + (rnd() - 0.5) * 0.4,
px: 0,
py: 0,
fx: 0.3 + rnd() * 0.6,
fy: 0.3 + rnd() * 0.6,
ph: rnd() * Math.PI * 2,
g: g,
s: K_MIN,
k: K_MIN,
dup: null,
lit: 0
});
}
for (var d = 0; d < NODES; d += 3) {
var da = rnd() * Math.PI * 2;
nodes[d].dup = { dx: Math.cos(da) * 0.045, dy: Math.sin(da) * 0.045, m: 0, on: false };
}
var links = [];
var seen = {};
function addLink(a, b) {
if (a === b) return;
var key = Math.min(a, b) + ":" + Math.max(a, b);
if (seen[key]) return;
seen[key] = 1;
var st = [];
for (var si = 0; si < STRANDS; si++) {
st.push((si - (STRANDS - 1) / 2) * 0.9 + (rnd() - 0.5) * 0.6);
}
links.push({ a: a, b: b, st: st, s: K_MIN, k: K_MIN, lit: 0 });
}
for (var cc = 0; cc < CLUSTERS; cc++) {
var mem = [];
for (var mi = 0; mi < NODES; mi++) {
if (nodes[mi].c === cc) mem.push(mi);
}
for (var mj = 0; mj < mem.length; mj++) {
addLink(mem[mj], mem[(mj + 1) % mem.length]);
}
}
var tries = 0;
while (links.length < LINKS && tries++ < 900) {
var x = Math.floor(rnd() * NODES);
var y = Math.floor(rnd() * NODES);
if (nodes[x].c !== nodes[y].c && rnd() > 0.36) continue;
addLink(x, y);
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
var recall = null;
var visits = [];
for (var vi = 0; vi < NODES; vi++) visits.push(0);
function coldest() {
var best = 0;
for (var i = 1; i < NODES; i++) {
if (visits[i] < visits[best]) best = i;
}
return best;
}
function land(i) {
visits[i]++;
nodes[i].s = 1;
nodes[i].k = Math.min(K_CAP, nodes[i].k + LEARN);
nodes[i].lit = 1;
if (nodes[i].dup) nodes[i].dup.on = true;
}
function hop(now) {
if (!recall || recall.hop >= HOPS) {
recall = null;
return;
}
var ns = nbr[recall.from];
var opts = [];
for (var i = 0; i < ns.length; i++) {
if (ns[i].to !== recall.prev) opts.push(ns[i]);
}
if (!opts.length) opts = ns;
if (!opts.length) {
recall = null;
return;
}
var pick = opts[0];
var best = links[pick.l].k * (0.6 + rnd() * 0.8);
for (var j = 1; j < opts.length; j++) {
var score = links[opts[j].l].k * (0.6 + rnd() * 0.8);
if (score > best) {
best = score;
pick = opts[j];
}
}
recall.l = pick.l;
recall.to = pick.to;
recall.t0 = now;
recall.hop++;
}
function startRecall(now) {
var from = rnd() > 0.45 ? coldest() : Math.floor(rnd() * NODES);
recall = { from: from, to: -1, l: -1, prev: -1, hop: 0, t0: now };
land(from);
hop(now);
}
function arrive(now) {
var l = links[recall.l];
l.s = 1;
l.k = Math.min(K_CAP, l.k + LEARN);
l.lit = 1;
recall.prev = recall.from;
recall.from = recall.to;
land(recall.from);
hop(now);
}
function relax() {
for (var i = 0; i < NODES; i++) {
var n = nodes[i];
n.s += (n.k - n.s) * RELAX;
if (n.lit > 0.01) n.lit *= 0.9;
if (n.dup && n.dup.on && n.dup.m < 1) {
n.dup.m = Math.min(1, n.dup.m + (1 - n.dup.m) * 0.06 + 0.003);
}
}
for (var j = 0; j < links.length; j++) {
var l = links[j];
l.s += (l.k - l.s) * RELAX;
if (l.lit > 0.01) l.lit *= 0.93;
}
}
function forget() {
for (var i = 0; i < NODES; i++) {
nodes[i].k = K_MIN + (nodes[i].k - K_MIN) * FORGET_KEEP;
}
for (var j = 0; j < links.length; j++) {
links[j].k = K_MIN + (links[j].k - K_MIN) * FORGET_KEEP;
}
}
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
function cloud(n, cx, cy, s, scale) {
var vague = 1 - s;
blob(hazeImg, cx, cy, (6.4 + vague * 24) * scale, (0.03 + vague * 0.19) * scale);
blob(glowImg, cx, cy, (2.6 + s * 9) * scale, s * s * 0.5 * scale);
ctx.fillStyle = DIM;
for (var gi = 0; gi < GHOSTS; gi++) {
ctx.globalAlpha = (0.17 - s * 0.09) * scale;
disc(cx + n.g[gi][0] * vague * 15.5, cy + n.g[gi][1] * vague * 15.5, 1.7);
}
ctx.fillStyle = DATA;
ctx.globalAlpha = (0.15 + s * 0.8) * scale;
disc(cx, cy, (1.3 + s * 2.9) * scale);
}
function draw(now) {
ctx.clearRect(0, 0, W, H);
var pad = 0.11;
var i;
var n;
var vague;
for (i = 0; i < NODES; i++) {
n = nodes[i];
var t = now / 3600;
vague = 1 - n.s;
n.px =
(pad + n.bx * (1 - pad * 2)) * W +
Math.sin(t * n.fx + n.ph) * W * 0.018 +
Math.sin(now * 0.0021 + n.ph * 2.3) * vague * 2.6;
n.py =
(pad + n.by * (1 - pad * 2)) * H +
Math.cos(t * n.fy + n.ph) * H * 0.018 +
Math.cos(now * 0.0017 + n.ph * 3.1) * vague * 2.6;
}
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
var o = l.st[si] * vague * 19;
ctx.beginPath();
ctx.moveTo(A.px, A.py);
ctx.quadraticCurveTo(mx + nx * o, my + ny * o, B.px, B.py);
ctx.stroke();
}
if (l.s > 0.24) {
ctx.strokeStyle = DATA;
ctx.globalAlpha = (l.s - 0.24) * 0.62;
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
for (i = 0; i < NODES; i++) {
n = nodes[i];
if (n.dup && n.dup.m < 0.99) {
var away = 1 - n.dup.m;
cloud(n, n.px + n.dup.dx * W * away, n.py + n.dup.dy * H * away, n.s * 0.75, 0.88);
}
cloud(n, n.px, n.py, n.s, 1);
if (n.lit > 0.01) {
ctx.fillStyle = ACC;
ctx.globalAlpha = n.lit * 0.9;
disc(n.px, n.py, 1.6 + n.s * 2.6);
}
}
if (recall && recall.l >= 0) {
var C = nodes[recall.from];
var D = nodes[recall.to];
var f = Math.max(0, Math.min(1, (now - recall.t0) / HOP_MS));
var hx = C.px + (D.px - C.px) * f;
var hy = C.py + (D.py - C.py) * f;
var crisp = recall.hop / HOPS;
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
ctx.globalAlpha = 0.12 + crisp * 0.24;
disc(hx + headG[hi][0] * smudge, hy + headG[hi][1] * smudge, 1.1 + crisp * 1.6);
}
}
ctx.globalAlpha = 1;
}
size();
window.addEventListener("resize", size, { passive: true });
function settle() {
var clock = 0;
for (var r = 0; r < 6; r++) {
startRecall(clock);
while (recall) {
clock += HOP_MS;
arrive(clock);
}
}
for (var f = 0; f < 40; f++) relax();
for (var i = 0; i < NODES; i++) {
if (nodes[i].dup) nodes[i].dup.m = 1;
}
}
var still =
window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (still) {
settle();
draw(0);
return;
}
var offscreen = false;
if (window.IntersectionObserver) {
new IntersectionObserver(function (es) {
offscreen = !es[0].isIntersecting;
if (!offscreen) tick(performance.now());
}).observe(el);
}
var running = false;
var last = 0;
var lastRecall = 0;
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
if (now - last >= 1000 / FPS) {
last = now;
if (now - lastForget >= FORGET_MS) {
lastForget = now;
forget();
}
if (recall) {
if (now - recall.t0 >= HOP_MS) arrive(now);
if (!recall) lastRecall = now;
} else if (now - lastRecall >= RECALL_MS) {
startRecall(now);
}
relax();
draw(now);
}
requestAnimationFrame(frame);
}
document.addEventListener("visibilitychange", function () {
if (!document.hidden) tick(performance.now());
});
tick(performance.now());
})();
