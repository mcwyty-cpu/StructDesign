/* Calculation sheets: step-by-step workings for every slab, beam and column.
   Output is a list of blocks: {h:"Heading"} | {sub:"Sub-heading"} | {ref, txt, out, ok} */
const CALC = (() => {
  const f = (x, n = 2) => (x == null || !isFinite(x)) ? "–" : Number(x).toFixed(n);
  const f0 = x => f(x, 0), f1 = x => f(x, 1), f3 = x => f(x, 3);
  const st = SD.st, bt = SD.bt;

  function basis(P, C) {
    const ec = C.ec, B = [];
    B.push({ h: "DESIGN BASIS" });
    B.push({ ref: ec ? "BS EN 1990" : "BS 8110-1", txt: ec ? `Design to BS EN 1992-1-1 with UK National Annex values. ULS load combination eq. 6.10: ${C.gG}Gk + ${C.gQ}Qk; pattern loading ${C.gGmin}Gk on unloaded spans.` : `Design to BS 8110-1:1997 (Amd 3). Load factors ${C.gG}Gk + ${C.gQ}Qk; ${C.gGmin}Gk on unloaded spans.`, out: "" });
    if (ec) {
      B.push({ ref: "3.1.6", txt: `Concrete C${P.mat.fck}: fcd = αcc fck/γc = 0.85 × ${P.mat.fck}/1.5`, out: `fcd = ${f(C.fcd)} MPa` });
      B.push({ ref: "3.1.2", txt: `fctm = 0.3 fck^(2/3) = 0.3 × ${P.mat.fck}^(2/3)`, out: `fctm = ${f(C.fctm)} MPa` });
      B.push({ ref: "3.2.7", txt: `Reinforcement B${P.mat.fyk}: fyd = fyk/γs = ${P.mat.fyk}/1.15`, out: `fyd = ${f1(C.fyd)} MPa` });
      B.push({ ref: "5.5", txt: "Limit for singly reinforced section without redistribution", out: "K′ = 0.167" });
    } else {
      B.push({ ref: "3.4.4.4", txt: `Concrete fcu = ${P.mat.fcu} MPa; stress block 0.45 fcu over 0.9x`, out: `0.45fcu = ${f(C.fcd)} MPa` });
      B.push({ ref: "2.4.4.1", txt: `Reinforcement fy = ${P.mat.fy} MPa, γm = 1.15 → 0.87fy`, out: `${f1(C.fyd)} MPa` });
      B.push({ ref: "3.4.4.4", txt: "Limit for singly reinforced section (≤10% redistribution)", out: "K′ = 0.156" });
    }
    B.push({ ref: "4.4.1", txt: `Nominal cover: slabs ${P.mat.cs} mm (roof/balconies ≥ 30–35), beams and columns ${P.mat.cb} mm`, out: "" });
    for (const l of P.levels) B.push({ ref: "", txt: `${l.name}: slab ${l.h} mm; finishes ${l.fin}, partitions ${l.part}, qk ${l.qk} kN/m²; walls on beams ${l.kind === "roof" ? `parapet ${l.ext}` : `ext ${l.ext} / int ${l.int}`} kN/m; storey ${l.H} m`, out: "" });
    return B;
  }

  // ------------------------------------------------------------------ flexure lines (shared)
  function flexLines(C, label, M, b, d, ref) {
    const B = [];
    if (M <= 0) { B.push({ ref, txt: `${label}: M = 0`, out: "nominal steel" }); return B; }
    const r = SD.flex(C, M, b, d);
    if (C.ec) {
      B.push({ ref: ref || "6.1", txt: `${label}: K = M/(b d² fck) = ${f1(M)}×10⁶ / (${f0(b)} × ${f0(d)}² × ${C.fck})`, out: `K = ${f3(r.K)} ${r.K <= C.Kp ? "≤" : ">"} K′`, ok: r.K <= C.Kp });
      B.push({ ref: "", txt: `z = d/2 [1 + √(1 − 3.53K)] ≤ 0.95d`, out: `z = ${f0(r.z)} mm` });
      B.push({ ref: "", txt: `As = M/(fyd z) = ${f1(M)}×10⁶ / (${f1(C.fyd)} × ${f0(r.z)})`, out: `As,req = ${f0(r.As)} mm²` });
    } else {
      B.push({ ref: ref || "3.4.4.4", txt: `${label}: K = M/(b d² fcu) = ${f1(M)}×10⁶ / (${f0(b)} × ${f0(d)}² × ${C.fcu})`, out: `K = ${f3(r.K)} ${r.K <= C.Kp ? "≤" : ">"} K′`, ok: r.K <= C.Kp });
      B.push({ ref: "", txt: `z = d[0.5 + √(0.25 − K/0.9)] ≤ 0.95d`, out: `z = ${f0(r.z)} mm` });
      B.push({ ref: "", txt: `As = M/(0.87 fy z) = ${f1(M)}×10⁶ / (${f1(C.fyd)} × ${f0(r.z)})`, out: `As,req = ${f0(r.As)} mm²` });
    }
    return B;
  }

  // ------------------------------------------------------------------ slab
  function slab(P, C, L, p) {
    const B = [{ h: `SLAB ${p.mark} — ${L.lvl.name}` }];
    const d = p.d;
    if (!d) { B.push({ ref: "", txt: p.cls, out: "REVISE", ok: false }); return B; }
    B.push({ sub: "Geometry and classification" });
    B.push({ ref: "", txt: `Panel between grid lines: ${f(p.Lx)} m (x) × ${f(p.Ly)} m (y)` + (p.irregular ? " — irregular shape, designed on its bounding rectangle" : ""), out: "" });
    if (p.kind === "cant") {
      B.push({ ref: "", txt: `Supported on one edge (${p.supSide}); projection Lc = ${f(p.Lc)} m`, out: "CANTILEVER" });
    } else {
      B.push({ ref: "", txt: `lx = ${f(p.lx)} m, ly = ${f(p.ly)} m, ly/lx = ${f(p.ratio)} ${p.ratio > 2 ? "> 2 → spans one way" : "≤ 2 → spans two ways"}`, out: p.kind === "one" ? "ONE-WAY" : "TWO-WAY" });
      const ed = s => p.sides[s].cont ? "continuous" : "discontinuous";
      B.push({ ref: "", txt: `Edges: top ${ed("top")}, bottom ${ed("bottom")}, left ${ed("left")}, right ${ed("right")} → ${p.ns} short and ${p.nl} long edge(s) discontinuous`, out: p.simpleFlag ? "SIMPLE" : "CONTINUOUS" });
      B.push({ ref: "", txt: `Classification: ${p.cls}`, out: "" });
    }
    B.push({ sub: "Loading" });
    B.push({ ref: "", txt: `Self-weight ${d.h} mm × 25 kN/m³ = ${f(d.h / 1000 * 25)}; finishes ${L.lvl.fin}${p.kind === "cant" ? "" : `; partitions ${L.lvl.part}`} kN/m²`, out: `gk = ${f(d.gk)} kN/m²` });
    B.push({ ref: "", txt: `Imposed load${p.kind === "cant" ? " (balcony, min 2.5)" : ""}`, out: `qk = ${f(d.qk)} kN/m²` });
    B.push({ ref: C.ec ? "Eq 6.10" : "Table 2.1", txt: `n = ${C.gG} × ${f(d.gk)} + ${C.gQ} × ${f(d.qk)}`, out: `n = ${f(d.n)} kN/m²` });
    B.push({ sub: "Design moments" });
    const R = d.rows, lx = p.kind === "cant" ? p.Lc : p.lx;
    if (p.kind === "cant") {
      B.push({ ref: "", txt: `M = n Lc²/2 + ${C.gG}×${P.balu}×Lc (balustrade) + ${C.gQ}×0.74×1.1 (horizontal load) = ${f(d.n)}×${f(lx)}²/2 + …`, out: `M = ${f(R.sxn.M)} kNm/m` });
    } else if (p.kind === "one") {
      const cp = [0.125, 0.086, 0.063][p.pos1 - 1], cn = [0, 0.086, 0.063][p.pos1 - 1];
      B.push({ ref: "Table 3.12", txt: `Span coefficient ${cp}, support coefficient ${cn} (${["single span", "end span", "interior span"][p.pos1 - 1]})`, out: "" });
      B.push({ ref: "", txt: `M = coef × n × lx² = ${cp} × ${f(d.n)} × ${f(lx)}²`, out: `M+ = ${f(R.sxp.M)} kNm/m` });
      if (cn) B.push({ ref: "", txt: `M− = ${cn} × ${f(d.n)} × ${f(lx)}²`, out: `M− = ${f(R.sxn.M)} kNm/m` });
    } else if (p.simple) {
      B.push({ ref: "Table 3.13", txt: `Simply supported: αsx = r⁴/[8(1+r⁴)], αsy = r²/[8(1+r⁴)], r = ${f(Math.min(p.ratio, 2))}`, out: "" });
      B.push({ ref: "", txt: `Msx = αsx n lx² ; Msy = αsy n lx²`, out: `Msx = ${f(R.sxp.M)}, Msy = ${f(R.syp.M)} kNm/m` });
    } else {
      const c = p.case - 1, T = SD.T314;
      B.push({ ref: "Table 3.14", txt: `Case ${p.case} (${T.names[c]}), ly/lx = ${f(p.ratio)}: βsx− = ${f3(SD.interp(p.ratio, T.neg[c]))}, βsx+ = ${f3(SD.interp(p.ratio, T.pos[c]))}, βsy− = ${f3(T.negL[c])}, βsy+ = ${f3(T.posL[c])}`, out: "" });
      B.push({ ref: "", txt: `M = β n lx² with n lx² = ${f(d.n)} × ${f(lx)}² = ${f(d.n * lx * lx)}`, out: `Msx+ ${f(R.sxp.M)} · Msx− ${f(R.sxn.M)} · Msy+ ${f(R.syp.M)} · Msy− ${f(R.syn.M)}` });
    }
    B.push({ sub: "Reinforcement (per metre width)" });
    B.push({ ref: "", txt: `d (outer layer) = h − c − Ø/2 = ${d.h} − ${C.ec || true ? (d.h - d.d1 - 5) : ""} − 5`, out: `dx = ${d.d1} mm, dy = ${d.d2} mm` });
    const names = { sxp: "Short span, midspan (bottom)", sxn: p.kind === "cant" ? "Cantilever root (top)" : "Short span, support (top)", syp: p.kind === "cant" ? "Bottom (nominal)" : "Long span, midspan (bottom)", syn: p.kind === "cant" ? "Distribution (top)" : "Long span, support (top)" };
    for (const k of ["sxp", "sxn", "syp", "syn"]) {
      const r = R[k]; if (!r) continue;
      if (r.M > 0) B.push(...flexLines(C, names[k], r.M, 1000, r.d));
      else B.push({ ref: "", txt: `${names[k]}: no design moment — minimum / distribution steel`, out: "" });
      if (r.Ad > 0) B.push({ ref: C.ec ? "9.2.1.1" : "Table 3.25", txt: `As,min = ${C.ec ? `max(0.26 fctm/fyk bd, 0.0013bd)` : "0.13% bh"}; provide ≥ ${f0(r.Ad)} mm²/m`, out: `${st(r.bars)} (${f0(r.bars.A)} mm²/m)`, ok: r.bars.A >= r.Ad - 0.5 });
    }
    B.push({ sub: "Deflection" });
    B.push({ ref: C.ec ? "7.4.2" : "3.4.6", txt: `Allowable span/depth (basic ratio × modification factors for steel stress / As,prov/As,req)`, out: `${d.ldAllow > 60 ? ">60" : f1(d.ldAllow)}` });
    B.push({ ref: "", txt: `Actual L/d = ${f0(lx * 1000)}/${d.d1}`, out: `${f1(d.ldAct)} ${d.ldAct <= d.ldAllow ? "≤ allowable ✔" : "> allowable ✘"}`, ok: d.ldAct <= d.ldAllow });
    if (p.note) B.push({ ref: "", txt: `Slab ${p.note}`, out: "" });
    B.push({ sub: "Shear" });
    B.push({ ref: C.ec ? "6.2.2" : "3.5.5", txt: `VEd ≈ coef × n × l = ${f1(d.V)} kN/m; concrete resistance ${C.ec ? "VRd,c" : "vc·b·d"}`, out: `${f1(d.V)} ≤ ${f1(d.VRc)} kN/m ${d.V <= d.VRc ? "✔" : "✘"}`, ok: d.V <= d.VRc });
    B.push({ ref: "", txt: "RESULT", out: p.status, ok: p.status !== "REVISE" });
    return B;
  }

  // ------------------------------------------------------------------ beam
  function beam(P, C, L, r) {
    const B = [{ h: `BEAM ${r.mark} — ${L.lvl.name}` }];
    if (!r.des) { B.push({ ref: "", txt: r.warn.join("; "), out: "REVISE", ok: false }); return B; }
    const D = r.des;
    const pa = r.dir === "h" ? P.gx : P.gy;
    B.push({ sub: "Arrangement" });
    B.push({ ref: "", txt: `${r.dir === "h" ? "Along x" : "Along y"} on grid ${r.dir === "h" ? (r.line + 1) : SHEETS.letters(r.line)}; supports: ${r.sup.map(s => s.type === "col" ? "column" : "beam").join(", ")}; total length ${f(r.L)} m`, out: `${D.bw} × ${D.h} mm` });
    B.push({ ref: "", txt: `Slab on ${r.type === "T-beam" ? "both sides" : r.type === "L-beam" ? "one side" : "neither side"}`, out: r.type.toUpperCase() });
    B.push({ sub: "Loading per element (characteristic)" });
    const sw = D.bw / 1000 * (D.h - L.lvl.h) / 1000 * 25;
    B.push({ ref: "", txt: `Self-weight of downstand = ${D.bw/1000} × ${((D.h - L.lvl.h) / 1000).toFixed(3)} × 25`, out: `${f(sw)} kN/m` });
    D.spans.forEach((s, i) => {
      const e = r.el[i];
      const pts = e.pts.length ? `; point loads ${e.pts.map(p => `${f1(p.G)}/${f1(p.Q)} kN at ${f(p.a)} m from ${p.from}`).join(", ")}` : "";
      B.push({ ref: "", txt: `${s.kind === "span" ? "Span" : "Cantilever"} ${i + 1} (L = ${f(s.L)} m): slab + walls ${f(e.g)} + self-weight ${f(sw)}${pts}`, out: `gk ${f(s.g)} · qk ${f(s.q)} kN/m` });
    });
    B.push({ sub: "Analysis" });
    B.push({ ref: C.ec ? "5.1.3" : "3.2.1.2", txt: `Continuous beam by stiffness method on knife-edge supports; load patterns: all spans ${C.gG}G+${C.gQ}Q, alternate spans and adjacent pairs with ${C.gGmin}G elsewhere`, out: "" });
    D.spans.forEach((s, i) => B.push({ ref: "", txt: `${s.kind === "span" ? "Span" : "Cantilever"} ${i + 1}: max sagging, hogging at left / right support, max shear`, out: `M+ ${f1(s.Mpos)} · M− ${f1(s.MnL)}/${f1(s.MnR)} kNm · V ${f1(s.V)} kN` }));
    B.push({ ref: "", txt: `Support reactions Gk / Qk: ${D.an.RG.map((g, k) => `${f1(g)}/${f1(D.an.RQ[k])}`).join(" · ")}`, out: "kN" });
    B.push({ sub: "Section design" });
    B.push({ ref: "", txt: `d = h − cover − link − Ø/2 = ${D.h} − ${P.mat.cb} − 8 − 10`, out: `d = ${D.d} mm` });
    D.spans.forEach((s, i) => {
      B.push({ ref: "", txt: `— ${s.kind === "span" ? "Span" : "Cantilever"} ${i + 1}`, out: "" });
      if (s.Mpos > 0 && s.kind === "span") {
        if (r.type !== "Rectangular") {
          B.push({ ref: C.ec ? "5.3.2.1" : "3.4.1.5", txt: C.ec ? `beff = bw + Σ min(0.2bi + 0.1l0, 0.2l0, bi); l0 = ${f0(s.l0)} mm, b1 = ${f0(s.b1)}, b2 = ${f0(s.b2)}` : `b = bw + lz/${r.type === "T-beam" ? 5 : 10}; lz = ${f0(s.l0)} mm`, out: `beff = ${f0(s.bf)} mm` });
          const Mf = (C.ec ? 0.567 * C.fck : 0.45 * C.fcu) * s.bf * s.hf * (D.d - s.hf / 2) / 1e6;
          B.push({ ref: "", txt: `Flange capacity Mf = ${C.ec ? "0.567fck" : "0.45fcu"} beff hf (d − hf/2) = ${f1(Mf)} kNm ${s.Mpos <= Mf ? "≥ M → neutral axis in flange" : "< M → flanged equation"}`, out: "" });
          if (s.Mpos <= Mf) B.push(...flexLines(C, "Sagging", s.Mpos, s.bf, D.d));
          else B.push({ ref: C.ec ? "Concise EC2" : "Eq 1", txt: `As = [M + 0.1${C.ec ? "fck" : "fcu"} bw d (${C.ec ? "0.36" : "0.45"}d − hf)] / [${C.ec ? "fyd" : "0.87fy"} (d − 0.5hf)]`, out: `As,req = ${f0(s.As)} mm²` });
        } else B.push(...flexLines(C, "Sagging", s.Mpos, D.bw, D.d));
      }
      B.push({ ref: "", txt: `Bottom bars`, out: `${bt(s.bot)} (${f0(s.bot.A)} mm²)${s.bot.layers > 1 ? " 2 layers" : ""}`, ok: true });
      if (s.MnL > 0) B.push(...flexLines(C, "Hogging, left support", s.MnL, D.bw, D.d));
      B.push({ ref: "", txt: `Top bars, left support`, out: `${bt(s.topL)} (${f0(s.topL.A)} mm²)` });
      if (s.MnR > 0) B.push(...flexLines(C, "Hogging, right support", s.MnR, D.bw, D.d));
      B.push({ ref: "", txt: `Top bars, right support`, out: `${bt(s.topR)} (${f0(s.topR.A)} mm²)` });
      if (C.ec) {
        const z = 0.9 * D.d, nu1 = 0.6 * (1 - C.fck / 250);
        const Vm = D.bw * z * nu1 * C.fck / 1.5 / 2.9 / 1000;
        B.push({ ref: "6.2.3", txt: `Shear: VEd = ${f1(s.V)} kN; VRd,max (cotθ = 2.5) = bw z ν1 fcd/(cotθ+tanθ) = ${f1(Vm)} kN; VRd,c = ${f1(s.links.VRc)} kN`, out: "" });
        B.push({ ref: "6.2.3(3)", txt: `Asw/s = VEd/(z fywd cotθ) ≥ 0.08√fck bw/fywk → H8 2-leg (101 mm²)`, out: `links @ ${s.links.s} mm`, ok: s.links.ok });
      } else {
        const v = s.V * 1000 / (D.bw * D.d);
        B.push({ ref: "3.4.5", txt: `Shear: v = V/(bd) = ${f(v)} MPa; vc = ${f(s.links.VRc * 1000 / (D.bw * D.d))} MPa; Asv/sv = ${v <= s.links.VRc * 1000 / (D.bw * D.d) + 0.4 ? "0.4b/0.87fyv" : "b(v − vc)/0.87fyv"}`, out: `H8 2-leg @ ${s.links.s} mm`, ok: s.links.ok });
      }
      B.push({ ref: C.ec ? "7.4.2" : "3.4.6", txt: `Deflection (${{ ss: "simply supported", end: "end span", int: "interior span", cant: "cantilever" }[s.dk]}): allowable L/d ${f1(s.ldA)}, actual ${f1(s.ldC)}`, out: s.ldC <= s.ldA ? "✔" : "✘", ok: s.ldC <= s.ldA });
    });
    for (const w of r.warn) B.push({ ref: "", txt: "Note: " + w, out: "CHECK", ok: false });
    B.push({ ref: "", txt: "RESULT", out: r.status, ok: r.status !== "REVISE" });
    return B;
  }

  // ------------------------------------------------------------------ column
  function column(P, C, D, c) {
    const B = [{ h: `COLUMN ${c.name} — grid ${SHEETS.letters(c.i)}/${c.j + 1}` }];
    if (!c.res) { B.push({ ref: "", txt: "No section up to 600 × 600 satisfies the checks — add columns or beams", out: "REVISE", ok: false }); return B; }
    const b = c.res.b;
    B.push({ ref: "", txt: `Square section b = h = ${b} mm, braced; effective length factor β = ${P.beta}`, out: `${b} × ${b}` });
    c.res.des.forEach((d, k) => {
      B.push({ sub: `Storey below ${d.level} (height ${d.H} m)` });
      B.push({ ref: "", txt: `Loads from beams above (cumulative) Gk ${f1(d.Gbeams)} + self-weight ${f1(d.sw)}; Qk ${f1(d.Qk)}`, out: `Gk ${f1(d.Gk)} · Qk ${f1(d.Qk)} kN` });
      B.push({ ref: "", txt: `NEd = ${C.gG} × ${f1(d.Gk)} + ${C.gQ} × ${f1(d.Qk)}`, out: `NEd = ${f0(d.N)} kN` });
      B.push({ ref: "", txt: `End moments from beams (sub-frame share of out-of-balance FEM): Mx = ${f1(d.Mx)}, My = ${f1(d.My)} kNm`, out: "" });
      B.push({ ref: C.ec ? "5.8.3.2" : "3.8.1.6", txt: `l0 = β × l = ${P.beta} × ${d.H}`, out: `l0 = ${f(d.l0)} m` });
      for (const [nm, a] of [["x", d.ax], ["y", d.ay]]) {
        if (C.ec) {
          B.push({ ref: "5.8.3.1", txt: `Axis ${nm}: λ = l0√12/h = ${f1(a.lam)}; n = NEd/(Ac fcd) = ${f3(a.n)}; ω = ${f3(a.om)}; λlim = 20ABC/√n (A = 0.7, B = √(1+2ω), C = 0.7)`, out: `λlim = ${f1(a.lamlim)} → ${a.slender ? "LONG (slender)" : "SHORT"}` });
          B.push({ ref: "5.2 / 6.1(4)", txt: `M0 = M + NEd·ei (ei = l0/400 = ${f1(a.ei)} mm); minimum NEd·e0 (e0 = ${f1(a.e0)} mm)`, out: `M0 = ${f1(a.M0)} kNm` });
          if (a.slender) B.push({ ref: "5.8.8", txt: `Nominal curvature: Kr = ${f3(a.Kr)}, Kφ = ${f3(a.Kf)}, e2 = Kr Kφ (fyd/Es)/(0.45d) · l0²/10 = ${f1(a.e2)} mm`, out: `M2 = ${f1(a.M2)} kNm` });
        } else {
          B.push({ ref: "3.8.1.3", txt: `Axis ${nm}: le/h = ${f(d.l0 * 1000)}/${b} = ${f(a.lam)} ${a.slender ? "≥" : "<"} 15 (braced)`, out: a.slender ? "LONG (slender)" : "SHORT" });
          if (a.slender) B.push({ ref: "3.8.3", txt: `Madd = N au, au = βa K h; βa = (le/b)²/2000, K = (Nuz − N)/(Nuz − Nbal) = ${f3(a.K)}`, out: `Madd = ${f1(a.M2)} kNm` });
          B.push({ ref: "3.8.2.4", txt: `Minimum eccentricity emin = min(0.05h, 20) = ${f1(a.emin)} mm`, out: "" });
        }
        B.push({ ref: "", txt: `Design moment about ${nm}`, out: `MEd,${nm} = ${f1(a.MEd)} kNm` });
      }
      B.push({ ref: "", txt: `Bars checked: ${d.checkedBars} (${d.perFace} per face, Aface = ${f0(d.Af)} mm²); strain-compatibility MRd at NEd`, out: `MRd = ${f1(d.MRd)} kNm` });
      if (C.ec) B.push({ ref: "5.8.9", txt: `Biaxial: (MEd,x/MRd)^a + (MEd,y/MRd)^a, NEd/NRd = ${f3(d.N / d.NRd)} → a = ${f(d.aExp)}`, out: `${f3(d.util)} ${d.util <= 1 ? "≤ 1 ✔" : "✘"}`, ok: d.util <= 1 });
      else B.push({ ref: "3.8.4.5", txt: `Biaxial: M′ = M_major + β M_minor, β = ${f3(d.betaB)} (N/bhfcu = ${f3(d.nr)}) → M′ = ${f1(d.Mp)} kNm`, out: `M′/MRd = ${f3(d.util)} ${d.util <= 1 ? "✔" : "✘"}`, ok: d.util <= 1 });
      B.push({ ref: C.ec ? "9.5.2" : "3.12.5", txt: `Steel ${d.nb}H${d.phi} = ${f0(d.Ast)} mm² (${f(100 * d.Ast / (b * b))}%)` + (d.unified ? " — heaviest arrangement used in every storey (bars run continuously)" : ""), out: `${d.nb}H${d.phi}` });
    });
    const phi = c.res.des[0].phi;
    B.push({ ref: C.ec ? "9.5.3" : "3.12.7", txt: `Links Ø ≥ max(6, Ø/4); spacing ≤ ${C.ec ? "min(20Ø, b, 400)" : "12Ø"}; 0.6× within 400 of beams and at laps`, out: `H8 @ ${Math.floor(Math.min(C.ec ? 20 * phi : 12 * phi, b, 400) / 25) * 25}` });
    B.push({ ref: "", txt: "RESULT", out: c.status, ok: c.status !== "REVISE" });
    return B;
  }

  function all(P, D) {
    const C = D.C, out = [{ id: "basis", title: "Design basis", blocks: basis(P, C) }];
    for (const L of D.levels) {
      for (const p of L.panels) out.push({ id: "s-" + p.mark, title: `Slab ${p.mark} (${L.lvl.name})`, blocks: slab(P, C, L, p), status: p.status });
      for (const r of L.runs) out.push({ id: "b-" + r.mark, title: `Beam ${r.mark} (${L.lvl.name})`, blocks: beam(P, C, L, r), status: r.status });
    }
    for (const c of D.cols) out.push({ id: "c-" + c.name, title: `Column ${c.name}`, blocks: column(P, C, D, c), status: c.status });
    return out;
  }

  // HTML rendering
  const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  function html(sec) {
    let h = `<table class="calc"><tr><th class="ref">Ref.</th><th>Calculation</th><th class="out">Output</th></tr>`;
    for (const b of sec.blocks) {
      if (b.h) h += `<tr class="ch"><td colspan="3">${esc(b.h)}</td></tr>`;
      else if (b.sub) h += `<tr class="cs"><td></td><td colspan="2">${esc(b.sub)}</td></tr>`;
      else h += `<tr><td class="ref">${esc(b.ref)}</td><td>${esc(b.txt)}</td><td class="out ${b.ok === false ? "bad" : (b.ok ? "good" : "")}">${esc(b.out)}</td></tr>`;
    }
    return h + "</table>";
  }

  // jsPDF core fonts are WinAnsi only: map the remaining symbols to plain text
  const MAP = { "≤": "<=", "≥": ">=", "√": "sqrt", "α": "alpha ", "β": "beta ", "γ": "gamma ", "λ": "lambda", "ν": "nu", "ω": "omega", "φ": "phi", "θ": "theta", "ρ": "rho",
    "Σ": "sum ", "Δ": "delta", "✔": "OK", "✘": "NOT OK", "⁶": "^6", "⁴": "^4", "′": "'", "→": "->", "—": "-", "–": "-", "↔": "<->", "↕": "|", "…": "...", "∞": "inf", "ε": "eps", "≈": "~", "²": "^2", "³": "^3", "Ø": "dia ", "⟂": "perp" };
  const clean = t => String(t == null ? "" : t).replace(/[≤≥√αβγλνωφθρΣΔ✔✘⁶⁴′→—–↔↕…∞ε≈²³Ø⟂]/g, ch => MAP[ch] || ch);
  // PDF rendering (jsPDF, A4 portrait, vector text)
  function pdf(doc, P, secs, startNew) {
    const W = 210, M = 12, colRef = 22, colOut = 50, colTxt = W - 2 * M - colRef - colOut;
    let y = 0, page = 0;
    const I = P.info || {};
    const header = () => {
      page++;
      doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(M, 8, W - 2 * M, 16);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text((I.company || "").toUpperCase(), M + 2, 13);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      doc.text(clean(`Project: ${I.name || ""}   Client: ${I.client || ""}`), M + 2, 17.5);
      doc.text(clean(`Calculations to ${P.code === "EC2" ? "BS EN 1992-1-1" : "BS 8110-1"} · made by ${I.engineer || ""} · ${I.date || ""}`), M + 2, 21.5);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(`Sheet C-${String(page).padStart(2, "0")}`, W - M - 2, 13, { align: "right" });
      doc.setFillColor(232, 238, 245); doc.rect(M, 26, W - 2 * M, 6, "F");
      doc.setFontSize(7.5); doc.text("Ref.", M + 1.5, 30); doc.text("Calculation", M + colRef + 1.5, 30); doc.text("Output", W - M - colOut + 1.5, 30);
      doc.setLineWidth(0.15); doc.line(M + colRef, 26, M + colRef, 287); doc.line(W - M - colOut, 26, W - M - colOut, 287); doc.rect(M, 26, W - 2 * M, 261);
      y = 36;
    };
    const need = h => { if (y + h > 284) { doc.addPage("a4", "portrait"); header(); } };
    if (startNew) doc.addPage("a4", "portrait");
    header();
    for (const sec of secs) {
      for (const b of sec.blocks) {
        if (b.h) { need(12); y += 2; doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(11, 79, 138); doc.text(clean(b.h), M + colRef + 1.5, y); doc.setTextColor(0); y += 5; continue; }
        if (b.sub) { need(8); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text(clean(b.sub), M + colRef + 1.5, y); y += 4.2; continue; }
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.6);
        const tl = doc.splitTextToSize(clean(b.txt), colTxt - 3), ol = doc.splitTextToSize(clean(b.out), colOut - 3), rl = doc.splitTextToSize(clean(b.ref), colRef - 3);
        const h = Math.max(tl.length, ol.length, rl.length) * 3.4 + 0.8;
        need(h);
        doc.setTextColor(90); doc.text(rl, M + 1.5, y); doc.setTextColor(0);
        doc.text(tl, M + colRef + 1.5, y);
        if (b.ok === false) doc.setTextColor(176, 0, 32); else if (b.ok) doc.setTextColor(10, 122, 47);
        doc.setFont("helvetica", "bold"); doc.text(ol, W - M - colOut + 1.5, y); doc.setFont("helvetica", "normal"); doc.setTextColor(0);
        y += h;
      }
      y += 2;
    }
  }
  return { all, html, pdf };
})();
if (typeof module !== "undefined") module.exports = CALC;
