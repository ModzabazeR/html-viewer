/*
 * Assemble the flat Vencord/Equicord userplugin folder.
 *
 * Equicord compiles plugins from a flat folder inside its own tree and cannot
 * resolve imports outside it, so the shared core cannot be a live import there.
 * This copies core/src + vencord/ into one self-contained folder you drop into
 * <equicord>/src/userplugins/htmlViewer/. Core stays single-source; no committed
 * duplication.
 */

import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist", "vencord", "htmlViewer");

rmSync(join(root, "dist", "vencord"), { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// Shared core (harden/detect/allowlist) — skip the barrel; the flat plugin uses
// relative "./harden" imports, not "@html-viewer/core".
for (const f of readdirSync(join(root, "core", "src"))) {
    if (f === "index.ts") continue;
    cpSync(join(root, "core", "src", f), join(out, f));
}

// Vencord-specific React files.
for (const f of readdirSync(join(root, "vencord"))) {
    cpSync(join(root, "vencord", f), join(out, f));
}

console.log("Assembled Vencord/Equicord plugin ->", out);
console.log("Copy its contents into <equicord>/src/userplugins/htmlViewer/ and run `pnpm buildWeb`.");
