/* ==========================================================================
   The correction form — progressive enhancement only.

   The <form> in the page already works without this file: it has an `action`
   and `method="POST"`, so with scripting off the browser posts it to Formspree
   and you land on Formspree's own thank-you screen. That is the whole reason
   it is a form and not a fetch bolted to a button, and it is why this page's
   text is byte-identical with every <script> tag removed.

   All this adds is an inline reply instead of the hand-off.

   THE ONE RULE THAT MATTERS: "sent" is printed only after the endpoint
   actually returns 2xx. A form that says thank-you on submit and drops the
   message is precisely the failure this site is about — and it is the default
   behaviour of most hand-rolled AJAX forms. The publication gate reads the
   shape of the success branch below and refuses a build in which it is not
   guarded by the response.

   Unlike memory.js, this file IS allowed to write into the document — that is
   its entire job. The §8 animation checks are aimed at memory.js alone, and
   the two files are separate for exactly that reason.
   ========================================================================== */
(function () {
  var form = document.querySelector("form.say");
  if (!form || !window.fetch || !window.FormData) return;
  var msg = form.querySelector(".say-msg");
  var btn = form.querySelector("button[type=submit]");
  if (!msg || !btn) return;

  function say(text, cls) {
    msg.textContent = text;
    msg.className = "say-msg" + (cls ? " " + cls : "");
  }

  form.addEventListener("submit", function (e) {
    /* checkValidity is ours to call because the form carries novalidate: the
       browser's own bubbles are styled by the browser, not by this page. */
    if (!form.checkValidity()) {
      e.preventDefault();
      var bad = form.querySelector(":invalid");
      say(
        bad && bad.name === "email"
          ? "That email address will not parse."
          : "Both fields are needed.",
        "bad"
      );
      if (bad) bad.focus();
      return;
    }
    e.preventDefault();
    btn.disabled = true;
    say("sending…");

    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" }
    })
      .then(function (res) {
        return res.json().then(
          function (data) {
            return { ok: res.ok, status: res.status, data: data };
          },
          function () {
            return { ok: res.ok, status: res.status, data: null };
          }
        );
      })
      .then(function (r) {
        if (r.ok) {
          form.reset();
          say("Sent. A person reads these; give it a day or two.", "ok");
          btn.disabled = false;
          return;
        }
        /* Report what the endpoint actually said. The reason is usually
           actionable, and a generic apology is not. */
        var why =
          (r.data &&
            (r.data.error ||
              (r.data.errors &&
                r.data.errors
                  .map(function (x) {
                    return x.message;
                  })
                  .join("; ")))) ||
          "HTTP " + r.status;
        say("Not sent — " + why, "bad");
        btn.disabled = false;
      })
      .catch(function () {
        say(
          "Not sent — the request never completed. Check the connection, or anything blocking formspree.io.",
          "bad"
        );
        btn.disabled = false;
      });
  });
})();
