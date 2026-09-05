/* inspect.js — the interactive layer of graphonomous.com, and nothing else.

   The page is complete without this file: every stage panel, every refusal
   and every world row is in the markup. This script only decides which of
   them is in front. It toggles classes and aria-pressed; it writes no text,
   reads no data and fetches nothing, and the publication gate holds it to
   that (no textContent / innerHTML / document.write / fetch). */
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
  wire("#pipeline", ".stage", ".panels > [data-stage]", "data-stage");
  wire("#refuse", ".rbtn", ".rpanels > [data-r]", "data-r");
})();
