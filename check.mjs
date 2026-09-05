/* ==========================================================================
   graphonomous.com — re-derive the record from the world.

       node check.mjs            re-derives everything reachable
       node check.mjs --offline  skips the two network checks

   records/witness.json is a claim about a codebase and a registry that live
   somewhere else. This file goes and looks. Anything it can recompute, it
   recomputes from the real artifact — the sibling engine checkout, the npm
   registry, the GitHub release assets — and it exits non-zero on disagreement.

   The direction of dependency is the point (SHELL.md §4.1): the record is what
   the page is CHECKED AGAINST, never the thing that decides what is true.

   What it deliberately does not do: run `mix test`. That needs an Elixir
   toolchain and a compiled _build, which a Pages builder does not have. That
   figure carries its raw output line in the record instead, and this file says
   out loud that it is taking it on trust rather than pretending otherwise. A
   check that quietly skips is worse than a check that reports it skipped.
   ========================================================================== */
import { readFileSync, existsSync, readdirSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const J = (p) => JSON.parse(readFileSync(path.join(HERE, p), "utf8"));
const witness = J("records/witness.json");
const ENGINE = path.resolve(HERE, witness.engine_path);
const OFFLINE = process.argv.includes("--offline");

let pass = 0;
const fail = [];
const skip = [];

function T(name, got, want) {
    if (String(got) === String(want)) {
        pass++;
        console.log(`  ok    ${name}  = ${want}`);
    } else {
        fail.push(`${name}: derived ${JSON.stringify(String(got))} != record ${JSON.stringify(String(want))}`);
        console.log(`  FAIL  ${name}  derived ${got}, record says ${want}`);
    }
}
const S = (name, why) => {
    skip.push(`${name} — ${why}`);
    console.log(`  skip  ${name}  (${why})`);
};

const F = (id) => witness.facts[id].value;
const eng = (p) => readFileSync(path.join(ENGINE, p), "utf8");

console.log(`engine checkout: ${ENGINE}`);

/* ---------- 1. the sibling checkout ---------- */
if (!existsSync(ENGINE)) {
    S("mix_version / machine_count / action_count / elixir_req / install_total_count",
      `no checkout at ${ENGINE}`);
} else {
    T("mix_version", /version:\s*"([^"]+)"/.exec(eng("mix.exs"))[1], F("tree_version"));
    T("elixir_req", /elixir:\s*"([^"]+)"/.exec(eng("mix.exs"))[1], F("elixir_req"));

    const server = eng("lib/graphonomous/mcp/machines/server.ex");
    const machines = [...server.matchAll(/component\(Graphonomous\.MCP\.Machines\.(\w+)\)/g)].map((m) => m[1]);
    T("machine_count", machines.length, F("machines"));

    /* @valid_actions is the authoritative list — it is the guard the running
       server dispatches through, not a comment about one. */
    let actions = 0;
    for (const m of machines) {
        const src = eng(`lib/graphonomous/mcp/machines/${m.toLowerCase()}.ex`);
        const decl = /@valid_actions\s+~w\(([^)]*)\)/.exec(src);
        if (!decl) {
            fail.push(`${m}.ex declares no @valid_actions`);
            continue;
        }
        actions += decl[1].trim().split(/\s+/).filter(Boolean).length;
    }
    T("action_count", actions, F("actions"));

    /* Every action the record prints in the loop rail must exist in the code,
       and every action in the code must be printed. The old page was short by
       two and nothing noticed. */
    const surface = J("records/surface.json");
    const printed = surface.loop.flatMap((p) => p.actions.split("·").map((s) => s.trim()));
    const declared = machines.flatMap((m) => {
        const src = eng(`lib/graphonomous/mcp/machines/${m.toLowerCase()}.ex`);
        const d = /@valid_actions\s+~w\(([^)]*)\)/.exec(src);
        return d ? d[1].trim().split(/\s+/).filter(Boolean) : [];
    });
    const missing = declared.filter((a) => !printed.includes(a));
    const invented = printed.filter((a) => !declared.includes(a));
    T("every declared action is printed", missing.length ? `missing ${missing.join(",")}` : "yes", "yes");
    T("every printed action is declared", invented.length ? `invented ${invented.join(",")}` : "yes", "yes");

    const rp = eng("npm/scripts/resolve-platform.js");
    const plats = (/PLATFORM_MAP\s*=\s*\{([^}]*)\}/.exec(rp)[1].match(/\w+\s*:/g) || []).length;
    const archs = (/ARCH_MAP\s*=\s*\{([^}]*)\}/.exec(rp)[1].match(/\w+\s*:/g) || []).length;
    T("install_total_count", plats * archs, F("install_targets_total"));

    T("npm package version matches the tree",
      JSON.parse(eng("npm/package.json")).version, F("tree_version"));
}

/* ---------- 1b. the V2 lane, and the WRL profile table it seals under ----------
   V2 is a second lane in the same checkout (graphonomous/v2). Its figures are read
   from the projections and snapshots on disk, and the profile counts from WRL's own
   module, imported — not from anything this site wrote down. */
const V2DIR = path.join(ENGINE, "v2");
if (!existsSync(V2DIR)) {
    S("v2_worlds_sealed / tri_sources / tri_adapters / tri_nodes / tri_relations / super_pin", `no V2 lane at ${V2DIR}`);
} else {
    const worlds = readdirSync(path.join(V2DIR, "projections"), { withFileTypes: true })
        .filter((d) => d.isDirectory() && existsSync(path.join(V2DIR, "projections", d.name, "world", "SEM"))).length;
    T("v2_worlds_sealed", worlds, F("v2_worlds_sealed"));
    const tri = JSON.parse(readFileSync(path.join(V2DIR, "snapshots", "tri.json"), "utf8"));
    T("tri_sources", tri.sources.length, F("tri_sources"));
    T("tri_adapters", tri.params.adapters.length, F("tri_adapters"));
    T("super_pin", tri.sources.find((s) => s.namespace === "super").commit.slice(0, 7), F("super_pin"));
    const lines = (p) => readFileSync(p, "utf8").split("\n").filter(Boolean).length;
    T("tri_nodes", lines(path.join(V2DIR, "projections", "tri", "records", "node.jsonl")), F("tri_nodes"));
    T("tri_relations", lines(path.join(V2DIR, "projections", "tri", "records", "relation.jsonl")), F("tri_relations"));
}
const WRLJS = path.resolve(HERE, "..", "WRL", "relation-v2.js");
if (!existsSync(WRLJS)) {
    S("wrl_profile_rows / wrl_static_rows", `no WRL checkout at ${WRLJS}`);
} else {
    const V2 = await import(pathToFileURL(WRLJS).href);
    T("wrl_profile_rows", V2.V2_PROFILE_IDS.length, F("wrl_profile_rows"));
    T("wrl_static_rows", Object.values(V2.V2_PROFILES).filter((r) => r.derivation === "static").length, F("wrl_static_rows"));
}

/* ---------- 2. this repository ---------- */
T("demo_count", readdirSync(path.join(HERE, "demo"), { withFileTypes: true }).filter((d) => d.isDirectory()).length, F("demos"));

/* ---------- 3. the registry and the release assets ---------- */
if (OFFLINE) {
    S("npm_dist_tag / npm_publish_date / install_ok_count", "--offline");
} else {
    const meta = await (await fetch("https://registry.npmjs.org/graphonomous")).json();
    T("npm_dist_tag", meta["dist-tags"].latest, F("published_version"));
    T("npm_publish_date", meta.time[F("published_version")].slice(0, 10), F("published_at"));

    /* Probe every advertised target, not just the one that works. This is the
       check that found the defect: a package that resolves on the registry can
       still be uninstallable, the same way a link that returns 200 can be
       dead. */
    let ok = 0;
    for (const row of witness.install_targets.rows) {
        const url = witness.install_targets.release + witness.install_targets.asset_pattern.replace("<target>", row.target);
        const res = await fetch(url, { redirect: "follow" });
        T(`asset ${row.target}`, res.status, row.http);
        if (res.status === 200) ok++;
    }
    T("install_ok_count", ok, F("install_targets_ok"));
}

/* ---------- 4. what is being taken on trust, said out loud ---------- */
for (const [id, fact] of Object.entries(witness.facts)) {
    if (fact.derivable === null) {
        console.log(`  trust ${id} = ${fact.value}  <- ${fact.command}`);
    }
}

console.log(`\n${pass} re-derived, ${fail.length} disagreed, ${skip.length} skipped`);
if (skip.length) skip.forEach((s) => console.log(`  skipped: ${s}`));
if (fail.length) {
    fail.forEach((f) => console.error(`  DISAGREEMENT: ${f}`));
    process.exit(1);
}
