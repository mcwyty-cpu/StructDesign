/* Structural drawing sheets (A3 landscape, SVG in mm) */
const SHEETS = (() => {
  const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const W = 420, H = 297;
  const T = (x, y, s, sz = 2.5, o = {}) => `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${sz}" font-family="Arial,Helvetica,sans-serif"${o.a ? ` text-anchor="${o.a}"` : ""}${o.b ? ` font-weight="bold"` : ""}${o.c ? ` fill="${o.c}"` : ""}${o.r ? ` transform="rotate(${o.r} ${x.toFixed(2)} ${y.toFixed(2)})"` : ""}>${esc(s)}</text>`;
  const Ln = (x1, y1, x2, y2, w = 0.25, c = "#000", dash) => `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${c}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
  const Rc = (x, y, w, h, f = "none", s = "#000", sw = 0.25, extra = "") => `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(w, 0).toFixed(2)}" height="${Math.max(h, 0).toFixed(2)}" fill="${f}" stroke="${s}" stroke-width="${sw}" ${extra}/>`;
  const letters = i => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

  function frame(P, title, no, inner, scaleTxt) {
    const I = P.info || {};
    const tb = [
      Rc(8, 8, W - 16, H - 16, "none", "#000", 0.5),
      Rc(8, 268, W - 16, 21, "#fff", "#000", 0.4),
      Ln(118, 268, 118, 289, 0.3), Ln(208, 268, 208, 289, 0.3), Ln(270, 268, 270, 289, 0.3), Ln(362, 268, 362, 289, 0.3),
      T(10, 271.5, "COMPANY", 1.6, { c: "#666" }), T(10, 276, (I.company || "").toUpperCase(), 2.6, { b: 1 }), T(10, 280.5, I.address || "", 1.9), T(10, 284.5, I.phone || "", 1.9),
      T(120, 271.5, "PROJECT / CLIENT", 1.6, { c: "#666" }), T(120, 276, I.name || "", 2.4, { b: 1 }), T(120, 281, "Client: " + (I.client || ""), 2.2), T(120, 285.5, I.location || "", 1.9),
      T(210, 271.5, "DESIGNED / DRAWN BY", 1.6, { c: "#666" }), T(210, 276.5, I.engineer || "", 2.2, { b: 1 }), T(210, 281.5, I.engineer2 || "", 2.2, { b: 1 }),
      T(272, 271.5, "DRAWING TITLE", 1.6, { c: "#666" }), T(272, 276.5, title, 2.5, { b: 1 }), T(272, 281.5, `Design code: ${P.code === "EC2" ? "BS EN 1992-1-1 (EC2)" : "BS 8110-1:1997"}`, 1.9), T(272, 285.5, `C${P.code === "EC2" ? P.mat.fck : P.mat.fcu} concrete · B${P.code === "EC2" ? P.mat.fyk : P.mat.fy} steel`, 1.9),
      T(364, 271.5, "SHEET / SCALE / DATE", 1.6, { c: "#666" }), T(364, 277, no, 3.2, { b: 1 }), T(364, 282, scaleTxt || "NTS", 2.1), T(364, 286, I.date || new Date().toISOString().slice(0, 10), 2.0)
    ].join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm"><rect width="${W}" height="${H}" fill="#fff"/>${inner}${tb}</svg>`;
  }

  // ------------------------------------------------------------ framing plan
  function framing(P, D, L, no) {
    const gx = P.gx, gy = P.gy, xmin = gx[0], xmax = gx[gx.length - 1], ymin = gy[0], ymax = gy[gy.length - 1];
    const Wm = xmax - xmin, Hm = ymax - ymin;
    const scales = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500];
    const r = scales.find(s => Wm / s <= 270 && Hm / s <= 205) || 500, s = 1 / r;
    const ox = 32 + (275 - Wm * s) / 2, oy = 34 + (210 - Hm * s) / 2;
    const X = x => ox + (x - xmin) * s, Y = y => oy + (y - ymin) * s;
    const o = [];
    o.push(T(14, 17, `${L.lvl.name.toUpperCase()} – FRAMING & SLAB REINFORCEMENT PLAN`, 4.2, { b: 1 }));
    // cells
    for (let i = 0; i + 1 < gx.length; i++) for (let j = 0; j + 1 < gy.length; j++) {
      const t = SD.cellT(L.P || P, i, j), x = X(gx[i]), y = Y(gy[j]), w = (gx[i + 1] - gx[i]) * s, h = (gy[j + 1] - gy[j]) * s;
      if (t === "slab") o.push(Rc(x, y, w, h, "#f7f7f2", "none", 0));
      if (t === "balcony") o.push(Rc(x, y, w, h, "#ecebfb", "none", 0));
      if (t === "void") { o.push(Ln(x, y, x + w, y + h, 0.2, "#888"), Ln(x + w, y, x, y + h, 0.2, "#888"), T(x + w / 2, y + h / 2 + 1, "VOID", 2.2, { a: "middle", c: "#666" })); }
    }
    // grid
    gx.forEach((v, i) => { o.push(Ln(X(v), oy - 14, X(v), Y(ymax) + 4, 0.18, "#999", "4 1 0.6 1")); o.push(`<circle cx="${X(v).toFixed(2)}" cy="${(oy - 17).toFixed(2)}" r="3" fill="#fff" stroke="#000" stroke-width="0.3"/>`, T(X(v), oy - 15.9, letters(i), 2.8, { a: "middle", b: 1 })); });
    gy.forEach((v, j) => { o.push(Ln(ox - 14, Y(v), X(xmax) + 4, Y(v), 0.18, "#999", "4 1 0.6 1")); o.push(`<circle cx="${(ox - 17).toFixed(2)}" cy="${Y(v).toFixed(2)}" r="3" fill="#fff" stroke="#000" stroke-width="0.3"/>`, T(ox - 17, Y(v) + 1, String(j + 1), 2.8, { a: "middle", b: 1 })); });
    for (let i = 0; i + 1 < gx.length; i++) { const a = X(gx[i]), b = X(gx[i + 1]); o.push(Ln(a, oy - 8, b, oy - 8, 0.2), Ln(a, oy - 9.2, a, oy - 6.8, 0.2), T((a + b) / 2, oy - 8.8, String(Math.round(gx[i + 1] - gx[i])), 1.9, { a: "middle" })); }
    for (let j = 0; j + 1 < gy.length; j++) { const a = Y(gy[j]), b = Y(gy[j + 1]); o.push(Ln(ox - 8, a, ox - 8, b, 0.2), Ln(ox - 9.2, a, ox - 6.8, a, 0.2), T(ox - 8.8, (a + b) / 2, String(Math.round(gy[j + 1] - gy[j])), 1.9, { a: "middle", r: -90 })); }
    // beams
    for (const r0 of L.runs) {
      if (!r0.des) continue;
      const bw = Math.max(r0.des.bw * s, 0.9);
      const a = r0.dir === "h" ? [X(gx[r0.a]), Y(gy[r0.line])] : [X(gx[r0.line]), Y(gy[r0.a])];
      const b = r0.dir === "h" ? [X(gx[r0.b]), Y(gy[r0.line])] : [X(gx[r0.line]), Y(gy[r0.b])];
      if (r0.dir === "h") o.push(Rc(a[0], a[1] - bw / 2, b[0] - a[0], bw, r0.status === "REVISE" ? "#f6c6c6" : "#d6d6d6", "#333", 0.18, 'stroke-dasharray="1.2 0.6"'));
      else o.push(Rc(a[0] - bw / 2, a[1], bw, b[1] - a[1], r0.status === "REVISE" ? "#f6c6c6" : "#d6d6d6", "#333", 0.18, 'stroke-dasharray="1.2 0.6"'));
      const lab = `${r0.mark} ${r0.des.bw}×${r0.des.h}`;
      // place label on longest element
      let best = r0.el[0], bi = 0; r0.el.forEach((e, k) => { if (e.L > best.L) { best = e; bi = k; } });
      const pa = r0.dir === "h" ? gx : gy;
      const mid = (pa[best.k0] + pa[best.k1]) / 2;
      if (r0.dir === "h") o.push(T(X(mid), a[1] - bw / 2 - 0.8, lab, 2.0, { a: "middle", b: 1 }));
      else o.push(T(a[0] - bw / 2 - 0.8, Y(mid), lab, 2.0, { a: "middle", b: 1, r: -90 }));
    }
    // panels
    for (const p of L.panels) {
      if (!p.d) continue;
      const cx = X((p.x0 + p.x1) / 2), cy = Y((p.y0 + p.y1) / 2), pw = (p.x1 - p.x0) * s;
      const fs = Math.min(2.3, Math.max(1.4, pw / 22));
      const R = p.d.rows;
      o.push(T(cx, cy - fs * 1.6, p.mark, fs * 1.25, { a: "middle", b: 1, c: "#0b4f8a" }));
      if (p.kind === "cant") {
        o.push(T(cx, cy, `CANT. h=${p.d.h}`, fs, { a: "middle" }), T(cx, cy + fs * 1.3, `T: ${SD.st(R.sxn.bars)}`, fs, { a: "middle", c: "#a00" }), T(cx, cy + fs * 2.6, `dist: ${SD.st(R.syn.bars)}`, fs * 0.9, { a: "middle" }));
      } else {
        const bx = p.shortAlongX ? R.sxp : R.syp, by = p.shortAlongX ? R.syp : R.sxp;
        const top = [R.sxn, R.syn].filter(x => x && x.bars).sort((a, b) => b.bars.A - a.bars.A)[0];
        o.push(T(cx, cy, `h=${p.d.h}`, fs, { a: "middle" }));
        o.push(T(cx, cy + fs * 1.3, `B↔ ${SD.st(bx.bars)}`, fs, { a: "middle" }));
        o.push(T(cx, cy + fs * 2.6, `B↕ ${SD.st(by.bars)}`, fs, { a: "middle" }));
        if (top) o.push(T(cx, cy + fs * 3.9, `T ${SD.st(top.bars)}`, fs, { a: "middle", c: "#a00" }));
      }
    }
    // columns
    for (const c of D.cols) {
      if (!c.res) { o.push(Rc(X(c.x) - 1.2, Y(c.y) - 1.2, 2.4, 2.4, "#c00", "none")); continue; }
      const z = Math.max(c.res.b * s, 1.8);
      o.push(Rc(X(c.x) - z / 2, Y(c.y) - z / 2, z, z, "#111", "none"));
      o.push(T(X(c.x) + z / 2 + 0.5, Y(c.y) + z / 2 + 2.2, c.name, 1.9, { c: "#b00020", b: 1 }));
    }
    // notes column
    const lv = L.lvl, nx0 = 318;
    const n = [
      ["LEVEL", lv.name], ["Slab", `${lv.h} mm UNO (see marks)`], ["Finishes + services", `${lv.fin} kN/m²`], ["Partitions", `${lv.part} kN/m²`],
      ["Imposed qk", `${lv.qk} kN/m² (balconies ≥ 2.5)`], ["Walls on beams", lv.kind === "roof" ? `parapet ${lv.ext} kN/m` : `ext ${lv.ext} / int ${lv.int} kN/m`],
      ["Cover", `slabs ${P.mat.cs} · beams/cols ${P.mat.cb} mm`]
    ];
    o.push(Rc(nx0 - 2, 24, 96, 240, "#fff", "#999", 0.2));
    o.push(T(nx0, 30, "NOTES", 3, { b: 1 }));
    let y = 36;
    for (const [k, v] of n) { o.push(T(nx0, y, k + ":", 2.0, { b: 1 }), T(nx0 + 30, y, v, 2.0)); y += 4.2; }
    y += 2;
    const notes = [
      "B↔ = bottom bars spanning left–right; B↕ = bottom bars",
      "spanning up–down (short-span bars in outer layer).",
      "T = top bars over supporting beams, extend 0.3 lx",
      "each side; at discontinuous edges top bars ≥ 50% of",
      "midspan steel for 0.15 lx.",
      "Cantilever (CS) top bars anchored ≥ 1.5 × projection",
      "into the adjoining slab.",
      "Beams: overall depth incl. slab; see beam schedule.",
      "Columns: see column schedule.",
      "Read with architectural drawings. Do not scale.",
      `Scale 1:${r} at A3.`
    ];
    for (const t of notes) { o.push(T(nx0, y, t, 1.9)); y += 3.4; }
    y += 3;
    o.push(T(nx0, y, "LEGEND", 2.6, { b: 1 })); y += 4;
    o.push(Rc(nx0, y - 2.5, 8, 2.2, "#d6d6d6", "#333", 0.18, 'stroke-dasharray="1.2 0.6"'), T(nx0 + 10, y - 0.6, "beam (downstand)", 2)); y += 4;
    o.push(Rc(nx0 + 2.5, y - 2.8, 3, 3, "#111", "none"), T(nx0 + 10, y - 0.6, "column", 2)); y += 4;
    o.push(Rc(nx0, y - 2.5, 8, 2.5, "#ecebfb", "none"), T(nx0 + 10, y - 0.6, "balcony / cantilever slab", 2)); y += 4;
    o.push(Ln(nx0, y - 2.5, nx0 + 8, y, 0.2, "#888"), Ln(nx0 + 8, y - 2.5, nx0, y, 0.2, "#888"), T(nx0 + 10, y - 0.6, "void / stair", 2)); y += 4;
    const warns = [].concat(...L.panels.map(p => p.warn.map(w => `${p.mark}: ${w}`)), ...L.runs.map(r => r.warn.map(w => `${r.mark}: ${w}`)));
    if (warns.length) {
      y += 2; o.push(T(nx0, y, "CHECK", 2.6, { b: 1, c: "#b00020" })); y += 3.6;
      for (const w of warns.slice(0, 12)) { o.push(T(nx0, y, w.slice(0, 58), 1.7, { c: "#b00020" })); y += 3; }
    }
    return frame(P, `${lv.name} framing plan`, no, o.join(""), `1:${r} @ A3`);
  }

  // ------------------------------------------------------------ tables
  function table(x, y, cols, rows, rh = 4.6) {
    const fz = Math.min(2.0, rh * 0.46);
    const o = []; let cx = x;
    const tw = cols.reduce((s, c) => s + c[1], 0);
    o.push(Rc(x, y, tw, rh, "#e8eef5", "#000", 0.25));
    cols.forEach(([h, w]) => { o.push(T(cx + 1, y + rh - rh * 0.3, h, fz, { b: 1 })); cx += w; });
    rows.forEach((r, k) => {
      const yy = y + rh * (k + 1);
      if (r.sep) o.push(Ln(x, yy, x + tw, yy, 0.35));
      cx = x;
      r.cells.forEach((v, i) => { o.push(T(cx + 1, yy + rh - rh * 0.3, v, fz, { c: r.col && r.col[i] ? r.col[i] : null, b: r.bold && r.bold[i] })); cx += cols[i][1]; });
      o.push(Ln(x, yy + rh, x + tw, yy + rh, 0.1, "#bbb"));
    });
    o.push(Rc(x, y, tw, rh * (rows.length + 1), "none", "#000", 0.3));
    cx = x; cols.forEach(([, w]) => { o.push(Ln(cx, y, cx, y + rh * (rows.length + 1), 0.1, "#999")); cx += w; });
    return o.join("");
  }
  const stc = s => s === "OK" ? "#0a7a2f" : (s === "CHECK" ? "#b36b00" : "#b00020");

  function beamSchedule(P, D) {
    const rows = [];
    for (const L of D.levels) for (const r of L.runs) {
      if (!r.des) { rows.push({ cells: [r.mark, L.lvl.name, "–", "–", "", "", "", "", "", "", "REVISE"], col: Array(10).fill(null).concat(["#b00020"]), sep: true }); continue; }
      r.des.spans.forEach((s, k) => rows.push({
        sep: k === 0,
        cells: [k ? "" : r.mark, k ? "" : L.lvl.name, k ? "" : r.type, k ? "" : `${r.des.bw}×${r.des.h}`, s.kind === "span" ? `span ${r.des.spans.slice(0, k + 1).filter(x => x.kind === "span").length}` : "cantilever",
                s.L.toFixed(2), SD.bt(s.bot) + (s.bot.layers > 1 ? " (2 layers)" : ""), SD.bt(s.topL), SD.bt(s.topR), `H8-2L@${s.links.s}`, k ? "" : r.status],
        bold: [1], col: [null, null, null, null, null, null, null, null, null, null, stc(r.status)]
      }));
    }
    const cols = [["Mark", 18], ["Level", 30], ["Type", 24], ["b × h", 20], ["Span", 22], ["L (m)", 14], ["Bottom", 34], ["Top left", 26], ["Top right", 26], ["Links", 26], ["Status", 16]];
    const out = [], H0 = 232;
    const pages = [];
    if (rows.length + 1 <= Math.floor(H0 / 3.6)) pages.push(rows);
    else { let cur = []; for (const r of rows) { if (r.sep && cur.length >= 46) { pages.push(cur); cur = []; } cur.push(r); } if (cur.length) pages.push(cur); }
    pages.forEach((chunk, p) => {
      const rh = Math.min(4.6, H0 / (chunk.length + 1));
      let inner = T(14, 17, "BEAM SCHEDULE" + (pages.length > 1 ? ` (${p + 1} of ${pages.length})` : ""), 4.2, { b: 1 }) + table(14, 22, cols, chunk, rh);
      inner += T(14, 262, "Bottom bars run full span, lapped 40Ø over supports. Top bars extend ≥0.3 L from support face. Links: 2-leg closed H8, first link 50 from face. Ends modelled as pinned: provide top bars ≥ 25% of span steel anchored into columns.", 2);
      out.push({ title: "Beam schedule" + (pages.length > 1 ? ` ${p + 1}` : ""), body: inner });
    });
    return out;
  }

  function colSection(x, y, b, nb, phi) {
    const sc = 0.09, w = b * sc, o = [Rc(x, y, w, w, "#f4f1ea", "#000", 0.3)];
    const c = 38 * sc, rr = Math.max(phi / 2 * sc, 0.5);
    o.push(Rc(x + c, y + c, w - 2 * c, w - 2 * c, "none", "#555", 0.2));
    const per = nb === 4 ? 2 : (nb === 8 ? 3 : 4);
    const pts = new Set();
    for (let a = 0; a < per; a++) {
      const t = c + rr + a * (w - 2 * c - 2 * rr) / (per - 1);
      [[t, c + rr], [t, w - c - rr], [c + rr, t], [w - c - rr, t]].forEach(([px, py]) => pts.add(px.toFixed(2) + "," + py.toFixed(2)));
    }
    for (const p of pts) { const [px, py] = p.split(",").map(Number); o.push(`<circle cx="${(x + px).toFixed(2)}" cy="${(y + py).toFixed(2)}" r="${rr.toFixed(2)}" fill="#c00"/>`); }
    return o.join("");
  }

  function columnSchedule(P, D) {
    const rows = [];
    for (const c of D.cols) {
      const grid = `${letters(c.i)}/${c.j + 1}`;
      if (!c.res) { rows.push({ cells: [c.name, grid, "–", "", "", "", "", "", "", "", "REVISE"], col: [null, null, null, null, null, null, null, null, null, null, "#b00020"], sep: true }); continue; }
      c.res.des.forEach((d, k) => rows.push({ sep: k === 0, cells: [k ? "" : c.name, k ? "" : grid, k ? "" : `${c.res.b}×${c.res.b}`, `below ${d.level}`, d.N.toFixed(0), `${d.nb}H${d.phi}`, `H8@${Math.min(P.code === "EC2" ? 20 * d.phi : 12 * d.phi, c.res.b, 400) - (Math.min(P.code === "EC2" ? 20 * d.phi : 12 * d.phi, c.res.b, 400) % 25)}`,
        d.ax.slender || d.ay.slender ? "LONG (slender)" : "SHORT", k ? "" : (d.Gk).toFixed(0), k ? "" : (d.Qk).toFixed(0), k ? "" : c.status], bold: [1, 0, 0, 0, 0, 1], col: [null, null, null, null, null, null, null, null, null, null, stc(c.status)] }));
    }
    const cols = [["Column", 14], ["Grid", 13], ["Size", 18], ["Storey", 32], ["NEd kN", 15], ["Bars", 15], ["Links", 16], ["Class", 25], ["Gk base", 15], ["Qk base", 15], ["Status", 14]];
    let inner = T(14, 17, "COLUMN SCHEDULE & LOADS TO FOUNDATIONS", 4.2, { b: 1 }) + table(14, 24, cols, rows.slice(0, 48)) + T(14, 258, "Gk / Qk base = characteristic loads at foundation level (kN) for footing design.", 2);
    // types
    const types = {};
    D.cols.forEach(c => c.res && c.res.des.forEach(d => { const k = `${c.res.b}|${d.nb}|${d.phi}`; (types[k] = types[k] || []).push(c.name); }));
    let tx = 220, ty = 26;
    inner += T(tx, 22, "TYPICAL SECTIONS", 2.8, { b: 1 });
    Object.entries(types).slice(0, 16).forEach(([k, names], n) => {
      const [b, nb, phi] = k.split("|").map(Number);
      const x = tx + (n % 4) * 46, y = ty + Math.floor(n / 4) * 56;
      inner += colSection(x, y, b, nb, phi) + T(x, y + b * 0.09 + 4, `${b}×${b} · ${nb}H${phi}`, 2.1, { b: 1 }) + T(x, y + b * 0.09 + 7.5, [...new Set(names)].join(", ").slice(0, 34), 1.7);
    });
    inner += T(14, 263, "Bars continuous through floors with 40Ø laps above slab level; links at 0.6× spacing within 400 of beams and over laps; kicker 75; cover 30 to links.", 2);
    return [{ title: "Column schedule", body: inner }];
  }

  function slabSchedule(P, D) {
    const rows = [];
    for (const L of D.levels) for (const p of L.panels) {
      if (!p.d) { rows.push({ cells: [p.mark, L.lvl.name, "", "", p.cls, "", "", "", "REVISE"], col: [0, 0, 0, 0, 0, 0, 0, 0, "#b00020"] }); continue; }
      const R = p.d.rows;
      const bx = p.kind === "cant" ? R.sxp : (p.shortAlongX ? R.sxp : R.syp), by = p.kind === "cant" ? R.syp : (p.shortAlongX ? R.syp : R.sxp);
      const top = p.kind === "cant" ? R.sxn : [R.sxn, R.syn].filter(x => x && x.bars).sort((a, b) => b.bars.A - a.bars.A)[0];
      rows.push({ cells: [p.mark, L.lvl.name, `${p.Lx.toFixed(2)}×${p.Ly.toFixed(2)}`, String(p.d.h), p.cls.slice(0, 62), SD.st(bx.bars), SD.st(by.bars), top ? SD.st(top.bars) : "–", p.status],
                  col: [null, null, null, null, null, null, null, null, stc(p.status)], bold: [1] });
    }
    const cols = [["Mark", 16], ["Level", 28], ["Lx×Ly (m)", 22], ["h", 10], ["Classification", 112], ["Bottom ↔", 24], ["Bottom ↕", 24], ["Top", 24], ["Status", 16]];
    const inner = T(14, 17, "SLAB SCHEDULE", 4.2, { b: 1 }) + table(14, 24, cols, rows.slice(0, 50)) +
      T(14, 263, "↔ bars span left–right on plan, ↕ bars span up–down. Short-span bars in the outer layer. Two-way coefficients: BS 8110 Table 3.14 / 3.13; one-way: Table 3.12.", 2);
    return [{ title: "Slab schedule", body: inner }];
  }

  function details(P, D) {
    const o = [T(14, 17, "TYPICAL REINFORCEMENT DETAILS & GENERAL NOTES", 4.2, { b: 1 })];
    // beam elevation
    const x0 = 20, y0 = 40, L = 160, h = 28;
    o.push(T(x0, 32, "TYPICAL CONTINUOUS BEAM", 2.8, { b: 1 }));
    o.push(Rc(x0, y0, L, h, "#f4f1ea", "#000", 0.35), Rc(x0, y0, L, 6, "#e2dccf", "#000", 0.2));
    [x0, x0 + L / 2, x0 + L].forEach(x => o.push(Rc(x - 3, y0 + h, 6, 10, "#777", "none")));
    o.push(Ln(x0 + 2, y0 + h - 3, x0 + L - 2, y0 + h - 3, 0.7, "#c00"), T(x0 + L / 4, y0 + h - 4.5, "bottom bars – full span, lap 40Ø at supports", 2, { a: "middle", c: "#c00" }));
    o.push(Ln(x0 + L / 2 - 0.3 * L / 2, y0 + 3, x0 + L / 2 + 0.3 * L / 2, y0 + 3, 0.7, "#03c"), T(x0 + L / 2, y0 - 1.2, "top bars ≥ 0.3 L each side of support", 2, { a: "middle", c: "#03c" }));
    o.push(Ln(x0 + 2, y0 + 3, x0 + 0.25 * L / 2, y0 + 3, 0.7, "#03c"), T(x0 + 2, y0 - 1.2, "end top bars ≥ 0.25 L", 2, { c: "#03c" }));
    for (let k = 1; k < 40; k++) { const x = x0 + k * L / 40; o.push(Ln(x, y0 + 1.5, x, y0 + h - 1.5, 0.15, "#666")); }
    o.push(T(x0, y0 + h + 15, "Links: 2-leg closed H8 (shape code 51), first link 50 mm from column face; spacing per schedule.", 2));
    o.push(T(x0, y0 + h + 19, "Hangers 2H12 where no top bars are scheduled; side bars 2H12 per face for beams ≥ 600 deep.", 2));
    // slab edge / cantilever
    const sx = 210, sy = 40;
    o.push(T(sx, 32, "CANTILEVER BALCONY / SLAB EDGE", 2.8, { b: 1 }));
    o.push(`<path d="M${sx},${sy} L${sx + 70},${sy} L${sx + 70},${sy + 6} L${sx + 120},${sy + 6} L${sx + 120},${sy + 10} L${sx},${sy + 10} Z" fill="#f4f1ea" stroke="#000" stroke-width="0.3"/>`);
    o.push(Rc(sx + 60, sy + 10, 10, 18, "#f4f1ea", "#000", 0.3));
    o.push(Ln(sx + 5, sy + 2, sx + 118, sy + 2, 0.7, "#03c"), T(sx + 30, sy - 1.5, "cantilever top bars – anchor ≥ 1.5 × projection into slab", 2, { a: "middle", c: "#03c" }));
    o.push(Ln(sx + 2, sy + 8.5, sx + 118, sy + 8.5, 0.5, "#c00"), T(sx + 95, sy + 15, "fall 1:60 away from door", 2, { a: "middle" }));
    // general notes
    const gn = [
      "GENERAL NOTES",
      `1. Design to ${P.code === "EC2" ? "BS EN 1990, BS EN 1991-1-1 and BS EN 1992-1-1 with UK NA values" : "BS 8110-1:1997 (Amd 3) and BS 6399"}.`,
      `2. Concrete C${P.code === "EC2" ? P.mat.fck : P.mat.fcu}${P.code === "EC2" ? "/" + (P.mat.fck + 5) : ""}, max aggregate 20 mm, slump 75–100 mm, cure 7 days minimum.`,
      `3. Reinforcement high-yield B${P.code === "EC2" ? P.mat.fyk : P.mat.fy} (H/Y) to BS 4449 / KS EAS 412, bent to BS 8666.`,
      `4. Nominal cover: slabs ${P.mat.cs} mm (roof/balconies 30–35), beams and columns ${P.mat.cb} mm to links.`,
      "5. Laps 40Ø in tension, staggered; no laps at points of maximum moment.",
      "6. Slab props to remain until concrete reaches 70% of design strength (min. 14 days for spans > 4 m).",
      "7. Columns are placed in walls — confirm against openings on every floor before casting.",
      "8. Foundations, stairs and ground slab designed separately using the loads on the column schedule.",
      "9. This design was generated with StructDesign and must be checked and signed by a registered engineer.",
    ];
    let y = 120;
    gn.forEach((t, i) => { o.push(T(20, y, t, i ? 2.3 : 2.9, { b: !i })); y += i ? 5.2 : 6.5; });
    // design basis
    const C = D.C;
    const bl = ["DESIGN BASIS", `Load factors: ${C.gG}G + ${C.gQ}Q (pattern: ${C.gGmin}G on unloaded spans)`, `K′ = ${C.Kp}; fyd = ${C.fyd.toFixed(0)} MPa; concrete design stress ${C.fcd.toFixed(1)} MPa`,
      `Columns: braced, effective length factor ${P.beta}; min. size ${P.colMin} mm`, `Max. beam span before an extra column is proposed: ${(P.maxSpan / 1000).toFixed(1)} m`];
    y = 120; bl.forEach((t, i) => { o.push(T(230, y, t, i ? 2.3 : 2.9, { b: !i })); y += i ? 5.2 : 6.5; });
    y += 4; o.push(T(230, y, "LEVELS AND LOADS", 2.9, { b: 1 })); y += 6.5;
    P.levels.forEach(l => { o.push(T(230, y, `${l.name}: slab ${l.h}, finishes ${l.fin}, partitions ${l.part}, qk ${l.qk} kN/m², storey ${l.H} m`, 2.2)); y += 5; });
    return [{ title: "Typical details & notes", body: o.join("") }];
  }

  function all(P, D) {
    const sheets = [];
    D.levels.forEach(L => sheets.push({ title: `${L.lvl.name} framing plan`, svgFn: (no) => framing(P, D, L, no) }));
    if (typeof SECTIONS !== "undefined") for (const s of SECTIONS.extra(P, D)) sheets.push({ title: s.title, svgFn: (no) => frame(P, s.title, no, s.body, "NTS") });
    for (const s of beamSchedule(P, D).concat(slabSchedule(P, D), columnSchedule(P, D), details(P, D)))
      sheets.push({ title: s.title, svgFn: (no) => frame(P, s.title, no, s.body, "NTS") });
    return sheets.map((s, i) => ({ title: s.title, no: `S-${String(i + 1).padStart(2, "0")}`, svg: s.svgFn(`S-${String(i + 1).padStart(2, "0")}`) }));
  }
  return { all, letters };
})();
if (typeof module !== "undefined") module.exports = SHEETS;
