/**
 * SSC PrepAI — PREMIUM INTRO v5.0
 * Ultra-clean · Minimal Orbs · No scan lines · Futuristic
 * Two ambient orbs + one central crystalline orb
 */
(function () {
  'use strict';
  if (document.getElementById('sscIntroOverlay')) return;

  const isMobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 600;
  const isLowEnd = isMobile && (window.innerWidth < 380 || (navigator.deviceMemory && navigator.deviceMemory <= 2));
  const DPR = Math.min(devicePixelRatio, isLowEnd ? 1 : isMobile ? 1.5 : 2);
  const ORB_SZ = isLowEnd ? 80 : isMobile ? 100 : 130;

  /* ─── 1. INJECT DOM ──────────────────────────────────────── */
  const overlay = document.createElement('div');
  overlay.id = 'sscIntroOverlay';
  overlay.innerHTML = `
    <!-- Ambient background orbs (static, no movement) -->
    <div id="iAmbientOrb1"></div>
    <div id="iAmbientOrb2"></div>

    <!-- HUD corners -->
    <div id="iHUD">
      <div class="iCorner iCTL"><span class="iCH"></span><span class="iCV"></span></div>
      <div class="iCorner iCTR"><span class="iCH"></span><span class="iCV"></span></div>
      <div class="iCorner iCBL"><span class="iCH"></span><span class="iCV"></span></div>
      <div class="iCorner iCBR"><span class="iCH"></span><span class="iCV"></span></div>
      <div id="iHudTop">SSC PREP AI &nbsp;·&nbsp; NEURAL v5.0</div>
      <div id="iHudBot">INDIA &nbsp;·&nbsp; भारत &nbsp;·&nbsp; <span id="iClock"></span></div>
    </div>

    <!-- Center stage -->
    <div id="iCenter">

      <!-- Crystal orb assembly -->
      <div id="iOrbAssm">
        <!-- Outer decorative rings (CSS only, no THREE.js) -->
        <div class="iRing iR1"></div>
        <div class="iRing iR2"></div>
        <!-- Center crystal orb canvas -->
        <canvas id="iOrbCv"></canvas>
        <!-- Orb inner glow -->
        <div id="iOrbGlow"></div>
      </div>

      <!-- Brand block -->
      <div id="iBrand">
        <div id="iSanskrit">ज्ञानं परमं बलम्</div>
        <div id="iBrandName">
          <span class="iBL">S</span><span class="iBL">S</span><span class="iBL">C</span>
          <span class="iSp"></span>
          <span class="iBL iCP">P</span><span class="iBL iCP">r</span><span class="iBL iCP">e</span><span class="iBL iCP">p</span>
          <span class="iSp"></span>
          <span class="iBL iCG">A</span><span class="iBL iCG">I</span>
        </div>
        <div id="iTagline">INTELLIGENT EXAM ASSISTANT &nbsp;·&nbsp; भारत का AI टीचर</div>
      </div>

      <!-- Stats row -->
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

      <!-- Progress bar -->
      <div id="iProg">
        <div id="iProgTrack"><div id="iProgBar"></div></div>
        <div id="iProgPct">0%</div>
      </div>

      <!-- Status line -->
      <div id="iStatus">
        <div id="iDot"></div>
        <div id="iStatusTx">Initializing Neural Core…</div>
      </div>

      <!-- Made in India -->
      <div id="iMII">🇮🇳 <span>Proudly Made in India</span></div>
    </div>

    <!-- Exit veil -->
    <div id="iVeil"></div>
  `;
  document.body.insertBefore(overlay, document.body.firstChild);

  /* ─── 2. INJECT CSS ─────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Tiro+Devanagari+Sanskrit&display=swap');

    /* Base overlay */
    #sscIntroOverlay{position:fixed;inset:0;z-index:99999;background:#040410;display:flex;align-items:center;justify-content:center;overflow:hidden;will-change:opacity}

    /* ── Ambient orbs (static glow, no movement) ── */
    #iAmbientOrb1{
      position:absolute;
      top:-10%;left:-8%;
      width:${isMobile?'320px':'520px'};
      height:${isMobile?'320px':'520px'};
      border-radius:50%;
      background:radial-gradient(circle at center,rgba(108,99,255,0.14) 0%,rgba(108,99,255,0.04) 45%,transparent 70%);
      pointer-events:none;
      will-change:opacity;
    }
    #iAmbientOrb2{
      position:absolute;
      bottom:-12%;right:-6%;
      width:${isMobile?'280px':'460px'};
      height:${isMobile?'280px':'460px'};
      border-radius:50%;
      background:radial-gradient(circle at center,rgba(255,107,157,0.10) 0%,rgba(255,107,157,0.03) 45%,transparent 70%);
      pointer-events:none;
      will-change:opacity;
    }

    /* ── HUD ── */
    #iHUD{position:absolute;inset:0;pointer-events:none}
    .iCorner{position:absolute;width:${isMobile?'22px':'28px'};height:${isMobile?'22px':'28px'};opacity:0;will-change:opacity,transform}
    .iCTL{top:20px;left:20px}.iCTR{top:20px;right:20px}.iCBL{bottom:20px;left:20px}.iCBR{bottom:20px;right:20px}
    .iCH,.iCV{position:absolute;background:rgba(108,99,255,0.55)}
    .iCH{height:1.5px;width:100%;top:0;left:0}
    .iCV{width:1.5px;height:100%;top:0;left:0}
    .iCTR .iCH,.iCBR .iCH{left:auto;right:0}
    .iCTR .iCV,.iCBR .iCV{left:auto;right:0}
    .iCBL .iCH,.iCBR .iCH{top:auto;bottom:0}
    .iCBL .iCV,.iCBR .iCV{top:auto;bottom:0}
    #iHudTop,#iHudBot{
      position:absolute;
      font-family:'Rajdhani',sans-serif;
      font-size:${isMobile?'8px':'9px'};
      font-weight:600;
      letter-spacing:0.22em;
      text-transform:uppercase;
      color:rgba(108,99,255,0.38);
      white-space:nowrap;
      opacity:0;
      left:50%;transform:translateX(-50%);
      will-change:opacity;
    }
    #iHudTop{top:16px}
    #iHudBot{bottom:16px}

    /* ── Center stage ── */
    #iCenter{
      position:relative;z-index:5;
      display:flex;flex-direction:column;
      align-items:center;gap:0;
      opacity:0;
      will-change:opacity;
    }

    /* ── Orb assembly ── */
    #iOrbAssm{
      position:relative;
      width:${ORB_SZ + 70}px;
      height:${ORB_SZ + 70}px;
      display:flex;align-items:center;justify-content:center;
      transform:scale(0);
      will-change:transform;
    }

    /* CSS decorative rings — only 2, clean, non-rotating */
    .iRing{
      position:absolute;top:50%;left:50%;
      transform:translate(-50%,-50%);
      border-radius:50%;
      pointer-events:none;
      will-change:opacity;
    }
    .iR1{
      width:${ORB_SZ + 24}px;height:${ORB_SZ + 24}px;
      border:1px solid rgba(108,99,255,0.30);
      box-shadow:0 0 24px rgba(108,99,255,0.10),inset 0 0 16px rgba(108,99,255,0.05);
      animation:iRingBreath 4s ease-in-out infinite;
    }
    .iR2{
      width:${ORB_SZ + 54}px;height:${ORB_SZ + 54}px;
      border:1px solid rgba(255,107,157,0.14);
      animation:iRingBreath 4s ease-in-out 1s infinite;
    }
    @keyframes iRingBreath{
      0%,100%{opacity:0.4;transform:translate(-50%,-50%) scale(1)}
      50%{opacity:0.85;transform:translate(-50%,-50%) scale(1.03)}
    }

    /* Three.js orb canvas */
    #iOrbCv{
      position:relative;z-index:2;
      border-radius:50%;display:block;
      width:${ORB_SZ}px;height:${ORB_SZ}px;
    }

    /* Orb inner glow layer */
    #iOrbGlow{
      position:absolute;z-index:1;
      width:${ORB_SZ + 40}px;height:${ORB_SZ + 40}px;
      border-radius:50%;
      background:radial-gradient(circle,rgba(108,99,255,0.28) 0%,transparent 65%);
      filter:blur(12px);
      animation:iGlowBreath 3s ease-in-out infinite;
    }
    @keyframes iGlowBreath{
      0%,100%{opacity:0.7;transform:scale(0.95)}
      50%{opacity:1;transform:scale(1.08)}
    }

    /* ── Brand block ── */
    #iBrand{
      margin-top:${isMobile?'28px':'36px'};
      text-align:center;
      display:flex;flex-direction:column;
      align-items:center;gap:8px;
    }
    #iSanskrit{
      font-family:'Tiro Devanagari Sanskrit','Noto Serif Devanagari',serif;
      font-size:${isMobile?'12px':'14px'};
      color:rgba(255,153,51,0);
      letter-spacing:0.07em;
      opacity:0;
      transform:translateY(-10px);
      will-change:opacity,transform;
      text-shadow:0 0 20px rgba(255,153,51,0.5);
    }
    #iBrandName{
      display:flex;align-items:baseline;
      justify-content:center;
      gap:${isMobile?'1px':'2px'};
      overflow:visible;line-height:1;
    }
    .iBL{
      display:inline-block;
      font-family:'Rajdhani','Space Grotesk',sans-serif;
      font-size:${isMobile?'clamp(28px,8vw,40px)':'clamp(38px,6.5vw,58px)'};
      font-weight:700;
      letter-spacing:-0.02em;
      background:linear-gradient(155deg,#ffffff 0%,rgba(210,205,255,0.9) 55%,#b8b0ff 100%);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
      opacity:0;
      transform:translateY(50px) rotateX(-90deg) scale(0.75);
      transform-origin:50% 100%;
      will-change:transform,opacity;
    }
    .iCP{background:linear-gradient(155deg,#ffaacc,#FF6B9D,#f04a90);-webkit-background-clip:text;background-clip:text}
    .iCG{background:linear-gradient(155deg,#ffe97a,#FF9933,#e07200);-webkit-background-clip:text;background-clip:text}
    .iSp{display:inline-block;width:${isMobile?'9px':'14px'}}
    #iTagline{
      font-family:'Rajdhani',sans-serif;
      font-size:${isMobile?'9px':'10px'};
      font-weight:600;
      letter-spacing:0.18em;
      text-transform:uppercase;
      color:rgba(180,170,255,0.40);
      opacity:0;transform:translateY(8px);
      will-change:opacity,transform;
    }

    /* ── Stats ── */
    #iStats{
      display:flex;align-items:center;
      gap:${isMobile?'16px':'28px'};
      margin-top:${isMobile?'20px':'28px'};
      opacity:0;transform:translateY(14px);
      will-change:opacity,transform;
    }
    .iStat{display:flex;flex-direction:column;align-items:center;gap:2px}
    .iStatNum{
      font-family:'Rajdhani',sans-serif;
      font-size:${isMobile?'19px':'24px'};
      font-weight:700;
      background:linear-gradient(135deg,#7c6fff,#FF6B9D);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
    }
    .iStatSuf{
      font-family:'Rajdhani',sans-serif;
      font-size:${isMobile?'13px':'16px'};
      font-weight:700;color:#FF9933;
      -webkit-text-fill-color:#FF9933;margin-left:1px;
    }
    .iStatLbl{
      font-size:${isMobile?'8px':'9px'};
      letter-spacing:0.14em;text-transform:uppercase;
      color:rgba(180,170,255,0.35);
      font-family:'Rajdhani',sans-serif;margin-top:1px;
    }
    .iStatDiv{
      width:1px;height:28px;
      background:linear-gradient(180deg,transparent,rgba(108,99,255,0.25),transparent);
    }

    /* ── Progress ── */
    #iProg{
      margin-top:${isMobile?'24px':'32px'};
      width:${isMobile?'190px':'270px'};
      opacity:0;
      display:flex;flex-direction:column;align-items:center;gap:5px;
      will-change:opacity;
    }
    #iProgTrack{
      width:100%;height:2px;
      background:rgba(255,255,255,0.06);
      border-radius:2px;overflow:hidden;
    }
    #iProgBar{
      height:100%;width:0%;border-radius:2px;
      background:linear-gradient(90deg,#6C63FF,#FF6B9D,#FF9933);
      box-shadow:0 0 8px rgba(108,99,255,0.5);
    }
    #iProgPct{
      font-family:'Rajdhani',sans-serif;
      font-size:9px;font-weight:600;
      letter-spacing:0.12em;
      color:rgba(180,170,255,0.35);
    }

    /* ── Status line ── */
    #iStatus{
      margin-top:10px;
      display:flex;align-items:center;gap:8px;
      opacity:0;will-change:opacity;
    }
    #iDot{
      width:5px;height:5px;border-radius:50%;flex-shrink:0;
      background:#6C63FF;
      box-shadow:0 0 7px rgba(108,99,255,.8);
      animation:iDotPulse 1.1s ease-in-out infinite;
    }
    @keyframes iDotPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(0.5);opacity:0.3}}
    #iStatusTx{
      font-family:'Rajdhani',sans-serif;
      font-size:${isMobile?'9px':'10px'};font-weight:500;
      letter-spacing:0.16em;text-transform:uppercase;
      color:rgba(180,170,255,0.50);white-space:nowrap;
    }

    /* ── Made in India ── */
    #iMII{
      margin-top:14px;
      display:flex;align-items:center;gap:6px;
      font-family:'Rajdhani',sans-serif;
      font-size:${isMobile?'10px':'11px'};
      font-weight:700;letter-spacing:0.18em;text-transform:uppercase;
      background:linear-gradient(90deg,#FF9933 0%,#ffffff 50%,#138808 100%);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
      opacity:0;will-change:opacity;
    }

    /* ── Exit veil ── */
    #iVeil{
      position:absolute;inset:0;z-index:10;
      pointer-events:none;opacity:0;
      background:radial-gradient(circle at center,rgba(108,99,255,0.35) 0%,rgba(2,2,10,0.97) 65%,#020208 100%);
    }

    @media(max-width:480px){
      #iHudTop,#iHudBot{font-size:7px;letter-spacing:0.14em}
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

  /* ─── 4. LOAD LIBS ──────────────────────────────────────── */
  function loadScript(src, cb) {
    const s = document.createElement('script');
    s.src = src; s.onload = cb; s.onerror = cb;
    document.head.appendChild(s);
  }
  let _g = false, _t = false;
  function _check() { if (_g && _t) startIntro(); }
  loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js', () => { _g = true; _check(); });
  loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', () => { _t = true; _check(); });

  /* ─── 5. THREE.JS CRYSTAL ORB ───────────────────────────── */
  function initOrb() {
    const canvas = document.getElementById('iOrbCv');
    if (!canvas || typeof THREE === 'undefined') return null;
    canvas.width = canvas.height = ORB_SZ * DPR;
    canvas.style.width = ORB_SZ + 'px';
    canvas.style.height = ORB_SZ + 'px';

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(DPR);
    renderer.setSize(ORB_SZ, ORB_SZ);
    renderer.setClearColor(0, 0);

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    cam.position.z = 3.0;

    // Core crystal sphere
    const oGeo = new THREE.SphereGeometry(0.76, isLowEnd ? 20 : 60, isLowEnd ? 20 : 60);
    const oMat = new THREE.MeshPhongMaterial({
      color: 0x3d35c8,
      emissive: new THREE.Color(0x1e1880),
      emissiveIntensity: 0.65,
      shininess: 200,
      specular: new THREE.Color(0xc0b8ff),
    });
    const orb = new THREE.Mesh(oGeo, oMat);
    scene.add(orb);

    // Subtle geodesic wireframe overlay
    const wGeo = new THREE.IcosahedronGeometry(0.79, 2);
    scene.add(new THREE.Mesh(wGeo, new THREE.MeshBasicMaterial({
      color: 0xb0a8ff, wireframe: true, transparent: true, opacity: 0.10
    })));

    // Translucent glow shells (only 2, no tricolor spam)
    [[0.90, 0x7c70ff, 0.16], [1.12, 0xff6b9d, 0.05]].forEach(([r, c, o]) => {
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(r, 18, 18),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.BackSide })
      ));
    });

    // Lights
    scene.add(new THREE.AmbientLight(0x7266ff, 0.5));
    const p1 = new THREE.PointLight(0x9d94ff, 3.2, 8); p1.position.set(2, 2, 2); scene.add(p1);
    const p2 = new THREE.PointLight(0xFF9933, 1.6, 6); p2.position.set(-2, -1, 1); scene.add(p2);

    let alive = true, raf, t = 0;
    function animate() {
      if (!alive) return;
      raf = requestAnimationFrame(animate);
      t += 0.014;
      orb.scale.setScalar(1 + Math.sin(t * 1.1) * 0.018);
      orb.rotation.y += 0.007;
      orb.rotation.x += 0.002;
      p1.position.x = Math.cos(t * 0.35) * 2.2;
      p1.position.y = Math.sin(t * 0.28) * 1.8;
      renderer.render(scene, cam);
    }
    animate();
    return {
      dispose() {
        alive = false;
        cancelAnimationFrame(raf);
        renderer.dispose();
        oGeo.dispose();
        oMat.dispose();
      }
    };
  }

  /* ─── 6. PARTICLE BURST (exit) ──────────────────────────── */
  function fireParticleBurst(cb) {
    const c = document.createElement('canvas');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:8;pointer-events:none';
    overlay.appendChild(c);
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const ctx = c.getContext('2d');
    const cx = c.width / 2, cy = c.height / 2;
    const COLS = ['#7c6fff', '#a89cff', '#FF6B9D', '#ff9d9d', '#ffffff', '#ffd7e9'];
    const N = isLowEnd ? 30 : isMobile ? 60 : 110;
    const pts = Array.from({ length: N }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 10 + 4;
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
        r: Math.random() * 4 + 1.2,
        color: COLS[Math.floor(Math.random() * COLS.length)],
        life: 0, maxLife: Math.random() * 40 + 25
      };
    });

    function draw() {
      ctx.clearRect(0, 0, c.width, c.height);
      let any = false;
      pts.forEach(p => {
        if (p.life >= p.maxLife) return;
        any = true;
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.28; p.vx *= 0.97; p.vy *= 0.97;
        p.life++;
        const al = 1 - p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = al;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      if (any) requestAnimationFrame(draw);
      else { c.remove(); if (cb) cb(); }
    }
    requestAnimationFrame(draw);
  }

  /* ─── 7. COUNTER ANIMATION ──────────────────────────────── */
  function animateCounters() {
    document.querySelectorAll('.iStatNum').forEach(el => {
      const target = parseFloat(el.dataset.t);
      const dec = parseInt(el.dataset.d || '0');
      let cur = 0;
      const step = target / 45;
      const t = setInterval(() => {
        cur = Math.min(cur + step, target);
        el.textContent = cur.toFixed(dec);
        if (cur >= target) clearInterval(t);
      }, 28);
    });
  }

  /* ─── 8. MAIN TIMELINE ──────────────────────────────────── */
  function startIntro() {
    if (typeof gsap === 'undefined') { finishIntro(null); return; }

    const orbScene = initOrb();

    // Fade in ambient orbs
    gsap.to('#iAmbientOrb1', { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0);
    gsap.to('#iAmbientOrb2', { opacity: 1, duration: 1.4, ease: 'power2.out', delay: 0.2 });

    // Show HUD text
    setTimeout(() => {
      document.getElementById('iHudTop').style.opacity = '1';
      document.getElementById('iHudBot').style.opacity = '1';
    }, 400);

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
      pCur += (pTarget - pCur) * 0.07;
      if (progBar) progBar.style.width = pCur + '%';
      if (progPct) progPct.textContent = Math.round(pCur) + '%';
      requestAnimationFrame(tickProg);
    }
    tickProg();

    // GSAP initial states
    gsap.set(center, { opacity: 0 });
    gsap.set(orbAssm, { scale: 0, rotation: -15 });
    gsap.set(sanskrit, { opacity: 0, y: -12 });
    gsap.set(letters, { opacity: 0, y: 48, rotateX: -90, scale: 0.75 });
    gsap.set(tagline, { opacity: 0, y: 10 });
    gsap.set(stats, { opacity: 0, y: 16 });
    gsap.set(prog, { opacity: 0 });
    gsap.set(status, { opacity: 0 });
    gsap.set(corners, { opacity: 0 });
    gsap.set(mii, { opacity: 0, y: 6 });

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => fireParticleBurst(() => finishIntro(orbScene))
    });

    // Phase 0: Corners snap in
    tl.to(corners, { opacity: 1, duration: 0.3, stagger: 0.07 }, 0.1);

    // Phase 1: Center fades in
    tl.to(center, { opacity: 1, duration: 0.4 }, 0.3);

    // Phase 2: Orb erupts from zero — satisfying back.out spring
    tl.to(orbAssm, { scale: 1, rotation: 0, duration: 1.0, ease: 'back.out(2.5)' }, 0.45);

    // Phase 3: Sanskrit materializes
    tl.to(sanskrit, { opacity: 1, y: 0, duration: 0.85, ease: 'power2.out' }, 1.25);
    tl.to(sanskrit, { color: 'rgba(255,153,51,0.85)', duration: 0.45 }, 1.42);
    tl.to(sanskrit, { color: 'rgba(255,255,255,0.42)', duration: 0.7 }, 1.9);

    // Phase 4: Brand letters cascade up with 3D flip
    tl.to(letters, {
      opacity: 1, y: 0, rotateX: 0, scale: 1,
      duration: 0.65, ease: 'back.out(2.2)',
      stagger: { each: 0.05, from: 'start' }
    }, 1.52);

    // Phase 5: Tagline
    tl.to(tagline, { opacity: 1, y: 0, duration: 0.45 }, 2.18);
    tl.to(mii, { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out' }, 2.3);

    // Phase 6: Progress + status
    tl.to(prog, { opacity: 1, duration: 0.4 }, 2.28);
    tl.to(status, { opacity: 1, duration: 0.4 }, 2.42);

    // Phase 7: Status messages + progress
    const msgPlan = [
      { t: 2.48, p: 12 },
      { t: 2.95, p: 36 },
      { t: 3.38, p: 62 },
      { t: 3.72, p: 82 },
      { t: 4.05, p: 100 },
    ];
    msgPlan.forEach(({ t, p }, i) => {
      tl.add(() => {
        if (statusTx) statusTx.textContent = MSGS[i];
        pTarget = p;
        if (i === 1) {
          gsap.to(stats, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
          animateCounters();
        }
        if (i === 4) {
          // Ready: dot turns accent color
          if (dot) {
            dot.style.background = '#FF9933';
            dot.style.boxShadow = '0 0 10px rgba(255,153,51,.9)';
          }
          // Letter glow surge
          gsap.to(letters, { filter: 'brightness(1.5) saturate(1.6)', duration: 0.25, stagger: 0.022 });
          gsap.to(letters, { filter: 'brightness(1) saturate(1)', duration: 0.45, delay: 0.35, stagger: 0.022 });
        }
      }, t);
    });

    // Phase 8: DRAMATIC EXIT
    // Orb implodes first
    tl.to(orbAssm, { scale: 0.55, duration: 0.26, ease: 'power4.in' }, 4.52);

    // Text scatters up
    tl.to([tagline, stats, prog, status, mii], { opacity: 0, y: -18, duration: 0.3, stagger: 0.04 }, 4.48);
    tl.to(sanskrit, { opacity: 0, y: -18, duration: 0.28 }, 4.48);
    tl.to(letters, {
      opacity: 0, y: -40, rotateX: 85,
      duration: 0.38, stagger: { each: 0.03, from: 'end' }, ease: 'power3.in'
    }, 4.52);

    // HUD dissolves
    tl.to(corners, { opacity: 0, scale: 0.4, duration: 0.28, stagger: 0.04 }, 4.52);
    tl.to('#iHudTop,#iHudBot', { opacity: 0, duration: 0.25 }, 4.52);

    // Orb expands outward
    tl.to(orbAssm, { scale: 5, opacity: 0, duration: 0.55, ease: 'expo.out' }, 4.76);

    // Purple veil flash
    tl.to(veil, { opacity: 1, duration: 0.34, ease: 'power3.in' }, 4.65);
    tl.to(veil, { opacity: 0, duration: 0.55, ease: 'expo.out' }, 4.99);

    // Overlay fades
    tl.to(overlay, { opacity: 0, duration: 0.52, ease: 'power2.inOut' }, 4.80);
  }

  /* ─── 9. FINISH ─────────────────────────────────────────── */
  function finishIntro(orbScene) {
    clearInterval(clockInt);
    window.__introComplete = true;
    window.dispatchEvent(new CustomEvent('sscIntroComplete'));
    requestAnimationFrame(() => {
      if (orbScene) orbScene.dispose();
      overlay.remove();
      style.remove();
    });
  }

})();