/* Excel workbook with live formulas (ExcelJS). Analysis results are inputs; section design is formula-driven. */
const XLS = (() => {
  const BLUE = { argb: "FF0000FF" }, INFILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
  const HEAD = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  const r1 = x => Math.round(x * 1000) / 1000;

  function head(ws, cols) {
    ws.columns = cols.map(([h, w]) => ({ header: h, width: w }));
    const r = ws.getRow(1);
    r.eachCell(c => { c.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 9 }; c.fill = HEAD; c.alignment = { wrapText: true, vertical: "middle", horizontal: "center" }; });
    r.height = 42; ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];
  }
  function put(ws, row, col, v, kind, fmt) {
    const c = ws.getCell(row, col);
    if (typeof v === "string" && v.startsWith("=")) c.value = { formula: v.slice(1) };
    else c.value = v;
    c.font = { name: "Arial", size: 9, color: kind === "in" ? BLUE : undefined, bold: kind === "res" };
    if (kind === "in") c.fill = INFILL;
    if (fmt) c.numFmt = fmt;
    c.alignment = { horizontal: "center" };
    return c;
  }

  async function build(P, D) {
    const C = D.C, ec = C.ec;
    const wb = new ExcelJS.Workbook(); wb.creator = "StructDesign"; wb.created = new Date();
    // ---------------- Read me + basis
    const rm = wb.addWorksheet("Basis");
    rm.getColumn(1).width = 46; rm.getColumn(2).width = 16; rm.getColumn(3).width = 70;
    const I = P.info || {};
    const rows = [
      ["STRUCTDESIGN – DESIGN WORKBOOK", "", ""], [`${I.name || ""} · Client: ${I.client || ""}`, "", ""], [`${I.company || ""} · ${I.engineer || ""} ${I.engineer2 ? "& " + I.engineer2 : ""}`, "", ""], ["", "", ""],
      ["Design code", ec ? "EC2" : "BS 8110", "Blue cells on yellow are inputs (from the app's analysis or your own values). Black cells are formulas."],
      [ec ? "fck (MPa)" : "fcu (MPa)", ec ? P.mat.fck : P.mat.fcu, "Concrete strength"],
      [ec ? "fyk (MPa)" : "fy (MPa)", ec ? P.mat.fyk : P.mat.fy, "Reinforcement yield strength"],
      ["γG (permanent)", C.gG, ec ? "EN 1990 eq 6.10" : "BS 8110 Table 2.1"],
      ["γQ (imposed)", C.gQ, ""],
      [ec ? "fyd = fyk/1.15" : "0.87 fy", "=B7*" + (ec ? "1/1.15" : "0.87"), "Design steel stress"],
      [ec ? "fcd = 0.85fck/1.5" : "0.45 fcu", ec ? "=0.85*B6/1.5" : "=0.45*B6", "Design concrete stress"],
      ["fctm = 0.3 fck^(2/3)", ec ? "=0.3*B6^(2/3)" : "", ec ? "EC2 Table 3.1" : "not used"],
      ["K′", ec ? 0.167 : 0.156, "Limit for singly reinforced sections"],
      ["", "", ""],
      ["Sheets", "", "Slabs – one row per panel: moments from coefficient × n × lx², design at short-span midspan and support."],
      ["", "", "Beams – one row per span: moments/shear from the app's continuous-beam analysis (inputs), bending and shear design by formula."],
      ["", "", "Columns – one row per storey: axial load and design moments (inputs), slenderness and axial capacity by formula; MRd from the app's strain-compatibility check."],
      ["", "", "Change any blue input (e.g. a slab thickness, bar size or moment) and the checks update."],
    ];
    rows.forEach((r, i) => { r.forEach((v, j) => put(rm, i + 1, j + 1, v, (i >= 4 && i <= 12 && j === 1 && !(typeof v === "string" && v.startsWith("="))) ? "in" : null)); });
    rm.getCell("A1").font = { bold: true, size: 14, name: "Arial", color: { argb: "FF1F4E78" } };
    for (let i = 1; i <= 18; i++) { rm.getCell(i, 1).alignment = { horizontal: "left" }; rm.getCell(i, 3).alignment = { horizontal: "left", wrapText: true }; }
    const F = "Basis!$B$6", FY = "Basis!$B$7", GG = "Basis!$B$8", GQ = "Basis!$B$9", FYD = "Basis!$B$10", FCD = "Basis!$B$11", FCT = "Basis!$B$12", KP = "Basis!$B$13";

    // ---------------- Slabs
    const ws = wb.addWorksheet("Slabs");
    head(ws, [["Mark", 8], ["Level", 12], ["Classification", 30], ["lx (m)", 7], ["ly (m)", 7], ["h (mm)", 7], ["cover", 6], ["finishes+part. kN/m²", 9], ["qk kN/m²", 7], ["gk = h·25 + fin", 8], ["n (ULS) kN/m²", 8],
      ["β short mid", 8], ["β short sup", 8], ["M short mid kNm/m", 9], ["M short sup kNm/m", 9], ["d (mm)", 7], ["K mid", 7], ["z mid", 7], ["As req mid", 8], ["As min", 8], ["bar Ø mid", 6], ["spacing mid", 7], ["As prov mid", 8], ["check mid", 9],
      ["K sup", 7], ["As req sup", 8], ["bar Ø sup", 6], ["spacing sup", 7], ["As prov sup", 8], ["check sup", 9]]);
    let r = 2;
    for (const L of D.levels) for (const p of L.panels) {
      if (!p.d) continue;
      const d = p.d, R = d.rows, lx = p.kind === "cant" ? p.Lc : p.lx;
      const mid = p.kind === "cant" ? R.sxp : R.sxp, sup = R.sxn;
      const cm = mid.M / (d.n * lx * lx), cs = sup ? sup.M / (d.n * lx * lx) : 0;
      const cov = d.h - d.d1 - 5;
      put(ws, r, 1, p.mark, "res"); put(ws, r, 2, L.lvl.name); put(ws, r, 3, p.cls); ws.getCell(r, 3).alignment = { horizontal: "left" };
      put(ws, r, 4, r1(lx), "in", "0.000"); put(ws, r, 5, r1(p.kind === "cant" ? p.Wd : p.ly), "in", "0.000"); put(ws, r, 6, d.h, "in", "0"); put(ws, r, 7, cov, "in", "0");
      put(ws, r, 8, r1(d.gk - d.h / 1000 * 25), "in", "0.00"); put(ws, r, 9, d.qk, "in", "0.00");
      put(ws, r, 10, `=F${r}/1000*25+H${r}`, null, "0.00"); put(ws, r, 11, `=${GG}*J${r}+${GQ}*I${r}`, null, "0.00");
      put(ws, r, 12, r1(cm * 1000) / 1000, "in", "0.0000"); put(ws, r, 13, Math.round(cs * 1e5) / 1e5, "in", "0.0000");
      put(ws, r, 14, `=L${r}*K${r}*D${r}^2`, null, "0.00"); put(ws, r, 15, `=M${r}*K${r}*D${r}^2`, null, "0.00");
      put(ws, r, 16, `=F${r}-G${r}-5`, null, "0");
      const K = (M) => `=IF(${M}${r}<=0,0,${M}${r}*1E6/(1000*P${r}^2*${F}))`;
      put(ws, r, 17, K("N"), null, "0.000");
      put(ws, r, 18, ec ? `=MIN(0.95*P${r},P${r}/2*(1+SQRT(MAX(1-3.53*Q${r},0))))` : `=MIN(0.95*P${r},P${r}*(0.5+SQRT(MAX(0.25-Q${r}/0.9,0))))`, null, "0");
      put(ws, r, 19, `=IF(N${r}<=0,0,N${r}*1E6/(${FYD}*R${r}))`, null, "0");
      put(ws, r, 20, ec ? `=MAX(0.26*${FCT}/${FY}*1000*P${r},0.0013*1000*P${r})` : `=0.0013*1000*F${r}`, null, "0");
      put(ws, r, 21, mid.bars ? mid.bars.d : 10, "in", "0"); put(ws, r, 22, mid.bars ? mid.bars.s : 200, "in", "0");
      put(ws, r, 23, `=PI()*U${r}^2/4*1000/V${r}`, null, "0");
      put(ws, r, 24, `=IF(AND(Q${r}<=${KP},W${r}>=MAX(S${r},T${r})),"OK","REVISE")`, "res");
      put(ws, r, 25, K("O"), null, "0.000");
      put(ws, r, 26, ec ? `=IF(O${r}<=0,0,O${r}*1E6/(${FYD}*MIN(0.95*P${r},P${r}/2*(1+SQRT(MAX(1-3.53*Y${r},0))))))` : `=IF(O${r}<=0,0,O${r}*1E6/(${FYD}*MIN(0.95*P${r},P${r}*(0.5+SQRT(MAX(0.25-Y${r}/0.9,0))))))`, null, "0");
      put(ws, r, 27, sup && sup.bars ? sup.bars.d : 10, "in", "0"); put(ws, r, 28, sup && sup.bars ? sup.bars.s : 250, "in", "0");
      put(ws, r, 29, `=PI()*AA${r}^2/4*1000/AB${r}`, null, "0");
      put(ws, r, 30, `=IF(O${r}<=0,"-",IF(AND(Y${r}<=${KP},AC${r}>=MAX(Z${r},T${r})),"OK","REVISE"))`, "res");
      r++;
    }

    // ---------------- Beams
    const wbm = wb.addWorksheet("Beams");
    head(wbm, [["Mark", 8], ["Level", 12], ["Type", 11], ["Span", 9], ["L (m)", 7], ["bw (mm)", 7], ["h (mm)", 7], ["b for sagging (beff)", 9], ["cover", 6], ["d = h−c−8−10", 8],
      ["M+ kNm (analysis)", 9], ["M− kNm (analysis)", 9], ["V kN (analysis)", 9], ["K sag", 7], ["z sag", 7], ["As req bottom", 9], ["As min", 8], ["Bottom bars", 9], ["As prov bottom", 9], ["check bottom", 9],
      ["K hog", 7], ["As req top", 9], ["Top bars", 9], ["As prov top", 9], ["check top", 9], ["Asw/s req (mm²/mm)", 10], ["link spacing", 8], ["Asw/s prov (H8 2-leg)", 10], ["check shear", 9]]);
    r = 2;
    for (const L of D.levels) for (const b of L.runs) {
      if (!b.des) continue;
      b.des.spans.forEach((s, k) => {
        const top = s.topL.A >= s.topR.A ? s.topL : s.topR;
        put(wbm, r, 1, k ? "" : b.mark, "res"); put(wbm, r, 2, L.lvl.name); put(wbm, r, 3, b.type);
        put(wbm, r, 4, s.kind === "span" ? `span ${k + 1}` : "cantilever"); put(wbm, r, 5, r1(s.L), null, "0.00");
        put(wbm, r, 6, b.des.bw, "in", "0"); put(wbm, r, 7, b.des.h, "in", "0"); put(wbm, r, 8, Math.round(s.inFlange !== false ? s.bf : b.des.bw), "in", "0"); put(wbm, r, 9, P.mat.cb, "in", "0");
        put(wbm, r, 10, `=G${r}-I${r}-8-10`, null, "0");
        put(wbm, r, 11, r1(s.kind === "span" ? s.Mpos : 0), "in", "0.0"); put(wbm, r, 12, r1(Math.max(s.MnL, s.MnR)), "in", "0.0"); put(wbm, r, 13, r1(s.V), "in", "0.0");
        put(wbm, r, 14, `=IF(K${r}<=0,0,K${r}*1E6/(H${r}*J${r}^2*${F}))`, null, "0.000");
        put(wbm, r, 15, ec ? `=MIN(0.95*J${r},J${r}/2*(1+SQRT(MAX(1-3.53*N${r},0))))` : `=MIN(0.95*J${r},J${r}*(0.5+SQRT(MAX(0.25-N${r}/0.9,0))))`, null, "0");
        put(wbm, r, 16, `=IF(K${r}<=0,0,K${r}*1E6/(${FYD}*O${r}))`, null, "0");
        put(wbm, r, 17, ec ? `=MAX(0.26*${FCT}/${FY}*F${r}*J${r},0.0013*F${r}*J${r})` : `=0.0013*F${r}*G${r}`, null, "0");
        put(wbm, r, 18, SD.bt(s.bot), "in"); put(wbm, r, 19, Math.round(s.bot.A), "in", "0");
        put(wbm, r, 20, `=IF(AND(N${r}<=${KP},S${r}>=MAX(P${r},Q${r})),"OK","REVISE")`, "res");
        put(wbm, r, 21, `=IF(L${r}<=0,0,L${r}*1E6/(F${r}*J${r}^2*${F}))`, null, "0.000");
        put(wbm, r, 22, ec ? `=IF(L${r}<=0,0,L${r}*1E6/(${FYD}*MIN(0.95*J${r},J${r}/2*(1+SQRT(MAX(1-3.53*U${r},0))))))` : `=IF(L${r}<=0,0,L${r}*1E6/(${FYD}*MIN(0.95*J${r},J${r}*(0.5+SQRT(MAX(0.25-U${r}/0.9,0))))))`, null, "0");
        put(wbm, r, 23, SD.bt(top), "in"); put(wbm, r, 24, Math.round(top.A), "in", "0");
        put(wbm, r, 25, `=IF(L${r}<=0,"-",IF(AND(U${r}<=${KP},X${r}>=V${r}),"OK","REVISE"))`, "res");
        if (ec) put(wbm, r, 26, `=MAX(M${r}*1000/(0.9*J${r}*${FYD}*2.5),0.08*SQRT(${F})*F${r}/${FY})`, null, "0.000");
        else put(wbm, r, 26, `=MAX(0.4*F${r}/${FYD},F${r}*(M${r}*1000/(F${r}*J${r})-0.79*MIN(3,100*S${r}/(F${r}*J${r}))^(1/3)*MAX(1,400/J${r})^0.25/1.25*(MIN(${F},40)/25)^(1/3))/${FYD})`, null, "0.000");
        put(wbm, r, 27, s.links.s, "in", "0");
        put(wbm, r, 28, `=2*PI()*8^2/4/AA${r}`, null, "0.000");
        put(wbm, r, 29, `=IF(AND(AB${r}>=Z${r},AA${r}<=0.75*J${r}),"OK","REVISE")`, "res");
        r++;
      });
    }

    // ---------------- Columns
    const wc = wb.addWorksheet("Columns");
    head(wc, [["Column", 8], ["Storey", 16], ["b = h (mm)", 8], ["l0 (m)", 7], ["NEd kN", 8], ["MEd,x kNm", 8], ["MEd,y kNm", 8], ["λ = l0√12/h" + (ec ? "" : " (le/h)"), 9], [ec ? "λlim = 20ABC/√n" : "limit", 9], ["Class", 13],
      ["Bars", 8], ["Asc (mm²)", 8], ["Asc %", 7], ["NRd kN", 8], ["NEd/NRd", 8], ["MRd at NEd (app)", 9], [ec ? "biaxial (MEdx/MRd)^a+(MEdy/MRd)^a" : "M′/MRd", 12], ["check", 9]]);
    r = 2;
    for (const c of D.cols) {
      if (!c.res) continue;
      c.res.des.forEach((d, k) => {
        put(wc, r, 1, k ? "" : c.name, "res"); put(wc, r, 2, `below ${d.level}`);
        put(wc, r, 3, c.res.b, "in", "0"); put(wc, r, 4, r1(d.l0), "in", "0.00"); put(wc, r, 5, r1(d.N), "in", "0.0");
        put(wc, r, 6, r1(d.ax.MEd), "in", "0.0"); put(wc, r, 7, r1(d.ay.MEd), "in", "0.0");
        put(wc, r, 8, ec ? `=D${r}*1000*SQRT(12)/C${r}` : `=D${r}*1000/C${r}`, null, "0.0");
        put(wc, r, 9, ec ? `=20*0.7*SQRT(1+2*L${r}*${FYD}/(C${r}^2*${FCD}))*0.7/SQRT(MAX(E${r}*1000/(C${r}^2*${FCD}),0.01))` : 15, ec ? null : "in", "0.0");
        put(wc, r, 10, ec ? `=IF(H${r}<=I${r},"SHORT","LONG (slender)")` : `=IF(H${r}<I${r},"SHORT","LONG (slender)")`);
        put(wc, r, 11, `${d.nb}H${d.phi}`, "in"); put(wc, r, 12, Math.round(d.Ast), "in", "0");
        put(wc, r, 13, `=100*L${r}/C${r}^2`, null, "0.00");
        put(wc, r, 14, ec ? `=(${FCD}*C${r}^2+L${r}*${FYD})/1000` : `=(0.45*${F}*(C${r}^2-L${r})+${FYD}*L${r})/1000`, null, "0");
        put(wc, r, 15, `=E${r}/N${r}`, null, "0.000");
        put(wc, r, 16, r1(d.MRd), "in", "0.0");
        if (ec) put(wc, r, 17, `=(F${r}/P${r})^IF(O${r}<=0.1,1,IF(O${r}<=0.7,1+(O${r}-0.1)/0.6*0.5,1.5+(O${r}-0.7)/0.3*0.5))+(G${r}/P${r})^IF(O${r}<=0.1,1,IF(O${r}<=0.7,1+(O${r}-0.1)/0.6*0.5,1.5+(O${r}-0.7)/0.3*0.5))`, null, "0.000");
        else put(wc, r, 17, r1(d.util), "in", "0.000");
        put(wc, r, 18, `=IF(AND(Q${r}<=1,O${r}<1,M${r}>=${ec ? 0.2 : 0.4},M${r}<=${ec ? 4 : 6}),"OK","REVISE")`, "res");
        r++;
      });
    }
    const buf = await wb.xlsx.writeBuffer();
    return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  return { build };
})();
if (typeof module !== "undefined") module.exports = XLS;
