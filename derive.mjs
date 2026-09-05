/* ==========================================================================
   derive.mjs — every figure and every table on graphonomous.com, DERIVED.

   measure.mjs calls this and writes the result into records/witness.json.
   check.mjs calls this and refuses if the record disagrees. The two share this
   one module so that the record can never be produced by a different rule
   than the one it is checked against — a measurement and its check that live
   in two files drift apart, and the drift is invisible until a reader finds
   it (SHELL.md §4.1).

   Everything here reads the sibling checkouts: graphonomous/v2 (the lane) and
   WRL (the encoder whose profile table the lane seals under). Nothing here
   reads this site. Where a sibling is absent the caller skips loudly.
   ========================================================================== */
import { readFileSync, readdirSync, existsSync } from "fs";
import { execFileSync } from "child_process";
import path from "path";
import { pathToFileURL } from "url";

const lines = (p) => readFileSync(p, "utf8").split("\n").filter(Boolean).length;
const text = (p) => readFileSync(p, "utf8").trim();
const J = (p) => JSON.parse(readFileSync(p, "utf8"));

export const WORLD_NAMES = ["baseline", "historical", "multi", "multi-v1", "tri"];
export const LARGEST = "tri";

/* The minimal world the refusals are demonstrated on: a RECEIPT that WITNESSES
   a CLAIM, in exactly the shape lib/wrl_world.mjs submits. Six edits are made
   to fresh copies and offered to the same seal. */
export const RULES = "graphonomous.semantic.rules.v0";
export const PROFILE = "graphonomous.semantic.v2";
const term = (id) => ({ object_id: id, port: "node" });
export const world = () => ({
    ir_version: "2.0", profile_id: PROFILE, semantic_policies: { rulepack_id: RULES },
    objects: [
        { object_id: "receipt_3Asha256_3Aabc", role: "RECEIPT", static_config: { lid: "receipt:sha256:abc", attrs: {} }, ports: ["node"] },
        { object_id: "claim_3Acrosswalk_3AE_2D48", role: "CLAIM", static_config: { lid: "claim:crosswalk:E-48", attrs: {} }, ports: ["node"] },
    ],
    relations: [{
        identity_seed: { variant: "named-initial", relation_name: "rel:WITNESSES:receipt:sha256:abc:claim:crosswalk:E-48" },
        revision: { domain: "semantic", kind: "WITNESSES", orientation: "directed", texture: "solid",
            endpoints: [{ role: "source", terminal: term("receipt_3Asha256_3Aabc") }, { role: "target", terminal: term("claim_3Acrosswalk_3AE_2D48") }],
            attributes: {}, policy: RULES },
    }],
});
export const EDITS = [
    ["an undeclared role", "objects[0].role = \"OPINION\"", (w) => { w.objects[0].role = "OPINION"; }],
    ["an undeclared relation kind", "relations[0].revision.kind = \"LIKES\"", (w) => { w.relations[0].revision.kind = "LIKES"; }],
    ["a pair the kind does not admit", "endpoints reversed: CLAIM → RECEIPT under WITNESSES", (w) => { const e = w.relations[0].revision.endpoints; [e[0].terminal, e[1].terminal] = [e[1].terminal, e[0].terminal]; }],
    ["a policy outside the profile's vocabulary", "relations[0].revision.policy = \"anything.at.all\"", (w) => { w.relations[0].revision.policy = "anything.at.all"; }],
    ["a runtime claim in a static world", "semantic_policies.film_schema = \"film.v0.7\"", (w) => { w.semantic_policies.film_schema = "film.v0.7"; }],
    ["a profile id the table has no row for", "profile_id = \"graphonomous.semantic.v9\"", (w) => { w.profile_id = "graphonomous.semantic.v9"; }],
];

export function git(dir, ...args) {
    return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" }).trim();
}

/** Everything derivable from the lane. */
export function deriveLane(engine) {
    const V2 = path.join(engine, "v2");
    if (!existsSync(V2)) return null;
    const worlds = WORLD_NAMES.map((name) => {
        const d = path.join(V2, "projections", name);
        const m = J(path.join(d, "manifest.json"));
        const snap = J(path.join(d, "snapshot.json"));
        const ids = J(path.join(d, "world", "identities.json"));
        const cm = existsSync(path.join(d, "consistency", "manifest.json")) ? J(path.join(d, "consistency", "manifest.json")) : null;
        return {
            name, profile: ids.profile_id,
            nodes: lines(path.join(d, "records", "node.jsonl")),
            relations: lines(path.join(d, "records", "relation.jsonl")),
            assertions: lines(path.join(d, "records", "assertion.jsonl")),
            faults: m.faults.count,
            findings: cm ? cm.count : null,
            adapters: snap.params && snap.params.adapters ? snap.params.adapters : ["crosswalk"],
            sources: snap.sources.length,
            sem: text(path.join(d, "world", "SEM")),
            root: text(path.join(d, "ROOT")),
            vclaim: text(path.join(d, "certificate", "VCLAIM")),
        };
    });
    const sealed = readdirSync(path.join(V2, "projections"), { withFileTypes: true })
        .filter((e) => e.isDirectory() && existsSync(path.join(V2, "projections", e.name, "world", "SEM"))).length;
    const tri = J(path.join(V2, "snapshots", "tri.json"));
    const triM = J(path.join(V2, "projections", LARGEST, "manifest.json"));
    const largest = worlds.find((w) => w.name === LARGEST);
    return {
        facts: {
            worlds_sealed: String(sealed),
            pinned_sources: String(tri.sources.length),
            adapters: String(tri.params.adapters.length),
            nodes: String(largest.nodes),
            relations: String(largest.relations),
            faults: String(largest.faults),
            findings: String(largest.findings),
            super_pin: tri.sources.find((s) => s.namespace === "super").commit.slice(0, 7),
        },
        worlds,
        faults: triM.faults.by_code.map(([code, count]) => ({ code, count })),
        sources: tri.sources.map((s) => ({ namespace: s.namespace, commit: s.commit.slice(0, 12), files: s.files.length })),
        engine_commit: git(engine, "rev-parse", "HEAD"),
    };
}

/** Everything derivable from WRL: the profile table, and the six refusals, run live. */
export async function deriveWrl(wrl) {
    const mod = path.join(wrl, "relation-v2.js");
    if (!existsSync(mod)) return null;
    const V2 = await import(pathToFileURL(mod).href);
    const rows = Object.values(V2.V2_PROFILES);
    const refusals = [];
    for (const [edit, shown, mutate] of EDITS) {
        const w = world(); mutate(w);
        try { await V2.v2WorldIdOfArtifact(w); refusals.push({ edit, shown, code: "(sealed)", message: "" }); }
        catch (e) { refusals.push({ edit, shown, code: e.code || String(e), message: e.message || "" }); }
    }
    const sem = await V2.v2WorldIdOfArtifact(world());
    const profile = V2.V2_PROFILES[PROFILE];
    return {
        facts: {
            profile_rows: String(V2.V2_PROFILE_IDS.length),
            static_rows: String(rows.filter((r) => r.derivation === "static").length),
            roles: String(Object.keys(profile.roles).length),
            kinds: String(Object.keys(profile.endpoints).length),
            pairs: String(Object.values(profile.endpoints).reduce((n, p) => n + p.length, 0)),
        },
        refusals, sem,
        wrl_commit: git(wrl, "rev-parse", "HEAD"),
    };
}
