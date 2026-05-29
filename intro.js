/**
 * CrackAI — ULTRA ENERGETIC INTRO v6.0
 * Plasma orb · Data streams · India Pride · Hyper-futuristic
 */
(function () {
  'use strict';
  if (document.getElementById('sscIntroOverlay')) return;

  const isMobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 600;
  const isLowEnd = isMobile && (window.innerWidth < 380 || (navigator.deviceMemory && navigator.deviceMemory <= 2));
  const DPR = Math.min(devicePixelRatio, isLowEnd ? 1 : isMobile ? 1.5 : 2);
  const ORB_SZ = isLowEnd ? 90 : isMobile ? 110 : 140;

  /* ─── 1. INJECT DOM ──────────────────────────────────────── */
  const overlay = document.createElement('div');
  overlay.id = 'sscIntroOverlay';
  overlay.innerHTML = `
    <canvas id="iParticleBg"></canvas>
    <div id="iScanLine"></div>
    <div id="iDataLeft" class="iDataStream"></div>
    <div id="iDataRight" class="iDataStream iDataRight"></div>

    <div id="iHUD">
      <div class="iCorner iCTL"><span class="iCH"></span><span class="iCV"></span></div>
      <div class="iCorner iCTR"><span class="iCH"></span><span class="iCV"></span></div>
      <div class="iCorner iCBL"><span class="iCH"></span><span class="iCV"></span></div>
      <div class="iCorner iCBR"><span class="iCH"></span><span class="iCV"></span></div>
      <div id="iHudTop">CRACKAI · NEURAL ENGINE v6.0 · AI-POWERED</div>
      <div id="iHudBot">🇮🇳 INDIA · भारत · <span id="iClock"></span></div>
    </div>

    <div id="iCenter">
      <div id="iOrbAssm">
        <div class="iRing iR1"></div>
        <div class="iRing iR2"></div>
        <div class="iRing iR3"></div>
        <canvas id="iOrbCv"></canvas>
        <div id="iOrbGlow"></div>
        <div id="iOrbCore"></div>
      </div>

      <div id="iBrand">
        <div id="iSanskrit">ज्ञानं परमं बलम्</div>
        <div id="iBrandName">
          <span class="iBL iCC">C</span><span class="iBL iCC">r</span><span class="iBL iCC">a</span><span class="iBL iCC">c</span><span class="iBL iCC">k</span>
          <span class="iSp"></span>
          <span class="iBL iCG">A</span><span class="iBL iCG">I</span>
        </div>
        <div id="iTagline">INTELLIGENT EXAM ASSISTANT · भारत का AI टीचर</div>
      </div>

      <div id="iStats">
        <div class="iStat">
          <span class="iStatNum" data-t="50" data-s="K+">0</span><span class="iStatSuf">K+</span>
          <span class="iStatLbl">Students</span>
        </div>
        <div class="iStatDiv"></div>
        <div class="iStat">
          <span class="iStatNum" data-t="1" data-s="M+">0</span><span class="iStatSuf">M+</span>
          <span class="iStatLbl">Questions</span>
        </div>
        <div class="iStatDiv"></div>
        <div class="iStat">
          <span class="iStatNum" data-t="4.9" data-d="1" data-s="★">0</span><span class="iStatSuf">★</span>
          <span class="iStatLbl">Rating</span>
        </div>
      </div>

      <div id="iProg">
        <div id="iProgTrack"><div id="iProgBar"></div></div>
        <div id="iProgPct">0%</div>
      </div>

      <div id="iStatus">
        <div id="iDot"></div>
        <div id="iStatusTx">Initializing Neural Core…</div>
      </div>

      <div id="iMII">🇮🇳 <span>Proudly Made in India</span></div>
    </div>

    <div id="iVeil"></div>
  `;
  document.body.insertBefore(overlay, document.body.firstChild);

  /* ─── 2. INJECT CSS ─────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Tiro+Devanagari+Sanskrit&display=swap');

    #sscIntroOverlay{
      position:fixed;inset:0;z-index:99999;
      background:radial-gradient(ellipse 120% 100% at 50% 50%, #08021a 0%, #020208 60%);
      display:flex;align-items:center;justify-content:center;
      overflow:hidden;will-change:opacity;
    }

    /* ── Particle BG canvas ── */
    #iParticleBg{position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}

    /* ── Scan line sweep ── */
    #iScanLine{
      position:absolute;left:0;right:0;height:2px;
      background:linear-gradient(90deg,transparent 0%,rgba(108,99,255,0.6) 30%,rgba(255,107,157,0.8) 50%,rgba(108,99,255,0.6) 70%,transparent 100%);
      box-shadow:0 0 20px rgba(108,99,255,0.5);
      animation:scanSweep 2.5s linear infinite;
      z-index:1;pointer-events:none;
    }
    @keyframes scanSweep{0%{top:-2px;opacity:0}10%{opacity:1}90%{opacity:0.7}100%{top:100%;opacity:0}}

    /* ── Data streams (sides) ── */
    .iDataStream{
      position:absolute;top:0;bottom:0;width:${isMobile?'28px':'40px'};
      z-index:1;pointer-events:none;
      display:flex;flex-direction:column;gap:0;overflow:hidden;
    }
    #iDataLeft{left:0;background:linear-gradient(90deg,rgba(108,99,255,0.06) 0%,transparent 100%)}
    .iDataRight{right:0;background:linear-gradient(270deg,rgba(255,107,157,0.06) 0%,transparent 100%)}

    /* ── HUD ── */
    #iHUD{position:absolute;inset:0;pointer-events:none;z-index:3}
    .iCorner{position:absolute;width:${isMobile?'24px':'32px'};height:${isMobile?'24px':'32px'};opacity:0;will-change:opacity,transform;transition:transform 0.3s}
    .iCTL{top:18px;left:18px}.iCTR{top:18px;right:18px}.iCBL{bottom:18px;left:18px}.iCBR{bottom:18px;right:18px}
    .iCH,.iCV{position:absolute}
    .iCH{height:2px;width:100%;background:linear-gradient(90deg,#6C63FF,#a78bfa)}
    .iCV{width:2px;height:100%;background:linear-gradient(180deg,#6C63FF,#a78bfa)}
    .iCTL .iCH,.iCBL .iCH{top:0;left:0}.iCTR .iCH,.iCBR .iCH{top:0;right:0;left:auto}
    .iCTL .iCV,.iCTR .iCV{top:0}.iCBL .iCV,.iCBR .iCV{bottom:0;top:auto}
    .iCBL .iCH,.iCBR .iCH{top:auto;bottom:0}
    .iCBR .iCV{left:auto;right:0}.iCTR .iCV{left:auto;right:0}

    #iHudTop,#iHudBot{
      position:absolute;
      font-family:'Rajdhani',monospace;
      font-size:${isMobile?'8px':'10px'};font-weight:600;
      letter-spacing:0.22em;text-transform:uppercase;
      background:linear-gradient(90deg,rgba(108,99,255,0.6),rgba(255,107,157,0.5));
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
      white-space:nowrap;opacity:0;will-change:opacity;
      left:50%;transform:translateX(-50%);
    }
    #iHudTop{top:14px}
    #iHudBot{bottom:14px}

    /* ── Center ── */
    #iCenter{
      position:relative;z-index:5;
      display:flex;flex-direction:column;align-items:center;gap:0;
      opacity:0;will-change:opacity;
    }

    /* ── Orb assembly ── */
    #iOrbAssm{
      position:relative;
      width:${ORB_SZ+90}px;height:${ORB_SZ+90}px;
      display:flex;align-items:center;justify-content:center;
      transform:scale(0) rotate(-20deg);will-change:transform;
    }
    .iRing{
      position:absolute;top:50%;left:50%;
      transform:translate(-50%,-50%);
      border-radius:50%;pointer-events:none;
    }
    .iR1{
      width:${ORB_SZ+28}px;height:${ORB_SZ+28}px;
      border:1.5px solid rgba(108,99,255,0.5);
      box-shadow:0 0 30px rgba(108,99,255,0.2),inset 0 0 20px rgba(108,99,255,0.08);
      animation:iRingSpin 8s linear infinite;
    }
    .iR2{
      width:${ORB_SZ+58}px;height:${ORB_SZ+58}px;
      border:1px solid rgba(255,107,157,0.25);
      animation:iRingSpin 14s linear infinite reverse;
    }
    .iR3{
      width:${ORB_SZ+88}px;height:${ORB_SZ+88}px;
      border:1px dashed rgba(108,99,255,0.12);
      animation:iRingSpin 20s linear infinite;
    }
    @keyframes iRingSpin{0%{transform:translate(-50%,-50%) rotate(0deg)}100%{transform:translate(-50%,-50%) rotate(360deg)}}

    #iOrbCv{position:relative;z-index:2;border-radius:50%;display:block;width:${ORB_SZ}px;height:${ORB_SZ}px;}

    #iOrbGlow{
      position:absolute;z-index:1;
      width:${ORB_SZ+60}px;height:${ORB_SZ+60}px;
      border-radius:50%;
      background:radial-gradient(circle,rgba(108,99,255,0.4) 0%,rgba(255,107,157,0.15) 40%,transparent 70%);
      filter:blur(16px);
      animation:iGlowPulse 2s ease-in-out infinite;
    }
    @keyframes iGlowPulse{0%,100%{opacity:0.6;transform:scale(0.9)}50%{opacity:1;transform:scale(1.12)}}

    #iOrbCore{
      position:absolute;z-index:3;
      width:${Math.floor(ORB_SZ*0.3)}px;height:${Math.floor(ORB_SZ*0.3)}px;
      border-radius:50%;
      background:radial-gradient(circle,rgba(255,255,255,0.9) 0%,rgba(200,190,255,0.6) 50%,transparent 70%);
      filter:blur(3px);
      animation:iCorePulse 1.5s ease-in-out infinite;
      pointer-events:none;
    }
    @keyframes iCorePulse{0%,100%{opacity:0.5;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}

    /* ── Brand ── */
    #iBrand{
      margin-top:${isMobile?'24px':'32px'};
      text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px;
    }
    #iSanskrit{
      font-family:'Tiro Devanagari Sanskrit','Noto Serif Devanagari',serif;
      font-size:${isMobile?'11px':'13px'};
      color:rgba(255,153,51,0.85);letter-spacing:0.07em;
      opacity:0;transform:translateY(-8px);will-change:opacity,transform;
      text-shadow:0 0 30px rgba(255,153,51,0.6);
    }
    #iBrandName{
      display:flex;align-items:baseline;justify-content:center;
      gap:${isMobile?'1px':'2px'};overflow:visible;line-height:1;
    }
    .iBL{
      display:inline-block;
      font-family:'Rajdhani','Space Grotesk',sans-serif;
      font-size:${isMobile?'clamp(30px,9vw,42px)':'clamp(42px,7vw,64px)'};
      font-weight:700;letter-spacing:-0.02em;
      background:linear-gradient(155deg,#ffffff 0%,rgba(210,205,255,0.9) 55%,#b8b0ff 100%);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
      opacity:0;transform:translateY(60px) rotateX(-90deg) scale(0.7);
      transform-origin:50% 100%;will-change:transform,opacity;
    }
    .iCC{background:linear-gradient(155deg,#7c6fff,#a78bfa,#6C63FF);-webkit-background-clip:text;background-clip:text}
    .iCG{background:linear-gradient(155deg,#ffe97a,#FF9933,#ff6b00);-webkit-background-clip:text;background-clip:text}
    .iSp{display:inline-block;width:${isMobile?'10px':'16px'}}
    #iTagline{
      font-family:'Rajdhani',sans-serif;
      font-size:${isMobile?'8px':'10px'};font-weight:600;
      letter-spacing:0.18em;text-transform:uppercase;
      color:rgba(180,170,255,0.45);
      opacity:0;transform:translateY(8px);will-change:opacity,transform;
    }

    /* ── Stats ── */
    #iStats{
      display:flex;align-items:center;gap:${isMobile?'18px':'32px'};
      margin-top:${isMobile?'18px':'26px'};
      opacity:0;transform:translateY(14px);will-change:opacity,transform;
    }
    .iStat{display:flex;flex-direction:column;align-items:center;gap:2px}
    .iStatNum{
      font-family:'Rajdhani',sans-serif;
      font-size:${isMobile?'20px':'26px'};font-weight:700;
      background:linear-gradient(135deg,#7c6fff,#FF6B9D);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
    }
    .iStatSuf{font-family:'Rajdhani',sans-serif;font-size:${isMobile?'14px':'17px'};font-weight:700;color:#FF9933;-webkit-text-fill-color:#FF9933;margin-left:1px}
    .iStatLbl{font-size:${isMobile?'8px':'9px'};letter-spacing:0.14em;text-transform:uppercase;color:rgba(180,170,255,0.35);font-family:'Rajdhani',sans-serif;margin-top:1px}
    .iStatDiv{width:1px;height:30px;background:linear-gradient(180deg,transparent,rgba(108,99,255,0.3),transparent)}

    /* ── Progress ── */
    #iProg{
      margin-top:${isMobile?'22px':'30px'};
      width:${isMobile?'200px':'280px'};
      opacity:0;display:flex;flex-direction:column;align-items:center;gap:5px;will-change:opacity;
    }
    #iProgTrack{width:100%;height:3px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden;position:relative}
    #iProgBar{
      height:100%;width:0%;border-radius:3px;
      background:linear-gradient(90deg,#6C63FF,#FF6B9D,#FF9933);
      box-shadow:0 0 12px rgba(108,99,255,0.7);
      position:relative;
    }
    #iProgBar::after{
      content:'';position:absolute;right:0;top:-2px;bottom:-2px;width:6px;
      background:white;border-radius:50%;filter:blur(2px);
      box-shadow:0 0 8px #fff,0 0 16px #a78bfa;
    }
    #iProgPct{font-family:'Rajdhani',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;color:rgba(180,170,255,0.5)}

    /* ── Status ── */
    #iStatus{margin-top:8px;display:flex;align-items:center;gap:8px;opacity:0;will-change:opacity}
    #iDot{
      width:6px;height:6px;border-radius:50%;flex-shrink:0;
      background:#6C63FF;box-shadow:0 0 10px rgba(108,99,255,1);
      animation:iDotPulse 0.9s ease-in-out infinite;
    }
    @keyframes iDotPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(0.4);opacity:0.2}}
    #iStatusTx{
      font-family:'Rajdhani',monospace;
      font-size:${isMobile?'9px':'11px'};font-weight:600;
      letter-spacing:0.14em;text-transform:uppercase;
      color:rgba(180,170,255,0.6);white-space:nowrap;
    }

    /* ── Made in India ── */
    #iMII{
      margin-top:12px;display:flex;align-items:center;gap:6px;
      font-family:'Rajdhani',sans-serif;
      font-size:${isMobile?'10px':'12px'};font-weight:700;letter-spacing:0.18em;text-transform:uppercase;
      background:linear-gradient(90deg,#FF9933 0%,#ffffff 50%,#138808 100%);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
      opacity:0;will-change:opacity;
    }

    /* ── Exit veil ── */
    #iVeil{
      position:absolute;inset:0;z-index:10;pointer-events:none;opacity:0;
      background:radial-gradient(circle at center,rgba(108,99,255,0.5) 0%,rgba(2,2,20,0.98) 60%,#020208 100%);
    }

    @media(max-width:480px){
      #iHudTop,#iHudBot{font-size:7px;letter-spacing:0.12em}
      .iCorner{width:18px;height:18px}
    }
  `;
  document.head.appendChild(style);

  /* ─── 3. HUD CLOCK ──────────────────────────────────────── */
  function tickClock() {
    const el = document.getElementById('iClock');
    if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  tickClock();
  const clockInt = setInterval(tickClock, 1000);

  /* ─── 4. PARTICLE BACKGROUND ────────────────────────────── */
  function initParticleBg() {
    const canvas = document.getElementById('iParticleBg');
    if (!canvas) return null;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const COUNT = isLowEnd ? 30 : isMobile ? 55 : 110;
    const COLS = ['rgba(108,99,255,', 'rgba(255,107,157,', 'rgba(167,139,250,', 'rgba(255,153,51,'];
    const pts = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.3,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      col: COLS[Math.floor(Math.random() * COLS.length)],
      a: Math.random() * 0.6 + 0.1,
    }));
    let alive = true;
    function draw() {
      if (!alive) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.col + p.a + ')';
        ctx.fill();
      });
      // Connection lines for nearby particles
      if (!isLowEnd) {
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 80) {
              ctx.beginPath();
              ctx.moveTo(pts[i].x, pts[i].y);
              ctx.lineTo(pts[j].x, pts[j].y);
              ctx.strokeStyle = `rgba(108,99,255,${0.08 * (1 - dist / 80)})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }
      requestAnimationFrame(draw);
    }
    draw();
    return { dispose() { alive = false; } };
  }

  /* ─── 5. LOAD LIBS ──────────────────────────────────────── */
  function loadScript(src, cb) {
    const s = document.createElement('script');
    s.src = src; s.onload = cb; s.onerror = cb;
    document.head.appendChild(s);
  }
  let _g = false, _t = false;
  function _check() { if (_g && _t) startIntro(); }
  loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js', () => { _g = true; _check(); });
  loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', () => { _t = true; _check(); });

  /* ─── 6. THREE.JS PLASMA ORB ────────────────────────────── */
  function initOrb() {
    const canvas = document.getElementById('iOrbCv');
    if (!canvas || typeof THREE === 'undefined') return null;
    canvas.width = canvas.height = ORB_SZ * DPR;
    canvas.style.width = ORB_SZ + 'px';
    canvas.style.height = ORB_SZ + 'px';

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isLowEnd, alpha: true });
    renderer.setPixelRatio(DPR);
    renderer.setSize(ORB_SZ, ORB_SZ);
    renderer.setClearColor(0, 0);

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    cam.position.z = 3.2;

    // Core plasma sphere
    const oGeo = new THREE.SphereGeometry(0.78, isLowEnd ? 24 : 64, isLowEnd ? 24 : 64);
    const oMat = new THREE.MeshPhongMaterial({
      color: 0x4a3dc8,
      emissive: new THREE.Color(0x200a60),
      emissiveIntensity: 0.8,
      shininess: 250,
      specular: new THREE.Color(0xe0d8ff),
    });
    const orb = new THREE.Mesh(oGeo, oMat);
    scene.add(orb);

    // Geodesic wireframe overlay
    if (!isLowEnd) {
      const wGeo = new THREE.IcosahedronGeometry(0.82, 2);
      scene.add(new THREE.Mesh(wGeo, new THREE.MeshBasicMaterial({
        color: 0xc8c0ff, wireframe: true, transparent: true, opacity: 0.12
      })));
    }

    // Glow shells
    [[0.92, 0x8070ff, 0.18], [1.10, 0xff6b9d, 0.07], [1.28, 0xffd070, 0.03]].forEach(([r, c, o]) => {
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(r, 16, 16),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.BackSide })
      ));
    });

    // Dynamic lights
    scene.add(new THREE.AmbientLight(0x6655ff, 0.6));
    const p1 = new THREE.PointLight(0xa090ff, 4.0, 8); p1.position.set(2, 2, 2); scene.add(p1);
    const p2 = new THREE.PointLight(0xFF9933, 2.2, 6); p2.position.set(-2, -1, 1); scene.add(p2);
    const p3 = new THREE.PointLight(0xFF6B9D, 1.5, 5); p3.position.set(0, -2, 1.5); scene.add(p3);

    let alive = true, raf, t = 0;
    function animate() {
      if (!alive) return;
      raf = requestAnimationFrame(animate);
      t += 0.018;
      orb.scale.setScalar(1 + Math.sin(t * 1.3) * 0.022);
      orb.rotation.y += 0.009;
      orb.rotation.x += 0.003;
      orb.rotation.z += 0.001;
      p1.position.x = Math.cos(t * 0.42) * 2.4;
      p1.position.y = Math.sin(t * 0.33) * 2.0;
      p1.intensity = 3.5 + Math.sin(t * 2.2) * 0.8;
      p2.position.y = Math.cos(t * 0.55) * 1.5 - 1;
      renderer.render(scene, cam);
    }
    animate();
    return {
      dispose() {
        alive = false; cancelAnimationFrame(raf); renderer.dispose(); oGeo.dispose(); oMat.dispose();
      }
    };
  }

  /* ─── 7. PARTICLE EXIT BURST ─────────────────────────────── */
  function fireParticleBurst(cb) {
    const c = document.createElement('canvas');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:8;pointer-events:none';
    overlay.appendChild(c);
    c.width = window.innerWidth; c.height = window.innerHeight;
    const ctx = c.getContext('2d');
    const cx = c.width / 2, cy = c.height / 2;
    const COLS = ['#7c6fff','#a89cff','#FF6B9D','#ff9d9d','#ffffff','#FF9933','#ffd7e9','#ffe080'];
    const N = isLowEnd ? 40 : isMobile ? 80 : 150;
    const pts = Array.from({ length: N }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 14 + 5;
      return {
        x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 3,
        r: Math.random() * 5 + 1.5, color: COLS[Math.floor(Math.random() * COLS.length)],
        life: 0, maxLife: Math.random() * 45 + 30
      };
    });
    function draw() {
      ctx.clearRect(0, 0, c.width, c.height);
      let any = false;
      pts.forEach(p => {
        if (p.life >= p.maxLife) return;
        any = true;
        p.x += p.vx; p.y += p.vy; p.vy += 0.32; p.vx *= 0.97; p.vy *= 0.97; p.life++;
        const al = 1 - p.life / p.maxLife;
        ctx.save(); ctx.globalAlpha = al;
        ctx.fillStyle = p.color; ctx.shadowBlur = 10; ctx.shadowColor = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
      if (any) requestAnimationFrame(draw); else { c.remove(); if (cb) cb(); }
    }
    requestAnimationFrame(draw);
  }

  /* ─── 8. COUNTER ANIMATION ──────────────────────────────── */
  function animateCounters() {
    document.querySelectorAll('.iStatNum').forEach(el => {
      const target = parseFloat(el.dataset.t);
      const dec = parseInt(el.dataset.d || '0');
      let cur = 0;
      const step = target / 40;
      const t = setInterval(() => {
        cur = Math.min(cur + step, target);
        el.textContent = cur.toFixed(dec);
        if (cur >= target) clearInterval(t);
      }, 25);
    });
  }

  /* ─── 9. MAIN TIMELINE ──────────────────────────────────── */
  function startIntro() {
    if (typeof gsap === 'undefined') { finishIntro(null, null); return; }

    const particleBg = initParticleBg();
    const orbScene = initOrb();

    const center = document.getElementById('iCenter');
    const orbAssm = document.getElementById('iOrbAssm');
    const sanskrit = document.getElementById('iSanskrit');
    const letters = document.querySelectorAll('.iBL');
    const tagline = document.getElementById('iTagline');
    const stats = document.getElementById('iStats');
    const prog = document.getElementById('iProg');
    const progBar = document.getElementById('iProgBar');
    const progPct = document.getElementById('iProgPct');
    const status = document.getElementById('iStatus');
    const statusTx = document.getElementById('iStatusTx');
    const dot = document.getElementById('iDot');
    const corners = document.querySelectorAll('.iCorner');
    const mii = document.getElementById('iMII');
    const veil = document.getElementById('iVeil');

    const MSGS = [
      'Initializing Neural Core…',
      'Loading Knowledge Base…',
      'Calibrating AI Systems…',
      'Activating Exam Intelligence…',
      '⚡ System Ready · प्रणाली तैयार',
    ];

    // Progress ticker
    let pTarget = 0, pCur = 0;
    function tickProg() {
      pCur += (pTarget - pCur) * 0.08;
      if (progBar) progBar.style.width = pCur + '%';
      if (progPct) progPct.textContent = Math.round(pCur) + '%';
      requestAnimationFrame(tickProg);
    }
    tickProg();

    // HUD text fade in
    setTimeout(() => {
      gsap.to('#iHudTop', { opacity: 1, duration: 0.6 });
      gsap.to('#iHudBot', { opacity: 1, duration: 0.6, delay: 0.15 });
    }, 300);

    // GSAP initial states
    gsap.set(center, { opacity: 0 });
    gsap.set(orbAssm, { scale: 0, rotation: -20 });
    gsap.set(sanskrit, { opacity: 0, y: -12 });
    gsap.set(letters, { opacity: 0, y: 60, rotateX: -90, scale: 0.7 });
    gsap.set(tagline, { opacity: 0, y: 10 });
    gsap.set(stats, { opacity: 0, y: 16 });
    gsap.set(prog, { opacity: 0 });
    gsap.set(status, { opacity: 0 });
    gsap.set(corners, { opacity: 0, scale: 0.4 });
    gsap.set(mii, { opacity: 0, y: 6 });

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => fireParticleBurst(() => finishIntro(orbScene, particleBg))
    });

    // Phase 0: Corners snap in with scale
    tl.to(corners, { opacity: 1, scale: 1, duration: 0.4, stagger: 0.06 }, 0.1);

    // Phase 1: Center fades in
    tl.to(center, { opacity: 1, duration: 0.5 }, 0.3);

    // Phase 2: Orb ERUPTS with dramatic back.out spring + rotation
    tl.to(orbAssm, { scale: 1, rotation: 0, duration: 1.1, ease: 'back.out(3.0)' }, 0.4);

    // Phase 3: Sanskrit materializes with color flash
    tl.to(sanskrit, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 1.2);

    // Phase 4: Brand letters cascade up with 3D flip — fast and punchy
    tl.to(letters, {
      opacity: 1, y: 0, rotateX: 0, scale: 1,
      duration: 0.55, ease: 'back.out(2.5)',
      stagger: { each: 0.045, from: 'start' }
    }, 1.45);

    // Phase 5: Tagline + MII
    tl.to(tagline, { opacity: 1, y: 0, duration: 0.4 }, 2.0);
    tl.to(mii, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 2.1);

    // Phase 6: Progress + status
    tl.to(prog, { opacity: 1, duration: 0.4 }, 2.1);
    tl.to(status, { opacity: 1, duration: 0.4 }, 2.25);

    // Phase 7: Status messages + progress advances
    const msgPlan = [
      { t: 2.35, p: 15 },
      { t: 2.80, p: 40 },
      { t: 3.20, p: 65 },
      { t: 3.55, p: 85 },
      { t: 3.88, p: 100 },
    ];
    msgPlan.forEach(({ t, p }, i) => {
      tl.add(() => {
        if (statusTx) statusTx.textContent = MSGS[i];
        pTarget = p;
        if (i === 1) {
          gsap.to(stats, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' });
          animateCounters();
        }
        if (i === 4) {
          // Ready flash — dot turns orange, letters glow
          if (dot) { dot.style.background = '#FF9933'; dot.style.boxShadow = '0 0 14px rgba(255,153,51,1)'; }
          gsap.to(letters, { filter: 'brightness(1.8) saturate(2)', duration: 0.2, stagger: 0.018 });
          gsap.to(letters, { filter: 'brightness(1) saturate(1)', duration: 0.5, delay: 0.3, stagger: 0.018 });
          // Orb glow surge
          gsap.to('#iOrbGlow', { scale: 1.4, opacity: 1, duration: 0.3 });
          gsap.to('#iOrbGlow', { scale: 1, opacity: 0.7, duration: 0.5, delay: 0.3 });
        }
      }, t);
    });

    // Phase 8: DRAMATIC EXIT — orb implodes then EXPLODES outward
    tl.to(orbAssm, { scale: 0.5, rotation: 10, duration: 0.22, ease: 'power4.in' }, 4.38);
    tl.to([tagline, stats, prog, status, mii], { opacity: 0, y: -20, duration: 0.28, stagger: 0.035 }, 4.32);
    tl.to(sanskrit, { opacity: 0, y: -20, duration: 0.25 }, 4.32);
    tl.to(letters, {
      opacity: 0, y: -50, rotateX: 85,
      duration: 0.35, stagger: { each: 0.025, from: 'end' }, ease: 'power4.in'
    }, 4.38);
    tl.to(corners, { opacity: 0, scale: 0.2, duration: 0.25, stagger: 0.04 }, 4.38);
    tl.to('#iHudTop,#iHudBot', { opacity: 0, duration: 0.22 }, 4.38);
    tl.to(orbAssm, { scale: 8, opacity: 0, rotation: -30, duration: 0.6, ease: 'expo.out' }, 4.58);
    tl.to('#iScanLine', { opacity: 0, duration: 0.3 }, 4.50);
    tl.to(veil, { opacity: 1, duration: 0.3, ease: 'power3.in' }, 4.48);
    tl.to(veil, { opacity: 0, duration: 0.5, ease: 'expo.out' }, 4.78);
    tl.to(overlay, { opacity: 0, duration: 0.5, ease: 'power2.inOut' }, 4.62);
  }

  /* ─── 10. FINISH ─────────────────────────────────────────── */
  function finishIntro(orbScene, particleBg) {
    clearInterval(clockInt);
    window.__introComplete = true;
    window.dispatchEvent(new CustomEvent('sscIntroComplete'));
    requestAnimationFrame(() => {
      if (orbScene) orbScene.dispose();
      if (particleBg) particleBg.dispose();
      overlay.remove();
      style.remove();
    });
  }

})();