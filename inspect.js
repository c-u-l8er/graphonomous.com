(function () {
function wire(rootSel, btnSel, panelSel, attr) {
var root = document.querySelector(rootSel);
if (!root) return;
var btns = root.querySelectorAll(btnSel);
var panels = root.querySelectorAll(panelSel);
if (!btns.length || !panels.length) return;
root.classList.add("js");
function show(id) {
for (var i = 0; i < btns.length; i++) {
var on = btns[i].getAttribute(attr) === id;
btns[i].classList.toggle("on", on);
btns[i].setAttribute("aria-pressed", on ? "true" : "false");
}
for (var j = 0; j < panels.length; j++) {
panels[j].classList.toggle("on", panels[j].getAttribute(attr) === id);
}
}
for (var k = 0; k < btns.length; k++) {
btns[k].addEventListener("click", function (e) { show(e.currentTarget.getAttribute(attr)); });
}
show(btns[0].getAttribute(attr));
}
wire("#what", ".sblk", ".spanels > [data-s]", "data-s");
wire("#pipeline", ".stage", ".panels > [data-stage]", "data-stage");
wire("#refuse", ".rbtn", ".rpanels > [data-r]", "data-r");
})();
