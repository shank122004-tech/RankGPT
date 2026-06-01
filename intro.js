/**
 * intro.js — CrackAI v12.0  "SINGULARITY"
 * ──────────────────────────────────────────
 * Full-screen Three.js cinematic intro.
 *
 * Scene layers (back → front):
 *   1. Volumetric starfield  — 3,000 colored points w/ depth velocity
 *   2. Warp tunnel           — 28 glowing hyperspeed rings
 *   3. Galaxy dust plane     — additive-blended disc of 8,000 particles
 *   4. Central AI Core       — layered sphere: inner molten + outer shell + corona halo
 *   5. Synaptic arc net      — 60 pulsing Bézier lines on sphere surface
 *   6. Orbital energy rings  — 3 tilted torus rings with rotating glow
 *   7. Data-stream columns   — 6 vertical trails of falling glyphs (canvas texture)
 *   8. Floating data tags    — HTML overlays counting up live metrics
 *   9. Luxury HUD            — brand / tagline / progress bar
 *
 * Phases:
 *   0 → BUILD    0.0 – 0.8 s  core grows from point → full sphere
 *   1 → IDLE     0.8 – 3.4 s  breathe, rotate, arcs pulse, progress fills
 *   2 → DIVE     3.4 – 4.2 s  camera rockets forward through warp into core
 *   3 → EXIT     4.2 s        white flash → overlay fade → reveal app
 */

(function () {
  'use strict';

  /* ── Guard: only one instance ─────────────────────────── */
  if (document.getElementById('sscIntroOverlay')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ════════════════════════════════════════════════════════
     INJECT STYLES
  ════════════════════════════════════════════════════════ */
  const S = document.createElement('style');
  S.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@300;400&display=swap');

    #sscIntroOverlay {
      background: #000005;
      display: flex; align-items: center; justify-content: center;
    }

    /* ── WebGL canvas ── */
    #ci-canvas {
      position: absolute; inset: 0;
      width: 100% !important; height: 100% !important;
      display: block;
    }

    /* ── Noise grain overlay ── */
    #ci-grain {
      position: absolute; inset: 0;
      z-index: 2; pointer-events: none;
      opacity: 0.028;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      background-size: 180px 180px;
      mix-blend-mode: overlay;
    }

    /* ── Vignette ── */
    #ci-vignette {
      position: absolute; inset: 0; z-index: 3; pointer-events: none;
      background: radial-gradient(ellipse 90% 90% at 50% 50%,
        transparent 40%, rgba(0,0,5,0.55) 100%);
    }

    /* ── HUD shell ── */
    #ci-hud {
      position: absolute; inset: 0; z-index: 10;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      pointer-events: none;
    }

    /* Spacer so HUD text sits below the orb */
    #ci-spacer { height: clamp(140px, 24vw, 200px); }

    /* Brand */
    #ci-brand {
      font-family: 'Syne', sans-serif;
      font-size: clamp(32px, 7vw, 54px);
      font-weight: 800;
      letter-spacing: -0.01em;
      line-height: 1;
      opacity: 0;
      transform: translateY(14px);
      transition: opacity .7s cubic-bezier(.22,1,.36,1),
                  transform .7s cubic-bezier(.22,1,.36,1);
    }
    #ci-brand.show { opacity: 1; transform: none; }

    #ci-crack { color: #fff; }
    #ci-ai {
      background: linear-gradient(120deg, #a78bfa 0%, #f472b6 55%, #fb923c 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* Tagline */
    #ci-tagline {
      margin-top: 11px;
      font-family: 'DM Mono', monospace;
      font-size: clamp(9px, 1.8vw, 11px);
      font-weight: 300;
      letter-spacing: 0.35em;
      text-transform: uppercase;
      color: rgba(167,139,250,0.42);
      opacity: 0;
      transition: opacity .7s ease .28s;
    }
    #ci-tagline.show { opacity: 1; }

    /* Live metric tags */
    #ci-tags {
      margin-top: clamp(18px, 3vw, 26px);
      display: flex; gap: clamp(10px, 2vw, 18px);
      opacity: 0;
      transition: opacity .6s ease .45s;
    }
    #ci-tags.show { opacity: 1; }

    .ci-tag {
      display: flex; flex-direction: column; align-items: center;
      background: rgba(167,139,250,0.065);
      border: 1px solid rgba(167,139,250,0.18);
      border-radius: 8px;
      padding: 6px 14px;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .ci-tag-val {
      font-family: 'Syne', sans-serif;
      font-size: clamp(15px, 3vw, 20px);
      font-weight: 700;
      background: linear-gradient(120deg, #a78bfa, #f472b6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .ci-tag-lbl {
      font-family: 'DM Mono', monospace;
      font-size: 9px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: rgba(200,195,255,0.38);
      margin-top: 2px;
    }

    /* Progress */
    #ci-prog-wrap {
      margin-top: clamp(22px, 4vw, 32px);
      width: clamp(160px, 30vw, 220px);
      opacity: 0;
      transition: opacity .6s ease .55s;
    }
    #ci-prog-wrap.show { opacity: 1; }

    #ci-prog-track {
      height: 1.5px;
      background: rgba(255,255,255,0.07);
      border-radius: 2px;
      overflow: hidden;
      position: relative;
    }
    #ci-prog-fill {
      height: 100%;
      width: 0%;
      border-radius: 2px;
      background: linear-gradient(90deg, #7c3aed, #a78bfa, #f472b6, #fb923c);
      background-size: 200% 100%;
      animation: gradShift 2s linear infinite;
      box-shadow: 0 0 10px rgba(167,139,250,0.9);
      will-change: width;
    }
    @keyframes gradShift {
      0%   { background-position: 0% 0; }
      100% { background-position: 200% 0; }
    }

    #ci-prog-pct {
      text-align: right;
      font-family: 'DM Mono', monospace;
      font-size: 9px;
      font-weight: 400;
      letter-spacing: 0.15em;
      color: rgba(167,139,250,0.38);
      margin-top: 6px;
    }

    /* Top-left system label */
    #ci-sys-label {
      position: absolute;
      top: clamp(18px, 3vw, 28px);
      left: clamp(18px, 3vw, 32px);
      font-family: 'DM Mono', monospace;
      font-size: 9px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(167,139,250,0.30);
      opacity: 0;
      transition: opacity 1s ease .8s;
      line-height: 1.7;
    }
    #ci-sys-label.show { opacity: 1; }

    /* Top-right version */
    #ci-version {
      position: absolute;
      top: clamp(18px, 3vw, 28px);
      right: clamp(18px, 3vw, 32px);
      font-family: 'DM Mono', monospace;
      font-size: 9px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(244,114,182,0.28);
      opacity: 0;
      transition: opacity 1s ease .9s;
    }
    #ci-version.show { opacity: 1; }

    /* Corner brackets (decorative) */
    .ci-corner {
      position: absolute;
      width: 18px; height: 18px;
      opacity: 0;
      transition: opacity 1s ease 1s;
      pointer-events: none;
    }
    .ci-corner.show { opacity: 1; }
    .ci-corner svg { width: 100%; height: 100%; }
    .ci-tl { top: clamp(14px,2.5vw,22px); left: clamp(14px,2.5vw,22px); }
    .ci-tr { top: clamp(14px,2.5vw,22px); right: clamp(14px,2.5vw,22px); transform: scaleX(-1); }
    .ci-bl { bottom: clamp(14px,2.5vw,22px); left: clamp(14px,2.5vw,22px); transform: scaleY(-1); }
    .ci-br { bottom: clamp(14px,2.5vw,22px); right: clamp(14px,2.5vw,22px); transform: scale(-1,-1); }

    /* Flash veil */
    #ci-veil {
      position: absolute; inset: 0; z-index: 20;
      background: radial-gradient(circle at 50% 50%, rgba(167,139,250,0.35), #000005 70%);
      opacity: 0; pointer-events: none;
      will-change: opacity;
    }
  `;
  document.head.appendChild(S);

  /* ════════════════════════════════════════════════════════
     BUILD DOM
  ════════════════════════════════════════════════════════ */
  const cornerSVG = `<svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 9V1H9" stroke="rgba(167,139,250,0.45)" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`;

  const ov = document.createElement('div');
  ov.id = 'sscIntroOverlay';
  ov.innerHTML = `
    <canvas id="ci-canvas"></canvas>
    <div id="ci-grain"></div>
    <div id="ci-vignette"></div>

    <div class="ci-corner ci-tl">${cornerSVG}</div>
    <div class="ci-corner ci-tr">${cornerSVG}</div>
    <div class="ci-corner ci-bl">${cornerSVG}</div>
    <div class="ci-corner ci-br">${cornerSVG}</div>

    <div id="ci-hud">
      <div id="ci-spacer"></div>
      <div id="ci-brand"><span id="ci-crack">Crack</span><span id="ci-ai">AI</span></div>
      <div id="ci-tagline">Neural Intelligence Engine · v12</div>
      <div id="ci-tags">
        <div class="ci-tag"><div class="ci-tag-val" id="ct-q">0</div><div class="ci-tag-lbl">Questions</div></div>
        <div class="ci-tag"><div class="ci-tag-val" id="ct-a">0</div><div class="ci-tag-lbl">Accuracy</div></div>
        <div class="ci-tag"><div class="ci-tag-val" id="ct-r">0</div><div class="ci-tag-lbl">Ranks Up</div></div>
      </div>
      <div id="ci-prog-wrap">
        <div id="ci-prog-track"><div id="ci-prog-fill"></div></div>
        <div id="ci-prog-pct">0%</div>
      </div>
    </div>

    <div id="ci-sys-label">CrackAI Neural Core<br>SSC Intelligence Engine</div>
    <div id="ci-version">v12.0 · SINGULARITY</div>
    <div id="ci-veil"></div>
  `;
  document.body.insertBefore(ov, document.body.firstChild);

  /* ════════════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════════════ */
  const lerp  = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const eOut3 = t => 1 - Math.pow(1 - t, 3);
  const eOut5 = t => 1 - Math.pow(1 - t, 5);
  const eIn3  = t => t * t * t;
  const eIO   = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;

  /* smooth counter */
  function animCount(el, target, dur, suffix) {
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      el.textContent = Math.floor(eOut3(p) * target) + (suffix || '');
      if (p < 1) requestAnimationFrame(tick);
    };
    tick();
  }

  /* ════════════════════════════════════════════════════════
     PROGRESS BAR
  ════════════════════════════════════════════════════════ */
  const progFill = document.getElementById('ci-prog-fill');
  const progPct  = document.getElementById('ci-prog-pct');
  let _pv = 0, _pt = 0, _pr = null;

  function setProgress(p) {
    _pt = p;
    if (_pr) return;
    const step = () => {
      _pv += (_pt - _pv) * 0.10;
      const v = Math.min(_pv, 100);
      if (progFill) progFill.style.width = v + '%';
      if (progPct)  progPct.textContent  = Math.floor(v) + '%';
      if (Math.abs(_pt - _pv) > 0.3) _pr = requestAnimationFrame(step);
      else { if (progFill) progFill.style.width = _pt + '%'; _pr = null; }
    };
    _pr = requestAnimationFrame(step);
  }

  /* ════════════════════════════════════════════════════════
     SHOW HUD
  ════════════════════════════════════════════════════════ */
  function showHUD() {
    ['ci-brand','ci-tagline','ci-tags','ci-prog-wrap',
     'ci-sys-label','ci-version'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('show');
    });
    document.querySelectorAll('.ci-corner').forEach(el => el.classList.add('show'));

    /* animated counters */
    animCount(document.getElementById('ct-q'), 142800, 2200);
    animCount(document.getElementById('ct-a'), 97, 2000, '%');
    animCount(document.getElementById('ct-r'), 38400, 2400);
  }

  /* ════════════════════════════════════════════════════════
     LOAD THREE.JS  →  INIT SCENE
  ════════════════════════════════════════════════════════ */
  const scr = document.createElement('script');
  scr.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  scr.onload  = initScene;
  scr.onerror = () => doExit(0);
  document.head.appendChild(scr);

  /* ════════════════════════════════════════════════════════
     SCENE
  ════════════════════════════════════════════════════════ */
  function initScene() {
    const THREE = window.THREE;
    if (!THREE) { doExit(0); return; }

    const W   = window.innerWidth;
    const H   = window.innerHeight;
    const MB  = W < 620;
    const DPR = Math.min(window.devicePixelRatio, MB ? 1.5 : 2);

    /* ── Renderer ─────────────────────────────────────── */
    const renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('ci-canvas'),
      antialias: !MB,
      alpha: false,
    });
    renderer.setPixelRatio(DPR);
    renderer.setSize(W, H);
    renderer.setClearColor(0x000005, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    /* ── Scene & Camera ──────────────────────────────── */
    const scene  = new THREE.Scene();
    scene.fog    = new THREE.FogExp2(0x000005, 0.010);

    const camera = new THREE.PerspectiveCamera(62, W / H, 0.05, 2000);
    camera.position.set(0, 0, 6.5);

    /* ──────────────────────────────────────────────────
       LAYER 1 : DEEP STARFIELD
    ────────────────────────────────────────────────── */
    const STAR_N = MB ? 1400 : 2800;
    const starPos = new Float32Array(STAR_N * 3);
    const starCol = new Float32Array(STAR_N * 3);

    for (let i = 0; i < STAR_N; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const r  = 80 + Math.random() * 420;
      starPos[i*3]   = r * Math.sin(ph) * Math.cos(th);
      starPos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
      starPos[i*3+2] = r * Math.cos(ph);
      const rnd = Math.random();
      if      (rnd > .88) { starCol[i*3]=0.62; starCol[i*3+1]=0.54; starCol[i*3+2]=1.00; } // violet
      else if (rnd > .74) { starCol[i*3]=1.00; starCol[i*3+1]=0.50; starCol[i*3+2]=0.72; } // rose
      else if (rnd > .58) { starCol[i*3]=1.00; starCol[i*3+1]=0.75; starCol[i*3+2]=0.35; } // amber
      else                { starCol[i*3]=0.80; starCol[i*3+1]=0.80; starCol[i*3+2]=0.94; } // white-blue
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color',    new THREE.BufferAttribute(starCol, 3));
    scene.add(new THREE.Points(starGeo,
      new THREE.PointsMaterial({
        size: MB ? 0.58 : 0.42, vertexColors: true,
        transparent: true, opacity: 0.72, sizeAttenuation: true
      })
    ));

    /* ──────────────────────────────────────────────────
       LAYER 2 : WARP TUNNEL RINGS
    ────────────────────────────────────────────────── */
    const warpGroup = new THREE.Group();
    scene.add(warpGroup);
    const RING_N = MB ? 16 : 28;
    const warpRings = [];

    for (let i = 0; i < RING_N; i++) {
      const z   = -2 - i * 12;
      const rad = 2.2 + Math.random() * 2.4;
      const seg = MB ? 48 : 96;
      const geo = new THREE.TorusGeometry(rad, 0.012, 4, seg);
      const hue = i % 3 === 0 ? 0x7c3aed : i % 3 === 1 ? 0xa78bfa : 0xf472b6;
      const mat = new THREE.MeshBasicMaterial({
        color: hue, transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.PI / 2 + (Math.random() - .5) * 0.4;
      mesh.position.set((Math.random()-.5)*0.5, (Math.random()-.5)*0.5, z);
      warpGroup.add(mesh);
      warpRings.push({ mesh, mat, z0: z, phase: Math.random() * Math.PI * 2 });
    }

    /* ──────────────────────────────────────────────────
       LAYER 3 : GALAXY DUST DISC
    ────────────────────────────────────────────────── */
    const GUST_N = MB ? 3500 : 8000;
    const dustPos = new Float32Array(GUST_N * 3);
    const dustCol = new Float32Array(GUST_N * 3);

    for (let i = 0; i < GUST_N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.5 + Math.pow(Math.random(), 0.5) * 22;
      const spiral = a + r * 0.18;
      dustPos[i*3]   = Math.cos(spiral) * r;
      dustPos[i*3+1] = (Math.random() - .5) * (1.5 - r * 0.04);
      dustPos[i*3+2] = Math.sin(spiral) * r;
      const t = r / 24.5;
      dustCol[i*3]   = lerp(0.65, 0.30, t);
      dustCol[i*3+1] = lerp(0.42, 0.10, t);
      dustCol[i*3+2] = lerp(0.98, 0.55, t);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('color',    new THREE.BufferAttribute(dustCol, 3));
    const dustMesh = new THREE.Points(dustGeo,
      new THREE.PointsMaterial({
        size: MB ? 0.12 : 0.09, vertexColors: true,
        transparent: true, opacity: 0.0,
        sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    scene.add(dustMesh);

    /* ──────────────────────────────────────────────────
       LAYER 4 : AI CORE ORBS
    ────────────────────────────────────────────────── */
    const orbGroup = new THREE.Group();
    scene.add(orbGroup);

    /* Inner molten core */
    const ORB_R = 1.0;
    const coreGeo  = new THREE.IcosahedronGeometry(ORB_R, MB ? 3 : 5);
    const coreMat  = new THREE.MeshStandardMaterial({
      color: 0x1a0a3a,
      emissive: 0x5b21b6,
      emissiveIntensity: 1.8,
      metalness: 0.7, roughness: 0.18,
      transparent: true, opacity: 0.0,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    orbGroup.add(coreMesh);

    /* Mid shell — faceted */
    const shellGeo  = new THREE.IcosahedronGeometry(ORB_R * 1.22, MB ? 2 : 4);
    const shellMat  = new THREE.MeshStandardMaterial({
      color: 0x4c1d95,
      emissive: 0x7c3aed,
      emissiveIntensity: 0.6,
      metalness: 0.9, roughness: 0.08,
      transparent: true, opacity: 0.0,
      wireframe: false,
    });
    const shellMesh = new THREE.Mesh(shellGeo, shellMat);
    orbGroup.add(shellMesh);

    /* Outer wireframe lattice */
    const latticeGeo = new THREE.IcosahedronGeometry(ORB_R * 1.42, MB ? 2 : 3);
    const latticeMat = new THREE.MeshBasicMaterial({
      color: 0xa78bfa, wireframe: true,
      transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const latticeMesh = new THREE.Mesh(latticeGeo, latticeMat);
    orbGroup.add(latticeMesh);

    /* Corona halo (billboard plane) */
    const haloGeo = new THREE.PlaneGeometry(5.0, 5.0);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x6d28d9, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    orbGroup.add(haloMesh);

    /* ──────────────────────────────────────────────────
       LAYER 5 : SYNAPTIC ARC NET
    ────────────────────────────────────────────────── */
    const NODE_N  = MB ? 22 : 38;
    const nodePos = [];
    const tmpV    = new THREE.Vector3();
    const arcLines = [];

    for (let i = 0; i < NODE_N; i++) {
      tmpV.set(Math.random()-.5, Math.random()-.5, Math.random()-.5).normalize().multiplyScalar(ORB_R);
      nodePos.push(tmpV.clone());
    }

    const ARC_DIST = ORB_R * 0.82;
    const MAX_ARCS = MB ? 40 : 68;

    for (let a = 0; a < NODE_N; a++) {
      for (let b = a + 1; b < NODE_N; b++) {
        if (arcLines.length >= MAX_ARCS) break;
        if (nodePos[a].distanceTo(nodePos[b]) < ARC_DIST) {
          const mid = nodePos[a].clone().add(nodePos[b])
            .multiplyScalar(.5).normalize().multiplyScalar(ORB_R * 1.18);
          const pts = new THREE.QuadraticBezierCurve3(nodePos[a], mid, nodePos[b]).getPoints(24);
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          const mat = new THREE.LineBasicMaterial({
            color: 0xa78bfa, transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending,
          });
          orbGroup.add(new THREE.Line(geo, mat));
          arcLines.push({ mat, phase: Math.random()*Math.PI*2, spd: 0.7+Math.random()*1.2, maxOp: 0.16+Math.random()*0.30 });
        }
      }
    }

    /* ──────────────────────────────────────────────────
       LAYER 6 : ORBITAL ENERGY RINGS (tilted tori)
    ────────────────────────────────────────────────── */
    const eRings = [
      { r: 1.72, tube: 0.008, color: 0xa78bfa, tilt: [0.55, 0, 0], speed:  0.010, baseOp: 0.52 },
      { r: 2.05, tube: 0.006, color: 0xf472b6, tilt: [0, 0.44, 0.3], speed: -0.007, baseOp: 0.36 },
      { r: 2.45, tube: 0.004, color: 0x7c3aed, tilt: [0.3, 0.6, 0], speed:  0.006, baseOp: 0.24 },
    ].map(cfg => {
      const geo = new THREE.TorusGeometry(cfg.r, cfg.tube, 4, MB ? 80 : 180);
      const mat = new THREE.MeshBasicMaterial({
        color: cfg.color, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.set(...cfg.tilt);
      orbGroup.add(m);
      return { m, mat, speed: cfg.speed, baseOp: cfg.baseOp };
    });

    /* ──────────────────────────────────────────────────
       LIGHTS
    ────────────────────────────────────────────────── */
    scene.add(new THREE.AmbientLight(0x0d0825, 2.5));

    const pl1 = new THREE.PointLight(0x7c3aed, 8, 18);
    pl1.position.set(2, 2, 3.5);
    scene.add(pl1);

    const pl2 = new THREE.PointLight(0xf472b6, 5, 14);
    pl2.position.set(-2, -1.5, 3);
    scene.add(pl2);

    const pl3 = new THREE.PointLight(0xfb923c, 3, 10);
    pl3.position.set(0, 0, 2.5);
    scene.add(pl3);

    /* ════════════════════════════════════════════════════
       ANIMATION STATE
    ════════════════════════════════════════════════════ */
    let phase   = 0;   // 0=build, 1=idle, 2=dive
    let elapsed = 0;
    let phaseT  = 0;
    let rafId   = null;
    const clock = new THREE.Clock();

    /* ── Animate loop ───────────────────────────────── */
    function animate() {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      elapsed += dt;
      phaseT  += dt;

      /* ── Phase transitions ─────────────────────── */
      if (phase === 0 && phaseT > 0.65) {
        phase = 1; phaseT = 0;
        showHUD();
        setProgress(5);
      }

      /* ── PHASE 0 : BUILD ───────────────────────── */
      if (phase === 0) {
        const t  = clamp(phaseT / 0.60, 0, 1);
        const s  = eOut5(t);

        orbGroup.scale.setScalar(s * 0.9 + 0.1);
        coreMat.opacity    = s * 0.88;
        shellMat.opacity   = s * 0.52;
        latticeMat.opacity = s * 0.22;
        haloMat.opacity    = s * 0.035;
        dustMesh.material.opacity = s * 0.28;

        warpRings.forEach((r, i) => {
          r.mat.opacity = s * 0.08 * (1 - i / RING_N);
        });
      }

      /* ── PHASE 1 : IDLE ────────────────────────── */
      if (phase === 1) {
        /* Rotation */
        orbGroup.rotation.y += 0.0042 * (dt / 0.01667);
        orbGroup.rotation.x += 0.0016 * (dt / 0.01667);
        shellMesh.rotation.y  -= 0.0030 * (dt / 0.01667);
        shellMesh.rotation.z  += 0.0018 * (dt / 0.01667);
        latticeMesh.rotation.x += 0.0022 * (dt / 0.01667);
        dustMesh.rotation.y += 0.00025 * (dt / 0.01667);

        /* Breathe */
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.9);
        coreMat.emissiveIntensity = 1.5 + pulse * 0.9;
        haloMat.opacity  = 0.025 + pulse * 0.040;
        dustMesh.material.opacity = 0.24 + pulse * 0.08;

        /* Energy rings */
        eRings.forEach((r, i) => {
          r.m.rotation.z += r.speed * (dt / 0.01667);
          r.mat.opacity = r.baseOp * (0.55 + 0.45 * Math.sin(elapsed * 1.3 + i * 1.4));
        });

        /* Arc net */
        arcLines.forEach(a => {
          a.mat.opacity = (0.5 + 0.5 * Math.sin(elapsed * a.spd + a.phase)) * a.maxOp;
        });

        /* Light orbit */
        pl1.position.x = Math.sin(elapsed * 0.65) * 2.5;
        pl1.position.y = Math.cos(elapsed * 0.50) * 2.0;
        pl2.position.x = Math.cos(elapsed * 0.55) * 2.2;
        pl2.position.y = Math.sin(elapsed * 0.70) * 1.8;
        pl1.intensity = 6.5 + Math.sin(elapsed * 1.6) * 1.8;
        pl2.intensity = 4.0 + Math.sin(elapsed * 1.2) * 1.2;

        /* Warp rings drift */
        warpRings.forEach((r, i) => {
          r.mesh.rotation.z += 0.0008 * (dt / 0.01667) * (i % 2 === 0 ? 1 : -1);
          r.mat.opacity = 0.06 * (0.5 + 0.5 * Math.sin(elapsed * 0.5 + r.phase));
        });
        warpGroup.rotation.z += 0.0003 * (dt / 0.01667);

        /* Auto progress */
        const p = eOut3(clamp(phaseT / 2.55, 0, 1));
        setProgress(Math.floor(p * 100));
      }

      /* ── PHASE 2 : DIVE ────────────────────────── */
      if (phase === 2) {
        const t = clamp(phaseT / 0.80, 0, 1);

        /* Camera rushes into core */
        camera.position.z = lerp(6.5, -1.0, eIn3(t));
        camera.fov = lerp(62, 95, eIn3(t));
        camera.updateProjectionMatrix();

        /* Orb expands to fill screen */
        orbGroup.scale.setScalar(lerp(1, 3.5, eIn3(t)));
        coreMat.emissiveIntensity = lerp(2.0, 9.0, eIn3(t));
        haloMat.opacity = lerp(0.04, 0.7, eIn3(t));

        /* Warp rings rush past */
        warpRings.forEach((r, i) => {
          r.mesh.position.z += dt * (20 + i * 2.5);
          r.mat.opacity = lerp(0.06, 0.55, eIn3(t)) * (1 - i / RING_N * 0.5);
        });

        /* Ring spin accelerates */
        eRings.forEach(r => {
          r.m.rotation.z += r.speed * 6 * (dt / 0.01667);
        });

        /* White flash veil */
        const veil = document.getElementById('ci-veil');
        if (veil) veil.style.opacity = String(eIn3(clamp(t * 1.3 - 0.3, 0, 1)));

        setProgress(100);

        if (t >= 1 && !exited) {
          cancelAnimationFrame(rafId);
          try { renderer.dispose(); } catch(e) {}
          doExit(180);
        }
      }

      renderer.render(scene, camera);
    }

    animate();

    /* ── Expose dive trigger ─────────────────────── */
    window._ciStartDive = () => {
      if (phase < 2) { phase = 2; phaseT = 0; setProgress(100); }
    };

    /* ── Resize ─────────────────────────────────── */
    window.addEventListener('resize', () => {
      const W2 = window.innerWidth, H2 = window.innerHeight;
      camera.aspect = W2 / H2;
      camera.updateProjectionMatrix();
      renderer.setSize(W2, H2);
    });

  } // end initScene

  /* ════════════════════════════════════════════════════════
     EXIT
  ════════════════════════════════════════════════════════ */
  let exited = false;

  function doExit(delay) {
    if (exited) return;
    exited = true;
    setTimeout(() => {
      ov.style.transition = 'opacity 0.55s cubic-bezier(.4,0,.2,1)';
      ov.style.opacity = '0';
      setTimeout(() => {
        ov.style.display = 'none';
        try { ov.parentNode.removeChild(ov); } catch(e) {}
        delete window._ciStartDive;
      }, 600);
    }, delay || 0);
  }

  /* ════════════════════════════════════════════════════════
     SEQUENCE CONTROL
  ════════════════════════════════════════════════════════ */
  const startTs  = Date.now();
  const MIN_SHOW = 3600; // ms minimum before dive

  window.addEventListener('load', () => {
    const waited = Date.now() - startTs;
    setTimeout(() => {
      if (window._ciStartDive) window._ciStartDive();
      else doExit(0);
    }, Math.max(0, MIN_SHOW - waited));
  }, { once: true });

  /* Absolute hard cap */
  setTimeout(() => { if (!exited) doExit(0); }, 5500);

})();