# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"AV Show Calculators": a static, installable web app (PWA) of field calculators for live AV shows (storage, 3-phase power, projector, pixel density, LED wall, camera lens, resolution scaling + EDID export, cabling reference). There is no build step, bundler, package.json, linter or test suite. The whole app is `index.html` (HTML, CSS and one IIFE of vanilla JS), plus `sw.js`, `manifest.webmanifest` and icon files. Fonts load from Google Fonts.

`Tanker Run.html` is an unrelated standalone game that lives in the same repo; leave it alone unless asked.

## Running and testing

- Open `index.html` directly, or serve the folder (`python3 -m http.server`). The service worker only registers over http(s), not `file://`.
- There are no tests. Verify changes in a real browser with Playwright (preinstalled in this environment: `require('playwright')`, plain `chromium.launch()`): load `index.html#<tab>`, drive inputs, read `#id` text, collect `pageerror`, and screenshot desktop and an iPhone-sized viewport. Jump to a tab with a hash: `#storage #power #projector #pixels #led #camera #scaling #cables`.
- EDID files from the Res Scaling tab can be checked with `edid-decode -c file.bin` (`apt-get install edid-decode`). Every export should report `EDID conformity: PASS`; the only acceptable leftover warning is the made-up "AVS" manufacturer ID.

## Releasing (every change gets published)

The live site is GitHub Pages at `https://videostuff.github.io/AV_Calcs/`, deployed from the branch `claude/great-mendel-augco9`. The repo's default branch is `ccr-f8eb4809-68vjb4`. Push each change to both:

```bash
git push origin HEAD:claude/great-mendel-augco9
git push origin HEAD:ccr-f8eb4809-68vjb4
```

Every published change bumps the version in three places, kept in step:
1. `<p id="app-ver">vX.Y · date</p>` in the header of `index.html`
2. `const APP_VERSION='X.Y'` in `index.html` (written into downloaded show files)
3. `const CACHE = 'avcalcs-X.Y'` in `sw.js`

Icon URLs in `index.html` and `manifest.webmanifest` carry a `?v=X.Y` query string; bump it if an icon changes. `sw.js` is network-first with a cache fallback (so updates show on the next load); it pre-caches the `SHELL` list, so add any new asset there.

## Architecture of index.html

Layout, top to bottom: `<style>`, header (theme/Shows/Reset buttons + tab bar), one `<section class="view" id="v-<name>">` per tab (marked with `<!-- ===== NAME ===== -->`), then one script with sections marked `/* ---- NAME ---- */`.

**Tabs and calculators.** `VIEWS` lists the tab ids and `show(v)` toggles `#v-<id>` (tab/hash routing). `CALC` maps a tab to its recalculation function (`calcStorage`, `calcProjector`, `calcScaling`, ...). Calculators are pure DOM reads (`num('id')`) to DOM writes; inputs marked `data-p` are persisted and wired to re-run their tab's `CALC` function (see "shared wiring" at the bottom of the script).

**Persistence.** Everything lives in `localStorage` under `avcalc:*` via the `store.get/set` helper: `inputs` (all `data-p` values keyed by element id), `power` (power lists), `pix` (pixel surfaces), `dept`, `svc`, `pxunit`, `tab`, `theme`, `shows`, `show` and a few small UI keys. Anything new that should be remembered must either be a `data-p` element or use `store`.

**Shows, share links, files.** A "show" is a snapshot of all `avcalc:*` keys except `NOT_SHOW` (`theme, tab, shows, show`). `snapshot()` / `writeState()` / `clearShowState()` handle it. Share links are `?s=<base64url JSON>` and are consumed in `readLink()` at the very top of the script, before any state is read; `{k:'show'}` replaces everything, otherwise it merges one tab. Show files are `.avshow.json` (`{app, type:'shows', version, shows:[{name, saved, data}]}`). Reset keeps saved shows. When you add stored state, decide whether it belongs in `NOT_SHOW`.

**Power tab data model.** `power[dept] = {sv:[{n, r208, r120}, ...]}` for dept in `video|audio|lighting`, up to `MAX_SVC` services each, with `svcI[dept]` the active index. `normPower()` migrates older shapes (single `{r208, r120}`) and runs on every load, so any code path that writes `power` raw (share-link import, show load) is safe. `deptTotals(svc)` and `legLoads(svc)` take a service object. `legLoads` places each unit on a leg or leg pair (greedy, busiest-leg minimising) and returns the per-row placement the UI, print sheet and share text all use. The service rating is busiest leg / 0.8 (NEC continuous load).

**Res Scaling and EDID export.** `cvtTiming()` generates VESA CVT reduced-blanking timing; `pixelClock()` and the table's Aquilon capacity badges derive from it, and `buildEdid()` writes the same timing into a binary EDID, so the table and exported files always agree. Supported connectors are HDMI 2.0 (max 600 MHz), DP 1.2 (about 720 MHz) and DP 1.4 (about 1,080 MHz), 8-bit RGB only; HDMI 2.1 is deliberately unsupported. Formats that do not fit a base-block DTD (over 4,095 px) go in a DisplayID extension with a 1080p60 fallback in the base block; the HDMI variant adds a block map. Change any EDID byte layout only with `edid-decode` verification.

**LED Wall tab.** `calcLed()` turns one panel type (`LED_PANELS` presets Diamond 2.6 and Graphite 2.6, or Custom; editing any spec flips the select to Custom; Graphite can add one row of half panels, `LED_GRAPHITE_HALF`) plus a panel count or target size into resolution, size, weight, power and processor fit. Processor fit counts whole panels per output (`LED_SX40`: 9M px total, 10 XD outputs of 525k px each at 8-bit 60 Hz; or Custom). Its "Send to Power" and "Send to Pixel Density" buttons write into `curSvc()` and `pix[pu].rows` and then call `show()`. The ROE panel figures were read from ROE's own spec PDFs; the Brompton figures came from datasheet text quoted in search results because Brompton's site was unreachable, so re-check them against the current Brompton datasheets if precision matters.

**UI helpers worth reusing.** `twoTap(btn, action)` is the two-tap confirm used for every destructive button (the page has no `confirm()` dialogs). `toast(msg)`, `<dialog class="sheet">` for Shows/Share, `unit()`, `fx()`/`fa()` number formatters, and the `.ro` (readout), `.panel`, `.field`, `.btn`, `.pill` styles. Colour tokens are CSS variables with light and dark sets (`prefers-color-scheme` plus `[data-theme]`); use the tokens, not literal colours.

## Data you may need to keep correct

Reference values are hardcoded in the script and verified against manufacturer and standards sources: ProRes/H.264 bitrates (`CODECS`), device wattages (`LIB208`, `LIB120G`; maximum ratings), projector and camera-lens libraries, and the cabling tables in the `v-cables` section. Storage uses decimal GB (divide by 1000) and scales long-GOP codecs by `(fps/29.97)^log2(1.5)`, ProRes linearly.
