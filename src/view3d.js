/* Interactive 3D model (three.js r128, loaded on demand) with optional reinforcement */
const VIEW3D = (() => {
  let renderer, scene, camera, root, state = { th: -0.8, ph: 0.75, r: 30, tx: 0, ty: 0, tz: 0 }, el, raf, built = null;
  function load() {
    return new Promise((res, rej) => {
      if (window.THREE) return res();
      const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      s.onload = res; s.onerror = () => rej(new Error("3D library could not load (needs internet the first time)")); document.head.appendChild(s);
    });
  }
  function cam() {
    const { th, ph, r, tx, ty, tz } = state;
    camera.position.set(tx + r * Math.cos(ph) * Math.cos(th), ty + r * Math.sin(ph), tz + r * Math.cos(ph) * Math.sin(th));
    camera.lookAt(tx, ty, tz);
  }
  function render() { if (renderer) { cam(); renderer.render(scene, camera); } }
  function mat(rgb, op = 1) { return new THREE.MeshLambertMaterial({ color: new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255), transparent: op < 1, opacity: op }); }

  // model coords: plan x → X, plan y → Z, height → Y (all in metres)
  function build(P, D, opts) {
    if (root) scene.remove(root);
    root = new THREE.Group();
    const B = SECTIONS.boxes(P, D);
    const lvlTop = SECTIONS.levelsZ(P).map(z => z * 1000);
    for (const b of B) {
      if (b.kind === "slab" && !opts.slabs) continue;
      if (b.kind === "beam" && !opts.beams) continue;
      if (b.kind === "col" && !opts.cols) continue;
      const g = new THREE.BoxGeometry((b.x1 - b.x0) / 1000, (b.z1 - b.z0) / 1000, (b.y1 - b.y0) / 1000);
      const m = new THREE.Mesh(g, mat(b.col, b.kind === "slab" ? (opts.rebar ? 0.25 : 0.8) : (opts.rebar ? 0.35 : 1)));
      m.position.set((b.x0 + b.x1) / 2000, (b.z0 + b.z1) / 2000, (b.y0 + b.y1) / 2000);
      root.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.35 }));
      e.position.copy(m.position); root.add(e);
    }
    if (opts.rebar) {
      const red = new THREE.LineBasicMaterial({ color: 0xcc0000 }), blue = new THREE.LineBasicMaterial({ color: 0x0033cc }), grey = new THREE.LineBasicMaterial({ color: 0x777777 });
      const seg = (pts, m) => { const g = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p[0] / 1000, p[2] / 1000, p[1] / 1000))); root.add(new THREE.Line(g, m)); };
      D.levels.forEach((Lv, li) => {
        const zt = lvlTop[li];
        for (const r of Lv.runs) {
          if (!r.des) continue;
          const bw = r.des.bw, h = r.des.h, c = P.mat.cb + 8;
          const pa = r.dir === "h" ? P.gx : P.gy, line = r.dir === "h" ? P.gy[r.line] : P.gx[r.line];
          const pt = (a, off, z) => r.dir === "h" ? [a, line + off, z] : [line + off, a, z];
          r.el.forEach((e, i) => {
            const s = r.des.spans[i], A0 = pa[e.k0], A1 = pa[e.k1], Lm = A1 - A0;
            const lay = (n, z, a0, a1, m) => { for (let k = 0; k < n; k++) { const off = -bw / 2 + c + k * (bw - 2 * c) / Math.max(n - 1, 1); seg([pt(a0, off, z), pt(a1, off, z)], m); } };
            lay(s.bot.n, zt - h + c, A0, A1, red);
            const tl = e.kind === "cantL" ? A1 : A0 + 0.3 * Lm, tr = e.kind === "cantR" ? A0 : A1 - 0.3 * Lm;
            if (e.kind !== "cantR") lay(s.topL.n, zt - c, A0, tl, blue);
            if (e.kind !== "cantL") lay(s.topR.n, zt - c, tr, A1, blue);
            const nl = Math.min(30, Math.round(Lm / s.links.s));
            for (let q = 1; q < nl; q++) { const a = A0 + q * Lm / nl; seg([pt(a, -bw / 2 + c, zt - h + c), pt(a, -bw / 2 + c, zt - c), pt(a, bw / 2 - c, zt - c), pt(a, bw / 2 - c, zt - h + c), pt(a, -bw / 2 + c, zt - h + c)], grey); }
          });
        }
      });
      for (const col of D.cols) {
        if (!col.res) continue;
        const d = col.res.des[0], b = col.res.b, c = P.mat.cb + 8, per = d.nb === 4 ? 2 : d.nb === 8 ? 3 : 4, top = lvlTop[lvlTop.length - 1];
        const ps = new Set();
        for (let k = 0; k < per; k++) { const t = -b / 2 + c + k * (b - 2 * c) / (per - 1); [[t, -b / 2 + c], [t, b / 2 - c], [-b / 2 + c, t], [b / 2 - c, t]].forEach(p => ps.add(p.join(","))); }
        for (const p of ps) { const [u, v] = p.split(",").map(Number); seg([[col.x + u, col.y + v, -300], [col.x + u, col.y + v, top - 40]], red); }
      }
    }
    // ground grid
    const gx = P.gx, gy = P.gy;
    const gm = new THREE.LineBasicMaterial({ color: 0x88aa99 });
    for (const x of gx) { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x / 1000, 0, gy[0] / 1000 - 1), new THREE.Vector3(x / 1000, 0, gy[gy.length - 1] / 1000 + 1)]); root.add(new THREE.Line(g, gm)); }
    for (const y of gy) { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(gx[0] / 1000 - 1, 0, y / 1000), new THREE.Vector3(gx[gx.length - 1] / 1000 + 1, 0, y / 1000)]); root.add(new THREE.Line(g, gm)); }
    scene.add(root);
    const cx = (gx[0] + gx[gx.length - 1]) / 2000, cz = (gy[0] + gy[gy.length - 1]) / 2000, ht = lvlTop[lvlTop.length - 1] / 1000;
    if (!built) Object.assign(state, { tx: cx, ty: ht / 2, tz: cz, r: Math.max(gx[gx.length - 1] - gx[0], gy[gy.length - 1] - gy[0]) / 1000 * 1.9 });
    built = true;
    render();
  }

  async function show(container, P, D, opts) {
    await load();
    el = container;
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      scene = new THREE.Scene(); scene.background = new THREE.Color(0xf4f7fb);
      camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
      scene.add(new THREE.AmbientLight(0xffffff, 0.65));
      const dl = new THREE.DirectionalLight(0xffffff, 0.55); dl.position.set(20, 40, 10); scene.add(dl);
      const cv = renderer.domElement; cv.style.touchAction = "none";
      const ptrs = new Map(); let last = null, pinch = null;
      cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY]; });
      cv.addEventListener("pointermove", e => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        if (ptrs.size === 2) {
          const [a, b] = [...ptrs.values()], dd = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (pinch) state.r = Math.max(2, Math.min(300, state.r * pinch / dd));
          pinch = dd; render(); return;
        }
        const dx = e.clientX - last[0], dy = e.clientY - last[1]; last = [e.clientX, e.clientY];
        if (e.shiftKey || e.buttons === 2) { const k = state.r / 600; state.tx -= dx * k * Math.sin(state.th) * -1; state.tz -= dx * k * Math.cos(state.th); state.ty += dy * k; }
        else { state.th += dx * 0.008; state.ph = Math.max(-0.2, Math.min(1.5, state.ph + dy * 0.008)); }
        render();
      });
      const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; };
      cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
      cv.addEventListener("wheel", e => { e.preventDefault(); state.r = Math.max(2, Math.min(300, state.r * (e.deltaY > 0 ? 1.1 : 0.9))); render(); }, { passive: false });
      cv.addEventListener("contextmenu", e => e.preventDefault());
    }
    container.innerHTML = ""; container.appendChild(renderer.domElement);
    const w = container.clientWidth || 800, h = Math.max(320, Math.min(window.innerHeight * 0.68, w * 0.75));
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    build(P, D, opts);
  }
  function view(name) {
    const v = { iso: [-0.8, 0.75], front: [-Math.PI / 2, 0.05], side: [0, 0.05], top: [-Math.PI / 2, 1.5] }[name];
    if (v) { state.th = v[0]; state.ph = v[1]; render(); }
  }
  function snapshot() { render(); return renderer ? renderer.domElement.toDataURL("image/png") : null; }
  function reset() { built = null; }
  return { show, view, snapshot, reset };
})();
