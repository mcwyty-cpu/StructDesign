/* StructDesign – UI */
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const toast = (m, bad) => { const t = $("#toast"); t.textContent = m; t.className = "show" + (bad ? " bad" : ""); clearTimeout(t._h); t._h = setTimeout(() => t.className = "", 3800); };

  // ------------------------------------------------------------------ state
  const DEF = () => ({
    v: 1,
    info: { name: "New project", client: "", location: "", company: "Urban Forge Construction Limited", address: "P. O. Box 4367-30100, Eldoret, Kenya",
            phone: "Tel 0723385748 / 0715276999", engineer: "Eng. Gasaya W.", engineer2: "Eng. Hezron K.", date: new Date().toISOString().slice(0, 10) },
    code: "EC2", mat: { fck: 25, fyk: 500, fcu: 30, fy: 500, cs: 25, cb: 30 },
    levels: [{ name: "First floor", kind: "floor", h: 150, fin: 1.5, part: 1.0, qk: 1.5, ext: 10.0, int: 8.9, H: 3.0 },
             { name: "Roof", kind: "roof", h: 150, fin: 2.1, part: 0, qk: 1.5, ext: 4.3, int: 0, H: 3.0 }],
    balu: 0.5, maxSpan: 6000, colMin: 225, beta: 0.85, beamMinH: 450, slabMaxS: 250,
    gx: [0, 4000, 8000], gy: [0, 4000, 8000], cols: {}, beams: {}, cells: {}, rooms: [], below: null,
    img: null, imgBelow: null, aiNotes: ""
  });
  let P = DEF();
  try { const s = localStorage.getItem("sd_project"); if (s) P = Object.assign(DEF(), JSON.parse(s)); } catch (e) {}
  let D = null, SHEETS_CACHE = null, CALC_CACHE = null, dirty = true;
  const save = () => {
    dirty = true;
    try { localStorage.setItem("sd_project", JSON.stringify(P)); }
    catch (e) { try { const c = Object.assign({}, P, { img: null, imgBelow: null }); localStorage.setItem("sd_project", JSON.stringify(c)); } catch (e2) {} }
  };

  // ------------------------------------------------------------------ platform (Claude app vs installed app)
  let sampleFn = null, sampleImages = false, downloads = null;
  if (window.claude && window.claude.use) {
    window.claude.use("sample").then(async s => {
      sampleFn = s;
      if (s) { try { const l = await s.limits(); sampleImages = !!(l && l.images); } catch (e) {} }
      renderAISource();
    });
    window.claude.use("downloads").then(d => { downloads = d; });
  }
  function renderAISource() {
    const el = $("#aiSource");
    if (sampleFn && sampleImages) { el.innerHTML = `<span class="ok">✔ Using Claude in this app — no API key needed.</span>`; $("#keyBox").hidden = true; }
    else { el.innerHTML = `Uses your Anthropic API key (stored only on this device).`; $("#keyBox").hidden = false; }
  }
  async function saveFile(name, data, mime) {
    // Android app (Capacitor): write to cache, then open the share sheet (Save to Files / Drive / WhatsApp…)
    const Cap = window.Capacitor;
    if (Cap && Cap.isNativePlatform && Cap.isNativePlatform() && Cap.Plugins && Cap.Plugins.Filesystem) {
      try {
        const blob = data instanceof Blob ? data : new Blob([data], { type: mime || "application/octet-stream" });
        const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
        const w = await Cap.Plugins.Filesystem.writeFile({ path: name, data: b64, directory: "CACHE" });
        if (Cap.Plugins.Share) await Cap.Plugins.Share.share({ title: name, url: w.uri, dialogTitle: "Save or send " + name });
        else toast("Saved to app storage: " + name);
      } catch (e) { if (!/cancel/i.test(String(e && (e.message || e)))) toast("Could not save: " + (e.message || e), true); }
      return;
    }
    if (downloads) {
      try { await downloads.save({ filename: name, data }); toast("Saved " + name); return; }
      catch (e) { if (e && e.code === "declined") return; toast("Download not available here: " + (e.code || e), true); return; }
    }
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || "application/octet-stream" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  // ------------------------------------------------------------------ tabs
  function showTab(t) {
    $$(".tab").forEach(b => b.classList.toggle("on", b.dataset.t === t));
    $$("section.pane").forEach(s => s.hidden = s.id !== "p-" + t);
    if (t === "layout") drawEditor();
    if (t === "loads") renderLoads();
    if (t === "results") { runDesign(); renderResults(); }
    if (t === "drawings") { runDesign(); renderSheets(); }
    if (t === "calcs") { runDesign(); renderCalcs(); }
    if (t === "model") { runDesign(); render3D(); }
    try { localStorage.setItem("sd_tab", t); } catch (e) {}
  }
  $$(".tab").forEach(b => b.onclick = () => showTab(b.dataset.t));

  // ------------------------------------------------------------------ import drawings
  const slots = { plan: { blob: null, w: 0, h: 0, url: null }, below: { blob: null, w: 0, h: 0, url: null } };
  let activeSlot = "plan";
  $$(".drop").forEach(d => {
    d.onclick = () => { activeSlot = d.dataset.slot; $$(".drop").forEach(x => x.classList.toggle("act", x === d)); };
    d.addEventListener("dragover", e => { e.preventDefault(); d.classList.add("over"); });
    d.addEventListener("dragleave", () => d.classList.remove("over"));
    d.addEventListener("drop", e => { e.preventDefault(); d.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) loadFile(f, d.dataset.slot); });
  });
  $$(".pick").forEach(i => i.onchange = () => { if (i.files[0]) loadFile(i.files[0], i.dataset.slot); i.value = ""; });
  document.addEventListener("paste", e => {
    const items = [...(e.clipboardData || {}).items || []];
    const it = items.find(x => x.kind === "file");
    if (it) { e.preventDefault(); loadFile(it.getAsFile(), activeSlot); }
  });
  $$(".pasteBtn").forEach(b => b.onclick = async (ev) => {
    ev.stopPropagation();
    const slot = b.dataset.slot;
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) { const t = it.types.find(x => x.startsWith("image/")); if (t) { loadFile(await it.getType(t), slot); return; } }
      toast("No image on the clipboard", true);
    } catch (e) { activeSlot = slot; toast("Press Ctrl+V (or long-press → Paste) to paste the drawing"); }
  });

  async function loadFile(file, slot) {
    try {
      $("#st-" + slot).textContent = "Loading…";
      let canvas;
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")) {
        if (!window.pdfjsLib) throw new Error("PDF reader not loaded (needs internet the first time)");
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        let pg = 1;
        pg = Math.min(Math.max(parseInt($("#pg-" + slot).value || "1", 10) || 1, 1), pdf.numPages);
        if (pdf.numPages > 1) toast(`PDF has ${pdf.numPages} pages – showing page ${pg} (change "PDF page" and load again for another)`);
        const page = await pdf.getPage(pg);
        const vp0 = page.getViewport({ scale: 1 }), sc = 2400 / Math.max(vp0.width, vp0.height);
        const vp = page.getViewport({ scale: sc });
        canvas = document.createElement("canvas"); canvas.width = vp.width; canvas.height = vp.height;
        const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
      } else {
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
        canvas = document.createElement("canvas"); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0);
      }
      setSlotCanvas(slot, canvas);
    } catch (e) { $("#st-" + slot).textContent = "Could not read file: " + (e.message || e); }
  }
  function setSlotCanvas(slot, canvas) {
    slots[slot].full = canvas; slots[slot].crop = null;
    showPreview(slot);
  }
  // preview with drag-to-crop
  function showPreview(slot) {
    const S = slots[slot], cv = S.full, box = $("#pv-" + slot);
    box.innerHTML = "";
    const c = document.createElement("canvas"); const sc = Math.min(1, 900 / cv.width);
    c.width = cv.width * sc; c.height = cv.height * sc; c.getContext("2d").drawImage(cv, 0, 0, c.width, c.height);
    c.className = "pvc"; box.appendChild(c);
    const sel = document.createElement("div"); sel.className = "sel"; box.appendChild(sel);
    let st = null;
    const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    c.onpointerdown = e => { st = pt(e); c.setPointerCapture(e.pointerId); };
    c.onpointermove = e => {
      if (!st) return; const p = pt(e), r = c.getBoundingClientRect(), br = box.getBoundingClientRect();
      const x0 = Math.min(st[0], p[0]), y0 = Math.min(st[1], p[1]), x1 = Math.max(st[0], p[0]), y1 = Math.max(st[1], p[1]);
      Object.assign(sel.style, { display: "block", left: (r.left - br.left + x0 * r.width) + "px", top: (r.top - br.top + y0 * r.height) + "px", width: ((x1 - x0) * r.width) + "px", height: ((y1 - y0) * r.height) + "px" });
      S.crop = [x0, y0, x1, y1];
    };
    c.onpointerup = () => { st = null; if (S.crop && (S.crop[2] - S.crop[0] < 0.03 || S.crop[3] - S.crop[1] < 0.03)) { S.crop = null; sel.style.display = "none"; } updSt(slot); };
    updSt(slot);
  }
  function updSt(slot) {
    const S = slots[slot];
    $("#st-" + slot).textContent = S.full ? `${S.full.width}×${S.full.height}px loaded${S.crop ? " · cropped to selection" : " · drag on the picture to crop to one plan"}` : "";
  }
  // prepare JPEG for AI (≤1.15 MP so the platform does not downsize further)
  async function prepImage(slot) {
    const S = slots[slot]; if (!S.full) return null;
    const cv = S.full, cr = S.crop || [0, 0, 1, 1];
    const sx = cr[0] * cv.width, sy = cr[1] * cv.height, sw = (cr[2] - cr[0]) * cv.width, sh = (cr[3] - cr[1]) * cv.height;
    const k = Math.min(1, Math.sqrt(1.15e6 / (sw * sh)), 1568 / Math.max(sw, sh));
    const o = document.createElement("canvas"); o.width = Math.round(sw * k); o.height = Math.round(sh * k);
    const ctx = o.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, o.width, o.height); ctx.drawImage(cv, sx, sy, sw, sh, 0, 0, o.width, o.height);
    const blob = await new Promise(r => o.toBlob(r, "image/jpeg", 0.9));
    return { blob, w: o.width, h: o.height, url: o.toDataURL("image/jpeg", 0.75) };
  }

  // ------------------------------------------------------------------ AI reading
  function aiPrompt(w, h, below) {
    return `You are a structural engineer reading an architectural FLOOR PLAN image (${w} x ${h} pixels) to set up a reinforced-concrete frame${below ? " — this image is the FLOOR BELOW; I only need its walls to place columns" : ""}.

Reply with ONLY one JSON object, no other text, in exactly this shape:
{"grid_x_mm":[0,4950,11800],"grid_y_mm":[0,3950,9800],
 "walls":[{"dir":"h","y_mm":0,"x1_mm":0,"x2_mm":11800,"t_mm":200},{"dir":"v","x_mm":0,"y1_mm":0,"y2_mm":9800,"t_mm":200}],
 "voids":[{"x1_mm":6400,"y1_mm":6500,"x2_mm":8850,"y2_mm":9800,"label":"stair"}],
 "balconies":[{"x1_mm":-1800,"y1_mm":0,"x2_mm":0,"y2_mm":3950}],
 "outside":[{"x1_mm":-1800,"y1_mm":3950,"x2_mm":0,"y2_mm":9800}],
 "rooms":[{"name":"Master bedroom","x_mm":2400,"y_mm":2000}],
 "image_px":{"left":120,"right":1180,"top":95,"bottom":890},
 "overall_mm":{"width":11800,"depth":9800},
 "notes":"..."}

Rules:
1. Units are millimetres. ORIGIN (0,0) = the CENTRELINE of the outer wall at the TOP-LEFT corner of the main building as drawn. x increases to the right, y increases DOWNWARD (image orientation). Balconies or porches left of / above the origin have negative values.
2. Read the WRITTEN DIMENSIONS on the drawing and add up dimension chains. Only estimate from pixels when no dimension is written (a door leaf is about 900 mm). Measure to wall centrelines (half the wall thickness in from the outer face of external walls).
3. "walls": every masonry wall as a CENTRELINE segment. Horizontal walls: dir "h" with y_mm, x1_mm, x2_mm. Vertical walls: dir "v" with x_mm, y1_mm, y2_mm. A wall with doors or windows in it is still ONE continuous wall. Ignore furniture, door swings, hatching, dimension lines, fixtures, and thin partitions such as shower screens. Walls that line up within 150 mm should share the same coordinate.
4. "grid_x_mm" / "grid_y_mm": every distinct wall-centreline coordinate (and the outer edges of balconies/porches), sorted.
5. "voids": stair wells and double-height openings where there is no floor slab at this level. "balconies": balcony/terrace/porch-roof slabs outside the main walls. "outside": rectangles inside the overall grid extents that are not part of the building (e.g. the empty corners of an L-shaped house).
6. "image_px": pixel coordinates in THIS image of the vertical lines x = min(grid_x_mm) and x = max(grid_x_mm), and the horizontal lines y = min(grid_y_mm) and y = max(grid_y_mm).
7. "notes": say which plan you read if the sheet shows more than one, and anything you were unsure about.`;
  }
  function parseJSON(t) {
    try { return JSON.parse(t); } catch (e) {}
    const m = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) try { return JSON.parse(m[1]); } catch (e) {}
    const a = t.indexOf("{"), b = t.lastIndexOf("}"); if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error("AI reply was not valid JSON");
  }
  async function askAI(promptText, img) {
    if (sampleFn && sampleImages) {
      return await sampleFn.json(promptText, { images: [img.blob], modelTier: "complex" });
    }
    const key = ($("#apikey").value || "").trim();
    if (!key) throw new Error("Enter your Anthropic API key below — or open the app inside Claude.");
    try { localStorage.setItem("sd_key", key); } catch (e) {}
    const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(",")[1]); fr.readAsDataURL(img.blob); });
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: $("#model").value || "claude-sonnet-5-5", max_tokens: 8000,
        messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } }, { type: "text", text: promptText }] }] })
    });
    const j = await res.json();
    if (!res.ok) throw new Error((j.error && j.error.message) || ("HTTP " + res.status));
    return parseJSON(j.content.map(c => c.text || "").join(""));
  }
  $("#readBtn").onclick = async () => {
    const st = $("#aiStatus");
    if (!slots.plan.full) { toast("Add the floor plan first", true); return; }
    $("#readBtn").disabled = true;
    try {
      st.textContent = "Reading the floor plan… (this can take up to a minute)";
      const img = await prepImage("plan");
      const J = await askAI(aiPrompt(img.w, img.h, false), img);
      let below = null, imgB = null, JB = null;
      if (slots.below.full) {
        st.textContent = "Reading the floor below…";
        imgB = await prepImage("below");
        JB = await askAI(aiPrompt(imgB.w, imgB.h, true), imgB);
        below = JB.walls || [];
      }
      const N = SD.fromAI(J, below);
      if (N.gx.length < 2 || N.gy.length < 2) throw new Error("No grid found — try cropping to one plan");
      Object.assign(P, { gx: N.gx, gy: N.gy, beams: N.beams, cells: N.cells, rooms: N.rooms, below: below });
      P.img = { src: img.url, w: img.w, h: img.h, px: J.image_px || null, op: 0.45 };
      P.imgBelow = imgB && JB ? { src: imgB.url, w: imgB.w, h: imgB.h, px: JB.image_px || null } : null;
      SD.autoColumns(P);
      P.aiNotes = (J.notes || "") + (JB && JB.notes ? "\nFloor below: " + JB.notes : "");
      save();
      st.innerHTML = `✔ Read ${N.gx.length}×${N.gy.length} grid lines, ${(J.walls || []).length} walls${below ? `, ${below.length} walls below` : ""}. <b>Check the layout next.</b>`;
      $("#aiNotes").textContent = P.aiNotes;
      showTab("layout");
    } catch (e) {
      const code = e && e.code;
      st.textContent = "AI reading failed: " + (code === "not_granted" ? "permission was declined" : (e.message || code || e));
    } finally { $("#readBtn").disabled = false; }
  };
  $("#demoBtn").onclick = () => {
    const { J, below } = demoProject();
    const N = SD.fromAI(J, below);
    P = Object.assign(DEF(), { gx: N.gx, gy: N.gy, beams: N.beams, cells: N.cells, rooms: N.rooms, below });
    P.info.name = "Proposed residence (demo)"; P.info.client = "Mr Mbaka"; P.info.location = "Eldoret";
    P.maxSpan = 6500;
    SD.autoColumns(P); save(); toast("Demo project loaded"); showTab("layout");
  };
  $("#blankBtn").onclick = () => {
    const gx = $("#blankX").value.split(/[,\s]+/).map(Number).filter(Number.isFinite), gy = $("#blankY").value.split(/[,\s]+/).map(Number).filter(Number.isFinite);
    if (gx.length < 2 || gy.length < 2) { toast("Enter at least two grid positions each way", true); return; }
    P.gx = gx.sort((a, b) => a - b); P.gy = gy.sort((a, b) => a - b); P.cols = {}; P.beams = {}; P.cells = {}; P.below = null; P.img = null;
    for (let i = 0; i < P.gx.length; i++) for (let j = 0; j < P.gy.length; j++) P.cols[SD.key(i, j)] = 1;
    for (let j = 0; j < P.gy.length; j++) for (let i = 0; i + 1 < P.gx.length; i++) P.beams[SD.key("h", i, j)] = { wall: j === 0 || j === P.gy.length - 1 ? 1 : 0 };
    for (let i = 0; i < P.gx.length; i++) for (let j = 0; j + 1 < P.gy.length; j++) P.beams[SD.key("v", i, j)] = { wall: i === 0 || i === P.gx.length - 1 ? 1 : 0 };
    save(); showTab("layout");
  };

  // ------------------------------------------------------------------ layout editor
  let tool = "col", zoom = 1;
  $$(".tool").forEach(b => b.onclick = () => { tool = b.dataset.tool; $$(".tool").forEach(x => x.classList.toggle("on", x === b)); });
  $("#zin").onclick = () => { zoom = Math.min(6, zoom * 1.4); drawEditor(); };
  $("#zout").onclick = () => { zoom = Math.max(0.6, zoom / 1.4); drawEditor(); };
  $("#autoCols").onclick = () => { SD.autoColumns(P); save(); drawEditor(); toast("Columns proposed — check them against openings"); };
  $("#op").oninput = e => { if (P.img) { P.img.op = +e.target.value; save(); drawEditor(); } };
  $("#showBelow").onchange = drawEditor;
  $("#applyGrid").onclick = () => {
    const gx = $("#gxIn").value.split(/[,\s]+/).map(Number).filter(Number.isFinite), gy = $("#gyIn").value.split(/[,\s]+/).map(Number).filter(Number.isFinite);
    if (gx.length < 2 || gy.length < 2) { toast("Need at least two lines each way", true); return; }
    SD.regrid(P, gx, gy); save(); drawEditor(); toast("Grid updated");
  };
  function drawEditor() {
    $("#gxIn").value = P.gx.join(", "); $("#gyIn").value = P.gy.join(", ");
    $("#op").value = P.img ? P.img.op : 0.45;
    const gx = P.gx, gy = P.gy, x0 = gx[0], x1 = gx[gx.length - 1], y0 = gy[0], y1 = gy[gy.length - 1];
    const pad = Math.max(x1 - x0, y1 - y0) * 0.08 + 800;
    const vb = [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad];
    const fs = Math.max(x1 - x0, y1 - y0) / 55;
    const o = [];
    if (P.img && P.img.px && $("#showImg").checked) {
      const px = P.img.px, sx = (x1 - x0) / Math.max(px.right - px.left, 1), sy = (y1 - y0) / Math.max(px.bottom - px.top, 1);
      o.push(`<image href="${P.img.src}" x="${x0 - px.left * sx}" y="${y0 - px.top * sy}" width="${P.img.w * sx}" height="${P.img.h * sy}" opacity="${P.img.op}" preserveAspectRatio="none"/>`);
    }
    for (let i = 0; i + 1 < gx.length; i++) for (let j = 0; j + 1 < gy.length; j++) {
      const t = SD.cellT(P, i, j), col = { slab: "rgba(120,170,230,0.18)", void: "rgba(250,250,250,0.6)", balcony: "rgba(140,120,230,0.30)", none: "rgba(0,0,0,0)" }[t];
      o.push(`<rect class="cell" data-k="${i},${j}" x="${gx[i]}" y="${gy[j]}" width="${gx[i + 1] - gx[i]}" height="${gy[j + 1] - gy[j]}" fill="${col}" stroke="#bcd" stroke-width="${fs / 12}"/>`);
      if (t === "void") o.push(`<path d="M${gx[i]},${gy[j]}L${gx[i + 1]},${gy[j + 1]}M${gx[i + 1]},${gy[j]}L${gx[i]},${gy[j + 1]}" stroke="#999" stroke-width="${fs / 10}"/>`);
      if (t === "none") o.push(`<rect x="${gx[i]}" y="${gy[j]}" width="${gx[i + 1] - gx[i]}" height="${gy[j + 1] - gy[j]}" fill="url(#hatchN)"/>`);
    }
    gx.forEach((v, i) => o.push(`<line x1="${v}" y1="${y0 - pad * 0.7}" x2="${v}" y2="${y1 + pad * 0.3}" stroke="#7a8" stroke-width="${fs / 12}" stroke-dasharray="${fs} ${fs / 2}"/><text x="${v}" y="${y0 - pad * 0.75}" font-size="${fs}" text-anchor="middle" fill="#264">${SHEETS.letters(i)}</text>`));
    gy.forEach((v, j) => o.push(`<line x1="${x0 - pad * 0.7}" y1="${v}" x2="${x1 + pad * 0.3}" y2="${v}" stroke="#7a8" stroke-width="${fs / 12}" stroke-dasharray="${fs} ${fs / 2}"/><text x="${x0 - pad * 0.78}" y="${v + fs / 3}" font-size="${fs}" text-anchor="middle" fill="#264">${j + 1}</text>`));
    for (let i = 0; i + 1 < gx.length; i++) o.push(`<text x="${(gx[i] + gx[i + 1]) / 2}" y="${y0 - pad * 0.35}" font-size="${fs * 0.75}" text-anchor="middle" fill="#555">${Math.round(gx[i + 1] - gx[i])}</text>`);
    for (let j = 0; j + 1 < gy.length; j++) o.push(`<text x="${x0 - pad * 0.35}" y="${(gy[j] + gy[j + 1]) / 2}" font-size="${fs * 0.75}" text-anchor="middle" fill="#555" transform="rotate(-90 ${x0 - pad * 0.35} ${(gy[j] + gy[j + 1]) / 2})">${Math.round(gy[j + 1] - gy[j])}</text>`);
    if (P.below && $("#showBelow").checked) for (const w of P.below)
      o.push(w.dir === "h" ? `<line x1="${w.x1_mm}" y1="${w.y_mm}" x2="${w.x2_mm}" y2="${w.y_mm}" stroke="#e67e22" stroke-width="${fs / 5}" stroke-dasharray="${fs / 2} ${fs / 3}"/>`
                           : `<line x1="${w.x_mm}" y1="${w.y1_mm}" x2="${w.x_mm}" y2="${w.y2_mm}" stroke="#e67e22" stroke-width="${fs / 5}" stroke-dasharray="${fs / 2} ${fs / 3}"/>`);
    // all segments (clickable)
    for (let j = 0; j < gy.length; j++) for (let i = 0; i + 1 < gx.length; i++) seg("h", i, j, gx[i], gy[j], gx[i + 1], gy[j]);
    for (let i = 0; i < gx.length; i++) for (let j = 0; j + 1 < gy.length; j++) seg("v", i, j, gx[i], gy[j], gx[i], gy[j + 1]);
    function seg(d, i, j, ax, ay, bx, by) {
      const k = SD.key(d, i, j), b = P.beams[k];
      o.push(`<line class="seg" data-k="${k}" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${b ? (b.wall ? "#1f4e78" : "#4a90d9") : "rgba(0,0,0,0.04)"}" stroke-width="${b ? fs / 2.2 : fs / 1.5}" ${b && !b.wall ? `stroke-dasharray="${fs / 1.5} ${fs / 3}"` : ""}/>`);
    }
    for (let i = 0; i < gx.length; i++) for (let j = 0; j < gy.length; j++) {
      const c = P.cols[SD.key(i, j)], z = fs * 0.9;
      o.push(c ? `<rect class="node" data-k="${i},${j}" x="${gx[i] - z / 2}" y="${gy[j] - z / 2}" width="${z}" height="${z}" fill="#111"/>`
               : `<circle class="node" data-k="${i},${j}" cx="${gx[i]}" cy="${gy[j]}" r="${fs / 3}" fill="#fff" stroke="#999" stroke-width="${fs / 15}"/>`);
    }
    for (const r of P.rooms || []) o.push(`<text x="${r.x_mm}" y="${r.y_mm}" font-size="${fs * 0.7}" text-anchor="middle" fill="#345" pointer-events="none">${esc(r.name)}</text>`);
    const svg = `<svg id="ed" xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(" ")}" style="width:${100 * zoom}%">
      <defs><pattern id="hatchN" width="${fs}" height="${fs}" patternUnits="userSpaceOnUse"><path d="M0,${fs}L${fs},0" stroke="#ddd" stroke-width="${fs / 12}"/></pattern></defs>${o.join("")}</svg>`;
    $("#edwrap").innerHTML = svg;
    $("#edInfo").textContent = `${gx.length} × ${gy.length} grid · ${Object.values(P.cols).filter(Boolean).length} columns · ${Object.keys(P.beams).length} beam segments`;
    const ed = $("#ed");
    ed.onclick = e => {
      const pt = ed.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const m = pt.matrixTransform(ed.getScreenCTM().inverse()), X = m.x, Y = m.y;
      if (tool === "col") {
        let best = null; gx.forEach((x, i) => gy.forEach((y, j) => { const d = Math.hypot(x - X, y - Y); if (!best || d < best.d) best = { d, i, j }; }));
        if (best && best.d < fs * 3) { const k = SD.key(best.i, best.j); if (P.cols[k]) delete P.cols[k]; else P.cols[k] = 1; }
      } else if (tool === "beam" || tool === "wall") {
        let best = null;
        const test = (d, i, j, ax, ay, bx, by) => {
          const L2 = (bx - ax) ** 2 + (by - ay) ** 2, t = Math.max(0, Math.min(1, ((X - ax) * (bx - ax) + (Y - ay) * (by - ay)) / L2));
          const dd = Math.hypot(X - (ax + t * (bx - ax)), Y - (ay + t * (by - ay))); if (!best || dd < best.dd) best = { dd, k: SD.key(d, i, j) };
        };
        for (let j = 0; j < gy.length; j++) for (let i = 0; i + 1 < gx.length; i++) test("h", i, j, gx[i], gy[j], gx[i + 1], gy[j]);
        for (let i = 0; i < gx.length; i++) for (let j = 0; j + 1 < gy.length; j++) test("v", i, j, gx[i], gy[j], gx[i], gy[j + 1]);
        if (best && best.dd < fs * 2.5) {
          if (tool === "beam") { if (P.beams[best.k]) delete P.beams[best.k]; else P.beams[best.k] = { wall: 0 }; }
          else { if (!P.beams[best.k]) P.beams[best.k] = { wall: 1 }; else P.beams[best.k].wall = P.beams[best.k].wall ? 0 : 1; }
        }
      } else if (tool === "cell") {
        for (let i = 0; i + 1 < gx.length; i++) for (let j = 0; j + 1 < gy.length; j++) if (X > gx[i] && X < gx[i + 1] && Y > gy[j] && Y < gy[j + 1]) {
          const order = ["slab", "void", "balcony", "none"], t = SD.cellT(P, i, j), n = order[(order.indexOf(t) + 1) % 4];
          if (n === "slab") delete P.cells[SD.key(i, j)]; else P.cells[SD.key(i, j)] = n;
        }
      }
      save(); drawEditor();
    };
  }
  $("#showImg").onchange = drawEditor;

  // ------------------------------------------------------------------ loads & settings
  function renderLoads() {
    const I = P.info;
    const f = (id, label, v, type = "text") => `<label>${label}<input data-f="${id}" type="${type}" value="${esc(v)}"></label>`;
    $("#infoForm").innerHTML = [f("info.name", "Project", I.name), f("info.client", "Client", I.client), f("info.location", "Location", I.location), f("info.company", "Company", I.company),
      f("info.address", "Address", I.address), f("info.phone", "Telephone", I.phone), f("info.engineer", "Designed by", I.engineer), f("info.engineer2", "Checked / drawn by", I.engineer2), f("info.date", "Date", I.date, "date")].join("");
    $("#codeSel").value = P.code;
    $("#matForm").innerHTML = (P.code === "EC2" ? [f("mat.fck", "Concrete fck (MPa)", P.mat.fck, "number"), f("mat.fyk", "Steel fyk (MPa)", P.mat.fyk, "number")]
      : [f("mat.fcu", "Concrete fcu (MPa)", P.mat.fcu, "number"), f("mat.fy", "Steel fy (MPa)", P.mat.fy, "number")]).concat([f("mat.cs", "Slab cover (mm)", P.mat.cs, "number"), f("mat.cb", "Beam/column cover (mm)", P.mat.cb, "number"),
      f("maxSpan", "Max beam span before adding a column (mm)", P.maxSpan, "number"), f("colMin", "Minimum column size (mm)", P.colMin, "number"),
      f("beta", "Column effective length factor β", P.beta, "number"), f("beamMinH", "Minimum beam depth (mm)", P.beamMinH, "number"),
      f("slabMaxS", "Max slab bar spacing (mm)", P.slabMaxS, "number"), f("balu", "Balustrade load (kN/m)", P.balu, "number")]).join("");
    const lv = P.levels.map((l, i) => `<tr><td><input data-l="${i}.name" value="${esc(l.name)}"></td>
      <td><select data-l="${i}.kind"><option ${l.kind === "floor" ? "selected" : ""}>floor</option><option ${l.kind === "roof" ? "selected" : ""}>roof</option></select></td>
      ${["h", "fin", "part", "qk", "ext", "int", "H"].map(k => `<td><input type="number" step="any" data-l="${i}.${k}" value="${l[k]}"></td>`).join("")}
      <td><button class="del" data-del="${i}">✕</button></td></tr>`).join("");
    $("#lvlBody").innerHTML = lv;
    $$("#p-loads [data-f]").forEach(inp => inp.onchange = () => {
      const [a, b] = inp.dataset.f.split("."); const v = inp.type === "number" ? +inp.value : inp.value;
      if (b) P[a][b] = v; else P[a] = v; save();
    });
    $$("#lvlBody [data-l]").forEach(inp => inp.onchange = () => {
      const [i, k] = inp.dataset.l.split("."); P.levels[+i][k] = (inp.type === "number") ? +inp.value : inp.value; save();
    });
    $$("#lvlBody [data-del]").forEach(b => b.onclick = () => { if (P.levels.length > 1) { P.levels.splice(+b.dataset.del, 1); save(); renderLoads(); } });
  }
  $("#codeSel").onchange = e => { P.code = e.target.value; save(); renderLoads(); };
  $("#addLvl").onclick = () => { P.levels.splice(P.levels.length - 1, 0, Object.assign({}, P.levels[0], { name: `Floor ${P.levels.length}` })); save(); renderLoads(); };

  // ------------------------------------------------------------------ design + results
  function runDesign() {
    if (!dirty && D) return;
    try { D = SD.design(JSON.parse(JSON.stringify(P))); SHEETS_CACHE = null; CALC_CACHE = null; VIEW3D.reset(); dirty = false; }
    catch (e) { console.error(e); D = null; toast("Design failed: " + e.message, true); }
  }
  const badge = s => `<span class="b ${s}">${s}</span>`;
  function renderResults() {
    const el = $("#results");
    if (!D) { el.innerHTML = "<p>No design yet.</p>"; return; }
    const all = [].concat(...D.levels.map(L => L.panels.map(p => p.status)), ...D.levels.map(L => L.runs.map(r => r.status)), D.cols.map(c => c.status));
    const cnt = s => all.filter(x => x === s).length;
    let h = `<div class="sum"><div><b>${D.levels.reduce((s, L) => s + L.panels.length, 0)}</b> slab panels</div><div><b>${D.levels.reduce((s, L) => s + L.runs.length, 0)}</b> beams</div><div><b>${D.cols.length}</b> columns</div>
      <div class="ok">${cnt("OK")} OK</div><div class="ck">${cnt("CHECK")} check</div><div class="bad">${cnt("REVISE")} revise</div></div>`;
    const W = [].concat(D.warn, ...D.levels.map(L => [].concat(...L.panels.map(p => p.warn.map(w => `${p.mark}: ${w}`)), ...L.runs.map(r => r.warn.map(w => `${r.mark}: ${w}`)))));
    if (W.length) h += `<details open class="warn"><summary>${W.length} items to check</summary><ul>${W.map(w => `<li>${esc(w)}</li>`).join("")}</ul></details>`;
    for (const L of D.levels) {
      h += `<h3>${esc(L.lvl.name)} — slabs</h3><div class="tw"><table><tr><th>Mark</th><th>Size (m)</th><th>h</th><th>Classification</th><th>Bottom ↔</th><th>Bottom ↕</th><th>Top</th><th>l/d</th><th></th></tr>`;
      for (const p of L.panels) {
        if (!p.d) { h += `<tr><td>${p.mark}</td><td colspan="7">${esc(p.cls)}</td><td>${badge(p.status)}</td></tr>`; continue; }
        const R = p.d.rows, bx = p.kind === "cant" ? R.sxp : (p.shortAlongX ? R.sxp : R.syp), by = p.kind === "cant" ? R.syp : (p.shortAlongX ? R.syp : R.sxp);
        const top = p.kind === "cant" ? R.sxn : [R.sxn, R.syn].filter(x => x && x.bars).sort((a, b) => b.bars.A - a.bars.A)[0];
        h += `<tr><td><b>${p.mark}</b></td><td>${p.Lx.toFixed(2)}×${p.Ly.toFixed(2)}</td><td>${p.d.h}</td><td>${esc(p.cls)}${p.note ? `<br><small>${esc(p.note)}</small>` : ""}</td><td>${SD.st(bx.bars)}</td><td>${SD.st(by.bars)}</td><td>${top ? SD.st(top.bars) : "–"}</td><td>${p.d.ldAct.toFixed(1)}/${p.d.ldAllow > 60 ? ">60" : p.d.ldAllow.toFixed(1)}</td><td>${badge(p.status)}</td></tr>`;
      }
      h += `</table></div><h3>${esc(L.lvl.name)} — beams</h3><div class="tw"><table><tr><th>Mark</th><th>Type</th><th>Size</th><th>Span</th><th>L</th><th>M+ / M− (kNm)</th><th>V</th><th>Bottom</th><th>Top L / R</th><th>Links</th><th></th></tr>`;
      for (const r of L.runs) {
        if (!r.des) { h += `<tr><td>${r.mark}</td><td colspan="9">${esc(r.warn.join("; "))}</td><td>${badge("REVISE")}</td></tr>`; continue; }
        r.des.spans.forEach((s, k) => h += `<tr class="${k ? "" : "first"}"><td>${k ? "" : `<b>${r.mark}</b>`}</td><td>${k ? "" : r.type}</td><td>${k ? "" : r.des.bw + "×" + r.des.h}</td><td>${s.kind === "span" ? "span" : "cantilever"}</td><td>${s.L.toFixed(2)}</td><td>${s.Mpos.toFixed(0)} / ${Math.max(s.MnL, s.MnR).toFixed(0)}</td><td>${s.V.toFixed(0)}</td><td>${SD.bt(s.bot)}${s.bot.layers > 1 ? " ²" : ""}</td><td>${SD.bt(s.topL)} / ${SD.bt(s.topR)}</td><td>H8@${s.links.s}</td><td>${k ? "" : badge(r.status)}</td></tr>`);
      }
      h += `</table></div>`;
    }
    h += `<h3>Columns</h3><div class="tw"><table><tr><th>Col</th><th>Grid</th><th>Size</th><th>Storey</th><th>NEd</th><th>Class</th><th>Bars</th><th>Util.</th><th>Gk+Qk at base</th><th></th></tr>`;
    for (const c of D.cols) {
      if (!c.res) { h += `<tr><td>${c.name}</td><td>${SHEETS.letters(c.i)}/${c.j + 1}</td><td colspan="7">no section ≤ 600 works – add columns/beams</td><td>${badge("REVISE")}</td></tr>`; continue; }
      c.res.des.forEach((d, k) => h += `<tr class="${k ? "" : "first"}"><td>${k ? "" : `<b>${c.name}</b>`}</td><td>${k ? "" : SHEETS.letters(c.i) + "/" + (c.j + 1)}</td><td>${k ? "" : c.res.b + "×" + c.res.b}</td><td>below ${esc(d.level)}</td><td>${d.N.toFixed(0)}</td><td>${d.ax.slender || d.ay.slender ? "Long (slender)" : "Short"}</td><td>${d.nb}H${d.phi}</td><td>${d.util.toFixed(2)}</td><td>${k ? (d.Gk + d.Qk).toFixed(0) : (d.Gk + d.Qk).toFixed(0)}</td><td>${k ? "" : badge(c.status)}</td></tr>`);
    }
    h += `</table></div><p class="small">Column moments use a sub-frame approximation; slab loads reach beams by tributary widths; coefficient methods follow BS 8110 tables (also used for EC2 design in UK practice). Results must be checked by a registered engineer.</p>`;
    el.innerHTML = h;
  }
  $("#csvBtn").onclick = () => {
    runDesign(); if (!D) return;
    const rows = [["Type", "Mark", "Level", "Size", "Item", "L(m)", "Bottom", "Top L", "Top R", "Links", "Status"]];
    D.levels.forEach(L => {
      L.panels.forEach(p => { if (p.d) { const R = p.d.rows; rows.push(["Slab", p.mark, L.lvl.name, `${p.Lx.toFixed(2)}x${p.Ly.toFixed(2)} h${p.d.h}`, p.cls, "", SD.st(R.sxp.bars), SD.st(R.syp.bars), SD.st((R.sxn && R.sxn.bars) ? R.sxn.bars : null), "", p.status]); } });
      L.runs.forEach(r => r.des && r.des.spans.forEach(s => rows.push(["Beam", r.mark, L.lvl.name, `${r.des.bw}x${r.des.h}`, r.type + " " + s.kind, s.L.toFixed(2), SD.bt(s.bot), SD.bt(s.topL), SD.bt(s.topR), "H8@" + s.links.s, r.status])));
    });
    D.cols.forEach(c => c.res && c.res.des.forEach(d => rows.push(["Column", c.name, d.level, `${c.res.b}x${c.res.b}`, `N=${d.N.toFixed(0)} Gk=${d.Gk.toFixed(0)} Qk=${d.Qk.toFixed(0)}`, "", `${d.nb}H${d.phi}`, "", "", "", c.status])));
    saveFile((P.info.name || "design").replace(/[^\w-]+/g, "_") + "_schedule.csv", rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  };

  // ------------------------------------------------------------------ drawings
  function sheets() { if (!SHEETS_CACHE && D) SHEETS_CACHE = SHEETS.all(P, D); return SHEETS_CACHE || []; }
  function renderSheets() {
    const S = sheets(), el = $("#sheets");
    el.innerHTML = S.map((s, i) => `<div class="sheet"><div class="sh"><b>${s.no}</b> ${esc(s.title)} <button data-svg="${i}">SVG</button></div>${s.svg.replace(/width="420mm" height="297mm"/, 'width="100%"')}</div>`).join("");
    $$("#sheets [data-svg]").forEach(b => b.onclick = () => { const s = S[+b.dataset.svg]; saveFile(`${s.no}_${s.title.replace(/[^\w-]+/g, "_")}.svg`, s.svg, "image/svg+xml"); });
  }
  async function svgToJpeg(svg, pxPerMm = 7) {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement("canvas"); c.width = 420 * pxPerMm; c.height = 297 * pxPerMm;
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    return c.toDataURL("image/jpeg", 0.92);
  }
  $("#pdfBtn").onclick = async () => {
    runDesign(); const S = sheets(); if (!S.length) return;
    if (!window.jspdf) { toast("PDF library not loaded (needs internet the first time)", true); return; }
    $("#pdfBtn").disabled = true; $("#pdfBtn").textContent = "Building PDF…";
    try {
      const doc = new jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
      for (let i = 0; i < S.length; i++) { if (i) doc.addPage("a3", "landscape"); doc.addImage(await svgToJpeg(S[i].svg), "JPEG", 0, 0, 420, 297); }
      await saveFile((P.info.name || "structural").replace(/[^\w-]+/g, "_") + "_structural_drawings.pdf", doc.output("blob"), "application/pdf");
    } catch (e) { toast("PDF failed: " + e.message, true); }
    finally { $("#pdfBtn").disabled = false; $("#pdfBtn").textContent = "Drawings PDF (A3)"; }
  };
  // ------------------------------------------------------------------ calculations, Excel, 3D
  const loadScript = (url, test) => new Promise((res, rej) => { if (test()) return res(); const s = document.createElement("script"); s.src = url; s.onload = res; s.onerror = () => rej(new Error("could not load " + url.split("/").pop() + " (needs internet the first time)")); document.head.appendChild(s); });
  function calcs() { if (!CALC_CACHE && D) CALC_CACHE = CALC.all(P, D); return CALC_CACHE || []; }
  function renderCalcs() {
    const S = calcs(), sel = $("#calcSel"), cur = sel.value;
    sel.innerHTML = S.map(s => `<option value="${s.id}">${s.status === "REVISE" ? "✘ " : s.status === "CHECK" ? "! " : ""}${esc(s.title)}</option>`).join("");
    if (cur && S.some(s => s.id === cur)) sel.value = cur;
    const sec = S.find(s => s.id === sel.value) || S[0];
    $("#calcView").innerHTML = sec ? CALC.html(sec) : "";
  }
  $("#calcSel").onchange = renderCalcs;
  $("#calcPdfBtn").onclick = async () => {
    runDesign(); if (!D) return;
    if (!window.jspdf) { toast("PDF library not loaded (needs internet the first time)", true); return; }
    const doc = new jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    CALC.pdf(doc, P, calcs(), false);
    await saveFile((P.info.name || "design").replace(/[^\w-]+/g, "_") + "_calculations.pdf", doc.output("blob"), "application/pdf");
  };
  $("#xlsBtn").onclick = async () => {
    runDesign(); if (!D) return;
    const b = $("#xlsBtn"); b.disabled = true; b.textContent = "Building workbook…";
    try {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js", () => window.ExcelJS);
      const blob = await XLS.build(P, D);
      await saveFile((P.info.name || "design").replace(/[^\w-]+/g, "_") + "_design.xlsx", blob, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch (e) { toast("Excel export failed: " + e.message, true); }
    finally { b.disabled = false; b.textContent = "Excel workbook (.xlsx)"; }
  };
  const m3 = () => ({ slabs: $("#m-slabs").checked, beams: $("#m-beams").checked, cols: $("#m-cols").checked, rebar: $("#m-rebar").checked });
  async function render3D() { if (!D) return; try { await VIEW3D.show($("#view3d"), P, D, m3()); } catch (e) { $("#view3d").innerHTML = `<p style="padding:16px">${esc(e.message)}</p>`; } }
  ["#m-slabs", "#m-beams", "#m-cols", "#m-rebar"].forEach(id => $(id).onchange = render3D);
  $$("#p-model [data-v]").forEach(b => b.onclick = () => VIEW3D.view(b.dataset.v));
  $("#pngBtn").onclick = async () => { const u = VIEW3D.snapshot(); if (!u) return; const blob = await (await fetch(u)).blob(); saveFile((P.info.name || "model").replace(/[^\w-]+/g, "_") + "_3D.png", blob, "image/png"); };
  $("#pkgBtn").onclick = async () => {
    runDesign(); const S = sheets(); if (!S.length) return;
    if (!window.jspdf) { toast("PDF library not loaded (needs internet the first time)", true); return; }
    const b = $("#pkgBtn"); b.disabled = true; b.textContent = "Building package…";
    try {
      const doc = new jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
      for (let i = 0; i < S.length; i++) { if (i) doc.addPage("a3", "landscape"); doc.addImage(await svgToJpeg(S[i].svg), "JPEG", 0, 0, 420, 297); }
      CALC.pdf(doc, P, calcs(), true);
      await saveFile((P.info.name || "design").replace(/[^\w-]+/g, "_") + "_structural_package.pdf", doc.output("blob"), "application/pdf");
    } catch (e) { toast("PDF failed: " + e.message, true); }
    finally { b.disabled = false; b.textContent = "Full package PDF (drawings + calcs)"; }
  };
  $("#saveBtn").onclick = () => saveFile((P.info.name || "project").replace(/[^\w-]+/g, "_") + ".json", JSON.stringify(P), "application/json");
  $("#openBtn").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { P = Object.assign(DEF(), JSON.parse(await f.text())); save(); toast("Project opened"); showTab("layout"); } catch (err) { toast("Not a project file", true); }
    e.target.value = "";
  };
  $("#newBtn").onclick = () => {
    const b = $("#newBtn");
    if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = "Tap again to clear"; setTimeout(() => { delete b.dataset.arm; b.textContent = "New project"; }, 3000); return; }
    delete b.dataset.arm; b.textContent = "New project"; P = DEF(); save(); showTab("drawing");
  };

  // ------------------------------------------------------------------ init
  try { $("#apikey").value = localStorage.getItem("sd_key") || ""; } catch (e) {}
  renderAISource();
  $("#aiNotes").textContent = P.aiNotes || "";
  let t0 = "drawing"; try { t0 = localStorage.getItem("sd_tab") || "drawing"; } catch (e) {}
  showTab(t0);
  if (!window.claude && !window.Capacitor && "serviceWorker" in navigator && location.protocol === "https:" && location.hostname !== "localhost") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); const b = $("#installBtn"); b.hidden = false; b.onclick = () => { e.prompt(); b.hidden = true; }; });
})();
