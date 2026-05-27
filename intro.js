/**
 * SSC PrepAI — ULTRA CINEMATIC INTRO v4.0
 * India-Pride × Cosmic Intelligence
 * Tricolor energy · Ashoka Chakra motif · Sanskrit reveal
 * No external libs for core. GSAP + Three.js loaded async.
 */
(function () {
  'use strict';
  if (document.getElementById('sscIntroOverlay')) return;

  const isMobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 600;
  const DPR = Math.min(devicePixelRatio, isMobile ? 1.5 : 2);
  const ORB = isMobile ? 110 : 140;
  const WRAP = isMobile ? 200 : 260;

  /* ─── 1. BUILD ASHOKA CHAKRA SVG ─────────────────────────────── */
  function buildChakra() {
    let spokes = '';
    let dots = '';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x1 = (100 + 14 * Math.cos(a)).toFixed(1);
      const y1 = (100 + 14 * Math.sin(a)).toFixed(1);
      const x2 = (100 + 88 * Math.cos(a)).toFixed(1);
      const y2 = (100 + 88 * Math.sin(a)).toFixed(1);
      spokes += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#cg)" stroke-width="0.8" opacity="0.5"/>`;
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + Math.PI / 48;
      const cx = (100 + 68 * Math.cos(a)).toFixed(1);
      const cy = (100 + 68 * Math.sin(a)).toFixed(1);
      dots += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="url(#cg)" opacity="0.7"/>`;
    }
    return `<svg id="iChakra" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FF9933"/>
          <stop offset="50%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#138808"/>
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="90" fill="none" stroke="url(#cg)" stroke-width="1.5" opacity="0.6"/>
      <circle cx="100" cy="100" r="12" fill="none" stroke="url(#cg)" stroke-width="2" opacity="0.8"/>
      ${spokes}${dots}
    </svg>`;
  }

  /* ─── 2. INJECT DOM ──────────────────────────────────────────── */
  const overlay = document.createElement('div');
  overlay.id = 'sscIntroOverlay';
  overlay.innerHTML = `
    <canvas id="iBgCanvas"></canvas>
    <div id="iAurora">
      <div class="iABand iABs"></div>
      <div class="iABand iABw"></div>
      <div class="iABand iABg"></div>
    </div>
    <div id="iScanLine"></div>
    <canvas id="iGrainCv"></canvas>
    <div id="iHUD">
      <div class="iCorner iCTL"><span class="iCLH"></span><span class="iCLV"></span></div>
      <div class="iCorner iCTR"><span class="iCLH"></span><span class="iCLV"></span></div>
      <div class="iCorner iCBL"><span class="iCLH"></span><span class="iCLV"></span></div>
      <div class="iCorner iCBR"><span class="iCLH"></span><span class="iCLV"></span></div>
      <div id="iHUDT" class="iHUDL">SSC PREP AI &nbsp;·&nbsp; NEURAL CORE v4.0</div>
      <div id="iHUDB" class="iHUDL">INDIA &nbsp;·&nbsp; भारत &nbsp;·&nbsp; <span id="iClock"></span></div>
    </div>
    <div id="iCenter">
      <div id="iOrbAssm">
        ${buildChakra()}
        <div id="iOrbRings">
          <div class="iOR iOR1"></div>
          <div class="iOR iOR2"></div>
          <div class="iOR iOR3"></div>
          <div class="iOR iOR4"></div>
        </div>
        <canvas id="iOrbCv"></canvas>
        <div id="iFlare"></div>
      </div>
      <div id="iBrandBlk">
        <div id="iSkt">ज्ञानं परमं बलम्</div>
        <div id="iBrandNm" aria-label="SSC PrepAI">
          <span class="iBL">S</span><span class="iBL">S</span><span class="iBL">C</span>
          <span class="iBSp"></span>
          <span class="iBL iBPink">P</span><span class="iBL iBPink">r</span><span class="iBL iBPink">e</span><span class="iBL iBPink">p</span>
          <span class="iBSp"></span>
          <span class="iBL iBGold">A</span><span class="iBL iBGold">I</span>
        </div>
        <div id="iTag">INTELLIGENT EXAM ASSISTANT &nbsp;·&nbsp; भारत का AI टीचर</div>
      </div>
      <div id="iStats">
        <div class="iSt"><span class="iSN" data-t="50" data-s="K+">0</span><span class="iSS">K+</span><span class="iSL">Students</span></div>
        <div class="iSD"></div>
        <div class="iSt"><span class="iSN" data-t="1" data-s="M+">0</span><span class="iSS">M+</span><span class="iSL">Questions</span></div>
        <div class="iSD"></div>
        <div class="iSt"><span class="iSN" data-t="4.9" data-d="1" data-s="★">0</span><span class="iSS">★</span><span class="iSL">Rating</span></div>
      </div>
      <div id="iProg">
        <div id="iProgT"><div id="iProgF"></div><div id="iProgO"></div></div>
        <div id="iProgP">0%</div>
      </div>
      <div id="iStatusW"><div id="iDot"></div><div id="iStatusTx">Initializing Neural Core…</div></div>
    </div>
    <canvas id="iPartCv"></canvas>
    <div id="iVeil"></div>
  `;
  document.body.insertBefore(overlay, document.body.firstChild);

  /* ─── 3. INJECT CSS ──────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Tiro+Devanagari+Sanskrit&display=swap');
    #sscIntroOverlay{position:fixed;inset:0;z-index:99999;background:radial-gradient(ellipse 140% 120% at 50% 50%,#0e0525 0%,#02020a 65%);display:flex;align-items:center;justify-content:center;overflow:hidden;will-change:opacity;-webkit-backface-visibility:hidden;backface-visibility:hidden}
    @media(prefers-reduced-motion:reduce){#sscIntroOverlay{display:none!important}}
    #iBgCanvas{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity 1s ease}
    #iBgCanvas.vis{opacity:1}
    #iAurora{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity 1.5s ease}
    #iAurora.vis{opacity:1}
    .iABand{position:absolute;width:100%;filter:blur(90px);pointer-events:none}
    .iABs{top:0;height:40%;background:radial-gradient(ellipse 80% 100% at 50% 0%,rgba(255,153,51,0.14) 0%,transparent 70%)}
    .iABw{top:30%;height:40%;background:radial-gradient(ellipse 60% 100% at 50% 50%,rgba(255,255,255,0.04) 0%,transparent 70%)}
    .iABg{bottom:0;height:40%;background:radial-gradient(ellipse 80% 100% at 50% 100%,rgba(19,136,8,0.11) 0%,transparent 70%)}
    #iScanLine{position:absolute;left:0;right:0;top:-2px;height:2px;background:linear-gradient(90deg,transparent,rgba(108,99,255,0.7),rgba(255,153,51,0.5),rgba(108,99,255,0.7),transparent);box-shadow:0 0 22px rgba(108,99,255,0.5);animation:iScan 3s linear infinite;opacity:0}
    @keyframes iScan{0%{top:-2px}100%{top:100vh}}
    #iGrainCv{position:absolute;inset:0;width:100%;height:100%;opacity:0.022;pointer-events:none;mix-blend-mode:overlay}
    #iHUD{position:absolute;inset:0;pointer-events:none}
    .iCorner{position:absolute;width:30px;height:30px;opacity:0}
    .iCTL{top:20px;left:20px}.iCTR{top:20px;right:20px}.iCBL{bottom:20px;left:20px}.iCBR{bottom:20px;right:20px}
    .iCLH,.iCLV{position:absolute;background:#FF9933;opacity:0.65}
    .iCLH{height:1.5px;width:100%;top:0;left:0}.iCLV{width:1.5px;height:100%;top:0;left:0}
    .iCTR .iCLH,.iCBR .iCLH{left:auto;right:0}.iCTR .iCLV,.iCBR .iCLV{left:auto;right:0}
    .iCBL .iCLH,.iCBR .iCLH{top:auto;bottom:0}.iCBL .iCLV,.iCBR .iCLV{top:auto;bottom:0}
    .iHUDL{position:absolute;font-family:'Rajdhani',sans-serif;font-size:9px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,153,51,0.4);white-space:nowrap;opacity:0;transition:opacity .6s}
    #iHUDT{top:13px;left:50%;transform:translateX(-50%)}
    #iHUDB{bottom:13px;left:50%;transform:translateX(-50%)}
    #iCenter{position:relative;z-index:5;display:flex;flex-direction:column;align-items:center;gap:0;opacity:0}
    #iOrbAssm{position:relative;width:${WRAP}px;height:${WRAP}px;display:flex;align-items:center;justify-content:center;transform:scale(0) rotate(-25deg);will-change:transform}
    #iChakra{position:absolute;width:${WRAP}px;height:${WRAP}px;top:50%;left:50%;transform:translate(-50%,-50%) rotate(0deg);animation:iChakraSpin 12s linear infinite;opacity:0}
    @keyframes iChakraSpin{from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(360deg)}}
    #iOrbRings{position:absolute;inset:0;pointer-events:none}
    .iOR{position:absolute;top:50%;left:50%;border-radius:50%;border:1px solid;transform:translate(-50%,-50%)}
    .iOR1{width:${ORB+20}px;height:${ORB+20}px;border-color:rgba(108,99,255,0.55);box-shadow:0 0 20px rgba(108,99,255,0.22),inset 0 0 20px rgba(108,99,255,0.08);animation:iRingP 2.8s ease-in-out infinite}
    .iOR2{width:${ORB+52}px;height:${ORB+52}px;border-color:rgba(255,107,157,0.28);border-style:dashed;animation:iRingSp 18s linear reverse infinite}
    .iOR3{width:${ORB+88}px;height:${ORB+88}px;border-color:rgba(255,153,51,0.20);border-style:dashed;animation:iRingSp 26s linear infinite}
    .iOR4{width:${ORB+126}px;height:${ORB+126}px;border-color:rgba(19,136,8,0.14);animation:iRingP 3.6s ease-in-out 0.7s infinite}
    @keyframes iRingP{0%,100%{opacity:0.45;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.045)}}
    @keyframes iRingSp{from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(360deg)}}
    #iOrbCv{position:relative;z-index:3;border-radius:50%;display:block;width:${ORB}px;height:${ORB}px}
    #iFlare{position:absolute;z-index:2;width:${ORB+70}px;height:${ORB+70}px;border-radius:50%;background:radial-gradient(circle,rgba(108,99,255,0.38) 0%,rgba(255,153,51,0.12) 40%,transparent 70%);filter:blur(14px);animation:iFP 2.2s ease-in-out infinite}
    @keyframes iFP{0%,100%{transform:scale(0.94);opacity:0.65}50%{transform:scale(1.1);opacity:1}}
    #iBrandBlk{margin-top:${isMobile?30:38}px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px}
    #iSkt{font-family:'Tiro Devanagari Sanskrit','Noto Serif Devanagari',serif;font-size:${isMobile?'13px':'15px'};color:rgba(255,153,51,0);letter-spacing:0.06em;opacity:0;transform:translateY(-14px);will-change:opacity,transform;text-shadow:0 0 24px rgba(255,153,51,0.6)}
    #iBrandNm{display:flex;align-items:baseline;justify-content:center;gap:${isMobile?'1px':'2px'};overflow:visible;line-height:1}
    .iBL{display:inline-block;font-family:'Rajdhani','Space Grotesk',sans-serif;font-size:${isMobile?'clamp(30px,8vw,42px)':'clamp(40px,7vw,60px)'};font-weight:700;letter-spacing:-0.02em;background:linear-gradient(160deg,#ffffff 0%,rgba(200,190,255,.9) 50%,#c0b8ff 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;opacity:0;transform:translateY(55px) rotateX(-95deg) scale(0.75);transform-origin:50% 100%;will-change:transform,opacity}
    .iBPink{background:linear-gradient(160deg,#ff9d9d,#FF6B9D,#ff4a8c);-webkit-background-clip:text;background-clip:text}
    .iBGold{background:linear-gradient(160deg,#ffe566,#FF9933,#ff7700);-webkit-background-clip:text;background-clip:text}
    .iBSp{display:inline-block;width:${isMobile?'10px':'16px'}}
    #iTag{font-family:'Rajdhani',sans-serif;font-size:${isMobile?'9px':'10px'};font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:rgba(180,170,255,0.42);opacity:0;transform:translateY(10px);will-change:opacity,transform}
    #iStats{display:flex;align-items:center;gap:${isMobile?'18px':'30px'};margin-top:${isMobile?'18px':'26px'};opacity:0;transform:translateY(16px);will-change:opacity,transform}
    .iSt{display:flex;flex-direction:column;align-items:center;gap:2px}
    .iSN{font-family:'Rajdhani',sans-serif;font-size:${isMobile?'20px':'26px'};font-weight:700;background:linear-gradient(135deg,#6C63FF,#FF6B9D);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
    .iSS{font-family:'Rajdhani',sans-serif;font-size:${isMobile?'15px':'18px'};font-weight:700;color:#FF9933;-webkit-text-fill-color:#FF9933;margin-left:1px}
    .iSL{font-size:${isMobile?'9px':'10px'};letter-spacing:0.14em;text-transform:uppercase;color:rgba(180,170,255,0.38);font-family:'Rajdhani',sans-serif;margin-top:1px}
    .iSD{width:1px;height:30px;background:linear-gradient(180deg,transparent,rgba(255,153,51,0.28),transparent)}
    #iProg{margin-top:${isMobile?'24px':'32px'};width:${isMobile?'200px':'290px'};opacity:0;will-change:opacity;display:flex;flex-direction:column;align-items:center;gap:6px}
    #iProgT{width:100%;height:3px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:visible;position:relative}
    #iProgF{height:100%;width:0%;border-radius:3px;background:linear-gradient(90deg,#FF9933,#6C63FF,#138808);box-shadow:0 0 10px rgba(108,99,255,0.5);transition:none}
    #iProgO{position:absolute;top:50%;right:-5px;transform:translateY(-50%) scale(0);width:11px;height:11px;border-radius:50%;background:radial-gradient(circle,#fff 0%,#FF9933 60%);box-shadow:0 0 12px #FF9933,0 0 24px rgba(255,153,51,0.5);will-change:transform}
    #iProgP{font-family:'Rajdhani',sans-serif;font-size:10px;font-weight:600;letter-spacing:0.12em;color:rgba(180,170,255,0.38)}
    #iStatusW{margin-top:12px;display:flex;align-items:center;gap:8px;opacity:0;will-change:opacity}
    #iDot{width:6px;height:6px;border-radius:50%;flex-shrink:0;background:#6C63FF;box-shadow:0 0 8px rgba(108,99,255,.9),0 0 16px rgba(108,99,255,.4);animation:iDP 1s ease-in-out infinite}
    @keyframes iDP{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(0.6);opacity:0.3}}
    #iStatusTx{font-family:'Rajdhani',sans-serif;font-size:${isMobile?'10px':'11px'};font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:rgba(180,170,255,0.52);white-space:nowrap}
    #iPartCv{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6;opacity:0}
    #iVeil{position:absolute;inset:0;z-index:10;pointer-events:none;opacity:0;background:radial-gradient(circle at center,rgba(255,153,51,0.22) 0%,rgba(108,99,255,0.42) 30%,rgba(2,2,10,0.97) 70%,#02020a 100%)}
    @media(max-width:480px){.iHUDL{font-size:8px;letter-spacing:0.13em}.iCorner{width:22px;height:22px}}
  `;
  document.head.appendChild(style);

  /* ─── 4. HUD CLOCK ───────────────────────────────────────────── */
  function tickClock() {
    const el = document.getElementById('iClock');
    if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }
  tickClock();
  const clockInt = setInterval(tickClock, 1000);

  /* ─── 5. GRAIN ───────────────────────────────────────────────── */
  (function grain() {
    const c = document.getElementById('iGrainCv');
    if (!c) return;
    const W = 256, H = 256; c.width = W; c.height = H;
    const ctx = c.getContext('2d'), img = ctx.createImageData(W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255 | 0;
      img.data[i] = img.data[i+1] = img.data[i+2] = v; img.data[i+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  })();

  /* ─── 6. LOAD LIBS ───────────────────────────────────────────── */
  function loadScript(src, cb) {
    const s = document.createElement('script');
    s.src = src; s.onload = cb; s.onerror = cb; document.head.appendChild(s);
  }
  let _g = false, _t = false;
  function _check() { if (_g && _t) startIntro(); }
  loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js', () => { _g = true; _check(); });
  loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', () => { _t = true; _check(); });

  /* ─── 7. THREE.JS BACKGROUND ────────────────────────────────── */
  function initBg() {
    const canvas = document.getElementById('iBgCanvas');
    if (!canvas || typeof THREE === 'undefined') return null;
    const W = window.innerWidth, H = window.innerHeight;
    const CNT = isMobile ? 80 : 220;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(DPR, 1.5));
    renderer.setSize(W, H); renderer.setClearColor(0, 0);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(70, W/H, 0.1, 1000);
    cam.position.z = 6;

    const triColors = [0x6c63ff, 0xFF9933, 0x138808, 0xff6b9d, 0xffffff];
    const pos = new Float32Array(CNT * 3), col = new Float32Array(CNT * 3), vel = [];
    for (let i = 0; i < CNT; i++) {
      pos[i*3]=(Math.random()-.5)*20; pos[i*3+1]=(Math.random()-.5)*14; pos[i*3+2]=(Math.random()-.5)*10;
      vel.push({x:(Math.random()-.5)*.007,y:(Math.random()-.5)*.005});
      const c = new THREE.Color(triColors[i%triColors.length]);
      col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    geo.setAttribute('color', new THREE.BufferAttribute(col,3));
    const mat = new THREE.PointsMaterial({ size:isMobile?.075:.055, transparent:true, opacity:.45, vertexColors:true, sizeAttenuation:true });
    const pts = new THREE.Points(geo, mat); scene.add(pts);

    const LINES = isMobile ? 45 : 110;
    const lGeo = new THREE.BufferGeometry();
    const lPos = new Float32Array(LINES*6);
    for (let i=0;i<LINES;i++){const a=Math.floor(Math.random()*CNT),b=Math.floor(Math.random()*CNT);lPos.set([pos[a*3],pos[a*3+1],pos[a*3+2],pos[b*3],pos[b*3+1],pos[b*3+2]],i*6);}
    lGeo.setAttribute('position', new THREE.BufferAttribute(lPos,3));
    scene.add(new THREE.LineSegments(lGeo, new THREE.LineBasicMaterial({color:0x6c63ff,transparent:true,opacity:.07})));

    const icoGeo = new THREE.IcosahedronGeometry(0.08, 0);
    const NODE = isMobile ? 10 : 26;
    const nodes = [];
    for (let i=0;i<NODE;i++){
      const m=new THREE.Mesh(icoGeo,new THREE.MeshBasicMaterial({color:triColors[i%3],wireframe:true,transparent:true,opacity:.32}));
      m.position.set((Math.random()-.5)*18,(Math.random()-.5)*12,(Math.random()-.5)*8);
      m.userData={sp:Math.random()*.014+.007,ph:Math.random()*Math.PI*2};
      scene.add(m); nodes.push(m);
    }

    let alive=true, raf, t=0;
    function animate(){
      if(!alive)return; raf=requestAnimationFrame(animate); t+=.01;
      const p=geo.attributes.position.array;
      for(let i=0;i<CNT;i++){
        p[i*3]+=vel[i].x; p[i*3+1]+=vel[i].y;
        if(p[i*3]>10)p[i*3]=-10; if(p[i*3]<-10)p[i*3]=10;
        if(p[i*3+1]>7)p[i*3+1]=-7; if(p[i*3+1]<-7)p[i*3+1]=7;
      }
      geo.attributes.position.needsUpdate=true;
      pts.rotation.y+=.0004;
      nodes.forEach(n=>{n.rotation.x+=n.userData.sp;n.rotation.y+=n.userData.sp*.6;n.position.y+=Math.sin(t+n.userData.ph)*.001;});
      renderer.render(scene, cam);
    }
    animate(); canvas.classList.add('vis');
    return { dispose(){alive=false;cancelAnimationFrame(raf);renderer.dispose();} };
  }

  /* ─── 8. THREE.JS ORB ────────────────────────────────────────── */
  function initOrb() {
    const canvas = document.getElementById('iOrbCv');
    if (!canvas || typeof THREE === 'undefined') return null;
    const SZ = ORB;
    canvas.width = canvas.height = SZ * DPR;
    canvas.style.width = SZ + 'px'; canvas.style.height = SZ + 'px';
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(DPR); renderer.setSize(SZ, SZ); renderer.setClearColor(0, 0);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    cam.position.z = 3.2;

    // Core orb
    const oGeo = new THREE.SphereGeometry(0.78, 64, 64);
    const oMat = new THREE.MeshPhongMaterial({ color:0x4d42dd, emissive:new THREE.Color(0x2d24aa), emissiveIntensity:0.72, shininess:160, specular:new THREE.Color(0xaaa5ff) });
    const orb = new THREE.Mesh(oGeo, oMat); scene.add(orb);

    // Geodesic wireframe
    const wGeo = new THREE.IcosahedronGeometry(0.81, 3);
    scene.add(new THREE.Mesh(wGeo, new THREE.MeshBasicMaterial({ color:0xb8b0ff, wireframe:true, transparent:true, opacity:.13 })));

    // Glow shells — tricolor
    [[0.93,0x8b7fff,.20],[1.08,0xFF9933,.07],[1.25,0x138808,.05],[1.44,0x6c63ff,.03]].forEach(([r,c,o])=>{
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(r,24,24),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o,side:THREE.BackSide})));
    });

    // Energy torus rings
    const ringDefs=[[0.97,.022,0x6c63ff,.70,0,Math.PI/4],[0.97,.015,0xFF9933,.62,Math.PI/3,Math.PI/6],[0.97,.011,0x138808,.52,Math.PI/6,-Math.PI/3]];
    const rings=ringDefs.map(([r,t,c,o,rx,rz])=>{
      const rg=new THREE.TorusGeometry(r,t,6,100);
      const rm=new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o});
      const m=new THREE.Mesh(rg,rm); m.rotation.x=rx; m.rotation.z=rz; scene.add(m); return m;
    });

    // Lights
    scene.add(new THREE.AmbientLight(0x6c63ff,.6));
    const p1=new THREE.PointLight(0x9d94ff,3.5,8); p1.position.set(2,2,2); scene.add(p1);
    const p2=new THREE.PointLight(0xFF9933,2.2,6); p2.position.set(-2,-1,1); scene.add(p2);
    const p3=new THREE.PointLight(0x138808,1.6,5); p3.position.set(0,2,-2); scene.add(p3);

    // Orbiting tricolor tetrahedra
    const tetGeo=new THREE.TetrahedronGeometry(0.08,0);
    const orbiters=[0xFF9933,0xffffff,0x138808].map(c=>{
      const m=new THREE.Mesh(tetGeo,new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.9}));
      scene.add(m); return m;
    });

    let alive=true, raf, t=0;
    function animate(){
      if(!alive)return; raf=requestAnimationFrame(animate); t+=.016;
      orb.scale.setScalar(1+Math.sin(t*1.2)*.022);
      orb.rotation.y+=.009; orb.rotation.x+=.003;
      rings[0].rotation.z+=.016; rings[0].rotation.y+=.008;
      rings[1].rotation.z-=.011; rings[1].rotation.x+=.006;
      rings[2].rotation.y+=.013; rings[2].rotation.z+=.005;
      orbiters.forEach((o,i)=>{
        const ph=t+i*(Math.PI*2/3);
        o.position.set(Math.cos(ph)*1.12,Math.sin(ph*.7)*.5,Math.sin(ph)*.65);
        o.rotation.x+=.025; o.rotation.y+=.018;
      });
      p1.position.x=Math.cos(t*.4)*2.5; p1.position.y=Math.sin(t*.3)*2;
      p2.position.x=Math.cos(t*.3+Math.PI)*2; p2.position.y=Math.sin(t*.5)*1.5;
      renderer.render(scene, cam);
    }
    animate();
    return { dispose(){alive=false;cancelAnimationFrame(raf);renderer.dispose();oGeo.dispose();oMat.dispose();} };
  }

  /* ─── 9. PARTICLE BURST ──────────────────────────────────────── */
  function fireParticleBurst(cb) {
    const c = document.getElementById('iPartCv');
    if (!c) { if(cb)cb(); return; }
    c.width = window.innerWidth; c.height = window.innerHeight;
    const ctx = c.getContext('2d');
    const cx = c.width/2, cy = c.height/2;
    const COLS = ['#FF9933','#6C63FF','#FF6B9D','#138808','#ffffff','#ffe566','#ff6b6b'];
    const BURST = isMobile ? 70 : 150;
    const pts = Array.from({length:BURST},()=>{
      const angle = Math.random()*Math.PI*2;
      const speed = Math.random()*14+5;
      return { x:cx, y:cy, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed-2.5,
               r:Math.random()*5+1.5, color:COLS[Math.floor(Math.random()*COLS.length)],
               life:0, maxLife:Math.random()*45+30, shape:Math.random()>.5?'c':'d' };
    });
    c.style.opacity = '1';
    function draw(){
      ctx.clearRect(0,0,c.width,c.height);
      let any=false;
      pts.forEach(p=>{
        if(p.life>=p.maxLife)return; any=true;
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.32; p.vx*=0.97; p.vy*=0.97; p.life++;
        const al=1-p.life/p.maxLife;
        ctx.save(); ctx.globalAlpha=al; ctx.fillStyle=p.color;
        ctx.shadowBlur=9; ctx.shadowColor=p.color;
        ctx.beginPath();
        if(p.shape==='c'){ctx.arc(p.x,p.y,p.r,0,Math.PI*2);}
        else{ctx.moveTo(p.x,p.y-p.r*1.6);ctx.lineTo(p.x+p.r,p.y);ctx.lineTo(p.x,p.y+p.r*1.6);ctx.lineTo(p.x-p.r,p.y);ctx.closePath();}
        ctx.fill(); ctx.restore();
      });
      if(any)requestAnimationFrame(draw);
      else{c.style.opacity='0';if(cb)cb();}
    }
    requestAnimationFrame(draw);
  }

  /* ─── 10. COUNTERS ───────────────────────────────────────────── */
  function animateCounters() {
    document.querySelectorAll('.iSN').forEach(el=>{
      const target=parseFloat(el.dataset.t), dec=parseInt(el.dataset.d||'0');
      let cur=0; const step=target/45;
      const t=setInterval(()=>{cur=Math.min(cur+step,target);el.textContent=cur.toFixed(dec);if(cur>=target)clearInterval(t);},28);
    });
  }

  /* ─── 11. MAIN TIMELINE ──────────────────────────────────────── */
  function startIntro() {
    if (typeof gsap === 'undefined') { finishIntro(null, null); return; }

    const bgScene  = initBg();
    const orbScene = initOrb();

    // Enable atmosphere
    document.getElementById('iAurora').classList.add('vis');
    document.getElementById('iScanLine').style.opacity = '1';
    document.getElementById('iHUDT').style.opacity = '1';
    document.getElementById('iHUDB').style.opacity = '1';

    const center   = document.getElementById('iCenter');
    const orbAssm  = document.getElementById('iOrbAssm');
    const chakra   = document.getElementById('iChakra');
    const skt      = document.getElementById('iSkt');
    const letters  = document.querySelectorAll('.iBL');
    const tag      = document.getElementById('iTag');
    const stats    = document.getElementById('iStats');
    const prog     = document.getElementById('iProg');
    const progF    = document.getElementById('iProgF');
    const progO    = document.getElementById('iProgO');
    const progP    = document.getElementById('iProgP');
    const statusW  = document.getElementById('iStatusW');
    const statusTx = document.getElementById('iStatusTx');
    const dot      = document.getElementById('iDot');
    const corners  = document.querySelectorAll('.iCorner');
    const veil     = document.getElementById('iVeil');

    const MSGS = [
      'Initializing Neural Core…',
      'Loading SSC Knowledge Base…',
      'Calibrating Vision AI · दृष्टि AI…',
      'Activating Exam Intelligence…',
      '⚡ प्रणाली तैयार है · System Ready',
    ];

    // Progress ticker
    let pT=0, pC=0;
    function tickProg(){
      pC+=(pT-pC)*.065;
      progF.style.width=pC+'%';
      progP.textContent=Math.round(pC)+'%';
      progO.style.transform=`translateY(-50%) scale(${pC>5?1:0})`;
      requestAnimationFrame(tickProg);
    }
    tickProg();

    // Set initial states
    gsap.set(center,  {opacity:0});
    gsap.set(orbAssm, {scale:0, rotation:-25});
    gsap.set(chakra,  {opacity:0, rotation:-60});
    gsap.set(skt,     {opacity:0, y:-16});
    gsap.set(letters, {opacity:0, y:58, rotateX:-95, scale:0.7});
    gsap.set(tag,     {opacity:0, y:12});
    gsap.set(stats,   {opacity:0, y:18});
    gsap.set(prog,    {opacity:0, y:12});
    gsap.set(statusW, {opacity:0});
    gsap.set(corners, {opacity:0});

    const tl = gsap.timeline({
      defaults: { ease:'power3.out' },
      onComplete: () => fireParticleBurst(() => finishIntro(bgScene, orbScene))
    });

    // Phase 0: HUD corners
    tl.to(corners, {opacity:1, duration:.35, stagger:.08}, 0.1);

    // Phase 1: Center appears
    tl.to(center, {opacity:1, duration:.4}, 0.3);

    // Phase 2: Chakra unfolds + Orb erupts
    tl.to(chakra,  {opacity:1, rotation:0, duration:1.15, ease:'back.out(1.6)'}, 0.4);
    tl.to(orbAssm, {scale:1,  rotation:0, duration:1.05, ease:'back.out(2.8)'}, 0.52);

    // Phase 3: Sanskrit fades in with golden glow
    tl.to(skt, {opacity:1, y:0, duration:.9, ease:'power2.out'}, 1.35);
    tl.to(skt, {color:'rgba(255,153,51,0.88)', duration:.5}, 1.55);
    tl.to(skt, {color:'rgba(255,255,255,0.48)', duration:.8}, 2.05);

    // Phase 4: Brand letters cascade UP with 3D flip
    tl.to(letters, {
      opacity:1, y:0, rotateX:0, scale:1,
      duration:.68, ease:'back.out(2.4)',
      stagger:{each:.052, from:'start'}
    }, 1.6);

    // Phase 5: Tagline
    tl.to(tag, {opacity:1, y:0, duration:.5}, 2.25);

    // Phase 6: Progress + status
    tl.to(prog,    {opacity:1, y:0, duration:.45}, 2.35);
    tl.to(statusW, {opacity:1, duration:.4}, 2.5);

    // Phase 7: Status messages cycle
    const msgT=[{t:2.55,p:12},{t:3.05,p:35},{t:3.5,p:58},{t:3.9,p:80},{t:4.25,p:100}];
    msgT.forEach(({t,p},i)=>{
      tl.add(()=>{
        statusTx.textContent = MSGS[i];
        pT = p;
        if(i===1){
          gsap.to(stats,{opacity:1,y:0,duration:.65,ease:'power2.out'});
          animateCounters();
        }
        if(i===4){
          // System ready: saffron dot
          dot.style.background='#FF9933';
          dot.style.boxShadow='0 0 10px rgba(255,153,51,.9),0 0 22px rgba(255,153,51,.4)';
          // Letter glow surge
          gsap.to(letters,{filter:'brightness(1.6) saturate(1.8)',duration:.28,stagger:.025});
          gsap.to(letters,{filter:'brightness(1) saturate(1)',duration:.5,delay:.38,stagger:.025});
          // Chakra accelerates
          chakra.style.animationDuration='2.5s';
        }
      }, t);
    });

    // Phase 8: DRAMATIC EXIT
    // Chakra spin to max speed
    tl.add(()=>{ chakra.style.animationDuration='1s'; }, 4.65);

    // Orb implodes
    tl.to(orbAssm, {scale:.6, duration:.28, ease:'power4.in'}, 4.65);

    // Text scatters upward
    tl.to([tag,stats,prog,statusW], {opacity:0,y:-20,duration:.32,stagger:.04}, 4.6);
    tl.to(skt, {opacity:0,y:-22,duration:.3}, 4.6);
    tl.to(letters, {opacity:0,y:-45,rotateX:90,duration:.42,stagger:{each:.035,from:'end'},ease:'power3.in'}, 4.65);

    // HUD dissolves
    tl.to(corners, {opacity:0,scale:.3,duration:.3,stagger:.05}, 4.65);

    // Orb explodes outward — India Moment
    tl.to(orbAssm, {scale:4.5, opacity:0, duration:.6, ease:'expo.out'}, 4.93);

    // Tricolor veil flash
    tl.to(veil, {opacity:1, duration:.38, ease:'power3.in'}, 4.8);
    tl.to(veil, {opacity:0, duration:.6,  ease:'expo.out'}, 5.18);

    // Full overlay fades
    tl.to(overlay, {opacity:0, duration:.58, ease:'power2.inOut'}, 4.95);
  }

  /* ─── 12. FINISH ─────────────────────────────────────────────── */
  function finishIntro(bg, orb) {
    clearInterval(clockInt);
    window.__introComplete = true;
    window.dispatchEvent(new CustomEvent('sscIntroComplete'));
    requestAnimationFrame(()=>{
      if(bg)bg.dispose();
      if(orb)orb.dispose();
      overlay.remove();
      style.remove();
    });
  }

})();