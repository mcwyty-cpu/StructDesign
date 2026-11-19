# StructDesign

Design reinforced-concrete **slabs, beams and columns** from an architectural floor plan, to **Eurocode 2** or **BS 8110**, and produce structural drawings, calculation sheets, an Excel design workbook and a 3D model.

Built for Urban Forge Construction Limited, Eldoret, Kenya.

**Live app:** https://mcwyty-cpu.github.io/StructDesign/ (after GitHub Pages is switched on — see below)

## What it does

1. **Drawing** – paste, drop or choose a floor plan (image or PDF). Optionally add the floor below, so columns only go where there are walls below.
2. **AI reading** – Claude reads walls, grid lines, stairs and balconies and proposes columns and beams (uses your Anthropic API key, stored only on your device).
3. **Layout** – tap to add or remove columns and beams, mark beams that carry walls, and set slab / void / balcony / outside areas over the drawing.
4. **Loads & code** – EC2 or BS 8110, materials, covers, levels (floors + roof) and loads.
5. **Design** – every member is classified and designed:
   - slabs: one-way / two-way, simple / continuous, cantilever (BS 8110 Tables 3.12–3.14), auto-thickened for deflection;
   - beams: T-beam / L-beam / rectangular, continuous-beam analysis with pattern loading, flexure, shear links, deflection;
   - columns: short / long (slender) per axis, second-order moments, strain-compatibility capacity, biaxial bending; loads to foundations.
6. **Calcs** – step-by-step calculation sheets (Ref. · Calculation · Output) for every member, as A4 PDF; **Excel workbook** with live formulas for slabs, beams and columns.
7. **3D** – interactive 3D model (rotate, zoom, pan) with an optional reinforcement view; save as PNG.
8. **Drawings** – A3 sheets: framing & slab-reinforcement plans per level, building sections, beam reinforcement elevations with cross-sections, slab and cantilever sections, 3D isometric, beam / slab / column schedules, typical details and notes. Export as PDF (drawings, or full package with calculations) or SVG.

## Switch on GitHub Pages (one time)

1. Open this repository on GitHub → **Settings** → **Pages**.
2. *Build and deployment* → Source: **Deploy from a branch**; Branch: **main**, folder **/ (root)** → **Save**.
3. After about a minute the site is live at `https://mcwyty-cpu.github.io/StructDesign/`.

## Install as an app

- **Android (Chrome):** open the address → ⋮ → **Install and create shortcut** (or *Add to Home screen*) → **Install**.
- **Windows 10 (Chrome):** open the address → install icon at the right of the address bar → **Install** (or ⋮ → *Cast, save and share* → *Install page as app*).
- **Windows 10 (Edge):** … → **Apps** → **Install this site as an app**.

The installed app works offline except for AI drawing reading.

## Developing

The app is a single static page. Source modules are in `src/`:

| File | Purpose |
|---|---|
| `engine.js` | grid model, slab panels, beam runs, continuous-beam analysis, EC2/BS section design, columns |
| `sheets.js` | A3 drawing sheets: framing plans, schedules, details |
| `sections.js` | building sections, beam elevations, slab sections, 3D isometric sheet |
| `calc.js` | calculation sheets (HTML and A4 PDF) |
| `xlsx.js` | Excel workbook with live formulas (ExcelJS) |
| `view3d.js` | interactive 3D model (three.js) |
| `app.js`, `template.html` | user interface |

After editing, run `python src/build.py` to regenerate `index.html`, then commit and push. Bump the cache name in `sw.js` so installed apps pick up the update.

## Limitations

Scheme-level design by hand methods: coefficient moments for slabs, tributary slab loads to beams, sub-frame moments for columns, square columns. Foundations and stairs are not designed (column loads to foundations are given). AI reading of drawings must be checked on the Layout tab. **All output must be checked and signed by a registered engineer before construction.**

## Phone and Windows apps

Every push to `main` builds the apps with GitHub Actions (`.github/workflows/build-apps.yml`) and publishes them on the **Releases** page:

- `StructDesign.apk` – Android (Capacitor wrapper, works offline; exported PDFs/Excel open the share sheet so you can save to Files/Drive or send on WhatsApp/email)
- `StructDesign-Setup.exe` – Windows 10/11 installer (Electron)
- `StructDesign-Portable.exe` – Windows, runs without installing

The AI drawing reader needs internet and your Anthropic API key (stored only on the device); all design, drawings, calc sheets, Excel and 3D work offline.
