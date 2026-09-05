/* ==========================================================================
   graphonomous.com — re-derive the record from the world.

       node check.mjs            re-derives everything reachable
       node check.mjs --offline  accepted for the deploy script; nothing here needs the network

   records/witness.json is a claim about a codebase and an encoder that live
   somewhere else. This file goes and looks, with derive.mjs — the SAME module
   measure.mjs wrote the record with — and exits non-zero on disagreement.
   The direction of dependency is the point (SHELL.md §4.1): the record is
   what the page is CHECKED AGAINST, never the thing that decides what is true.

   What it deliberately does not do: run the test suite. That takes a minute
   and the pinned registries; those three figures carry their raw verdict
   line and are printed below as "trust" rather than pretended. A check that
   quietly skips is worse than a check that reports it skipped.
   ========================================================================== */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { deriveLane, deriveWrl } from "./derive.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const witness = JSON.parse(readFileSync(path.join(HERE, "records/witness.json"), "utf8"));
const ENGINE = path.resolve(HERE, witness.engine_path);
const WRL = path.resolve(HERE, witness.wrl_path);

let pass = 0;
const fail = [];
const skip = [];
function T(name, got, want) {
    if (JSON.stringify(got) === JSON.stringify(want)) { pass++; console.log(`  ok    ${name}  = ${typeof want === "string" ? want : "(equal)"}`); }
    else { fail.push(`${name}: derived ${JSON.stringify(got).slice(0, 160)} != record ${JSON.stringify(want).slice(0, 160)}`); console.log(`  FAIL  ${name}`); }
}
const S = (name, why) => { skip.push(`${name} — ${why}`); console.log(`  skip  ${name}  (${why})`); };
const F = (id) => witness.facts[id].value;

/* ---------- 1. the lane ---------- */
console.log(`lane: ${ENGINE}/v2`);
const lane = deriveLane(ENGINE);
if (!lane) {
    S("worlds_sealed / pinned_sources / adapters / nodes / relations / faults / findings / super_pin / worlds / faults table / sources", `no lane at ${ENGINE}/v2`);
} else {
    for (const [id, v] of Object.entries(lane.facts)) T(id, v, F(id));
    T("worlds table", lane.worlds, witness.worlds.rows);
    T("faults table", lane.faults, witness.faults.rows);
    T("sources table", lane.sources, witness.sources.rows);
    T("the lane commit the record names", lane.engine_commit, witness.engine_commit);
}

/* ---------- 2. WRL: the profile table, and the six refusals run again ---------- */
console.log(`wrl:  ${WRL}`);
const wrl = await deriveWrl(WRL);
if (!wrl) {
    S("profile_rows / static_rows / roles / kinds / pairs / refusals", `no WRL checkout at ${WRL}`);
} else {
    for (const [id, v] of Object.entries(wrl.facts)) T(id, v, F(id));
    T("refusals, code and message", wrl.refusals, witness.refusals.rows);
    T("the two-object world's sem", wrl.sem, witness.refusals.world_sem);
    T("the WRL commit the record names", wrl.wrl_commit, witness.wrl_commit);
}

/* ---------- 3. what is being taken on trust, said out loud ---------- */
for (const [id, fact] of Object.entries(witness.facts)) {
    if (fact.derivable === null) console.log(`  trust ${id} = ${fact.value}  <- ${fact.command}`);
}

console.log(`\n${pass} re-derived, ${fail.length} disagreed, ${skip.length} skipped`);
if (skip.length) skip.forEach((s) => console.log(`  skipped: ${s}`));
if (fail.length) { fail.forEach((f) => console.error(`  DISAGREEMENT: ${f}`)); process.exit(1); }
