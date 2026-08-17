(function () {
var el = document.querySelector("[data-identity-animation]");
if (!el || !el.getContext) return;
var ctx = el.getContext("2d");
if (!ctx) return;
var NODES = 13;
var LINKS = 23;
var FPS = 24;
var CONSOLIDATE_MS = 2400;
var WALK_MS = 5200;
var WALK_HOPS = 9;
var ACC = "#ff5c9d";
var DATA = "#5ad1c8";
var DIM = "#e9ecf1";
var seed = 20260817;
function rnd() {
seed = (seed * 1103515245 + 12345) % 2147483648;
return seed / 2147483648;
}
var nodes = [];
for (var i = 0; i < NODES; i++) {
var t = (i / NODES) * Math.PI * 2;
var ring = i % 3 === 0 ? 0.24 : 0.42;
nodes.push({
bx: 0.5 + Math.cos(t) * ring * (0.7 + rnd() * 0.6),
by: 0.5 + Math.sin(t) * ring * (0.7 + rnd() * 0.6),
px: 0,
py: 0,
fx: 0.3 + rnd() * 0.7,
fy: 0.3 + rnd() * 0.7,
ph: rnd() * Math.PI * 2,
w: 0.3 + rnd() * 0.5,
lit: 0
});
}
var links = [];
var seen = {};
while (links.length < LINKS) {
var a = Math.floor(rnd() * NODES);
var b = Math.floor(rnd() * NODES);
if (a === b) continue;
var key = Math.min(a, b) + ":" + Math.max(a, b);
if (seen[key]) continue;
seen[key] = 1;
links.push({ a: a, b: b, w: 0.15 + rnd() * 0.75, lit: 0 });
}
var neighbours = nodes.map(function () {
return [];
});
links.forEach(function (l, idx) {
neighbours[l.a].push({ to: l.b, l: idx });
neighbours[l.b].push({ to: l.a, l: idx });
});
var cursor = 0;
function consolidate() {
for (var k = 0; k < 3; k++) {
var up = links[(cursor + k) % LINKS];
up.w = Math.min(1, up.w + 0.26);
var down = links[(cursor + LINKS / 2 + k) % LINKS | 0];
down.w = Math.max(0.06, down.w - 0.2);
}
cursor = (cursor + 3) % LINKS;
for (var n = 0; n < NODES; n++) nodes[n].w = 0.2;
links.forEach(function (l) {
nodes[l.a].w += l.w * 0.14;
nodes[l.b].w += l.w * 0.14;
});
}
consolidate();
var walkAt = -1;
var walkLeft = 0;
function walk() {
walkAt = Math.floor(rnd() * NODES);
walkLeft = WALK_HOPS;
nodes[walkAt].lit = 1;
}
function step() {
if (walkLeft <= 0 || walkAt < 0) return;
var ns = neighbours[walkAt];
if (!ns.length) {
walkLeft = 0;
return;
}
var best = ns[0];
for (var i2 = 1; i2 < ns.length; i2++) {
if (links[ns[i2].l].w * (0.65 + rnd() * 0.7) > links[best.l].w) best = ns[i2];
}
links[best.l].lit = 1;
links[best.l].w = Math.min(1, links[best.l].w + 0.05);
walkAt = best.to;
nodes[walkAt].lit = 1;
walkLeft--;
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
function draw(now) {
ctx.clearRect(0, 0, W, H);
var pad = 0.12;
for (var i3 = 0; i3 < NODES; i3++) {
var n = nodes[i3];
var d = now / 3600;
n.px = (pad + n.bx * (1 - pad * 2)) * W + Math.sin(d * n.fx + n.ph) * W * 0.022;
n.py = (pad + n.by * (1 - pad * 2)) * H + Math.cos(d * n.fy + n.ph) * H * 0.022;
}
ctx.lineCap = "round";
for (var j = 0; j < LINKS; j++) {
var l = links[j];
var A = nodes[l.a];
var B = nodes[l.b];
ctx.beginPath();
ctx.moveTo(A.px, A.py);
ctx.lineTo(B.px, B.py);
ctx.lineWidth = 0.4 + l.w * 1.9;
ctx.globalAlpha = 0.09 + l.w * 0.3;
ctx.strokeStyle = DIM;
ctx.stroke();
if (l.lit > 0.01) {
ctx.globalAlpha = l.lit * 0.85;
ctx.strokeStyle = ACC;
ctx.lineWidth = 0.7 + l.w * 2.1;
ctx.stroke();
l.lit *= 0.955;
}
}
for (var m = 0; m < NODES; m++) {
var p = nodes[m];
var r = 1.6 + p.w * 3.4;
ctx.globalAlpha = 0.22 + p.w * 0.26;
ctx.fillStyle = DATA;
ctx.beginPath();
ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
ctx.fill();
if (p.lit > 0.01) {
ctx.globalAlpha = p.lit * 0.9;
ctx.fillStyle = ACC;
ctx.beginPath();
ctx.arc(p.px, p.py, r + 1.4, 0, Math.PI * 2);
ctx.fill();
p.lit *= 0.94;
}
}
ctx.globalAlpha = 1;
}
size();
window.addEventListener("resize", size, { passive: true });
var still =
window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (still) {
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
var lastCon = 0;
var lastWalk = 0;
var lastStep = 0;
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
if (now - lastCon >= CONSOLIDATE_MS) {
lastCon = now;
consolidate();
}
if (now - lastWalk >= WALK_MS) {
lastWalk = now;
walk();
}
if (walkLeft > 0 && now - lastStep >= 190) {
lastStep = now;
step();
}
draw(now);
}
requestAnimationFrame(frame);
}
document.addEventListener("visibilitychange", function () {
if (!document.hidden) tick(performance.now());
});
tick(performance.now());
})();
