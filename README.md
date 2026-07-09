# html-viewer

An [Equicord](https://github.com/Equicord/Equicord) / [Vencord](https://github.com/Vendicated/Vencord) **userplugin** that renders `.html` file attachments inline in Discord, inside a locked sandbox — instead of showing a download chip or raw source.

Built for teams who pass around AI-generated HTML artifacts (reports, dashboards, mockups) in chat and want to actually *see* them without leaving Discord.

> **Heads up:** this is a userplugin you build yourself. It is **not** on the Equicord plugin list and is not eligible for it (see [Why a userplugin](#why-a-userplugin-and-not-upstream)). It renders other people's HTML — read [Security model](#security-model) before using it in servers you don't trust.

## Repo layout

A small monorepo so the two client targets share one tested core:

```
core/       @html-viewer/core — framework-agnostic logic (CSP hardening, attachment
            detection, auto-render allowlists) + its unit tests. Single source of truth.
vencord/    Vencord/Equicord plugin (React). Imports the core by relative path; the core
            is stitched in at build time (see below), so it is never duplicated in git.
shelter/    Shelter plugin (SolidJS). Built with Lune, deployed to GitHub Pages,
            installed by pasting a URL — no build step for end users.
scripts/    build-vencord.mjs — assembles core + vencord into a flat plugin folder.
```

Why the split: Equicord compiles plugins from a *flat* folder inside its own tree and can't resolve imports outside it, so the Vencord target is assembled by copying `core/` in beside it. Shelter bundles with Lune and imports the core normally.

## What it does

- **Render** — an `.html` attachment shows a compact card. Click **Render** and it renders inline in a sandboxed iframe. Nothing executes until you ask it to; scrollback stays inert.
- **Full view** — a large modal that renders the artifact with CDN assets (Tailwind, Chart.js, Google Fonts, …) loaded.
- **Download** — saves the file (Discord's own download chip is hidden by this plugin, so this replaces it).
- **Auto-render allowlists** — per-user and per-server toggles on the card; flip one on and future artifacts from that user / in that server render automatically. Also a global "auto-render everything" setting.
- Hides Discord's native preview of the `.html` attachment so you only see the plugin's card (co-posted images are left alone).

## Security model

The whole point is to render untrusted HTML without letting it touch Discord. Two things enforce that:

1. **Sandbox.** Every render is an `<iframe sandbox="allow-scripts">` with **no** `allow-same-origin`. The frame runs in an opaque origin, so it **cannot** read your Discord token, cookies, DOM, or messages, and cannot remove its own sandbox or navigate your client.
2. **Injected CSP.** Because some clients (e.g. Legcord with `csp:"none"`) strip the page CSP, the plugin injects its own `<meta>` Content-Security-Policy as the first thing in the document. Two tiers:
   - **Inline Render (`LOCKED_CSP`)** — inline + `data:` + a curated allowlist of well-known CDNs for scripts/styles/fonts/images; `connect-src 'none'` blocks `fetch`/XHR/WebSocket/`sendBeacon`.
   - **Full view (`FULLVIEW_CSP`)** — any `https:` for scripts/styles/fonts/images so arbitrary CDNs render; `connect-src 'none'` still blocks `fetch`-class egress.

**Residual risks you should know:**
- A rendered artifact **can** make `GET` requests to allowed sub-resource hosts (an `<img src="https://host/?data">` beacon). Inline limits that to the trusted CDNs; Full view allows any https host. Payloads are GET-only and URL-length-limited, and cannot read a response.
- It **cannot** exfiltrate via `fetch`/XHR/WebSocket (blocked by `connect-src 'none'`), probe your LAN with readback, touch Discord, or persist after you close it.
- It can render convincing fake UI (phishing) — treat a rendered artifact like any untrusted web page. Don't type secrets into one.

The pure security logic (CSP construction + injection ordering, attachment detection, allowlist handling) is unit-tested; see [Tests](#tests).

## Requirements

- Node.js 22+ and `pnpm` (via `corepack enable`)
- `git`
- An Equicord (or Vencord) checkout you build from source

## Install

There are two clients. **Shelter is the easy one** — no build, just paste a URL.

### Shelter (easiest — no build)

1. Make sure you have [Shelter](https://shelter.uwu.network) installed in your Discord client.
2. In Discord: **User Settings → Shelter → Settings → Plugins → Add Plugin**.
3. Paste: `https://modzabazer.github.io/html-viewer/html-viewer/`
4. Done. It updates itself when a new version is deployed.

Shelter renders the UI in SolidJS and injects via DOM observation; the security model and behavior are the same as the Vencord build below. (Building/hosting your own Shelter copy: `cd shelter && pnpm install && pnpm build && pnpm ssg`, then serve `shelter/dist/` — the repo's GitHub Actions workflow does exactly this on push.)

### Vencord / Equicord (build from source)

### 1. Build Equicord with this plugin

```sh
# in this repo: assemble the flat plugin folder (core + vencord stitched together)
pnpm install
pnpm build:vencord           # -> dist/vencord/htmlViewer/

git clone https://github.com/Equicord/Equicord
cd Equicord
pnpm install --frozen-lockfile

# drop the assembled folder into Equicord's userplugins
cp -r /path/to/html-viewer/dist/vencord/htmlViewer src/userplugins/
```

Then build for your client:

- **Legcord / web build:** `pnpm buildWeb` → produces `dist/browser/browser.js` and `dist/browser/browser.css`.
- **Official Discord desktop app (Vencord/Equicord injected):** `pnpm build && pnpm inject`.

### 2a. Load into Legcord

Legcord loads a prebuilt bundle off disk, so point it at your build:

1. In Legcord settings, enable **Equicord** and add it to the "don't auto-update" list (so Legcord won't overwrite your build).
2. Copy your build over Legcord's bundle (the "Open storage folder" button opens this directory):
   - `dist/browser/browser.js`  → `%APPDATA%\legcord\equicord.js`
   - `dist/browser/browser.css` → `%APPDATA%\legcord\equicord.css`
   - (back up the originals first if you want an easy revert)
3. Restart Legcord.

### 2b. Load into the official Discord desktop app

`pnpm inject` after `pnpm build` handles this; follow the Equicord/Vencord install docs.

### 3. Enable it

Open Equicord settings → Plugins → enable **HtmlViewer**. Post an `.html` file to test.

## Configuration

In the plugin's settings:

- **maxSizeKb** — largest artifact allowed to render inline (default 512). Bigger files still offer Full view / Download.
- **autoRenderAll** — auto-render every artifact inline (skip the Render click).
- **autoRenderUsers / autoRenderServers** — comma-separated ID allowlists. Easiest to manage with the person / server toggle icons on each card.

Trusted CDNs for the inline tier are listed in `core/src/harden.ts` (`TRUSTED_CDNS`) — edit that list to add hosts your artifacts rely on.

## Updating

When Equicord updates, or if a Discord change breaks the attachment-hiding patch (Equicord logs a patch-failure at startup; the native preview reappearing is the tell):

```sh
# in this repo
git pull && pnpm install && pnpm build:vencord

# in Equicord
cd Equicord && git pull && pnpm install --frozen-lockfile
rm -rf src/userplugins/htmlViewer && cp -r /path/to/html-viewer/dist/vencord/htmlViewer src/userplugins/
pnpm buildWeb   # then re-copy the bundle into Legcord
```

## Tests

The `core/` modules (`harden`, `detect`, `allowlist`) have no Discord dependencies and are unit-tested with [Vitest](https://vitest.dev):

```sh
pnpm install
pnpm test
```

The React/iframe layer is verified manually (there is no plugin test harness in Equicord).

## Known limits

- **Full view blocks runtime `fetch` by design.** Artifacts that pull live data at runtime won't populate; artifacts that embed their data render fully. Widen `FULLVIEW_CSP` in `core/src/harden.ts` if you need runtime fetch (and accept the exfil tradeoff).
- **The attachment-hiding patch rides a Discord code anchor.** If Discord shifts it, the patch stops applying (Equicord logs it at startup) and the native preview returns until the anchor is updated.
- **Pinning Equicord in Legcord's "don't auto-update" pauses Equicord updates** for that slot until you rebuild.

## Why a userplugin (and not upstream)

This plugin was written with heavy AI assistance. Equicord's contribution rules require contributions to be "majority human written" and prohibit AI-generated PRs/READMEs, so it is **not** eligible for the official plugin list, and it isn't submitted there. It lives here as a userplugin you build and share directly. Please don't submit it to Equicord/Vencord as human-authored work.

## License

GPL-3.0-or-later — see [LICENSE](LICENSE). Uses Equicord/Vencord plugin APIs, which are GPL-3.0-or-later.
