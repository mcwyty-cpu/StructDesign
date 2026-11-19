/* ===================================================================
   StructDesign engine — RC slabs, beams, columns to EC2 or BS 8110
   Grid model: gx[], gy[] (mm); cols{"i,j":1}; beams{"h,i,j":{wall}} (segment (i,j)->(i+1,j)),
   {"v,i,j":{wall}} ((i,j)->(i,j+1)); cells{"i,j": slab|void|balcony|none}
   =================================================================== */
const SD = (() => {
  const A = d => Math.PI * d * d / 4;
  const r25 = x => Math.floor(x / 25) * 25;
  const key = (...a) => a.join(",");

  // ---------------------------------------------------------- code parameters
  function codeP(P) {
    const m = P.mat, ec = P.code === "EC2";
    return ec ? { ec, gG: 1.35, gQ: 1.5, gGmin: 1.35, fck: m.fck, fyk: m.fyk, fcd: 0.85 * m.fck / 1.5,
                  fyd: m.fyk / 1.15, Kp: 0.167, fctm: 0.3 * Math.pow(m.fck, 2 / 3), name: "EC2" }
              : { ec, gG: 1.4, gQ: 1.6, gGmin: 1.0, fcu: m.fcu, fy: m.fy, fcd: 0.45 * m.fcu, fyd: 0.87 * m.fy,
                  Kp: 0.156, name: "BS 8110" };
  }

  // ---------------------------------------------------------- section design
  function flex(C, M, b, d, d2 = 50) {
    if (M <= 0) return { As: 0, As2: 0, K: 0, z: 0.95 * d };
    if (C.ec) {
      const K = M * 1e6 / (b * d * d * C.fck);
      if (K <= C.Kp) { const z = Math.min(0.95 * d, d / 2 * (1 + Math.sqrt(1 - 3.53 * K))); return { As: M * 1e6 / (C.fyd * z), As2: 0, K, z }; }
      const z = d / 2 * (1 + Math.sqrt(1 - 3.53 * C.Kp));
      const As2 = (K - C.Kp) * C.fck * b * d * d / (C.fyd * (d - d2));
      return { As: C.Kp * C.fck * b * d * d / (C.fyd * z) + As2, As2, K, z };
    }
    const K = M * 1e6 / (b * d * d * C.fcu);
    if (K <= C.Kp) { const z = Math.min(0.95 * d, d * (0.5 + Math.sqrt(0.25 - K / 0.9))); return { As: M * 1e6 / (C.fyd * z), As2: 0, K, z }; }
    const z = d * (0.5 + Math.sqrt(0.25 - C.Kp / 0.9));
    const As2 = (K - C.Kp) * C.fcu * b * d * d / (C.fyd * (d - d2));
    return { As: C.Kp * C.fcu * b * d * d / (C.fyd * z) + As2, As2, K, z };
  }
  // flanged sagging design (returns As)
  function flexT(C, M, bw, bf, d, hf) {
    if (M <= 0) return { As: 0, As2: 0, K: 0, inFlange: true };
    const Mf = (C.ec ? 0.567 * C.fck : 0.45 * C.fcu) * bf * hf * (d - hf / 2) / 1e6;
    if (M <= Mf) return Object.assign(flex(C, M, bf, d), { inFlange: true, Mf });
    const As = C.ec ? (M * 1e6 + 0.1 * C.fck * bw * d * (0.36 * d - hf)) / (C.fyd * (d - 0.5 * hf))
                    : (M * 1e6 + 0.1 * C.fcu * bw * d * (0.45 * d - hf)) / (C.fyd * (d - 0.5 * hf));
    const Kw = M * 1e6 / (bw * d * d * (C.ec ? C.fck : C.fcu));
    return { As, As2: 0, K: Kw * 0.5, inFlange: false, Mf };
  }
  function asMin(C, b, d, h) {
    return C.ec ? Math.max(0.26 * C.fctm / C.fyk * b * d, 0.0013 * b * d) : 0.0013 * b * h;
  }
  // allowable span/depth
  function ldEC(C, rho, K, rhoC = 0) {
    const f = Math.sqrt(C.fck), r0 = f / 1000; rho = Math.max(rho, 1e-6);
    const v = rho <= r0 ? 11 + 1.5 * f * r0 / rho + 3.2 * f * Math.pow(r0 / rho - 1, 1.5)
                        : 11 + 1.5 * f * r0 / Math.max(rho - rhoC, 1e-6) + f / 12 * Math.sqrt(rhoC / r0);
    return K * v;
  }
  function ldAllow(C, kind, As_req, As_prov, M, b, d, L, flangeRatio = 1) {
    // kind: 'ss' | 'end' | 'int' | 'cant'
    if (C.ec) {
      const K = { ss: 1.0, end: 1.3, int: 1.5, cant: 0.4 }[kind] * (flangeRatio > 3 ? 0.8 : 1);
      let v = ldEC(C, Math.max(As_req, 1) / (b * d), K) * Math.min(1.5, 500 / C.fyk * As_prov / Math.max(As_req, 1));
      if (L > 7 && kind !== "cant") v *= 7 / L;
      return v;
    }
    let basic = { ss: 20, end: 26, int: 26, cant: 7 }[kind];
    if (flangeRatio > 1) { const r = Math.max(0.3, 1 / flangeRatio); basic *= 0.8 + 0.2 * (r - 0.3) / 0.7; }
    const fs = 2 / 3 * C.fy * As_req / Math.max(As_prov, 1);
    const mf = Math.min(2, 0.55 + (477 - fs) / (120 * (0.9 + M * 1e6 / (b * d * d))));
    let v = basic * Math.max(mf, 0.3);
    if (L > 10 && kind !== "cant") v *= 10 / L;
    return v;
  }
  function vcConc(C, b, d, As) {
    if (C.ec) {
      const k = Math.min(2, 1 + Math.sqrt(200 / d)), rho = Math.min(0.02, As / (b * d));
      return Math.max(0.12 * k * Math.pow(100 * rho * C.fck, 1 / 3), 0.035 * Math.pow(k, 1.5) * Math.sqrt(C.fck)) * b * d / 1000; // kN
    }
    const vc = 0.79 * Math.pow(Math.min(3, 100 * As / (b * d)), 1 / 3) * Math.pow(Math.max(1, 400 / d), 0.25) / 1.25 * Math.pow(Math.min(C.fcu, 40) / 25, 1 / 3);
    return vc * b * d / 1000; // kN
  }
  function linksDesign(C, V, b, d, AsT, link = 8, legs = 2) {
    const Asw = legs * A(link);
    if (C.ec) {
      const z = 0.9 * d, nu1 = 0.6 * (1 - C.fck / 250), fcdv = C.fck / 1.5;
      const Vm25 = b * z * nu1 * fcdv / 2.9 / 1000, Vm45 = b * z * nu1 * fcdv / 2 / 1000;
      if (V > Vm45) return { ok: false, s: 0, txt: "section too small for shear" };
      const th = V <= Vm25 ? Math.atan(1 / 2.5) : 0.5 * Math.asin(Math.min(1, 2 * V * 1000 / (b * z * nu1 * fcdv)));
      const cot = 1 / Math.tan(th);
      const req = Math.max(V * 1000 / (z * C.fyd * cot), 0.08 * Math.sqrt(C.fck) * b / C.fyk);
      const s = Math.max(50, Math.min(r25(Asw / req), r25(0.75 * d), 300));
      return { ok: true, s, VRc: vcConc(C, b, d, AsT) };
    }
    const v = V * 1000 / (b * d), vmax = Math.min(0.8 * Math.sqrt(C.fcu), 5);
    if (v > vmax) return { ok: false, s: 0, txt: "section too small for shear" };
    const vc = vcConc(C, b, d, AsT) * 1000 / (b * d);
    const req = v <= vc + 0.4 ? 0.4 * b / C.fyd : b * (v - vc) / C.fyd;
    const s = Math.max(50, Math.min(r25(Asw / req), r25(0.75 * d), 300));
    return { ok: true, s, VRc: vc * b * d / 1000 };
  }
  function pickBars(As, b, cover, link, opts = [12, 16, 20, 25, 32]) {
    let best = null;
    for (const d of opts) {
      const n = Math.max(2, Math.ceil(As / A(d) - 1e-9));
      if (n > 8) continue;
      const clear = (b - 2 * cover - 2 * link - n * d) / Math.max(n - 1, 1);
      const layers = clear >= Math.max(d, 25) ? 1 : 2;
      const cand = { n, d, A: n * A(d), layers };
      const score = cand.A * (layers === 2 ? 1.25 : 1);
      if (!best || score < best.score - 1) best = Object.assign(cand, { score });
    }
    return best;
  }
  function slabBars(As, smax) {
    for (const d of [10, 12, 16]) {
      const s = Math.min(r25(A(d) * 1000 / As), smax);
      if (s >= 150 || (d === 16 && s >= 100)) return { d, s, A: A(d) * 1000 / s };
    }
    return { d: 16, s: 100, A: A(16) * 10, fail: true };
  }
  const bt = b => b ? `${b.n}H${b.d}` : "–";
  const st = b => b ? `H${b.d}@${b.s}` : "–";

  // ---------------------------------------------------------- BS 8110 Table 3.14
  const RAT = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0];
  const T314 = {
    neg: [[.031, .037, .042, .046, .050, .053, .059, .063], [.039, .044, .048, .052, .055, .058, .063, .067], [.039, .049, .056, .062, .068, .073, .082, .089],
          [.047, .056, .063, .069, .074, .078, .087, .093], [.046, .050, .054, .057, .060, .062, .067, .070], [0, 0, 0, 0, 0, 0, 0, 0],
          [.057, .065, .071, .076, .081, .084, .092, .098], [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]],
    pos: [[.024, .028, .032, .035, .037, .040, .044, .048], [.029, .033, .036, .039, .041, .043, .047, .050], [.030, .036, .042, .047, .051, .055, .062, .067],
          [.036, .042, .047, .051, .055, .059, .065, .070], [.034, .038, .040, .043, .045, .047, .050, .053], [.034, .046, .056, .065, .072, .078, .091, .100],
          [.043, .048, .053, .057, .060, .063, .069, .074], [.042, .054, .063, .071, .078, .084, .096, .105], [.055, .065, .074, .081, .087, .092, .103, .111]],
    negL: [.032, .037, .037, .045, 0, .045, 0, .058, 0], posL: [.024, .028, .028, .034, .034, .034, .044, .044, .056],
    names: ["interior panel", "one short edge discontinuous", "one long edge discontinuous", "two adjacent edges discontinuous",
            "two short edges discontinuous", "two long edges discontinuous", "three edges discontinuous (one long continuous)",
            "three edges discontinuous (one short continuous)", "four edges discontinuous"]
  };
  function interp(r, arr) {
    r = Math.min(Math.max(r, 1), 2);
    for (let i = 0; i < 7; i++) if (r <= RAT[i + 1]) return arr[i] + (r - RAT[i]) / (RAT[i + 1] - RAT[i]) * (arr[i + 1] - arr[i]);
    return arr[7];
  }
  function slabCase(ns, nl) {
    const t = { "0,0": 1, "1,0": 2, "0,1": 3, "1,1": 4, "2,0": 5, "0,2": 6, "2,1": 7, "1,2": 8, "2,2": 9 };
    return t[ns + "," + nl];
  }

  // ---------------------------------------------------------- geometry helpers
  function nx(P) { return P.gx.length - 1; }
  function ny(P) { return P.gy.length - 1; }
  const cellT = (P, i, j) => (i < 0 || j < 0 || i >= nx(P) || j >= ny(P)) ? "none" : (P.cells[key(i, j)] || "slab");
  const hasB = (P, k) => !!P.beams[k];

  // ---------------------------------------------------------- panels
  function panels(P) {
    const NX = nx(P), NY = ny(P);
    const par = {};
    const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[b] = a; };
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) par[key(i, j)] = key(i, j);
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const t = cellT(P, i, j); if (t !== "slab" && t !== "balcony") continue;
      if (i + 1 < NX && cellT(P, i + 1, j) === t && !hasB(P, key("v", i + 1, j))) uni(key(i, j), key(i + 1, j));
      if (j + 1 < NY && cellT(P, i, j + 1) === t && !hasB(P, key("h", i, j + 1))) uni(key(i, j), key(i, j + 1));
    }
    const groups = {};
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const t = cellT(P, i, j); if (t !== "slab" && t !== "balcony") continue;
      const r = find(key(i, j)); (groups[r] = groups[r] || { type: t, cells: [] }).cells.push([i, j]);
    }
    const out = [];
    for (const g of Object.values(groups)) {
      const is = g.cells.map(c => c[0]), js = g.cells.map(c => c[1]);
      const i0 = Math.min(...is), i1 = Math.max(...is), j0 = Math.min(...js), j1 = Math.max(...js);
      const p = { type: g.type, cells: g.cells, i0, i1, j0, j1, x0: P.gx[i0], x1: P.gx[i1 + 1], y0: P.gy[j0], y1: P.gy[j1 + 1],
                  irregular: g.cells.length !== (i1 - i0 + 1) * (j1 - j0 + 1), warn: [] };
      p.Lx = (p.x1 - p.x0) / 1000; p.Ly = (p.y1 - p.y0) / 1000;
      // sides: top (y0), bottom (y1), left (x0), right (x1)
      const side = (s) => {
        const segs = []; let cont = 0, n = 0;
        if (s === "top" || s === "bottom") {
          const j = s === "top" ? j0 : j1 + 1, jn = s === "top" ? j0 - 1 : j1 + 1;
          for (let i = i0; i <= i1; i++) { segs.push(key("h", i, j)); n++; if (cellT(P, i, jn) === "slab") cont++; }
        } else {
          const i = s === "left" ? i0 : i1 + 1, inb = s === "left" ? i0 - 1 : i1 + 1;
          for (let j = j0; j <= j1; j++) { segs.push(key("v", i, j)); n++; if (cellT(P, inb, j) === "slab") cont++; }
        }
        const sup = segs.filter(k => hasB(P, k)).length;
        return { segs, cont: cont > n / 2, supported: sup === segs.length, partly: sup > 0 };
      };
      p.sides = { top: side("top"), bottom: side("bottom"), left: side("left"), right: side("right") };
      out.push(p);
    }
    out.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    return out;
  }

  function classifyPanel(p) {
    const S = p.sides;
    if (p.type === "balcony") {
      const sup = Object.entries(S).filter(([k, v]) => v.supported).map(([k]) => k);
      if (sup.length === 1) {
        const s = sup[0];
        p.kind = "cant"; p.supSide = s;
        p.Lc = (s === "top" || s === "bottom") ? p.Ly : p.Lx;
        p.Wd = (s === "top" || s === "bottom") ? p.Lx : p.Ly;
        p.cls = `Cantilever slab (projection ${p.Lc.toFixed(2)} m)`;
        return p;
      }
      if (sup.length === 0) { p.kind = "none"; p.cls = "Unsupported – add a beam"; p.warn.push("balcony has no supporting beam"); return p; }
    }
    for (const [k, v] of Object.entries(S)) if (!v.supported) p.warn.push(`${k} edge ${v.partly ? "partly " : ""}unsupported – add beam`);
    p.lx = Math.min(p.Lx, p.Ly); p.ly = Math.max(p.Lx, p.Ly);
    p.shortAlongX = p.Lx <= p.Ly;
    // long edges are parallel to the long span: if short span along x, long edges are left/right
    const longE = p.shortAlongX ? ["left", "right"] : ["top", "bottom"];
    const shortE = p.shortAlongX ? ["top", "bottom"] : ["left", "right"];
    p.longE = longE; p.shortE = shortE;
    p.nl = longE.filter(e => !S[e].cont).length;
    p.ns = shortE.filter(e => !S[e].cont).length;
    p.ratio = p.ly / p.lx;
    if (p.ratio > 2) {
      p.kind = "one";
      p.pos1 = p.nl === 2 ? 1 : (p.nl === 1 ? 2 : 3);
      p.cls = p.pos1 === 1 ? "One-way, simply supported" : `One-way, continuous (${p.pos1 === 2 ? "end" : "interior"} span)`;
    } else {
      p.kind = "two";
      p.case = slabCase(p.ns, p.nl);
      p.simple = p.case === 9;
      p.cls = p.simple ? "Two-way, simply supported" : `Two-way, restrained – case ${p.case}: ${T314.names[p.case - 1]}`;
    }
    p.simpleFlag = (p.kind === "one" && p.pos1 === 1) || (p.kind === "two" && p.simple);
    p.contTxt = p.simpleFlag ? "Simple" : "Continuous";
    return p;
  }

  function designPanel(P, C, p, lvl) {
    classifyPanel(p);
    if (p.kind === "none") { p.status = "REVISE"; return p; }
    const cover = lvl.kind === "roof" ? Math.max(P.mat.cs, 30) : (p.kind === "cant" ? Math.max(P.mat.cs, 35) : P.mat.cs);
    const qk = p.kind === "cant" ? Math.max(lvl.qk, 2.5) : lvl.qk;
    for (let h = lvl.h; h <= 300; h += 25) {
      const gk = h / 1000 * 25 + lvl.fin + (p.kind === "cant" ? 0 : lvl.part);
      const n = C.gG * gk + C.gQ * qk;
      const d1 = h - cover - 5, d2 = d1 - 10;
      const r = { h, gk, qk, n, d1, d2 };
      let M = {};
      if (p.kind === "cant") {
        const L = p.Lc;
        M.sxn = n * L * L / 2 + C.gG * P.balu * L + C.gQ * 0.74 * 1.1; M.sxp = 0; M.syp = 0; M.syn = 0;
      } else if (p.kind === "one") {
        const cp = [0.125, 0.086, 0.063][p.pos1 - 1], cn = [0, 0.086, 0.063][p.pos1 - 1];
        M = { sxp: cp * n * p.lx ** 2, sxn: cn * n * p.lx ** 2, syp: 0, syn: 0 };
      } else if (p.simple) {
        const rr = Math.min(p.ratio, 2), a4 = rr ** 4;
        M = { sxp: a4 / (8 * (1 + a4)) * n * p.lx ** 2, sxn: 0, syp: rr * rr / (8 * (1 + a4)) * n * p.lx ** 2, syn: 0 };
      } else {
        const c = p.case - 1;
        M = { sxp: interp(p.ratio, T314.pos[c]) * n * p.lx ** 2, sxn: interp(p.ratio, T314.neg[c]) * n * p.lx ** 2,
              syp: T314.posL[c] * n * p.lx ** 2, syn: T314.negL[c] * n * p.lx ** 2 };
      }
      r.M = M;
      const sl = P.slabMaxS || 250;
      const smaxP = Math.min(C.ec ? Math.min(2 * h, 250) : Math.min(3 * d1, 300), sl), smaxS = Math.min(C.ec ? Math.min(3 * h, 300) : Math.min(3 * d1, 300), sl);
      const row = (Mv, d, main, need) => {
        const f = flex(C, Mv, 1000, d);
        const Amin = asMin(C, 1000, d, h);
        const Ad = need ? Math.max(f.As, Amin) : (Mv > 0 ? Math.max(f.As, Amin) : 0);
        return { M: Mv, d, As: f.As, K: f.K, Ad, bars: Ad > 0 ? slabBars(Ad, main ? smaxP : smaxS) : null };
      };
      if (p.kind === "cant") {
        r.rows = { sxp: row(0, d1, true, true), sxn: row(M.sxn, d1, true, true), syp: row(0, d2, false, true), syn: null };
        const dist = Math.max(asMin(C, 1000, d2, h), 0.2 * r.rows.sxn.Ad);
        r.rows.syn = { M: 0, d: d2, As: 0, Ad: dist, bars: slabBars(dist, smaxS) };
      } else {
        r.rows = { sxp: row(M.sxp, d1, true, true), sxn: row(M.sxn, d1, true, false), syp: row(M.syp, d2, false, true), syn: row(M.syn, d2, false, false) };
        if (p.kind === "one") { const dist = Math.max(asMin(C, 1000, d2, h), 0.2 * r.rows.sxp.Ad); r.rows.syp.Ad = dist; r.rows.syp.bars = slabBars(dist, smaxS); }
      }
      const main = p.kind === "cant" ? r.rows.sxn : r.rows.sxp;
      const kd = p.kind === "cant" ? "cant" : (p.simpleFlag || p.nl === 2 ? "ss" : (p.nl === 1 ? "end" : "int"));
      const L = p.kind === "cant" ? p.Lc : p.lx;
      r.ldAllow = ldAllow(C, kd, Math.max(main.As, 1), main.bars.A, main.M, 1000, d1, L);
      r.ldAct = L * 1000 / d1;
      r.V = p.kind === "cant" ? n * L + C.gG * P.balu : (p.kind === "one" ? [0.5, 0.6, 0.5][p.pos1 - 1] : (p.simpleFlag ? 0.5 : 0.575)) * n * L;
      r.VRc = vcConc(C, 1000, d1, main.bars.A);
      r.ok = r.ldAct <= r.ldAllow && r.V <= r.VRc && Object.values(r.rows).every(x => !x || ((!x.bars || !x.bars.fail) && x.K <= C.Kp + 1e-9 || !x.K));
      Object.assign(p, { d: r });
      if (r.ok) break;
    }
    p.status = p.d.ok ? (p.warn.length ? "CHECK" : "OK") : "REVISE";
    if (p.d.h > lvl.h) p.note = `thickened to ${p.d.h} mm for ${p.d.ldAct > p.d.ldAllow ? "deflection" : "strength/deflection"}`;
    return p;
  }

  // tributary widths on each side of a panel (m)
  function panelTrib(p) {
    const t = { top: 0, bottom: 0, left: 0, right: 0 };
    if (p.kind === "cant") { t[p.supSide] = p.Lc; return t; }
    if (p.kind === "none") return t;
    for (const e of p.longE) t[e] = p.lx / 2;
    for (const e of p.shortE) t[e] = p.kind === "one" ? 0 : p.lx / 3;
    return t;
  }

  // ---------------------------------------------------------- beam runs
  function runs(P) {
    const out = [];
    const NX = nx(P), NY = ny(P);
    for (let j = 0; j <= NY; j++) {
      let i = 0;
      while (i < NX) {
        if (hasB(P, key("h", i, j))) { const s = i; while (i < NX && hasB(P, key("h", i, j))) i++; out.push({ dir: "h", line: j, a: s, b: i }); }
        else i++;
      }
    }
    for (let i = 0; i <= NX; i++) {
      let j = 0;
      while (j < NY) {
        if (hasB(P, key("v", i, j))) { const s = j; while (j < NY && hasB(P, key("v", i, j))) j++; out.push({ dir: "v", line: i, a: s, b: j }); }
        else j++;
      }
    }
    out.forEach((r, k) => r.id = k);
    return out;
  }
  const nodeOf = (r, k) => r.dir === "h" ? [k, r.line] : [r.line, k];
  const posOf = (P, r, k) => r.dir === "h" ? P.gx[k] : P.gy[k];
  function runAt(R, dir, i, j) { // run containing segment
    return R.find(r => r.dir === dir && (dir === "h" ? (r.line === j && i >= r.a && i < r.b) : (r.line === i && j >= r.a && j < r.b)));
  }

  function setupRun(P, R, r) {
    r.sup = []; r.warn = [];
    for (let k = r.a; k <= r.b; k++) {
      const [i, j] = nodeOf(r, k);
      if (P.cols[key(i, j)]) { r.sup.push({ k, type: "col", node: key(i, j) }); continue; }
      if (k === r.a || k === r.b) {
        // perpendicular beam through/ending at node?
        let pr = null;
        if (r.dir === "h") pr = runAt(R, "v", i, j - 1) || runAt(R, "v", i, j);
        else pr = runAt(R, "h", i - 1, j) || runAt(R, "h", i, j);
        if (pr) r.sup.push({ k, type: "beam", run: pr.id, node: key(i, j) });
      }
    }
    if (r.sup.length === 0) r.warn.push("no supports – add a column");
    if (r.sup.length === 1 && !(r.sup[0].k === r.a || r.sup[0].k === r.b)) r.warn.push("single support – unstable");
    // elements: interior spans + overhangs
    const el = [];
    const s0 = r.sup.length ? r.sup[0].k : r.a, s1 = r.sup.length ? r.sup[r.sup.length - 1].k : r.b;
    if (s0 > r.a) el.push({ kind: "cantL", k0: r.a, k1: s0 });
    for (let t = 0; t + 1 < r.sup.length; t++) el.push({ kind: "span", k0: r.sup[t].k, k1: r.sup[t + 1].k });
    if (s1 < r.b) el.push({ kind: "cantR", k0: s1, k1: r.b });
    for (const e of el) { e.L = (posOf(P, r, e.k1) - posOf(P, r, e.k0)) / 1000; e.pts = []; }
    r.el = el;
    r.L = (posOf(P, r, r.b) - posOf(P, r, r.a)) / 1000;
  }

  // loads on each grid segment from panels + walls (per level)
  function segLoads(P, PN, lvl) {
    const L = {};
    const add = (k, g, q) => { const o = L[k] || (L[k] = { g: 0, q: 0, slabs: [] }); o.g += g; o.q += q; };
    for (const p of PN) {
      if (!p.d) continue;
      const t = panelTrib(p);
      for (const s of ["top", "bottom", "left", "right"]) {
        if (!t[s]) continue;
        let g = t[s] * p.d.gk, q = t[s] * p.d.qk;
        if (p.kind === "cant") g += P.balu;
        for (const k of p.sides[s].segs) if (P.beams[k]) { add(k, g, q); L[k].slabs.push({ p, side: s }); }
      }
    }
    // walls
    const NX = nx(P), NY = ny(P);
    for (const k of Object.keys(P.beams)) {
      const [d, i, j] = k.split(","); const ii = +i, jj = +j;
      let ext;
      if (d === "h") ext = cellT(P, ii, jj - 1) !== "slab" && cellT(P, ii, jj - 1) !== "void" || cellT(P, ii, jj) !== "slab" && cellT(P, ii, jj) !== "void";
      else ext = cellT(P, ii - 1, jj) !== "slab" && cellT(P, ii - 1, jj) !== "void" || cellT(P, ii, jj) !== "slab" && cellT(P, ii, jj) !== "void";
      const wall = P.beams[k].wall;
      let w = 0;
      if (lvl.kind === "roof") w = ext ? lvl.ext : 0;
      else if (wall) w = ext ? lvl.ext : lvl.int;
      add(k, w, 0);
      L[k].ext = ext;
    }
    return L;
  }

  // ---------------------------------------------------------- continuous beam analysis
  function gauss(Am, b) {
    const n = b.length, M = Am.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c && M[c][c] !== 0) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  // load: per element {w, pts:[[a,P]]}. returns per element: {Ml, Mr, res:[{x,M,V}], RA, RB} and support moments
  function solve(els, loads) {
    const spans = els.map((e, i) => i).filter(i => els[i].kind === "span");
    const out = els.map(() => ({}));
    // overhang moments (hogging magnitudes)
    const cantM = (i) => { const e = els[i], l = loads[i]; let m = l.w * e.L * e.L / 2; for (const [a, Pp] of l.pts) m += Pp * a; return m; };
    let McL = 0, McR = 0;
    els.forEach((e, i) => { if (e.kind === "cantL") McL = cantM(i); if (e.kind === "cantR") McR = cantM(i); });
    const ns = spans.length;
    let Ms = new Array(ns + 1).fill(0);
    if (ns >= 1) {
      const N = ns + 1, K = Array.from({ length: N }, () => new Array(N).fill(0)), F = new Array(N).fill(0);
      const fem = spans.map(i => {
        const e = els[i], l = loads[i], Lm = e.L;
        let fl = l.w * Lm * Lm / 12, fr = -l.w * Lm * Lm / 12;
        for (const [a, Pp] of l.pts) { const b = Lm - a; fl += Pp * a * b * b / (Lm * Lm); fr -= Pp * a * a * b / (Lm * Lm); }
        return [fl, fr];
      });
      spans.forEach((si, t) => {
        const Lm = els[si].L, k4 = 4 / Lm, k2 = 2 / Lm;
        K[t][t] += k4; K[t][t + 1] += k2; K[t + 1][t] += k2; K[t + 1][t + 1] += k4;
        F[t] -= fem[t][0]; F[t + 1] -= fem[t][1];
      });
      F[0] += McL; F[ns] -= McR;
      const th = gauss(K, F);
      spans.forEach((si, t) => {
        const Lm = els[si].L;
        const ml = fem[t][0] + (4 * th[t] + 2 * th[t + 1]) / Lm;
        const mr = fem[t][1] + (2 * th[t] + 4 * th[t + 1]) / Lm;
        if (t === 0) Ms[0] = -ml;
        Ms[t + 1] = mr;
      });
      // exact ends
      Ms[0] = McL ? -McL : (ns ? Ms[0] : 0); if (!McL) Ms[0] = 0;
      Ms[ns] = McR ? -McR : 0;
    }
    const Rsup = new Array(ns + 1).fill(0);
    spans.forEach((si, t) => {
      const e = els[si], l = loads[si], Lm = e.L, Ml = Ms[t], Mr = Ms[t + 1];
      const RA = l.w * Lm / 2 + l.pts.reduce((s, [a, Pp]) => s + Pp * (Lm - a) / Lm, 0) + (Mr - Ml) / Lm;
      const xs = []; for (let k = 0; k <= 30; k++) xs.push(Lm * k / 30); l.pts.forEach(([a]) => xs.push(a));
      xs.sort((a, b) => a - b);
      const res = xs.map(x => {
        const M = Ml + RA * x - l.w * x * x / 2 - l.pts.reduce((s, [a, Pp]) => s + (a < x ? Pp * (x - a) : 0), 0);
        const V = RA - l.w * x - l.pts.reduce((s, [a, Pp]) => s + (a < x ? Pp : 0), 0);
        return { x, M, V };
      });
      const RB = l.w * Lm + l.pts.reduce((s, [, Pp]) => s + Pp, 0) - RA;
      out[si] = { Ml, Mr, res, RA, RB };
      Rsup[t] += RA; Rsup[t + 1] += RB;
    });
    els.forEach((e, i) => {
      if (e.kind === "span") return;
      const l = loads[i], Vt = l.w * e.L + l.pts.reduce((s, [, Pp]) => s + Pp, 0), Mc = cantM(i);
      out[i] = { Ml: e.kind === "cantR" ? -Mc : 0, Mr: e.kind === "cantL" ? -Mc : 0, res: [{ x: 0, M: -Mc, V: Vt }], RA: 0, RB: 0, Vt, Mc };
      if (e.kind === "cantL") Rsup[0] += Vt; else Rsup[ns] += Vt;
    });
    return { out, Rsup, Ms };
  }

  function analyseRun(r, C, sw) {
    const els = r.el, n = els.length;
    const gk = els.map(e => e.g + sw), qk = els.map(e => e.q);
    const run = (gf, qf) => solve(els, els.map((e, i) => ({
      w: gf[i] * gk[i] + qf[i] * qk[i],
      pts: e.pts.map(p => [p.a, gf[i] * p.G + qf[i] * p.Q])
    })));
    const cases = [[els.map(() => C.gG), els.map(() => C.gQ)]];
    if (n > 1) {
      cases.push([els.map((e, i) => i % 2 ? C.gGmin : C.gG), els.map((e, i) => i % 2 ? 0 : C.gQ)]);
      cases.push([els.map((e, i) => i % 2 ? C.gG : C.gGmin), els.map((e, i) => i % 2 ? C.gQ : 0)]);
      for (let j = 0; j + 1 < n; j++) cases.push([els.map((e, i) => (i === j || i === j + 1) ? C.gG : C.gGmin), els.map((e, i) => (i === j || i === j + 1) ? C.gQ : 0)]);
    }
    const env = els.map(() => ({ Mpos: 0, MnL: 0, MnR: 0, V: 0 }));
    const nsup = r.sup.length;
    const Rmax = new Array(Math.max(nsup, 1)).fill(0);
    for (const [gf, qf] of cases) {
      const s = run(gf, qf);
      els.forEach((e, i) => {
        const o = s.out[i];
        if (e.kind === "span") {
          for (const p of o.res) { env[i].Mpos = Math.max(env[i].Mpos, p.M); env[i].V = Math.max(env[i].V, Math.abs(p.V)); }
          env[i].MnL = Math.max(env[i].MnL, -o.Ml); env[i].MnR = Math.max(env[i].MnR, -o.Mr);
        } else {
          env[i].V = Math.max(env[i].V, o.Vt);
          if (e.kind === "cantL") env[i].MnR = Math.max(env[i].MnR, o.Mc); else env[i].MnL = Math.max(env[i].MnL, o.Mc);
        }
      });
      s.Rsup.forEach((v, j) => Rmax[j] = Math.max(Rmax[j], v));
    }
    const RG = run(els.map(() => 1), els.map(() => 0)).Rsup, RQ = run(els.map(() => 0), els.map(() => 1)).Rsup;
    return { env, Rmax, RG, RQ, gk, qk };
  }

  const BEAM_SIZES = [[200, 450], [225, 450], [225, 500], [225, 550], [250, 600], [250, 650], [300, 650], [300, 700], [300, 750], [350, 800], [400, 900]];

  function designRun(P, C, r, lvl, PN) {
    const cover = P.mat.cb, link = 8;
    // beam type from adjacent cells
    const sideTypes = () => {
      let a = 0, b = 0;
      for (let k = r.a; k < r.b; k++) {
        if (r.dir === "h") { if (cellT(P, k, r.line - 1) === "slab") a++; if (cellT(P, k, r.line) === "slab") b++; }
        else { if (cellT(P, r.line - 1, k) === "slab") a++; if (cellT(P, r.line, k) === "slab") b++; }
      }
      const n = r.b - r.a; return [a > n / 2, b > n / 2];
    };
    const [sA, sB] = sideTypes();
    r.type = sA && sB ? "T-beam" : (sA || sB ? "L-beam" : "Rectangular");
    // clear distance to next parallel beam (for flange width): use adjacent panel dimensions
    const clearTo = (side) => {
      let best = 0;
      for (let k = r.a; k < r.b; k++) {
        let i, j;
        if (r.dir === "h") { i = k; j = side ? r.line : r.line - 1; } else { i = side ? r.line : r.line - 1; j = k; }
        if (cellT(P, i, j) !== "slab") continue;
        const dim = r.dir === "h" ? (P.gy[j + 1] - P.gy[j]) : (P.gx[i + 1] - P.gx[i]);
        best = Math.max(best, dim);
      }
      return best;
    };
    const b1 = sA ? clearTo(0) / 2 : 0, b2 = sB ? clearTo(1) / 2 : 0;
    let chosen = null;
    const minIdx = Math.max(0, BEAM_SIZES.findIndex(s => s[1] >= (P.beamMinH || 450)));
    for (let si = minIdx; si < BEAM_SIZES.length; si++) {
      const [bw, h] = BEAM_SIZES[si];
      const hf = lvl.h;
      const sw = bw / 1000 * (h - hf) / 1000 * 25;
      const an = analyseRun(r, C, sw);
      const d = h - cover - link - 10;
      let ok = true; const spans = [];
      r.el.forEach((e, i) => {
        const env = an.env[i];
        const isSpan = e.kind === "span";
        const nsp = r.el.filter(x => x.kind === "span").length;
        const idx = r.el.filter((x, k) => x.kind === "span" && k < i).length;
        const kind = !isSpan ? "cant" : (nsp === 1 ? "ss" : (idx === 0 || idx === nsp - 1 ? "end" : "int"));
        const l0 = { ss: 1, end: 0.85, int: 0.7, cant: 1 }[kind] * e.L * 1000;
        let bf = bw;
        if (r.type !== "Rectangular" && isSpan) {
          if (C.ec) bf = bw + (b1 ? Math.min(0.2 * b1 + 0.1 * l0, 0.2 * l0, b1) : 0) + (b2 ? Math.min(0.2 * b2 + 0.1 * l0, 0.2 * l0, b2) : 0);
          else bf = Math.min(bw + (r.type === "T-beam" ? l0 / 5 : l0 / 10), bw + b1 + b2);
        }
        const fs = isSpan && r.type !== "Rectangular" ? flexT(C, env.Mpos, bw, bf, d, hf) : flex(C, env.Mpos, bw, d);
        const fl = flex(C, env.MnL, bw, d), fr = flex(C, env.MnR, bw, d);
        if (fs.As2 > 0 || fl.As2 > 0 || fr.As2 > 0) ok = false;
        const Amin = asMin(C, bw, d, h);
        const bot = pickBars(Math.max(fs.As, Amin), bw, cover, link);
        const topL = pickBars(Math.max(fl.As, env.MnL > 0 ? Amin : 0, 0.15 * fs.As), bw, cover, link);
        const topR = pickBars(Math.max(fr.As, env.MnR > 0 ? Amin : 0, 0.15 * fs.As), bw, cover, link);
        if (!bot || !topL || !topR) { ok = false; return; }
        if (bot.layers > 1 || topL.layers > 1 || topR.layers > 1) { if (si < BEAM_SIZES.length - 2) ok = false; }
        const lk = linksDesign(C, env.V, bw, d, bot.A);
        if (!lk.ok) ok = false;
        const mainAs = isSpan ? fs.As : Math.max(fl.As, fr.As), mainProv = isSpan ? bot.A : Math.max(topL.A, topR.A);
        const ldA = ldAllow(C, kind, Math.max(mainAs, 1), mainProv, isSpan ? env.Mpos : Math.max(env.MnL, env.MnR), bw, d, e.L, bf / bw);
        const ldC = e.L * 1000 / d;
        if (ldC > ldA) ok = false;
        spans.push({ dk: kind, l0, hf, b1, b2, kind: e.kind, L: e.L, g: an.gk[i], q: an.qk[i], Mpos: env.Mpos, MnL: env.MnL, MnR: env.MnR, V: env.V,
                     bf, inFlange: fs.inFlange, bot, topL, topR, links: lk, ldA, ldC, As: fs.As });
      });
      chosen = { bw, h, d, an, spans, ok };
      if (ok) break;
    }
    r.des = chosen;
    r.status = chosen.ok ? (r.warn.length ? "CHECK" : "OK") : "REVISE";
    return r;
  }

  // ---------------------------------------------------------- columns
  function colCapacity(C, N, b, h, Aface, phi, cover = 30, link = 8) {
    const d = h - cover - link - phi / 2, d2 = cover + link + phi / 2;
    const blk = C.ec ? 0.8 : 0.9, pts = [];
    for (let i = 1; i <= 80; i++) {
      const x = h * 2 * i / 80, s = Math.min(blk * x, h), Fc = C.fcd * b * s;
      const e1 = 0.0035 * (d - x) / x, e2 = 0.0035 * (x - d2) / x;
      const f1 = Math.max(-C.fyd, Math.min(C.fyd, 200000 * e1)), f2 = Math.max(-C.fyd, Math.min(C.fyd, 200000 * e2));
      pts.push([(Fc + Aface * f2 - Aface * f1) / 1000, (Fc * (h / 2 - s / 2) + Aface * f2 * (h / 2 - d2) + Aface * f1 * (d - h / 2)) / 1e6]);
    }
    const Nmax = (C.fcd * b * h + 2 * Aface * C.fyd) / 1000;
    if (N >= Nmax) return 0;
    if (N <= pts[0][0]) return pts[0][1];
    for (let i = 0; i + 1 < pts.length; i++) if (pts[i][0] <= N && N <= pts[i + 1][0]) {
      const t = (N - pts[i][0]) / (pts[i + 1][0] - pts[i][0]); return pts[i][1] + t * (pts[i + 1][1] - pts[i][1]);
    }
    return 0;
  }
  const COL_BARS = [[4, 12], [4, 16], [8, 12], [4, 20], [8, 16], [12, 16], [8, 20], [12, 20], [8, 25], [12, 25]];
  function checkCol(P, C, N, Mx, My, b, l0, isTop, only) {
    const h = b, Ac = b * b, cover = P.mat.cb;
    for (const [nb, phi] of (only ? [only] : COL_BARS)) {
      const Ast = nb * A(phi), perFace = nb === 4 ? 2 : (nb === 8 ? 3 : 4), Af = perFace * A(phi);
      if (!only) {
        if (C.ec) { if (Ast < Math.max(0.1 * N * 1000 / C.fyd, 0.002 * Ac) || Ast > 0.04 * Ac) continue; }
        else { if (Ast < 0.004 * Ac || Ast > 0.06 * Ac) continue; }
      }
      const dd = h - cover - 8 - phi / 2;
      const res = { nb, phi, Ast };
      const axis = (M) => {
        if (C.ec) {
          const lam = l0 * 1000 * Math.sqrt(12) / h, n = N * 1000 / (Ac * C.fcd), om = Ast * C.fyd / (Ac * C.fcd);
          const lamlim = 20 * 0.7 * Math.sqrt(1 + 2 * om) * 0.7 / Math.sqrt(Math.max(n, 0.01));
          const slender = lam > lamlim;
          const ei = l0 * 1000 / 400, e0 = Math.max(h / 30, 20);
          let M0 = Math.max(M, 0) + N * ei / 1000;
          let M2 = 0, Kr = 0, Kf = 0, e2 = 0;
          if (slender) {
            Kr = Math.min(1, Math.max(0, (1 + om - n) / (1 + om - 0.4)));
            Kf = Math.max(1, 1 + (0.35 + C.fck / 200 - lam / 150) * 1.0);
            e2 = Kr * Kf * (C.fyd / 200000) / (0.45 * dd) * (l0 * 1000) ** 2 / 10;
            M2 = N * e2 / 1000;
          }
          const MEd = Math.max(M0 + M2, N * e0 / 1000);
          return { lam, lamlim, slender, MEd, M2, M, n, om, ei, e0, M0, Kr, Kf, e2, dd };
        }
        const lam = l0 * 1000 / h, slender = lam >= 15;
        let Madd = 0;
        if (slender) {
          const Nuz = (0.45 * C.fcu * (Ac - Ast) + 0.87 * C.fy * Ast) / 1000, Nbal = 0.25 * C.fcu * b * dd / 1000;
          const K = Math.min(1, Math.max(0, (Nuz - N) / (Nuz - Nbal)));
          Madd = N * (lam * lam / 2000) * K * h / 1000;
          var bsx = { Nuz, Nbal, K };
        }
        const MEd = Math.max(M + Madd, N * Math.min(0.05 * h, 20) / 1000);
        return Object.assign({ lam, lamlim: 15, slender, MEd, M2: Madd, M, emin: Math.min(0.05 * h, 20), dd }, bsx || {});
      };
      const ax = axis(Mx), ay = axis(My);
      const MRd = colCapacity(C, N, b, h, Af, phi, cover);
      let util;
      if (C.ec) {
        const NRd = (C.fcd * Ac + Ast * C.fyd) / 1000, rn = N / NRd;
        const a = rn <= 0.1 ? 1 : (rn <= 0.7 ? 1 + (rn - 0.1) / 0.6 * 0.5 : 1.5 + (rn - 0.7) / 0.3 * 0.5);
        util = MRd <= 0 ? 99 : Math.pow(ax.MEd / MRd, a) + Math.pow(ay.MEd / MRd, a);
        Object.assign(res, { NRd, aExp: a });
      } else {
        const nr = N * 1000 / (Ac * C.fcu);
        const tbl = [[0, .88], [.1, .77], [.2, .65], [.3, .53], [.4, .42], [.5, .30], [5, .30]];
        let beta = 0.3; for (let i = 0; i + 1 < tbl.length; i++) if (nr >= tbl[i][0] && nr <= tbl[i + 1][0]) beta = tbl[i][1] + (nr - tbl[i][0]) / (tbl[i + 1][0] - tbl[i][0]) * (tbl[i + 1][1] - tbl[i][1]);
        const Mmax = Math.max(ax.MEd, ay.MEd), Mmin = Math.min(ax.MEd, ay.MEd);
        const Mp = Mmax + beta * Mmin;
        util = MRd <= 0 ? 99 : Mp / MRd;
        Object.assign(res, { nr, betaB: beta, Mp });
      }
      Object.assign(res, { ax, ay, MRd, util, ok: util <= 1, Af, perFace, b, cover });
      if (res.ok || only) return res;
    }
    return null;
  }

  // roof covers the whole building: no balconies, stair voids roofed over
  function roofOf(P) {
    const Q = Object.assign({}, P, { cells: {} });
    for (const [k, t] of Object.entries(P.cells)) Q.cells[k] = t === "balcony" ? "none" : (t === "void" ? "slab" : t);
    return Q;
  }

  // ---------------------------------------------------------- full design
  function design(P) {
    const C = codeP(P);
    const out = { C, levels: [], warn: [] };
    if (!P.gx || P.gx.length < 2 || P.gy.length < 2) { out.warn.push("Grid needs at least 2 lines each way"); return out; }
    const R0 = runs(P);
    // name columns
    const colKeys = Object.keys(P.cols).filter(k => P.cols[k]).map(k => k.split(",").map(Number))
      .filter(([i, j]) => i < P.gx.length && j < P.gy.length)
      .sort((a, b) => P.gy[a[1]] - P.gy[b[1]] || P.gx[a[0]] - P.gx[b[0]]);
    const colName = {}; colKeys.forEach(([i, j], n) => colName[key(i, j)] = "C" + (n + 1));
    out.colName = colName;
    P.levels.forEach((lvl, li) => {
      const Pl = lvl.kind === "roof" ? roofOf(P) : P;
      const pre = lvl.kind === "roof" ? "R" : String(li + 1);
      const PN = panels(Pl);
      let sc = 0, cc = 0;
      PN.forEach(p => { designPanel(Pl, C, p, lvl); p.mark = p.kind === "cant" ? `${pre}CS${++cc}` : `${pre}S${++sc}`; });
      const SL = segLoads(Pl, PN, lvl);
      const R = R0.map(r => Object.assign({}, r));
      R.forEach(r => setupRun(Pl, R, r));
      // element loads (length-weighted average over segments)
      R.forEach(r => r.el.forEach(e => {
        let g = 0, q = 0, len = 0, ext = false;
        for (let k = e.k0; k < e.k1; k++) {
          const sk = r.dir === "h" ? key("h", k, r.line) : key("v", r.line, k);
          const ls = (posOf(Pl, r, k + 1) - posOf(Pl, r, k)) / 1000, o = SL[sk] || { g: 0, q: 0 };
          g += o.g * ls; q += o.q * ls; len += ls; if (o.ext) ext = true;
        }
        e.g = len ? g / len : 0; e.q = len ? q / len : 0; e.ext = ext;
      }));
      // naming
      R.forEach((r, n) => r.mark = `${pre}B${n + 1}`);
      // dependency order
      const dependents = R.map(() => []);
      R.forEach(r => r.sup.forEach(s => { if (s.type === "beam") dependents[s.run].push(r.id); }));
      const done = new Set(), order = [];
      let guard = 0;
      while (order.length < R.length && guard++ < R.length + 5) {
        let prog = false;
        R.forEach(r => { if (!done.has(r.id) && dependents[r.id].every(d => done.has(d))) { order.push(r); done.add(r.id); prog = true; } });
        if (!prog) { R.forEach(r => { if (!done.has(r.id)) { order.push(r); done.add(r.id); r.warn.push("circular beam-on-beam support – add a column"); } }); }
      }
      const colLoads = {};
      order.forEach(r => {
        if (!r.el.length) { r.status = "REVISE"; r.des = null; return; }
        designRun(Pl, C, r, lvl, PN);
        const an = r.des.an;
        r.sup.forEach((s, t) => {
          const G = an.RG[t] || 0, Q = an.RQ[t] || 0;
          if (s.type === "col") {
            const o = colLoads[s.node] || (colLoads[s.node] = { G: 0, Q: 0, Mx: 0, My: 0 });
            o.G += Math.max(G, 0); o.Q += Math.max(Q, 0);
            if (G < 0) r.warn.push(`uplift ${(-G).toFixed(0)} kN at ${colName[s.node] || s.node} – anchor top bars`);
            // unbalanced moment for column
            const elL = r.el.find(e => e.k1 === s.k), elR = r.el.find(e => e.k0 === s.k);
            const fem = (e, full) => {
              if (!e) return 0;
              const i = r.el.indexOf(e), w = C.gG * (e.g + r.des.an.gk[i] - e.g) + (full ? C.gQ * e.q : 0);
              if (e.kind !== "span") return w * e.L * e.L / 2;
              let f = w * e.L * e.L / 12;
              for (const p of e.pts) f += (C.gG * p.G + (full ? C.gQ * p.Q : 0)) * p.a * (e.L - p.a) / e.L * 0.5;
              return f;
            };
            const unb = elL && elR ? Math.max(Math.abs(fem(elL, true) - fem(elR, false)), Math.abs(fem(elR, true) - fem(elL, false))) : fem(elL || elR, true);
            const share = li === P.levels.length - 1 ? 0.6 : 0.4;
            if (r.dir === "h") o.Mx += share * unb; else o.My += share * unb;
          } else {
            // point load to supporting run
            const pr = R[s.run], pos = posOf(Pl, pr, r.dir === "h" ? nodeOf(r, s.k)[pr.dir === "h" ? 0 : 1] : nodeOf(r, s.k)[pr.dir === "h" ? 0 : 1]);
            const [ni, nj] = nodeOf(r, s.k);
            const kk = pr.dir === "h" ? ni : nj;
            const e = pr.el.find(e => e.k0 <= kk && kk <= e.k1);
            if (!e) { r.warn.push("support beam element not found"); return; }
            const a = e.kind === "cantL" ? (posOf(Pl, pr, e.k1) - posOf(Pl, pr, kk)) / 1000 : (posOf(Pl, pr, kk) - posOf(Pl, pr, e.k0)) / 1000;
            e.pts.push({ a, G, Q, from: r.mark });
          }
        });
      });
      out.levels.push({ lvl, pre, panels: PN, runs: R, colLoads, P: Pl });
    });
    // columns
    const cols = [];
    colKeys.forEach(([i, j]) => {
      const k = key(i, j); const nm = colName[k];
      const storeys = [];
      let G = 0, Q = 0;
      for (let li = P.levels.length - 1; li >= 0; li--) {
        const L = out.levels[li], o = L.colLoads[k] || { G: 0, Q: 0, Mx: 0, My: 0 };
        G += o.G; Q += o.Q;
        storeys.unshift({ li, G, Q, Mx: o.Mx, My: o.My, H: P.levels[li].H });
      }
      if (G === 0 && Q === 0) out.warn.push(`${nm} carries no beam – remove or add beams`);
      let res = null;
      for (const b of [225, 250, 300, 350, 400, 450, 500, 600].filter(v => v >= (P.colMin || 225))) {
        let sw = 0; const des = []; let ok = true;
        for (let s = storeys.length - 1; s >= 0; s--) {
          sw += b * b / 1e6 * 25 * storeys[s].H;
          const st = storeys[s], N = C.gG * (st.G + sw) + C.gQ * st.Q;
          const l0 = P.beta * st.H;
          const r = checkCol(P, C, N, st.Mx, st.My, b, l0, s === storeys.length - 1);
          if (!r) { ok = false; break; }
          des[s] = Object.assign(r, { N, Gk: st.G + sw, Qk: st.Q, level: P.levels[st.li].name, l0, Mx: st.Mx, My: st.My, H: st.H, sw, Gbeams: st.G, checkedBars: `${r.nb}H${r.phi}` });
        }
        if (ok) {
          // use the heaviest bar arrangement in every storey (bars run continuously, never more above than below)
          const big = des.reduce((m, d) => d.Ast > m.Ast ? d : m, des[0]);
          des.forEach((d, s) => { if (d.Ast < big.Ast) { const chk = d.checkedBars; const r2 = checkCol(P, C, d.N, d.Mx, d.My, b, d.l0, false, [big.nb, big.phi]); Object.assign(d, r2, { unified: true, checkedBars: `${big.nb}H${big.phi}` }); } });
          res = { b, des }; break;
        }
      }
      cols.push({ key: k, i, j, name: nm, x: P.gx[i], y: P.gy[j], res, status: res ? "OK" : "REVISE" });
    });
    out.cols = cols;
    return out;
  }

  // ---------------------------------------------------------- auto layout from walls
  function snapList(vals, tol = 200) {
    const s = vals.slice().sort((a, b) => a - b), out = [];
    for (const v of s) { if (out.length && v - out[out.length - 1].v <= tol) { const o = out[out.length - 1]; o.v = (o.v * o.n + v) / (o.n + 1); o.n++; } else out.push({ v, n: 1 }); }
    return out.map(o => Math.round(o.v / 25) * 25);
  }
  const nearest = (arr, v) => { let b = 0; arr.forEach((x, i) => { if (Math.abs(x - v) < Math.abs(arr[b] - v)) b = i; }); return b; };

  function fromAI(J, below) {
    const P = { gx: [], gy: [], cols: {}, beams: {}, cells: {}, rooms: J.rooms || [], below: below || null };
    const walls = (J.walls || []).filter(w => w && (w.dir === "h" || w.dir === "v"));
    const xs = (J.grid_x_mm || []).concat(walls.filter(w => w.dir === "v").map(w => +w.x_mm));
    const ys = (J.grid_y_mm || []).concat(walls.filter(w => w.dir === "h").map(w => +w.y_mm));
    (J.balconies || []).concat(J.outside || []).forEach(r => { xs.push(+r.x1_mm, +r.x2_mm); ys.push(+r.y1_mm, +r.y2_mm); });
    P.gx = snapList(xs.filter(Number.isFinite)); P.gy = snapList(ys.filter(Number.isFinite));
    for (const w of walls) {
      if (w.dir === "h") {
        const j = nearest(P.gy, +w.y_mm), a = nearest(P.gx, Math.min(+w.x1_mm, +w.x2_mm)), b = nearest(P.gx, Math.max(+w.x1_mm, +w.x2_mm));
        for (let i = a; i < b; i++) P.beams[key("h", i, j)] = { wall: 1 };
      } else {
        const i = nearest(P.gx, +w.x_mm), a = nearest(P.gy, Math.min(+w.y1_mm, +w.y2_mm)), b = nearest(P.gy, Math.max(+w.y1_mm, +w.y2_mm));
        for (let j = a; j < b; j++) P.beams[key("v", i, j)] = { wall: 1 };
      }
    }
    const inside = (r, x, y) => x > Math.min(+r.x1_mm, +r.x2_mm) && x < Math.max(+r.x1_mm, +r.x2_mm) && y > Math.min(+r.y1_mm, +r.y2_mm) && y < Math.max(+r.y1_mm, +r.y2_mm);
    for (let i = 0; i + 1 < P.gx.length; i++) for (let j = 0; j + 1 < P.gy.length; j++) {
      const cx = (P.gx[i] + P.gx[i + 1]) / 2, cy = (P.gy[j] + P.gy[j + 1]) / 2;
      let t = "slab";
      if ((J.outside || []).some(r => inside(r, cx, cy))) t = "none";
      if ((J.balconies || []).some(r => inside(r, cx, cy))) t = "balcony";
      if ((J.voids || []).some(r => inside(r, cx, cy))) t = "void";
      if (t !== "slab") P.cells[key(i, j)] = t;
    }
    // cells outside the walled perimeter: mark none if not enclosed by any wall in any direction (simple test)
    return P;
  }

  function onBelow(P, x, y, tol = 150) {
    if (!P.below || !P.below.length) return true;
    return P.below.some(w => w.dir === "h" ? Math.abs(+w.y_mm - y) <= tol && x >= Math.min(+w.x1_mm, +w.x2_mm) - tol && x <= Math.max(+w.x1_mm, +w.x2_mm) + tol
                                          : Math.abs(+w.x_mm - x) <= tol && y >= Math.min(+w.y1_mm, +w.y2_mm) - tol && y <= Math.max(+w.y1_mm, +w.y2_mm) + tol);
  }

  function autoColumns(P) {
    P.cols = {};
    const NX = nx(P), NY = ny(P);
    for (let i = 0; i <= NX; i++) for (let j = 0; j <= NY; j++) {
      const h = (hasB(P, key("h", i - 1, j)) ? 1 : 0) + (hasB(P, key("h", i, j)) ? 1 : 0);
      const v = (hasB(P, key("v", i, j - 1)) ? 1 : 0) + (hasB(P, key("v", i, j)) ? 1 : 0);
      if (h && v) {
        const corner = h === 1 && v === 1, edge = (h + v === 3);
        // perimeter junctions always; interior junctions only if wall below
        const ext = [cellT(P, i - 1, j - 1), cellT(P, i, j - 1), cellT(P, i - 1, j), cellT(P, i, j)].some(t => t === "none" || t === "balcony");
        if ((corner || ext) && onBelow(P, P.gx[i], P.gy[j], 400)) P.cols[key(i, j)] = 1;
        else if (P.below && P.below.length && onBelow(P, P.gx[i], P.gy[j])) P.cols[key(i, j)] = 1;
        else if (!P.below && (corner || edge || ext)) P.cols[key(i, j)] = 1;
      }
    }
    // enforce max span between columns on each run
    const R = runs(P);
    for (const r of R) {
      let last = r.a;
      for (let k = r.a + 1; k <= r.b; k++) {
        const [i, j] = nodeOf(r, k);
        if (P.cols[key(i, j)] || k === r.b) {
          const span = posOf(P, r, k) - posOf(P, r, last);
          if (span > (P.maxSpan || 6000)) {
            // add column at intermediate node nearest the middle that has a perpendicular wall or wall below
            let best = null;
            for (let m = last + 1; m < k; m++) {
              const [ii, jj] = nodeOf(r, m);
              const perp = r.dir === "h" ? (hasB(P, key("v", ii, jj - 1)) || hasB(P, key("v", ii, jj))) : (hasB(P, key("h", ii - 1, jj)) || hasB(P, key("h", ii, jj)));
              const score = Math.abs(posOf(P, r, m) - (posOf(P, r, last) + posOf(P, r, k)) / 2) - (perp ? 1e5 : 0) - (onBelow(P, P.gx[ii], P.gy[jj]) && P.below ? 1e5 : 0);
              if (!best || score < best.score) best = { m, score };
            }
            if (best) { const [ii, jj] = nodeOf(r, best.m); P.cols[key(ii, jj)] = 1; }
          }
          last = k;
        }
      }
    }
    return P;
  }

  // re-map features when grid lists change
  function regrid(P, gx, gy) {
    const old = { gx: P.gx, gy: P.gy };
    const cols = Object.keys(P.cols).filter(k => P.cols[k]).map(k => { const [i, j] = k.split(",").map(Number); return [old.gx[i], old.gy[j]]; });
    const beams = Object.entries(P.beams).map(([k, v]) => { const [d, i, j] = k.split(","); const I = +i, J = +j;
      return d === "h" ? { d, x1: old.gx[I], x2: old.gx[I + 1], y: old.gy[J], v } : { d, y1: old.gy[J], y2: old.gy[J + 1], x: old.gx[I], v }; });
    const cells = Object.entries(P.cells).map(([k, t]) => { const [i, j] = k.split(",").map(Number); return [(old.gx[i] + old.gx[i + 1]) / 2, (old.gy[j] + old.gy[j + 1]) / 2, t]; });
    P.gx = gx.slice().sort((a, b) => a - b); P.gy = gy.slice().sort((a, b) => a - b);
    P.cols = {}; P.beams = {}; P.cells = {};
    const near = (arr, v) => { const i = nearest(arr, v); return Math.abs(arr[i] - v) <= 300 ? i : -1; };
    cols.forEach(([x, y]) => { const i = near(P.gx, x), j = near(P.gy, y); if (i >= 0 && j >= 0) P.cols[key(i, j)] = 1; });
    beams.forEach(b => {
      if (b.d === "h") { const j = near(P.gy, b.y), a = near(P.gx, b.x1), c = near(P.gx, b.x2); if (j < 0 || a < 0 || c < 0) return; for (let i = a; i < c; i++) P.beams[key("h", i, j)] = b.v; }
      else { const i = near(P.gx, b.x), a = near(P.gy, b.y1), c = near(P.gy, b.y2); if (i < 0 || a < 0 || c < 0) return; for (let j = a; j < c; j++) P.beams[key("v", i, j)] = b.v; }
    });
    cells.forEach(([x, y, t]) => {
      for (let i = 0; i + 1 < P.gx.length; i++) for (let j = 0; j + 1 < P.gy.length; j++)
        if (x > P.gx[i] && x < P.gx[i + 1] && y > P.gy[j] && y < P.gy[j + 1]) P.cells[key(i, j)] = t;
    });
  }

  return { _solve: solve, design, panels, runs, autoColumns, fromAI, regrid, snapList, codeP, flex, flexT, asMin, ldAllow, ldEC, vcConc, linksDesign, interp, panelTrib, colCapacity, bt, st, A, key, cellT, T314 };
})();
if (typeof module !== "undefined") module.exports = SD;
