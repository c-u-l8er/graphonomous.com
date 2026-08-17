/* ==========================================================================
   graphonomous.com publication gate.

       node launch-gate.mjs

   It reads the ARTIFACT — the emitted index.html and memory.js — not the
   source, because the artifact is what a visitor gets and it is the only thing
   worth checking. No dependencies, no network.

   Structure and most of the checks are lifted from ~/Projects/GPSCoord/ and
   ProjectAmp2/toolboxhvac.com/, which are the portfolio's references for this.
   Checks 12–14 are this surface's own and are the ones that would have caught
   what shipped here: an install requirement contradicted by the release
   assets, and a machine table two actions short of the code.

   Every check below has been made to refuse on purpose. The results are in
   the commit message. A gate nobody has seen fail is an opinion.
   ========================================================================== */
import { readFileSync } from "fs";

const HTML = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const ANIM = readFileSync(new URL("./memory.js", import.meta.url), "utf8");
const SURFACE = JSON.parse(readFileSync(new URL("./records/surface.json", import.meta.url), "utf8"));
const WITNESS = JSON.parse(readFileSync(new URL("./records/witness.json", import.meta.url), "utf8"));
const PKG = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

const RUNGS = ["spec", "in_tree", "live_local", "live_deployed", "external"];
const VERBS = {
    spec: ["Read", "Challenge", "Implement"],
    in_tree: ["Inspect the source", "Run the tests"],
    live_local: ["Use it", "Reproduce it locally"],
    live_deployed: ["Use the deployed artifact"],
    external: ["See independent evidence", "Contribute another result"],
};

let pass = 0;
let fail = 0;
function T(name, ok, detail) {
    if (ok) {
        pass++;
        console.log(`  ok      ${name}${detail ? "  — " + detail : ""}`);
    } else {
        fail++;
        console.log(`  REFUSE  ${name}${detail ? "  — " + detail : ""}`);
    }
}

/* ---------- small helpers, because there is no DOM here ---------- */
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…", middot: "·", ldquo: '"', rdquo: '"', lsquo: "'", rsquo: "'", ensp: " ", emsp: " ", times: "×", rarr: "→", minus: "−", copy: "©", deg: "°" };
const decode = (s) =>
    String(s).replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (m, e) =>
        e[0] === "#" ? String.fromCodePoint(parseInt(e[1] === "x" ? e.slice(2) : e.slice(1), e[1] === "x" ? 16 : 10)) : NAMED[e] ?? m
    );
/* Visible text only: scripts, styles and attributes are not what a reader
   reads, and a check that scans them produces noise instead of refusals. */
const TEXT = decode(
    HTML.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<[^>]+>/g, " ")
).replace(/\s+/g, " ");

/* Text outside the retraction paragraph. Naming a wrong value is what a
   retraction IS, so the one place a retracted string may appear is inside it. */
const RETRACT_BLOCK = /<div class="retract" data-retraction>[\s\S]*?<\/div>/.exec(HTML);
const TEXT_OUTSIDE = decode(
    HTML.replace(/<div class="retract" data-retraction>[\s\S]*?<\/div>/, " ")
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<[^>]+>/g, " ")
).replace(/\s+/g, " ");

console.log("publication gate — graphonomous.com\n");

/* ---------- 1. release identity ---------- */
T("release identity: package == record", PKG.version === SURFACE.version, `${PKG.version} / ${SURFACE.version}`);
T("the stamp on the artifact names the release", HTML.includes(`v${SURFACE.version}`));
T("the artifact records which shell revision it was built against",
  HTML.includes(SURFACE.shell_revision) && SURFACE.shell_revision === "shell-r4", SURFACE.shell_revision);

/* ---------- 2. the artifact is fully rendered ---------- */
T("no unrendered {{TOKEN}} survived into the artifact", !/\{\{\w+\}\}/.test(HTML),
  (HTML.match(/\{\{\w+\}\}/g) || []).join(", "));
T("the animation artifact was emitted", ANIM.length > 0 && HTML.includes("/memory.js"));

/* ---------- 3. every rung on the artifact is a real rung ---------- */
const chips = [...HTML.matchAll(/<span class="rung" data-rung="([^"]*)"[^>]*>([^<]*)<\/span>/g)];
T("at least one rung chip is rendered", chips.length > 0, `${chips.length} chips`);
T("no empty / undefined / null rung anywhere",
  !/data-rung="(|undefined|null)"/.test(HTML));
T("every chip's text equals its stored rung",
  chips.every((c) => c[1] === c[2].trim()));
T("every rung is one of the five, or the honest ?",
  chips.every((c) => RUNGS.includes(c[1]) || c[1] === "?"));
T("the surface rung is the one in the record",
  chips.some((c) => c[1] === SURFACE.surface_rung), SURFACE.surface_rung);

/* ---------- 4. the band bounds what the rung covers ---------- */
const band = /<div class="band"[^>]*>([\s\S]*?)<\/div>\s*(?=<)/.exec(HTML);
T("the band is present", !!band);
T("the band carries a covers span", /class="covers"/.test(HTML));
T("the covers span names an artifact, not a vibe",
  decode(HTML).includes(SURFACE.surface_rung_covers.slice(0, 40)));
/* Tier is read from amp-nav, not chosen. place 2 keeps the layer sentence;
   place 4 must drop it. gpscoord shipped the wrong one of these. SHELL.md §1. */
const BANDTEXT = band ? decode(band[0].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ") : "";
T("the band's claim matches the tier in the record",
  SURFACE.tier === 4
      ? !BANDTEXT.includes(`layer of`) && BANDTEXT.includes(`A ${SURFACE.parent} project`)
      : BANDTEXT.includes(`is the ${SURFACE.layer} layer of ${SURFACE.parent}`),
  `tier ${SURFACE.tier}`);

/* ---------- 5. no dead mailbox anywhere ---------- */
T("no page advertises a mailto:", !/mailto:/i.test(HTML));
T("no bare email address in the text", !/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(TEXT));
T("there is a live correction channel instead",
  HTML.includes(SURFACE.contact.url), SURFACE.contact.url);

/* ---------- 6. the status block is complete ---------- */
for (const row of ["Status", "Last verified", "Source", "Limit", "Next rung"]) {
    T(`status block has the ${row} row`, new RegExp(`<dt>${row}</dt>`).test(HTML));
}
T("the LIMIT row is the highlighted one", /class="limit"><dt>Limit<\/dt>/.test(HTML));
T("LIMIT is load-bearing, not a disclaimer",
  SURFACE.status.limit.length > 160 && /\bnot\b/i.test(SURFACE.status.limit));

/* ---------- 7. the review ledger cannot lie ---------- */
for (const [k, g] of Object.entries(SURFACE.gates)) {
    if (k.startsWith("_")) continue;
    T(`gate ${k} declares a legal status`, ["pending", "approved"].includes(g.status), g.status);
    if (g.status === "approved") {
        T(`gate ${k} approved WITH evidence, reviewer and date`, !!(g.evidence && g.reviewer && g.date));
    }
}
/* While any gate is pending, the page may not claim the rung above its own. */
const pending = Object.entries(SURFACE.gates).filter(([k, g]) => !k.startsWith("_") && g.status === "pending");
T("a pending ledger does not let the page claim the next rung up",
  pending.length === 0 || !decode(HTML).includes(`data-rung="${SURFACE.advance.next_rung}"`),
  `${pending.length} pending`);
T("the ledger is published on the artifact, not just in the record",
  pending.every(([, g]) => decode(HTML).includes(g.label)));

/* ---------- 8. §0.7 — the rung gates the call to action ---------- */
const groups = [...HTML.matchAll(/<div class="tag(?: ok)?">(\w+) &mdash;[\s\S]*?<div class="cta">([\s\S]*?)<\/div><\/div>/g)];
T("at least one CTA group is emitted", groups.length > 0, `${groups.length} groups`);
for (const g of groups) {
    const groupRung = g[1];
    const verbs = [...g[2].matchAll(/<span class="verb">([^<]*)<\/span>/g)].map((m) => decode(m[1]));
    T(`CTA group "${groupRung}" declares a real rung`, RUNGS.includes(groupRung));
    const allowed = VERBS[groupRung] || [];
    const bad = verbs.filter((v) => !allowed.includes(v));
    T(`CTA group "${groupRung}" only uses verbs that rung has earned`, bad.length === 0,
      bad.length ? `not available at ${groupRung}: ${bad.join(", ")}` : verbs.join(" · "));
}

/* ---------- 9. claims that were retracted may not come back ---------- */
for (const r of SURFACE.retracted) {
    T(`retracted "${r.string}" stays retracted`, !TEXT_OUTSIDE.includes(r.string));
}
T("the retraction paragraph is on the artifact and names them", !!RETRACT_BLOCK &&
  SURFACE.retracted.every((r) => decode(RETRACT_BLOCK[0]).includes(r.string)));

/* ---------- 10. every figure on the page has a witness ----------
   The published figures come out of records/witness.json. A number in the
   count plate that is not a witnessed value is exactly the defect this whole
   arrangement exists to prevent, so it is checked on the artifact and not
   merely arranged for in the build. */
const plateNums = [...HTML.matchAll(/<div class="n">([^<]*)<\/div>/g)].map((m) => decode(m[1]).trim());
const witnessed = new Set(Object.values(WITNESS.facts).map((f) => String(f.value)));
for (const n of plateNums) {
    const parts = n.split(/\s+of\s+/);
    T(`plate figure "${n}" is witnessed`, parts.every((p) => witnessed.has(p)));
}
T("the witness record names a command for every fact",
  Object.entries(WITNESS.facts).every(([, f]) => typeof f.command === "string" && f.command.length > 3));
T("the witness record names the commit it was measured at",
  /^[0-9a-f]{40}$/.test(WITNESS.engine_commit), WITNESS.engine_commit.slice(0, 7));

/* ---------- 11. the install table is the one that was probed ---------- */
const tableTargets = [...HTML.matchAll(/<td class="place">([^<]*)<\/td><td class="(?:num|bad)">(\d+)<\/td>/g)]
    .map((m) => ({ target: decode(m[1]).trim(), http: +m[2] }));
T("every probed target is on the artifact",
  WITNESS.install_targets.rows.every((r) => tableTargets.some((t) => t.target === r.target && t.http === r.http)),
  `${tableTargets.length} rows`);
T("no target is on the artifact that was never probed",
  tableTargets.every((t) => WITNESS.install_targets.rows.some((r) => r.target === t.target)));
/* The defect in one line: the page may not claim a platform whose asset 404s.
   The old page said "macOS or Linux · x64 or arm64" while three of the four
   were missing. A link that returns 200 can still be dead, and so can a
   package that resolves. SITES.md §0.5. */
const broken = WITNESS.install_targets.rows.filter((r) => r.http !== 200);
for (const r of broken) {
    const os = r.target.startsWith("darwin") ? /\bmacOS\b/i : null;
    if (os) T(`the page does not advertise ${r.target}`, !os.test(TEXT_OUTSIDE) || /fail/i.test(TEXT));
}
T("the page states how many targets actually install",
  new RegExp(`${WITNESS.facts.install_targets_ok.value}\\s*of\\s*${WITNESS.facts.install_targets_total.value}`).test(TEXT));

/* ---------- 12. §8 — the identifying animation ---------- */
T("the landing page carries a data-identity-animation element", /data-identity-animation/.test(HTML));
T("the animation is above the fold, before any section boundary",
  HTML.indexOf("data-identity-animation") < HTML.indexOf('<section id="install"'));
/* These two test the GUARD, not the presence of a string. The first draft
   tested `/document\.hidden/.test(ANIM)` and a deliberate break sailed through
   it, because the identifier also appears in the visibilitychange listener —
   so removing the guard from the render loop left the check satisfied. A
   substring is not a behaviour. */
const FLAT = ANIM.replace(/\s+/g, " ");
T("prefers-reduced-motion draws one frame and returns",
  /prefers-reduced-motion: reduce/.test(ANIM) && /if \(still\) \{ draw\([^)]*\); return; \}/.test(FLAT));
T("the render loop returns early when the tab is hidden",
  /if \(document\.hidden[^)]*\) \{[^}]*return; \}/.test(FLAT));
T("something resumes it when the tab comes back",
  /visibilitychange/.test(ANIM));
T("IntersectionObserver is not the only trigger",
  !/IntersectionObserver/.test(ANIM) || /tick\(performance\.now\(\)\)\s*;?\s*\}\)\(\)/.test(ANIM.replace(/\s+/g, " ")) || ANIM.trimEnd().includes("tick(performance.now());"));
/* It must not be able to write into the page. A closed decoration with no wire
   back into the DOM is the cheapest way to guarantee rule 2 of §8.1. */
for (const wire of ["textContent", "innerHTML", "innerText", "dataset", "dispatchEvent", "setAttribute"]) {
    T(`the animation never writes ${wire} into the document`, !ANIM.includes(wire));
}

/* §8.5, the 12-Active-Pathfinders check, mechanised. gpscoord published a
   canvas loop bound as a live user metric for months. Every integer of 4 or
   more in the animation source is compared against every standalone number in
   the page's visible text; a collision is refused, and the fix is to change
   the ANIMATION, never the page.
   Limit of this check, stated rather than implied: it cannot catch a
   coincidence below 4, and it cannot catch a figure the animation computes
   rather than declares. It catches the class of defect that actually shipped. */
const animInts = [...new Set([...ANIM.matchAll(/(?<![\w.#])(\d+)(?![\w.])/g)].map((m) => +m[1]).filter((n) => n >= 4))];
const textNums = new Set([...TEXT.matchAll(/(?<![\w.-])(\d[\d,]*)(?![\w.-])/g)].map((m) => m[1].replace(/,/g, "")));
const leaked = animInts.filter((n) => textNums.has(String(n)));
T("no constant in the animation appears as a number on the page",
  leaked.length === 0, leaked.length ? `LEAKED: ${leaked.join(", ")}` : `${animInts.length} constants, none on the page`);
const recordNums = new Set(Object.values(WITNESS.facts).map((f) => String(f.value)).filter((v) => /^\d+$/.test(v)));
T("no constant in the animation appears in a frozen record",
  !animInts.some((n) => recordNums.has(String(n))));

/* ---------- 13. density (SHELL.md §5) ---------- */
const KB = (n) => (n / 1024).toFixed(1) + " KB";
T("the artifact is smaller than the page it replaces",
  HTML.length < WITNESS.routes.rows[0].bytes, `${KB(HTML.length)} vs ${KB(WITNESS.routes.rows[0].bytes)}`);
const STYLEBODY = (/<style[^>]*>([\s\S]*?)<\/style>/i.exec(HTML) || [, ""])[1];
T("the emitted CSS carries no comments or indentation",
  STYLEBODY.length > 1000 && !STYLEBODY.includes("/*") && !/\n\s\s/.test(STYLEBODY),
  `${(STYLEBODY.length / 1024).toFixed(1)} KB, ${(STYLEBODY.match(/\n/g) || []).length} newlines`);
T("no inline style= in the artifact", !/\sstyle="/.test(HTML),
  (HTML.match(/\sstyle="[^"]*"/g) || []).slice(0, 2).join(" "));
T("no inline event handlers in the artifact", !/\son(click|mouseover|mouseout|load)=/i.test(HTML));
T("the content does not depend on JavaScript",
  !/<script(?![^>]*\bsrc=)/.test(HTML), "no inline script; only deferred external files");

/* ---------- 14. contrast: no text token below 4.5:1 on its own surface ----------
   --fg3 shipped at .34 across the portfolio, which is 2.78:1 on the band — a
   WCAG failure on the two elements whose whole job is to keep a page honest.
   It is a dozen lines of colour maths and it makes that class of defect
   unshippable rather than reported. SHELL.md §0. */
const css = [...HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
const tok = (n) => new RegExp(`--${n}:\\s*([^;}]+)`).exec(css)?.[1].trim();
function parse(c) {
    let m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
    m = /^rgba?\(([^)]+)\)$/i.exec(c);
    if (m) {
        const p = m[1].split(",").map((x) => parseFloat(x));
        return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    return null;
}
const lin = (v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : Math.pow((v / 255 + 0.055) / 1.055, 2.4));
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
function ratio(fgC, bgC) {
    const fg = parse(fgC), bg = parse(bgC);
    if (!fg || !bg) return null;
    const a = lum(over(fg, bg)) + 0.05, b = lum(bg) + 0.05;
    return (Math.max(a, b) / Math.min(a, b));
}
for (const surfaceTok of ["ink", "ink2", "ink3"]) {
    for (const textTok of ["fg", "fg2", "fg3", "acc", "data", "warn"]) {
        const r = ratio(tok(textTok), tok(surfaceTok));
        T(`--${textTok} on --${surfaceTok} clears 4.5:1`, r !== null && r >= 4.5, r ? r.toFixed(2) + ":1" : "unparsed");
    }
}
/* At 11px the AA floor is legible in a screenshot and not on a laptop, so the
   load-bearing 11px spans take --fg2 rather than --fg3. */
T(".covers is not painted with --fg3 at 11px", /\.band \.covers\{color:var\(--fg2\)/.test(css));

/* ---------- 15. every interactive element can be seen to be interactive ----------
   .logo had no :hover rule at all on the reference surface, so hovering the
   top-left changed nothing and there was no way to tell it was a link.
   Limit: this matches an element's FIRST class, or its tag name when it has
   none, against the selector text of every :hover rule in the artifact. It
   cannot prove a bare <a> deep inside a container is covered by that
   container's rule — that is confirmed in a browser instead. */
const hoverSel = [...css.matchAll(/([^{}]*?):hover/g)].map((m) => m[1]).join(" , ");
const handles = new Set();
for (const el of HTML.matchAll(/<(a|button)\b([^>]*)>/gi)) {
    const cls = /class="([^"]*)"/.exec(el[2]);
    handles.add(cls ? "." + cls[1].trim().split(/\s+/)[0] : el[1].toLowerCase());
}
const naked = [...handles].filter((h) =>
    h.startsWith(".")
        ? !new RegExp(`\\${h}(?![\\w-])`).test(hoverSel)
        : !new RegExp(`(^|[\\s>+~,(])${h}(?=[\\s.:>+~,)]|$)`, "m").test(hoverSel));
T("every interactive element has a visible :hover", naked.length === 0,
  naked.length ? `no hover for: ${naked.join(", ")}` : `${handles.size} kinds, all covered`);
T("the artifact declares a focus-visible ring", /:focus-visible\s*\{/.test(css));

/* ---------- 16. the portfolio nav mount survives ----------
   graphonomous.com is a sync-nav.sh target (line 33) and amp-nav.js is lane
   N's file. This surface may not quietly drop the mount point. */
T("the amp-nav mount point is intact", /<amp-nav property="graphonomous">/.test(HTML));
T("amp-nav.js is loaded, and not edited from here", /src="\/amp-nav\.js"/.test(HTML));

console.log(`\n${pass} passed, ${fail} failed (publication gate)`);
if (fail) process.exit(1);
