/* ==========================================================================
   The build stamp — "did this artifact come from THIS build?"

   SHELL.md r6, hole 2, inherited from the GPSCoord reference by every surface
   built before it: nothing checked that the artifact and the source agreed.
   `launch-gate.mjs` reads the ARTIFACT, which is right, but if
   `build-site.mjs` threw halfway through, the PREVIOUS index.html was still
   sitting on disk and the gate cheerfully approved it. A publication gate that
   can approve a stale artifact is checking a file, not a build.

   So the build writes `build-stamp.json` recording three things, and the gate
   refuses unless all three still hold:

     inputs     sha256 of every file the artifact is generated from. A source
                that changed since the last SUCCESSFUL build means the build
                threw, or was never re-run — and the artifact on disk is stale.
     artifacts  sha256 of each emitted file, taken from the string the build
                was about to write. Catches an artifact edited after the emit.
     build_id   derived from `inputs`, and printed INTO the artifact's stamp
                line. So the artifact names the sources it came from, and the
                claim can be checked without this file at all.

   Limit, stated rather than implied: this proves the artifact and the sources
   are COHERENT, not that a human ran the build. Anything that can write
   build-stamp.json can write a coherent lie. It closes the accident — a
   throwing build leaving yesterday's page in place — which is the failure
   that actually happens.
   ========================================================================== */
import { createHash } from "crypto";
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "fs";
import path from "path";

export const STAMP_FILE = "build-stamp.json";
export const ARTIFACTS = ["index.html", "memory.js", "contact.js"];

const sha = (buf) => createHash("sha256").update(buf).digest("hex");

/* Everything the emitted artifact is a function of. Not launch-gate.mjs,
   check.mjs or prove-gate.mjs — those read the artifact, they do not make it,
   and listing them would mean every gate edit forced a rebuild. */
export function inputFiles(dir) {
    const list = ["build-site.mjs", "stamp.mjs", "package.json"];
    for (const sub of ["src", "records"]) {
        const p = path.join(dir, sub);
        if (!existsSync(p)) continue;
        for (const f of readdirSync(p).sort()) {
            if (statSync(path.join(p, f)).isFile()) list.push(sub + "/" + f);
        }
    }
    return list.sort();
}

export function inputHashes(dir) {
    const out = {};
    for (const f of inputFiles(dir)) out[f] = sha(readFileSync(path.join(dir, f)));
    return out;
}

export function artifactHashes(dir) {
    const out = {};
    for (const f of ARTIFACTS) out[f] = sha(readFileSync(path.join(dir, f)));
    return out;
}

/* Deterministic, so an unchanged tree rebuilds to an identical artifact and a
   rebuild is not a diff. A leading letter, so the id can never be read as a
   standalone number in the page's text — see the §8 constant check. */
export function buildId(inputs) {
    return "b" + sha(JSON.stringify(inputs)).slice(0, 12);
}

export function writeStamp(dir, emitted) {
    const inputs = inputHashes(dir);
    const stamp = {
        _comment:
            "Written by build-site.mjs. launch-gate.mjs refuses if any input has changed since, if an artifact does not hash to what was emitted, or if index.html does not carry this build_id. See stamp.mjs.",
        build_id: buildId(inputs),
        built_at: new Date().toISOString().slice(0, 10),
        inputs,
        artifacts: Object.fromEntries(Object.entries(emitted).map(([f, s]) => [f, sha(s)])),
    };
    writeFileSync(path.join(dir, STAMP_FILE), JSON.stringify(stamp, null, 2) + "\n");
    return stamp;
}

export function readStamp(dir) {
    try {
        return JSON.parse(readFileSync(path.join(dir, STAMP_FILE), "utf8"));
    } catch {
        return null;
    }
}
