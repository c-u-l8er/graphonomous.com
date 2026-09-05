#!/usr/bin/env node
/* measure.mjs — re-measure the record from the world and WRITE it.

   The one place a figure enters records/witness.json. Nothing is typed: every
   value comes out of derive.mjs, the same module check.mjs holds the record
   to. The three test-suite figures are the exception — they need a minute and
   the pinned registries — and are carried with their raw verdict line, marked
   derivable: null, which check.mjs prints as "trust" rather than pretending.

       node measure.mjs                     re-derive and rewrite the tables
       node measure.mjs --tests "<line>"    also record a fresh suite verdict line */
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { deriveLane, deriveLaneModules, deriveWrl, world, git, LARGEST, PROFILE } from "./derive.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const P = path.join(HERE, "records", "witness.json");
const w = JSON.parse(readFileSync(P, "utf8"));
const ENGINE = path.resolve(HERE, w.engine_path), WRL = path.resolve(HERE, w.wrl_path);
if (!existsSync(path.join(ENGINE, "v2")) || !existsSync(path.join(WRL, "relation-v2.js"))) {
    console.error(`measure.mjs needs both sibling checkouts: ${ENGINE}/v2 and ${WRL}/relation-v2.js`);
    process.exit(2);
}
const lane = deriveLane(ENGINE);
const wrl = await deriveWrl(WRL);
const mods = await deriveLaneModules(ENGINE);
const today = new Date().toISOString().slice(0, 10);

const CMD = {
    worlds_sealed: "ls ../graphonomous/v2/projections/*/world/SEM | wc -l",
    pinned_sources: "node -e \"console.log(require('../graphonomous/v2/snapshots/tri.json').sources.length)\"",
    adapters: "node -e \"console.log(require('../graphonomous/v2/snapshots/tri.json').params.adapters.length)\"",
    nodes: `grep -c '' ../graphonomous/v2/projections/${LARGEST}/records/node.jsonl`,
    relations: `grep -c '' ../graphonomous/v2/projections/${LARGEST}/records/relation.jsonl`,
    faults: `node -e \"console.log(require('../graphonomous/v2/projections/${LARGEST}/manifest.json').faults.count)\"`,
    findings: `node -e \"console.log(require('../graphonomous/v2/projections/${LARGEST}/consistency/manifest.json').count)\"`,
    super_pin: "node -e \"console.log(require('../graphonomous/v2/snapshots/tri.json').sources.find(s=>s.namespace==='super').commit.slice(0,7))\"",
    profile_rows: "node -e \"import('../WRL/relation-v2.js').then(V=>console.log(V.V2_PROFILE_IDS.length))\"",
    static_rows: "node -e \"import('../WRL/relation-v2.js').then(V=>console.log(Object.values(V.V2_PROFILES).filter(r=>r.derivation==='static').length))\"",
    roles: `node -e \"import('../WRL/relation-v2.js').then(V=>console.log(Object.keys(V.V2_PROFILES['${PROFILE}'].roles).length))\"`,
    kinds: `node -e \"import('../WRL/relation-v2.js').then(V=>console.log(Object.keys(V.V2_PROFILES['${PROFILE}'].endpoints).length))\"`,
    pairs: `node -e \"import('../WRL/relation-v2.js').then(V=>console.log(Object.values(V.V2_PROFILES['${PROFILE}'].endpoints).reduce((n,p)=>n+p.length,0)))\"`,
    rules: "node -e \"console.log(require('../graphonomous/v2/rules/g0.rules.json').rules.length)\"",
    derived_facts: `node -e \"console.log(require('../graphonomous/v2/projections/${LARGEST}/derived/manifest.json').count)\"`,
    consistency_rules: "node -e \"import('../graphonomous/v2/lib/consistency.mjs').then(m=>console.log(m.RULES.length))\"",
    consistency_rejected: "node -e \"import('../graphonomous/v2/lib/consistency.mjs').then(m=>console.log(m.REJECTED.length))\"",
    acceptance_questions: "node -e \"import('../graphonomous/v2/lib/acceptance.mjs').then(m=>console.log(m.QUESTIONS.length))\"",
};
const LABEL = {
    worlds_sealed: "Projections sealed as WRL worlds", pinned_sources: "Repositories the largest snapshot pins",
    adapters: "Adapters that read them", nodes: `Nodes in the ${LARGEST} projection`, relations: `Relations in the ${LARGEST} projection`,
    faults: `Typed faults kept in the ${LARGEST} projection`, findings: `Cross-registry findings on ${LARGEST}`,
    super_pin: "Super (CD) commit the snapshot pins", profile_rows: "Rows in WRL's profile table",
    static_rows: "Static rows, all declared by Graphonomous", roles: `Roles ${PROFILE} declares`,
    kinds: `Relation kinds ${PROFILE} declares`, pairs: `Endpoint pairs ${PROFILE} admits`,
    rules: "Rules in the derivation ruleset",
    derived_facts: `Facts derived from them on ${LARGEST}`, consistency_rules: "Cross-registry consistency rules accepted",
    consistency_rejected: "Candidate rules reduced to zero against the data and not implemented",
    acceptance_questions: "Acceptance questions answered by traversal, never by prose",
};
for (const [id, value] of Object.entries({ ...lane.facts, ...wrl.facts, ...mods.facts })) {
    w.facts[id] = { value, label: LABEL[id], command: CMD[id], derivable: id };
}
const testsArg = process.argv.indexOf("--tests");
if (testsArg > 0) {
    const raw = process.argv[testsArg + 1];
    const m = /(\d+) tests · (\d+) pass · (\d+) fail · (\d+) skipped/.exec(raw);
    if (!m) { console.error("--tests wants the suite line, e.g. '183 tests · 182 pass · 0 fail · 1 skipped'"); process.exit(2); }
    const cmd = "cd ../graphonomous/v2 && G0_TEST_CONCURRENCY=1 G0_TEST_HEAP_MB=2048 TMPDIR=$HOME/.cache/g0-probe/tmp npm run test:full-tree";
    w.facts.tests_total = { value: m[1], label: "Tests in the suite", command: cmd, raw, derivable: null,
        note: "Not re-derived by check.mjs: the run needs the pinned sibling registries and about a minute. The raw line is the whole output that established it, and the gate refuses if this figure and the page disagree." };
    w.facts.tests_pass = { value: m[2], label: "Tests passing", command: "same run as tests_total", derivable: null };
    w.facts.tests_skipped = { value: m[4], label: "Tests skipped by design", command: "same run as tests_total; the skip is the developer staleness check, which prints the rebuild command instead of failing when ui/data is absent", derivable: null };
}
w.worlds = { _comment: "One row per shipped projection, read from its manifest, records, world/SEM, ROOT, certificate/VCLAIM and consistency/manifest.json by derive.mjs. check.mjs re-derives every row.", rows: lane.worlds };
w.faults = { _comment: `The ${LARGEST} projection's faults by code, from manifest.json faults.by_code. A fault is what an adapter could not normalize; it is typed and kept beside the records, never guessed away.`, world: LARGEST, rows: lane.faults };
w.sources = { _comment: "The repositories the largest snapshot pins, from snapshots/tri.json: namespace, commit and how many files are pinned by blob.", snapshot: "tri", rows: lane.sources };
w.refusals = { _comment: "Six edits to a two-object world, each offered to WRL's seal at the WRL commit below. The code and message are WRL's own; derive.mjs runs the same edits again and check.mjs compares.", wrl_commit: wrl.wrl_commit, world: world(), world_sem: wrl.sem, rows: wrl.refusals };
w.measured_at = today;
w.engine_commit = lane.engine_commit;
w.wrl_commit = wrl.wrl_commit;
w.site_commit_at_measure = git(HERE, "rev-parse", "HEAD");
writeFileSync(P, JSON.stringify(w, null, 2) + "\n");
console.log(`measured ${Object.keys(lane.facts).length + Object.keys(wrl.facts).length + Object.keys(mods.facts).length} facts, ${lane.worlds.length} worlds, ${lane.faults.length} fault codes, ${lane.sources.length} sources, ${wrl.refusals.length} refusals at graphonomous ${lane.engine_commit.slice(0, 7)} / WRL ${wrl.wrl_commit.slice(0, 7)}`);
