/**
 * intro.js — CrackAI App Intro v7.0  "Native App Start"
 * ───────────────────────────────────────────────────────
 * Design philosophy:
 *   · Feels like opening a premium mobile app (like Notion, Linear, Duolingo)
 *   · No plasma orbs, no star fields, no HUD corners — just confidence
 *   · One beautiful logo mark, clean wordmark, single status line
 *   · Dark background, crisp typography, a single subtle pulse
 *   · Total duration: ~2.4s on fast devices, then gone
 *
 * Drop-in replacement — same self-executing pattern, same overlay ID.
 */

(function () {
  'use strict';

  // Only one instance
  if (document.getElementById('sscIntroOverlay')) return;

  /* ── Skip for reduced-motion users ─────────────────────────── */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ── Device flags ───────────────────────────────────────────── */
  const isMobile = window.innerWidth < 600;

  /* ─────────────────────────────────────────────────────────────
     1. BUILD DOM
  ───────────────────────────────────────────────────────────── */
  const overlay = document.createElement('div');
  overlay.id = 'sscIntroOverlay';

  overlay.innerHTML = `
    <div id="ci-center">
      <!-- Logo mark -->
      <div id="ci-logo">
        <svg id="ci-logomark" width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Outer rounded square bg -->
          <rect width="52" height="52" rx="14" fill="url(#ci-grad-bg)"/>
          <!-- Spark / bolt icon -->
          <path d="M28.5 8L17 27h12l-5.5 17L35 24H23.5L28.5 8z"
                fill="white" fill-opacity="0.95" stroke="none"/>
          <defs>
            <linearGradient id="ci-grad-bg" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stop-color="#6C63FF"/>
              <stop offset="100%" stop-color="#8B5CF6"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      <!-- Wordmark -->
      <div id="ci-wordmark">
        <span id="ci-word-crack">Crack</span><span id="ci-word-ai">AI</span>
      </div>

      <!-- Tagline -->
      <div id="ci-tagline">Your AI Exam Partner</div>

      <!-- Status line -->
      <div id="ci-status">
        <span id="ci-dot"></span>
        <span id="ci-status-text">Starting up…</span>
      </div>
    </div>
  `;

  document.body.insertBefore(overlay, document.body.firstChild);

  /* ─────────────────────────────────────────────────────────────
     2. INJECT CSS
  ───────────────────────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    /* ── Fonts ── */
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;700;800&display=swap');

    /* ── Overlay ── */
    #sscIntroOverlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: #07070f;
      display: flex;
      align-items: center;
      justify-content: center;
      will-change: opacity;
    }

    /* ── Center block ── */
    #ci-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity .5s ease, transform .5s ease;
    }
    #ci-center.ci-visible {
      opacity: 1;
      transform: none;
    }

    /* ── Logo mark ── */
    #ci-logo {
      margin-bottom: 20px;
    }
    #ci-logomark {
      display: block;
      /* subtle continuous pulse */
      animation: ci-pulse 2.4s ease-in-out infinite;
    }
    @keyframes ci-pulse {
      0%, 100% { opacity: 1;   transform: scale(1); }
      50%       { opacity: .88; transform: scale(.97); }
    }

    /* ── Wordmark ── */
    #ci-wordmark {
      font-family: 'Sora', 'Space Grotesk', system-ui, sans-serif;
      font-size: ${isMobile ? '26px' : '30px'};
      font-weight: 800;
      letter-spacing: -.02em;
      line-height: 1;
      margin-bottom: 8px;
    }
    #ci-word-crack { color: #ffffff; }
    #ci-word-ai    {
      background: linear-gradient(135deg, #7C72FF, #FF6B9D);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* ── Tagline ── */
    #ci-tagline {
      font-family: 'Sora', system-ui, sans-serif;
      font-size: ${isMobile ? '12px' : '13px'};
      font-weight: 400;
      color: rgba(200, 195, 255, 0.45);
      letter-spacing: .04em;
      margin-bottom: 32px;
    }

    /* ── Status ── */
    #ci-status {
      display: flex;
      align-items: center;
      gap: 7px;
      font-family: 'Sora', system-ui, sans-serif;
      font-size: 11px;
      color: rgba(200, 195, 255, 0.38);
      letter-spacing: .06em;
      text-transform: uppercase;
      min-height: 16px;
    }
    #ci-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #6C63FF;
      flex-shrink: 0;
      animation: ci-dot-blink .9s ease-in-out infinite;
    }
    @keyframes ci-dot-blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: .25; }
    }

    /* ── Exit fade ── */
    #sscIntroOverlay.ci-exit {
      opacity: 0;
      pointer-events: none;
      transition: opacity .35s ease;
    }
  `;
  document.head.appendChild(style);

  /* ─────────────────────────────────────────────────────────────
     3. SEQUENCE
  ───────────────────────────────────────────────────────────── */
  const center     = document.getElementById('ci-center');
  const statusText = document.getElementById('ci-status-text');
  const dot        = document.getElementById('ci-dot');

  const STATUSES = [
    { text: 'Loading AI engine…',    dot: '#6C63FF', delay: 0 },
    { text: 'Preparing your session…', dot: '#6C63FF', delay: 1200 },
    { text: 'Ready',                 dot: '#10b981', delay: 2400 },
  ];

  // Frame 1 — appear
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      center.classList.add('ci-visible');
    });
  });

  // Status cycling
  STATUSES.forEach(({ text, dot: dotColor, delay }) => {
    setTimeout(() => {
      if (statusText) statusText.textContent = text;
      if (dot) dot.style.background = dotColor;
    }, delay + 350); // 350ms after appear
  });

  // Exit — after 4s total
  const EXIT_DELAY = 4000;

  function doExit() {
    // Stop dot blink on exit
    if (dot) dot.style.animation = 'none';

    overlay.classList.add('ci-exit');

    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.remove();
    }, 380); // matches transition duration
  }

  // Bail-out: exit early if page already loaded
  let exited = false;
  function exit() {
    if (exited) return;
    exited = true;
    doExit();
  }

  const exitTimer = setTimeout(exit, EXIT_DELAY);

  // If page loaded before timer fires, exit promptly (min 3500ms)
  const minDelay = 3500;
  const startTs  = Date.now();

  window.addEventListener('load', () => {
    const elapsed = Date.now() - startTs;
    const wait    = Math.max(0, minDelay - elapsed);
    setTimeout(() => {
      clearTimeout(exitTimer);
      exit();
    }, wait);
  }, { once: true });

})();
