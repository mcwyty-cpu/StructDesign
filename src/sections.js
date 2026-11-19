/* Building sections, beam reinforcement elevations, member cross-sections and 3D isometric sheet */
const SECTIONS = (() => {
  const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const n2 = x => x.toFixed(2);
  const T = (x, y, s, sz = 2.4, o = {}) => `<text x="${n2(x)}" y="${n2(y)}" font-size="${sz}" font-family="Arial,Helvetica,sans-serif"${o.a ? ` text-anchor="${o.a}"` : ""}${o.b ? ` font-weight="bold"` : ""}${o.c ? ` fill="${o.c}"` : ""}${o.r ? ` transform="rotate(${o.r} ${n2(x)} ${n2(y)})"` : ""}>${esc(s)}</text>`;
  const Ln = (x1, y1, x2, y2, w = 0.25, c = "#000", d) => `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}" stroke="${c}" stroke-width="${w}"${d ? ` stroke-dasharray="${d}"` : ""}/>`;
  const Rc = (x, y, w, h, f = "none", s = "#000", sw = 0.25, ex = "") => `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(Math.max(w, 0))}" height="${n2(Math.max(h, 0))}" fill="${f}" stroke="${s}" stroke-width="${sw}" ${ex}/>`;
  const L = i => SHEETS.letters(i);
  const HATCH = `<defs><pattern id="ht" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="#777" stroke-width="0.25"/></pattern>
    <pattern id="earth" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0,3 L3,0" stroke="#8a7a5a" stroke-width="0.3"/></pattern></defs>`;

  function levelsZ(P) { let z = 0; return P.levels.map(l => (z += l.H)); }

  // ------------------------------------------------------------ building section along a grid line
  function section(P, D, dir, line, ox, oy, w, h, label) {
    // dir "x": cut along y-grid line `line`, horizontal axis = x ; dir "y": cut along x-grid line, axis = y
    const ax = dir === "x" ? P.gx : P.gy;
    const zs = levelsZ(P), ztop = zs[zs.length - 1];
    const a0 = ax[0], a1 = ax[ax.length - 1];
    const sc = Math.min((w - 40) / (a1 - a0), (h - 30) / (ztop * 1000 + 2300));
    const X = a => ox + 26 + (a - a0) * sc, Z = z => oy + 6 + (ztop * 1000 + 1100 - z) * sc;
    const o = [];
    o.push(T(ox, oy + 1, label, 3.2, { b: 1 }));
    // ground & foundations
    o.push(Rc(X(a0) - 8, Z(-150), (a1 - a0) * sc + 16, 1100 * sc, "url(#earth)", "none"));
    o.push(Ln(X(a0) - 8, Z(-150), X(a1) + 8, Z(-150), 0.5));
    // ground floor slab
    o.push(Rc(X(a0), Z(0), (a1 - a0) * sc, 150 * sc, "#ddd", "#000", 0.25));
    const cols = D.cols.filter(c => (dir === "x" ? c.j : c.i) === line && c.res);
    for (const c of cols) {
      const pos = dir === "x" ? P.gx[c.i] : P.gy[c.j], b = c.res.b;
      o.push(Rc(X(pos) - 600 * sc, Z(-1200), 1200 * sc, 400 * sc, "#cfcfcf", "#000", 0.3));
      o.push(Rc(X(pos) - b / 2 * sc, Z(ztop * 1000), b * sc, (ztop * 1000 + 800) * sc, "url(#ht)", "#000", 0.3));
      o.push(T(X(pos), Z(-1200) + 3.6, c.name, 1.9, { a: "middle", b: 1, c: "#b00020" }));
    }
    // levels
    D.levels.forEach((Lv, li) => {
      const zt = zs[li] * 1000, PL = Lv.P || P;
      // slab band where a slab cell is on either side of the line
      for (let k = 0; k + 1 < ax.length; k++) {
        const t1 = dir === "x" ? SD.cellT(PL, k, line - 1) : SD.cellT(PL, line - 1, k), t2 = dir === "x" ? SD.cellT(PL, k, line) : SD.cellT(PL, line, k);
        if (t1 === "slab" || t2 === "slab" || t1 === "balcony" || t2 === "balcony") o.push(Rc(X(ax[k]), Z(zt), (ax[k + 1] - ax[k]) * sc, Lv.lvl.h * sc, "#c9c9c9", "#000", 0.2));
      }
      // beams on this line
      for (const r of Lv.runs) {
        if (!r.des) continue;
        if (r.dir === (dir === "x" ? "h" : "v") && r.line === line) {
          const x0 = X(ax[r.a]), x1 = X(ax[r.b]), dh = r.des.h * sc;
          o.push(Rc(x0, Z(zt), x1 - x0, dh, "#e8e2d4", "#000", 0.35));
          o.push(T((x0 + x1) / 2, Z(zt) + dh + 2.6, `${r.mark} ${r.des.bw}×${r.des.h}`, 1.9, { a: "middle", b: 1 }));
        }
        // perpendicular beams cut by the section plane
        if (r.dir === (dir === "x" ? "v" : "h") && r.a <= line && line <= r.b && !(r.a === line || r.b === line)) {
          const pos = ax[r.line];
          o.push(Rc(X(pos) - r.des.bw / 2 * sc, Z(zt), r.des.bw * sc, r.des.h * sc, "#555", "#000", 0.2));
        }
        if (r.dir === (dir === "x" ? "v" : "h") && (r.a === line || r.b === line)) {
          const pos = ax[r.line];
          o.push(Rc(X(pos) - r.des.bw / 2 * sc, Z(zt), r.des.bw * sc, r.des.h * sc, "#555", "#000", 0.2));
        }
      }
      // parapet at roof
      if (Lv.lvl.kind === "roof" && cols.length) {
        const ps = cols.map(c => dir === "x" ? P.gx[c.i] : P.gy[c.j]), e0 = Math.min(...ps), e1 = Math.max(...ps);
        for (const e of [e0, e1]) o.push(Rc(X(e) - 100 * sc, Z(zt + 900), 200 * sc, 900 * sc, "#e8e2d4", "#000", 0.25));
      }
      // level marker
      o.push(Ln(X(a0) - 20, Z(zt), X(a0) - 4, Z(zt), 0.2), T(X(a0) - 20, Z(zt) - 0.8, `${Lv.lvl.name} +${zs[li].toFixed(3)}`, 1.9));
    });
    o.push(Ln(X(a0) - 20, Z(0), X(a0) - 4, Z(0), 0.2), T(X(a0) - 20, Z(0) - 0.8, "GF ±0.000", 1.9), T(X(a0) - 20, Z(-150) + 2.6, "NGL", 1.8));
    // storey dims
    let zp = 0; zs.forEach((z, i) => { const zz = z * 1000; o.push(Ln(X(a0) - 6, Z(zp), X(a0) - 6, Z(zz), 0.2), T(X(a0) - 7, (Z(zp) + Z(zz)) / 2, `${(P.levels[i].H * 1000).toFixed(0)}`, 1.8, { a: "middle", r: -90 })); zp = zz; });
    // grid bubbles
    ax.forEach((v, k) => { o.push(Ln(X(v), Z(-1200) + 5, X(v), Z(-1200) + 8, 0.15, "#888"), `<circle cx="${n2(X(v))}" cy="${n2(Z(-1200) + 11)}" r="2.6" fill="#fff" stroke="#000" stroke-width="0.25"/>`, T(X(v), Z(-1200) + 12, dir === "x" ? L(k) : String(k + 1), 2.3, { a: "middle", b: 1 })); });
    return o.join("");
  }
  function bestLine(P, D, dir) {
    const n = dir === "x" ? P.gy.length : P.gx.length; let best = 0, bc = -1;
    for (let k = 1; k < n - 1; k++) { const c = D.cols.filter(c => (dir === "x" ? c.j : c.i) === k).length; if (c > bc) { bc = c; best = k; } }
    return n > 2 ? best : 0;
  }
  function sectionsSheet(P, D) {
    const jx = bestLine(P, D, "x"), iy = bestLine(P, D, "y");
    const body = HATCH + section(P, D, "x", jx, 14, 14, 395, 122, `SECTION A–A (along grid line ${jx + 1})`) + section(P, D, "y", iy, 14, 140, 395, 122, `SECTION B–B (along grid line ${L(iy)})`);
    return { title: "Building sections", body };
  }

  // ------------------------------------------------------------ cross-section helper (mm on paper)
  function xsec(x, y, bw, h, hf, top, bot, link, sc) {
    const o = [];
    const W = bw * sc, H = h * sc, c = 38 * sc;
    if (hf) o.push(Rc(x - W, y, W * 3, hf * sc, "#ece7da", "none"));
    o.push(Rc(x, y, W, H, "#f4f1ea", "#000", 0.3));
    if (hf) { o.push(Ln(x - W, y, x + 2 * W, y, 0.3), Ln(x - W, y + hf * sc, x, y + hf * sc, 0.3), Ln(x + W, y + hf * sc, x + 2 * W, y + hf * sc, 0.3)); }
    o.push(Rc(x + c, y + c, W - 2 * c, H - 2 * c, "none", "#555", 0.2, 'rx="0.6"'));
    const row = (n, d, yy) => { const r = Math.max(d / 2 * sc, 0.45); for (let k = 0; k < n; k++) { const xx = x + c + r + 0.2 + k * (W - 2 * c - 2 * r - 0.4) / Math.max(n - 1, 1); o.push(`<circle cx="${n2(xx)}" cy="${n2(yy)}" r="${n2(r)}" fill="#c00"/>`); } };
    row(top.n, top.d, y + c + top.d / 2 * sc + 0.2); row(bot.n, bot.d, y + H - c - bot.d / 2 * sc - 0.2);
    return o.join("");
  }

  // ------------------------------------------------------------ beam reinforcement elevations
  function beamElevations(P, D) {
    const items = [];
    for (const Lv of D.levels) for (const r of Lv.runs) if (r.des) items.push({ Lv, r });
    const per = 6, sheets = [];
    for (let s = 0; s * per < items.length; s++) {
      const o = [HATCH, T(14, 17, `BEAM REINFORCEMENT DETAILS${items.length > per ? ` (${s + 1} of ${Math.ceil(items.length / per)})` : ""}`, 4.2, { b: 1 })];
      items.slice(s * per, (s + 1) * per).forEach(({ Lv, r }, k) => {
        const y0 = 26 + k * 40, x0 = 22, Wd = 300, D_ = r.des, Hh = 12;
        const pa = r.dir === "h" ? P.gx : P.gy, a0 = pa[r.a], a1 = pa[r.b], sc = Wd / (a1 - a0);
        const X = v => x0 + (v - a0) * sc;
        o.push(T(x0 - 8, y0 + 1, `${r.mark}`, 3, { b: 1 }), T(x0 + 14, y0 + 1, `${Lv.lvl.name} · ${r.type} · ${D_.bw}×${D_.h} · grid ${r.dir === "h" ? (r.line + 1) : L(r.line)}`, 2.1));
        const yb = y0 + 4;
        o.push(Rc(x0, yb, Wd, Hh, "#f4f1ea", "#000", 0.3), Rc(x0, yb, Wd, Hh * Lv.lvl.h / D_.h, "#e2dccf", "none"));
        // supports
        for (const sp of r.sup) {
          const xp = X(pa[sp.k]);
          if (sp.type === "col") o.push(Rc(xp - 1.4, yb + Hh, 2.8, 5, "url(#ht)", "#000", 0.25), Rc(xp - 1.4, yb - 3, 2.8, 3, "url(#ht)", "#000", 0.25));
          else o.push(`<path d="M${n2(xp)},${n2(yb + Hh)} l-1.6,3 h3.2 z" fill="#555"/>`);
          o.push(T(xp, yb + Hh + 8, sp.type === "col" ? (D.colName[sp.node] || "") : "beam", 1.7, { a: "middle", c: "#b00020" }));
        }
        // bars per element
        r.el.forEach((e, i) => {
          const s0 = D_.spans[i], xa = X(pa[e.k0]), xb = X(pa[e.k1]), Lp = xb - xa;
          o.push(Ln(xa + 0.6, yb + Hh - 1.4, xb - 0.6, yb + Hh - 1.4, 0.6, "#c00"));
          o.push(T((xa + xb) / 2, yb + Hh - 2.2, `${SD.bt(s0.bot)} B`, 1.8, { a: "middle", c: "#c00" }));
          const tl = e.kind === "cantL" ? [xa, xb] : [xa, xa + 0.3 * Lp], tr = e.kind === "cantR" ? [xa, xb] : [xb - 0.3 * Lp, xb];
          if (e.kind !== "cantR") { o.push(Ln(tl[0] + 0.4, yb + 1.4, tl[1], yb + 1.4, 0.6, "#03c")); o.push(T(tl[0] + 0.15 * Lp + 0.5, yb - 0.6, `${SD.bt(s0.topL)} T`, 1.7, { a: "middle", c: "#03c" })); }
          if (e.kind !== "cantL") { o.push(Ln(tr[0], yb + 1.4, tr[1] - 0.4, yb + 1.4, 0.6, "#03c")); o.push(T(tr[1] - 0.15 * Lp - 0.5, yb - 0.6, `${SD.bt(s0.topR)} T`, 1.7, { a: "middle", c: "#03c" })); }
          o.push(Ln(xa, yb + 2.6, xb, yb + 2.6, 0.12, "#03c", "1 0.6"));
          const nl = Math.min(40, Math.round(e.L * 1000 / s0.links.s));
          for (let q = 1; q < nl; q++) { const xx = xa + q * Lp / nl; o.push(Ln(xx, yb + 1, xx, yb + Hh - 1, 0.1, "#777")); }
          o.push(Ln(xa, yb + Hh + 10.5, xb, yb + Hh + 10.5, 0.15), Ln(xa, yb + Hh + 9.5, xa, yb + Hh + 11.5, 0.15), Ln(xb, yb + Hh + 9.5, xb, yb + Hh + 11.5, 0.15));
          o.push(T((xa + xb) / 2, yb + Hh + 10, `${(e.L * 1000).toFixed(0)} · H8@${s0.links.s}`, 1.7, { a: "middle" }));
        });
        // cross sections
        const big = D_.spans.reduce((m, s1) => s1.Mpos > m.Mpos ? s1 : m, D_.spans[0]);
        const sup = D_.spans.reduce((m, s1) => Math.max(s1.MnL, s1.MnR) > Math.max(m.MnL, m.MnR) ? s1 : m, D_.spans[0]);
        const topS = sup.topL.A >= sup.topR.A ? sup.topL : sup.topR;
        const sc2 = 26 / Math.max(D_.h, 450);
        const hf = r.type !== "Rectangular" ? Lv.lvl.h : 0;
        o.push(xsec(345, y0 + 4, D_.bw, D_.h, hf, { n: 2, d: 12 }, big.bot, 8, sc2), T(345 + D_.bw * sc2 / 2, y0 + 4 + D_.h * sc2 + 3, "midspan", 1.7, { a: "middle" }));
        o.push(xsec(380, y0 + 4, D_.bw, D_.h, hf, topS, { n: Math.max(2, big.bot.n), d: big.bot.d }, 8, sc2), T(380 + D_.bw * sc2 / 2, y0 + 4 + D_.h * sc2 + 3, "support", 1.7, { a: "middle" }));
        o.push(Ln(14, y0 + 37, 412, y0 + 37, 0.1, "#bbb"));
      });
      o.push(T(14, 264, "Top bars extend 0.3 L from each support face (full length on cantilevers); bottom bars full span, lapped 40Ø at supports; links H8 2-leg closed, first link 50 from face. Vertical scale exaggerated.", 1.9));
      sheets.push({ title: "Beam reinforcement details" + (items.length > per ? ` ${s + 1}` : ""), body: o.join("") });
    }
    return sheets;
  }

  // ------------------------------------------------------------ 3D isometric (vector)
  function boxes(P, D) {
    const B = [], zs = levelsZ(P).map(z => z * 1000);
    const top = zs[zs.length - 1];
    for (const c of D.cols) if (c.res) { const b = c.res.b; B.push({ x0: c.x - b / 2, x1: c.x + b / 2, y0: c.y - b / 2, y1: c.y + b / 2, z0: 0, z1: top, col: [120, 120, 125], kind: "col" }); }
    D.levels.forEach((Lv, li) => {
      const zt = zs[li], PL = Lv.P || P;
      for (const r of Lv.runs) if (r.des) {
        const bw = r.des.bw, h = r.des.h;
        if (r.dir === "h") B.push({ x0: P.gx[r.a], x1: P.gx[r.b], y0: P.gy[r.line] - bw / 2, y1: P.gy[r.line] + bw / 2, z0: zt - h, z1: zt - Lv.lvl.h, col: [196, 160, 110], kind: "beam" });
        else B.push({ x0: P.gx[r.line] - bw / 2, x1: P.gx[r.line] + bw / 2, y0: P.gy[r.a], y1: P.gy[r.b], z0: zt - h, z1: zt - Lv.lvl.h, col: [196, 160, 110], kind: "beam" });
      }
      for (const p of Lv.panels) if (p.d) B.push({ x0: p.x0, x1: p.x1, y0: p.y0, y1: p.y1, z0: zt - p.d.h, z1: zt, col: p.kind === "cant" ? [150, 140, 220] : [170, 195, 225], kind: "slab", op: 0.92 });
    });
    return B;
  }
  function iso(P, D, ox, oy, w, h) {
    const B = boxes(P, D);
    const c30 = Math.cos(Math.PI / 6), s30 = 0.5;
    const pr = (x, y, z) => [(x - y) * c30, (x + y) * s30 - z];
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    for (const b of B) for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) { const [u, v] = pr(x, y, z); mnx = Math.min(mnx, u); mxx = Math.max(mxx, u); mny = Math.min(mny, v); mxy = Math.max(mxy, v); }
    const sc = Math.min(w / (mxx - mnx), h / (mxy - mny));
    const S = (x, y, z) => { const [u, v] = pr(x, y, z); return [ox + (u - mnx) * sc + (w - (mxx - mnx) * sc) / 2, oy + (v - mny) * sc]; };
    // painter: far first (smaller x+y), lower first
    B.sort((a, b) => ((a.x0 + a.x1 + a.y0 + a.y1) / 2 - (b.x0 + b.x1 + b.y0 + b.y1) / 2) || (a.z0 - b.z0));
    B.sort((a, b) => (a.kind === "slab") - (b.kind === "slab") || 0);
    const items = B.map(b => ({ b, d: (b.x1 + b.y1) + b.z1 * 0.2 }));
    items.sort((a, c) => a.d - c.d);
    const o = [];
    const poly = (pts, rgb, f, op = 1) => `<polygon points="${pts.map(p => p.map(n2).join(",")).join(" ")}" fill="rgb(${rgb.map(v => Math.round(v * f)).join(",")})" fill-opacity="${op}" stroke="#333" stroke-width="0.12"/>`;
    for (const { b } of items) {
      const { x0, x1, y0, y1, z0, z1, col } = b, op = b.op || 1;
      o.push(poly([S(x0, y1, z0), S(x1, y1, z0), S(x1, y1, z1), S(x0, y1, z1)], col, 0.78, op)); // front (y1)
      o.push(poly([S(x1, y0, z0), S(x1, y1, z0), S(x1, y1, z1), S(x1, y0, z1)], col, 0.62, op)); // right (x1)
      o.push(poly([S(x0, y0, z1), S(x1, y0, z1), S(x1, y1, z1), S(x0, y1, z1)], col, 1.0, op)); // top
    }
    return o.join("");
  }
  function iso3dSheet(P, D) {
    const body = T(14, 17, "3D VIEW OF THE STRUCTURAL FRAME (isometric)", 4.2, { b: 1 }) + iso(P, D, 20, 26, 300, 232) +
      Rc(330, 30, 78, 50, "#fff", "#999", 0.2) + T(334, 37, "LEGEND", 2.6, { b: 1 }) +
      Rc(334, 41, 8, 4, "rgb(120,120,125)", "#333", 0.15) + T(345, 44.2, "columns", 2.1) +
      Rc(334, 48, 8, 4, "rgb(196,160,110)", "#333", 0.15) + T(345, 51.2, "beams (downstand)", 2.1) +
      Rc(334, 55, 8, 4, "rgb(170,195,225)", "#333", 0.15) + T(345, 58.2, "slabs", 2.1) +
      Rc(334, 62, 8, 4, "rgb(150,140,220)", "#333", 0.15) + T(345, 65.2, "cantilever balconies", 2.1) +
      T(334, 74, "Foundations and stairs not shown.", 1.8) + T(334, 77.5, "Interactive 3D in the app (tab 6).", 1.8);
    return { title: "3D view", body };
  }

  // ------------------------------------------------------------ slab sections
  function slabSections(P, D) {
    const o = [HATCH, T(14, 17, "SLAB AND CANTILEVER SECTIONS", 4.2, { b: 1 })];
    const list = [];
    for (const Lv of D.levels) for (const p of Lv.panels) if (p.d) list.push({ Lv, p });
    const pick = list.filter(x => x.p.kind !== "cant").slice(0, 4).concat(list.filter(x => x.p.kind === "cant").slice(0, 2));
    pick.forEach(({ Lv, p }, k) => {
      const x0 = 20 + (k % 2) * 200, y0 = 32 + Math.floor(k / 2) * 76, R = p.d.rows, h = p.d.h;
      const sc = 0.035, len = 160, H = Math.max(h * sc * 4, 6);
      o.push(T(x0, y0 - 4, `${p.mark} (${Lv.lvl.name}) — ${p.cls}`.slice(0, 80), 2.2, { b: 1 }));
      if (p.kind === "cant") {
        o.push(Rc(x0, y0, len * 0.6, H, "#f4f1ea", "#000", 0.3), `<path d="M${x0 + len * 0.6},${y0} L${x0 + len},${y0} L${x0 + len},${y0 + H * 0.75} L${x0 + len * 0.6},${y0 + H} Z" fill="#f4f1ea" stroke="#000" stroke-width="0.3"/>`);
        o.push(Rc(x0 + len * 0.6 - 6, y0 + H, 12, 18, "url(#ht)", "#000", 0.3));
        o.push(Ln(x0 + 6, y0 + 1.2, x0 + len - 1.5, y0 + 1.2, 0.6, "#03c"), T(x0 + len * 0.4, y0 - 0.8, `T ${SD.st(R.sxn.bars)} (anchor ≥ 1.5×${p.Lc.toFixed(2)} m)`, 1.9, { a: "middle", c: "#03c" }));
        o.push(Ln(x0 + 2, y0 + H - 1.2, x0 + len - 2, y0 + H * 0.75 - 1.2, 0.4, "#c00"), T(x0 + len * 0.8, y0 + H + 4, `B ${SD.st(R.syp.bars)} · dist. ${SD.st(R.syn.bars)} · h = ${h}→150`, 1.9, { a: "middle", c: "#c00" }));
      } else {
        o.push(Rc(x0, y0, len, H, "#f4f1ea", "#000", 0.3));
        [0, len].forEach(xx => o.push(Rc(x0 + xx - 4, y0 + H, 8, 14, "url(#ht)", "#000", 0.3)));
        const main = p.shortAlongX !== false ? R.sxp : R.syp;
        o.push(Ln(x0 + 1.5, y0 + H - 1.2, x0 + len - 1.5, y0 + H - 1.2, 0.6, "#c00"), T(x0 + len / 2, y0 + H + 4, `B ${SD.st(R.sxp.bars)} (short span) · ${SD.st(R.syp.bars)} (long span) · h = ${h}`, 1.9, { a: "middle", c: "#c00" }));
        const top = [R.sxn, R.syn].filter(x => x && x.bars).sort((a, b) => b.bars.A - a.bars.A)[0];
        const tl = 0.3 * len;
        o.push(Ln(x0 - 6, y0 + 1.2, x0 + tl, y0 + 1.2, 0.6, "#03c"), Ln(x0 + len - tl, y0 + 1.2, x0 + len + 6, y0 + 1.2, 0.6, "#03c"));
        if (top) o.push(T(x0 + len / 2, y0 - 0.8, `T ${SD.st(top.bars)} over supports, 0.3 lx each side`, 1.9, { a: "middle", c: "#03c" }));
        o.push(T(x0 + len / 2, y0 + H + 22, `lx = ${p.lx.toFixed(2)} m · cover ${P.mat.cs} mm`, 1.8, { a: "middle" }));
      }
    });
    // column section with laps
    o.push(T(20, 262, "Short-span bars in the outer layer. At discontinuous edges provide top bars ≥ 50% of midspan steel over 0.15 lx. Vertical scale exaggerated.", 1.9));
    return { title: "Slab sections", body: o.join("") };
  }

  function extra(P, D) {
    return [sectionsSheet(P, D), ...beamElevations(P, D), slabSections(P, D), iso3dSheet(P, D)];
  }
  return { extra, boxes, levelsZ };
})();
if (typeof module !== "undefined") module.exports = SECTIONS;
