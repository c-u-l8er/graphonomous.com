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
import path from "path";
import { fileURLToPath } from "url";
import { ARTIFACTS, artifactHashes, buildId, inputHashes, readStamp } from "./stamp.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const ANIM = readFileSync(new URL("./memory.js", import.meta.url), "utf8");
const SAYJS = readFileSync(new URL("./contact.js", import.meta.url), "utf8");
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
/* VISIBLE TEXT, AND THE ORDER OF THESE THREE PASSES IS THE POINT (SHELL.md
   r8). `<[^>]+>` stops at the first `>`, so an HTML comment CONTAINING a `>`
   is only half removed and its tail survives as "page text" — which would
   feed the §8 constant check a number nobody published and refuse a good
   build, or hide one that was. Comments come out FIRST, as their own pass,
   then script and style bodies, then tags. Measured on this artifact before
   the fix: one comment, no `>` inside it, and the extracted number set is
   byte-identical under all three orderings — so nothing here was wrong yet.
   It was one comment away from being wrong, and three checks read this. */
function visibleText(html) {
    return decode(
        html
            .replace(/<!--[\s\S]*?-->/g, " ")
            .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
    ).replace(/\s+/g, " ");
}
const TEXT = visibleText(HTML);

/* Text outside the retraction paragraph, and text inside it. Naming a wrong
   value is what a retraction IS, so the one place a retracted string may
   appear is inside it — ONCE. Both halves are needed: see check 9. The strip
   is global, so a second retraction block cannot be used as a hiding place. */
const RETRACT_RE = /<div class="retract" data-retraction>[\s\S]*?<\/div>/g;
const RETRACT_BLOCKS = HTML.match(RETRACT_RE) || [];
const TEXT_INSIDE = visibleText(RETRACT_BLOCKS.join(" "));
const TEXT_OUTSIDE = visibleText(HTML.replace(RETRACT_RE, " "));
/* Everything else in the artifact that is NOT visible text — markup,
   attribute values, comments, the inline stylesheet. A retracted claim parked
   in a comment is still on the page a maintainer reads, and a visible-text
   check cannot see it. SHELL.md r8. */
const RAW_OUTSIDE = decode(HTML.replace(RETRACT_RE, " "));

/* Counting, not detecting. r6 hole 1 in one function. */
function occurrences(haystack, needle) {
    let n = 0;
    let i = 0;
    while ((i = haystack.indexOf(needle, i)) !== -1) {
        n++;
        i += needle.length;
    }
    return n;
}

/* The body of the first balanced {...} after a header match, so a guard can be
   checked by its SHAPE rather than by a substring. Break 29 of the first
   prove-gate run passed because `document.hidden` also appears in the
   visibilitychange listener: deleting the guard from the render loop left a
   substring test satisfied. A substring is not a behaviour. */
function braceBody(src, from) {
    const open = src.indexOf("{", from);
    if (open < 0) return null;
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}" && --depth === 0) return { body: src.slice(open + 1, i), end: i };
    }
    return null;
}
function blockAfter(src, re) {
    const m = re.exec(src);
    return m ? braceBody(src, m.index + m[0].length) : null;
}

console.log("publication gate — graphonomous.com\n");

/* ---------- 0. the artifact came from THIS build ----------
   SHELL.md r6, hole 2. Every gate below reads the artifact, which is right,
   and until this check existed none of them could tell yesterday's artifact
   from today's: a build that threw left the previous index.html on disk and
   the gate approved it. stamp.mjs explains what is and is not proven. */
const STAMP = readStamp(DIR);
T("the build left a stamp", !!STAMP && !!STAMP.inputs && !!STAMP.artifacts, STAMP ? STAMP.build_id : "no build-stamp.json");
if (STAMP && STAMP.inputs && STAMP.artifacts) {
    const now = inputHashes(DIR);
    const drifted = Object.keys({ ...now, ...STAMP.inputs }).filter((f) => now[f] !== STAMP.inputs[f]);
    T("every source the artifact was generated from is unchanged since that build",
      drifted.length === 0,
      drifted.length ? `CHANGED WITHOUT A REBUILD: ${drifted.join(", ")}` : `${Object.keys(now).length} sources`);
    const disk = artifactHashes(DIR);
    const edited = ARTIFACTS.filter((f) => disk[f] !== STAMP.artifacts[f]);
    T("each artifact still hashes to the string the build emitted",
      edited.length === 0, edited.length ? `EDITED AFTER THE BUILD: ${edited.join(", ")}` : ARTIFACTS.join(", "));
    T("the artifact itself carries that build id", HTML.includes(`BUILD ${STAMP.build_id}`), STAMP.build_id);
    T("the build id is derived from those same sources", buildId(STAMP.inputs) === STAMP.build_id);
}

/* ---------- 1. release identity ---------- */
T("release identity: package == record", PKG.version === SURFACE.version, `${PKG.version} / ${SURFACE.version}`);
T("the stamp on the artifact names the release", HTML.includes(`v${SURFACE.version}`));
T("the artifact records which shell revision it was built against",
  HTML.includes(SURFACE.shell_revision) && SURFACE.shell_revision === "shell-r9", SURFACE.shell_revision);

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
/* Tier is read from amp-nav, not chosen, and there are THREE variants of this
   sentence rather than two (SHELL.md r6): place 1-2 take the layer sentence,
   place 3 is "a specification in the X world", place 4 is attribution and must
   NOT say layer. gpscoord shipped the wrong one of these for months. Refusing
   in one direction is only half of it — a tier-2 band that quietly DROPS its
   layer word is the same defect inverted, so each arm asserts what must be
   present AND what must be absent. */
const BANDTEXT = band ? decode(band[0].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ") : "";
const BAND_CLAIM = {
    1: () => BANDTEXT.includes(`is the ${SURFACE.layer} layer of ${SURFACE.parent}`),
    2: () => BANDTEXT.includes(`is the ${SURFACE.layer} layer of ${SURFACE.parent}`),
    3: () => BANDTEXT.includes(`is a specification in the ${SURFACE.parent} world`) && !/\blayer of\b/.test(BANDTEXT),
    4: () => BANDTEXT.includes(`A ${SURFACE.parent} project`) && !/\blayer of\b/.test(BANDTEXT),
};
T("the band's claim matches the tier in the record",
  (BAND_CLAIM[SURFACE.tier] || (() => false))(), `tier ${SURFACE.tier}`);

/* ---------- 5. the correction channel is real, and it is not a mailbox ----------
   SHELL.md r9. Travis ruled the Formspree endpoint on 2026-08-17, which closed
   the [TRAVIS] flag this surface filed for having no endpoint of its own. The
   shape matters as much as the URL: a real <form> with an action posts with
   scripting off, a fetch bolted to a button does not, and this page's whole
   content is checked to survive script removal. */
T("no page advertises a mailto:", !/mailto:/i.test(HTML));
T("no bare email address in the text", !/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(TEXT));
T("there is a live correction channel instead",
  HTML.includes(SURFACE.contact.url), SURFACE.contact.url);
const FORM = /<form\b[^>]*class="say"[^>]*>[\s\S]*?<\/form>/.exec(HTML);
T("the correction form is on the artifact", !!FORM);
const formTag = FORM ? /<form\b[^>]*>/.exec(FORM[0])[0] : "";
T("the form posts to the endpoint the record declares",
  new RegExp(`action="${SURFACE.contact.endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(formTag),
  SURFACE.contact.endpoint);
T("the form is a real POST, not a fetch bolted to a button",
  /method="POST"/i.test(formTag) && !!FORM && /<button[^>]*type="submit"/.test(FORM[0]));
T("the form carries the _gotcha honeypot", !!FORM && /name="_gotcha"/.test(FORM[0]));
T("the reply paragraph is a polite live region",
  !!FORM && /<p class="say-msg" role="status" aria-live="polite">/.test(FORM[0]));
/* Success on a 2xx, or the form is lying. Checked by SHAPE — the success
   branch has to be inside a block guarded by the response's own ok flag. */
const okBlk = blockAfter(SAYJS, /\bif \(r\.ok\)\s*/);
T("the inline reply prints success only inside a response-ok guard",
  !!okBlk && /\bsay\("Sent/.test(okBlk.body) && !/\bsay\("Sent/.test(SAYJS.replace(okBlk.body, " ")));

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
/* SHELL.md r5.2 — the record names WHICH gate witnesses the rung it claims.
   "Any pending gate blocks live_deployed" is too blunt: independent_use is
   pending forever by construction, so under that rule no surface could ever
   advance and the rule would simply be ignored. The named witness has to be
   real, approved, and published on the page. */
const witnessGate = SURFACE.gates[SURFACE.rung_witness];
T("the record names the gate that witnesses its rung", !!witnessGate && !SURFACE.rung_witness.startsWith("_"), SURFACE.rung_witness);
T(`the witnessing gate "${SURFACE.rung_witness}" is approved, with evidence, reviewer and date`,
  !!witnessGate && witnessGate.status === "approved" && !!(witnessGate.evidence && witnessGate.reviewer && witnessGate.date));
T("the witnessing gate is published on the artifact, not just in the record",
  !!witnessGate && decode(HTML).includes(witnessGate.label));

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

/* ---------- 9. claims that were retracted may not come back ----------
   SHELL.md r6, hole 1, inherited from the GPSCoord reference. The first
   version of this check asked "does the retraction still name it?" and
   stopped, which let a page keep its retraction AND re-assert the retracted
   sentence somewhere else — the quotation was doing double duty as an alibi.
   So: COUNT the occurrences and bound them in both directions. Outside the
   retraction, zero. Inside it, at least one (or the retraction does not name
   what it retracts) and at most `max_occurrences`, default 1 — a second
   occurrence inside the retraction is a re-assertion wearing its own
   retraction as cover. */
T("the retraction paragraph is on the artifact", RETRACT_BLOCKS.length === 1, `${RETRACT_BLOCKS.length} blocks`);
for (const r of SURFACE.retracted) {
    const min = Number.isInteger(r.min_occurrences) ? r.min_occurrences : 1;
    const max = Number.isInteger(r.max_occurrences) ? r.max_occurrences : 1;
    const outside = occurrences(TEXT_OUTSIDE, r.string);
    const inside = occurrences(TEXT_INSIDE, r.string);
    const hidden = occurrences(RAW_OUTSIDE, r.string);
    T(`retracted "${r.string}" appears nowhere outside its retraction`, outside === 0, `${outside} occurrences`);
    T(`retracted "${r.string}" is quoted between ${min} and ${max} times inside it`,
      inside >= min && inside <= max, `${inside}`);
    /* SHELL.md r8: a comment or an attribute is not a hiding place. */
    T(`retracted "${r.string}" is not hidden in markup, a comment or an attribute`,
      hidden === 0, `${hidden} occurrences outside visible text`);
}

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
/* THE GUARDS ARE CHECKED BY SHAPE, NOT BY SUBSTRING. The first draft of the
   hidden-tab check was `/document\.hidden/.test(ANIM)`, and a deliberate break
   sailed straight through it: the identifier also appears in the
   visibilitychange listener, so deleting the guard from the render loop left
   the check satisfied. Below, the guard has to BE the first statement of the
   render loop, it has to return, and the scheduling call has to come after it.
   Nothing about that survives deleting the statement. */
const stillBlk = blockAfter(ANIM, /\bif \(still\)\s*/);
T("the animation reads prefers-reduced-motion",
  /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/.test(ANIM));
T("under reduced motion it paints one frame and returns, scheduling nothing",
  !!stillBlk && /\bdraw\(/.test(stillBlk.body) && /\breturn;/.test(stillBlk.body) &&
      !/requestAnimationFrame/.test(stillBlk.body));

const frameBlk = blockAfter(ANIM, /\bfunction frame\(\w+\)\s*/);
T("the render loop is a function the gate can find", !!frameBlk);
const hiddenGuard = frameBlk ? blockAfter(frameBlk.body, /^\s*if \([^)]*document\.hidden[^)]*\)\s*/) : null;
T("the render loop's FIRST statement is a document.hidden guard that returns",
  !!hiddenGuard && /\breturn;/.test(hiddenGuard.body));
T("nothing is scheduled before that guard has run",
  !!hiddenGuard && frameBlk.body.indexOf("requestAnimationFrame") > hiddenGuard.end);

const visBlk = blockAfter(ANIM, /addEventListener\("visibilitychange",\s*function \(\)\s*/);
T("something resumes the loop when the tab comes back", !!visBlk && /\btick\(/.test(visBlk.body));
T("IntersectionObserver may pause the loop but never starts it",
  !/IntersectionObserver/.test(ANIM) || /\btick\(performance\.now\(\)\);\s*\}\)\(\);?$/.test(ANIM.trimEnd()));

/* It must not be able to write into the page. A closed decoration with no wire
   back into the DOM is the cheapest way to guarantee rule 2 of §8.1. The
   append/insertBefore pair is here because this animation now builds two
   gradient sprites on detached canvases, and "detached" is a claim the gate
   should be holding rather than the comment. */
for (const wire of ["textContent", "innerHTML", "innerText", "dataset", "dispatchEvent", "setAttribute", "append", "insertBefore", "document.write"]) {
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
/* And prove it rather than infer it: strip every script tag and the visible
   text must be identical, character for character. r9 made this load-bearing —
   the correction form has to submit with scripting off. */
const TEXT_NOJS = visibleText(HTML.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<script[^>]*>/gi, " "));
T("the page's visible text is unchanged with every script tag removed",
  TEXT_NOJS === TEXT, `${TEXT.length} chars either way`);

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
/* r9: off-screen rather than display:none — some bots skip anything a
   stylesheet has explicitly hidden, which defeats the honeypot. */
T("the _gotcha honeypot is moved off-screen, not display:none",
  /\.say input\[name=_gotcha\]\{position:absolute;left:-9999px/.test(css) && !/\[name=_gotcha\]\{[^}]*display:none/.test(css));

/* ---------- 14b. the colour an element PAINTS, not the one it declares ----------
   SHELL.md r7 and r8, and the reason this defect survived 44 deliberate
   breaks: check 14 above compares DECLARED TOKENS against DECLARED SURFACES —
   all 18 pairs clear 4.5:1 — and says nothing about which declaration wins on
   a real element. `.top nav a` is 0,2,1 and `.btn` is 0,1,0, so an unscoped
   nav rule takes the header CTA's colour away from it and the button paints
   --fg2 on --acc at 1.70:1, while the identical button in the hero paints
   #2a0413 at 6.46:1. Every token was fine. Every pair was fine. The button was
   unreadable, on nine surfaces.

   So: build the element tree, parse the emitted stylesheet, and resolve
   `color` and `background` the way a browser would — !important, then
   specificity, then source order, then inheritance — at every breakpoint the
   stylesheet itself declares and in both the resting and the hover state. A
   translucent background is composited down to the first opaque one beneath
   it, because a ratio taken against rgba() is not a ratio.

   LIMITS, stated rather than implied. Conditions other than min/max-width are
   not modelled and a block carrying one is skipped, so the reduced-motion
   block is not evaluated (it declares no colour). Sibling combinators are not
   implemented and a rule using one is skipped rather than guessed at.
   `filter`, `opacity` and `mix-blend-mode` are not applied, so `.btn:hover`'s
   brightness(1.1) is not modelled — it lightens the background, which can only
   help here, but it is not proven to. Pseudo-elements never match. It is a
   model of a browser, not a browser, and every verdict below was cross-checked
   against getComputedStyle in Chrome. */
const VOIDTAG = new Set(["meta", "link", "br", "hr", "img", "input", "source", "col", "area", "base", "embed", "param", "track", "wbr"]);
function elementTree(html) {
    const body = html.slice(html.indexOf("<body")).replace(/<!--[\s\S]*?-->/g, " ");
    const stack = [];
    const out = [];
    for (const m of body.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g)) {
        const tag = m[2].toLowerCase();
        if (m[1]) {
            for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
            continue;
        }
        const at = {};
        for (const a of m[3].matchAll(/([\w-]+)="([^"]*)"/g)) at[a[1]] = a[2];
        const node = { tag, cls: (at.class || "").trim().split(/\s+/).filter(Boolean), at, chain: null };
        node.chain = [...stack, node];
        out.push(node);
        if (!VOIDTAG.has(tag) && !m[3].trim().endsWith("/")) stack.push(node);
    }
    return out;
}
/* @media blocks are DESCENDED INTO rather than skipped, and source order is
   kept across the boundary, because a media rule later in the file beats an
   equally specific one before it. */
function cssRules(src, media, out, counter) {
    let i = 0;
    while (i < src.length) {
        const brace = src.indexOf("{", i);
        if (brace < 0) break;
        const head = src.slice(i, brace).trim();
        if (head.startsWith("@")) {
            let depth = 0;
            let j = brace;
            for (; j < src.length; j++) {
                if (src[j] === "{") depth++;
                else if (src[j] === "}" && --depth === 0) break;
            }
            if (/^@media/i.test(head)) cssRules(src.slice(brace + 1, j), head.replace(/^@media\s*/i, ""), out, counter);
            i = j + 1;
            continue;
        }
        const end = src.indexOf("}", brace);
        const decl = src.slice(brace + 1, end);
        for (const sel of head.split(",")) if (sel.trim()) out.push({ sel: sel.trim(), decl, media, order: counter.n++ });
        i = end + 1;
    }
    return out;
}
function mediaApplies(cond, w) {
    const parts = cond.match(/\([^)]*\)/g) || [];
    if (!parts.length) return false;
    for (const p of parts) {
        const m = /\(\s*(min|max)-width\s*:\s*(\d+)px\s*\)/.exec(p);
        if (!m) return false;
        if (m[1] === "min" ? w < +m[2] : w > +m[2]) return false;
    }
    return true;
}
function specificity(sel) {
    const b = (sel.match(/\.[\w-]+/g) || []).length +
        (sel.match(/\[[^\]]*\]/g) || []).length +
        (sel.match(/:(?!:)[\w-]+/g) || []).filter((x) => x !== ":not").length;
    const c = (sel.replace(/\.[\w-]+|\[[^\]]*\]|::?[\w-]+(\([^)]*\))?/g, " ").match(/[a-zA-Z][\w-]*/g) || []).length;
    return b * 1000 + c;
}
const STATEFUL = new Set(["hover", "focus", "focus-visible", "active"]);
function matchCompound(node, comp, state) {
    const nots = [...comp.matchAll(/:not\(([^)]*)\)/g)].map((m) => m[1]);
    const rest = comp.replace(/:not\([^)]*\)/g, "");
    if (/::/.test(rest)) return false;
    for (const p of (rest.match(/:[\w-]+/g) || []).map((x) => x.slice(1))) {
        if (!STATEFUL.has(p)) return false;
        if (!state) return false;
    }
    const bare = rest.replace(/:[\w-]+/g, "");
    const tag = (/^([a-zA-Z][\w-]*)/.exec(bare) || [, ""])[1].toLowerCase();
    if (tag && tag !== "*" && node.tag !== tag) return false;
    for (const c of bare.match(/\.[\w-]+/g) || []) if (!node.cls.includes(c.slice(1))) return false;
    for (const a of bare.match(/\[[^\]]*\]/g) || []) {
        const [k, v] = a.slice(1, -1).split("=");
        if (!(k in node.at)) return false;
        if (v !== undefined && node.at[k] !== v.replace(/^["']|["']$/g, "")) return false;
    }
    for (const n of nots) if (matchCompound(node, n, state)) return false;
    return true;
}
/* State applies to the SUBJECT compound only: `.top nav a:hover` means the
   link is hovered, not the nav. */
function selMatches(node, sel, state) {
    if (/[+~]/.test(sel)) return false;
    const parts = sel.replace(/\s*>\s*/g, " > ").trim().split(/\s+/);
    const chain = node.chain.slice();
    let i = parts.length - 1;
    if (!matchCompound(chain.pop(), parts[i--], state)) return false;
    while (i >= 0) {
        if (parts[i] === ">") {
            i--;
            const parent = chain.pop();
            if (!parent || !matchCompound(parent, parts[i], false)) return false;
            i--;
        } else {
            let ok = false;
            while (chain.length) if (matchCompound(chain.pop(), parts[i], false)) { ok = true; break; }
            if (!ok) return false;
            i--;
        }
    }
    return true;
}
const RULES = cssRules(css, null, [], { n: 0 });
/* Every breakpoint the stylesheet itself declares, and one pixel either side
   of it, so the check is derived from the CSS rather than from a guess about
   which widths matter. */
const WIDTHS = [...new Set([390, 1280, ...[...css.matchAll(/\(\s*(?:min|max)-width\s*:\s*(\d+)px\s*\)/g)]
    .flatMap((m) => [+m[1] - 1, +m[1], +m[1] + 1])])].sort((a, b) => a - b);
function declOf(decl, prop) {
    const re = prop === "color"
        ? /(?:^|;)\s*color\s*:\s*([^;]+)/i
        : /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i;
    const m = re.exec(decl);
    if (!m) return null;
    let v = m[1].trim();
    const important = /!important$/i.test(v);
    return { value: important ? v.replace(/!important$/i, "").trim() : v, important };
}
const rank = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
function winner(node, prop, w, state) {
    let best = null;
    for (const r of RULES) {
        if (r.media !== null && !mediaApplies(r.media, w)) continue;
        const d = declOf(r.decl, prop);
        if (!d || !selMatches(node, r.sel, state)) continue;
        const key = [d.important ? 1 : 0, specificity(r.sel), r.order];
        if (!best || rank(key, best.key) > 0) best = { key, ...d, sel: r.sel };
    }
    return best;
}
const resolveVar = (v) => (v && v.startsWith("var(") ? tok(v.slice(6, v.indexOf(")"))) : v);
function computedColour(node, w, state) {
    const last = node.chain.length - 1;
    for (let i = last; i >= 0; i--) {
        const c = winner(node.chain[i], "color", w, state && i === last);
        if (c) return { raw: resolveVar(c.value), sel: c.sel };
    }
    return { raw: tok("fg"), sel: "(initial)" };
}
function computedBackground(node, w, state) {
    const last = node.chain.length - 1;
    const layers = [];
    for (let i = last; i >= 0; i--) {
        const b = winner(node.chain[i], "background", w, state && i === last);
        if (!b) continue;
        const v = resolveVar(b.value);
        const p = v && v !== "transparent" && v !== "none" ? parse(v) : null;
        if (!p || p[3] <= 0) continue;
        layers.push({ p, sel: b.sel });
        if (p[3] >= 0.999) break;
    }
    const base = parse(tok("ink"));
    if (!layers.length || layers[layers.length - 1].p[3] < 0.999) layers.push({ p: base, sel: "(body)" });
    let acc = layers[layers.length - 1].p.slice(0, 3);
    for (let i = layers.length - 2; i >= 0; i--) {
        const q = layers[i].p;
        acc = [0, 1, 2].map((k) => q[k] * q[3] + acc[k] * (1 - q[3]));
    }
    return { rgb: acc, sel: layers[0].sel };
}
function ratioOn(fgC, bgRGB) {
    const fg = parse(fgC);
    if (!fg) return null;
    const a = lum([0, 1, 2].map((i) => fg[i] * fg[3] + bgRGB[i] * (1 - fg[3]))) + 0.05;
    const b = lum(bgRGB) + 0.05;
    return Math.max(a, b) / Math.min(a, b);
}

const controls = elementTree(HTML).filter((n) => n.tag === "a" || n.tag === "button");
T("the artifact has controls to resolve", controls.length > 0, `${controls.length} a/button elements`);
T("the check runs at every breakpoint the stylesheet declares, resting and hovered",
  WIDTHS.length >= 4, `${WIDTHS.length} widths x 2 states x ${controls.length} controls = ${WIDTHS.length * 2 * controls.length} resolutions`);
let worst = { r: 99, where: "" };
const btnLost = [];
for (const n of controls) {
    const isBtn = n.cls.includes("btn");
    for (const w of WIDTHS) {
        for (const state of [false, true]) {
            const fgC = computedColour(n, w, state);
            const bgC = computedBackground(n, w, state);
            const r = ratioOn(fgC.raw, bgC.rgb);
            if (r !== null && r < worst.r) {
                worst = { r, where: `${n.tag}.${n.cls.join(".")} at ${w}px${state ? " hovered" : ""} — ${fgC.sel} (${fgC.raw}) on ${bgC.sel}` };
            }
            if (isBtn && !/\.btn\b/.test(fgC.sel)) {
                btnLost.push(`${w}px${state ? " hovered" : ""}: ${fgC.sel} = ${fgC.raw}`);
            }
        }
    }
}
T("every control's COMPUTED colour clears 4.5:1 on its computed background",
  worst.r >= 4.5, `worst ${worst.r.toFixed(2)}:1 — ${worst.where}`);
/* The specific defect, named: a .btn whose colour is decided by a rule that is
   not a .btn rule has lost it to something more specific, wherever it sits. */
const btns = controls.filter((n) => n.cls.includes("btn"));
T("the page has .btn controls to check", btns.length > 0, `${btns.length} buttons`);
T("no .btn anywhere has its colour decided by a non-button rule",
  btnLost.length === 0, btnLost.length ? `LOST: ${[...new Set(btnLost)].slice(0, 3).join(" | ")}` : "at every width, both states");

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

/* ---------- 15b. the header stacks BEFORE the nav wraps (SHELL.md r6) ----------
   r5 published `@media (max-width:430px)`, measured on a four-item nav. With
   this nav — a logo and five items — the row layout needs 538px, so 430 would
   have left the logo marooned beside the tail of a wrapped nav for a hundred
   pixels. The VALUE is the surface's own and is measured; what the shell fixes
   is the RULE. So the record carries the number and the gate checks the
   stylesheet still implements it. */
T("the record names this surface's own nav breakpoint", Number.isInteger(SURFACE.nav_breakpoint_px), `${SURFACE.nav_breakpoint_px}px`);
T("the stylesheet stacks .top at exactly that breakpoint",
  new RegExp(`@media\\(max-width:${SURFACE.nav_breakpoint_px}px\\)\\{\\.top\\{flex-direction:column`).test(css));

/* ---------- 15c. §N citations resolve (SHELL.md r5.3) ----------
   Cheap, and it catches a citation that drifted when a spec was rewritten.
   Markdown headings inside fenced code blocks are not headings, so the fences
   come out first — otherwise `# 3 lines to join a cluster` reads as §3. */
const cites = [...new Set([...TEXT.matchAll(/§\s?(\d+(?:\.\d+)*)/g)].map((m) => m[1]))];
const citedSpecs = SURFACE.cited_specs || {};
if (!cites.length) {
    T("every §N in the page's visible text resolves to a real heading", true, "0 citations on this page");
}
for (const c of cites) {
    const spec = citedSpecs[c.split(".")[0]] || citedSpecs["*"];
    if (!spec) {
        T(`§${c} names the spec it cites`, false, "records/surface.json.cited_specs has no entry for it");
        continue;
    }
    let body = "";
    try {
        body = readFileSync(new URL(spec, import.meta.url), "utf8");
    } catch {
        /* left empty on purpose: an unreadable spec is a failed citation */
    }
    const heads = body.replace(/```[\s\S]*?```/g, " ").match(/^#{1,6}\s+.*$/gm) || [];
    const want = new RegExp(`^#{1,6}\\s+${c.replace(/\./g, "\\.")}(?![\\d.])`);
    T(`§${c} resolves to a real heading in ${spec}`, heads.some((h) => want.test(h)));
}

/* ---------- 16. the portfolio nav mount survives ----------
   graphonomous.com is a sync-nav.sh target (line 33) and amp-nav.js is lane
   N's file. This surface may not quietly drop the mount point. */
T("the amp-nav mount point is intact", /<amp-nav property="graphonomous">/.test(HTML));
T("amp-nav.js is loaded, and not edited from here", /src="\/amp-nav\.js"/.test(HTML));

console.log(`\n${pass} passed, ${fail} failed (publication gate)`);
if (fail) process.exit(1);
