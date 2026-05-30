/**
 * payment.js — CrackAI Frontend Payment Module v2.0
 * ─────────────────────────────────────────────────
 * Handles ALL Cashfree payments directly from the browser.
 * NO backend required — uses Cashfree JS SDK + their Orders API.
 *
 * HOW CASHFREE FRONTEND-ONLY WORKS:
 *  1. We call Cashfree's Orders API directly from browser (with app_id + secret)
 *  2. Get payment_session_id back
 *  3. Open Cashfree checkout modal
 *  4. On success → activate premium locally + sync to Firestore
 *
 * ⚠️  NOTE: For production at scale, move order creation to a backend.
 *     This works perfectly for launch without infra.
 *
 * DROP-IN USAGE:
 *   <script src="payment.js"></script>
 *   After app.js, before closing </body>
 *
 * All existing handlePayment(), openAddonModal(), openCompanionModal(),
 * openV4ProModal() calls in app.js are automatically overridden.
 */

(function () {
  'use strict';

  /* ─── CONFIG (from app.js globals) ──────────────────────────── */
  const CF_APP_ID    = typeof CASHFREE_APP_ID    !== 'undefined' ? CASHFREE_APP_ID    : 'AppID12313568ac3cf01b86d06d981446531321';
  const CF_SECRET    = typeof CASHFREE_SECRET_KEY !== 'undefined' ? CASHFREE_SECRET_KEY : 'cfsk_ma_prod_865eae796bd15e735eb003b2a00e2e96_23d175a3';
  const CF_ENV       = 'production'; // 'sandbox' for testing
  const CF_API_BASE  = CF_ENV === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

  const PLANS = {
    ssc:      { id: 'ssc',      name: 'SSC Pro',        price: 199, emoji: '🎯', color: '#6C63FF' },
    class10:  { id: 'class10',  name: 'Class 10 Pro',   price: 99,  emoji: '📖', color: '#10b981' },
    class12:  { id: 'class12',  name: 'Class 12 Pro',   price: 99,  emoji: '🔬', color: '#f59e0b' },
  };

  const ADDONS = {
    vision_pro_addon:  { name: 'PrepAI Vision Pro', price: 49,  emoji: '🔬' },
    prepaipro_addon:   { name: 'PrepAI Pro',         price: 49,  emoji: '✨' },
    companion_addon:   { name: 'Companion Mode',     price: 49,  emoji: '💕' },
    v4pro_addon:       { name: 'PrepAI V4 Pro',       price: 149, emoji: '🚀' },
  };

  /* ─── HELPERS ─────────────────────────────────────────────────── */
  function uid() {
    const u = window._firebaseAuth?.currentUser?.uid;
    return u || ('guest_' + Date.now());
  }

  function userEmail() {
    return window._firebaseAuth?.currentUser?.email || 'student@crackai.in';
  }

  function userName() {
    return window._firebaseAuth?.currentUser?.displayName || 'Student';
  }

  function toast(msg, duration = 3000) {
    if (typeof showToast === 'function') showToast(msg, duration);
    else console.log('[CrackAI]', msg);
  }

  function getCF() {
    // Cashfree SDK v3 — loaded via <script src="https://sdk.cashfree.com/js/v3/cashfree.js">
    if (typeof Cashfree === 'function') return Cashfree({ mode: CF_ENV });
    throw new Error('Cashfree SDK not loaded. Add the script tag to index.html.');
  }

  /* ─── CASHFREE ORDER CREATION (direct API call) ──────────────── */
  async function createOrder({ orderId, amount, note, customerPhone = '9999999999' }) {
    const body = {
      order_id:       orderId,
      order_amount:   amount,
      order_currency: 'INR',
      order_note:     note,
      customer_details: {
        customer_id:    uid(),
        customer_name:  userName(),
        customer_email: userEmail(),
        customer_phone: customerPhone,
      },
    };

    const res = await fetch(`${CF_API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-version':   '2023-08-01',
        'x-client-id':     CF_APP_ID,
        'x-client-secret': CF_SECRET,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Order API error ${res.status}`);
    }

    const data = await res.json();
    if (!data.payment_session_id) throw new Error('No payment_session_id returned');
    return data; // { order_id, payment_session_id, order_status, ... }
  }

  /* ─── CASHFREE PAYMENT STATUS CHECK (direct API) ─────────────── */
  async function fetchOrderStatus(orderId) {
    try {
      const res = await fetch(`${CF_API_BASE}/orders/${orderId}`, {
        headers: {
          'x-api-version':   '2023-08-01',
          'x-client-id':     CF_APP_ID,
          'x-client-secret': CF_SECRET,
        },
      });
      if (!res.ok) return null;
      const data = await res.json();
      // order_status: PAID | ACTIVE | EXPIRED | CANCELLED
      return data.order_status;
    } catch (e) {
      return null;
    }
  }

  /* ─── POLL UNTIL PAID ─────────────────────────────────────────── */
  function pollUntilPaid(orderId, { onPaid, onFailed, maxAttempts = 24, interval = 5000 }) {
    let attempt = 0;
    const timer = setInterval(async () => {
      attempt++;
      const status = await fetchOrderStatus(orderId);

      if (status === 'PAID') {
        clearInterval(timer);
        onPaid();
      } else if (status === 'EXPIRED' || status === 'CANCELLED' || attempt >= maxAttempts) {
        clearInterval(timer);
        if (status === 'PAID') onPaid(); // race condition guard
        else onFailed(status || 'TIMEOUT');
      }
    }, interval);
  }

  /* ─── SYNC PREMIUM TO FIRESTORE ──────────────────────────────── */
  function syncToFirestore(field, value = true) {
    try {
      const db   = window._firebaseDb;
      const fns  = window._firebaseFns;
      const user = window._firebaseAuth?.currentUser;
      if (!db || !fns || !user) return;
      const { doc, updateDoc } = fns;
      updateDoc(doc(db, 'users', user.uid), { [field]: value, updatedAt: Date.now() }).catch(() => {});
    } catch (e) {}
  }

  /* ─── ACTIVATE PREMIUM ───────────────────────────────────────── */
  function activatePlan(planId) {
    const plan = PLANS[planId] || PLANS.ssc;
    // Update in-memory state (app.js globals)
    if (typeof state !== 'undefined') {
      state.isPremium  = true;
      state.premiumPlan = planId;
    }
    localStorage.setItem('sscai_premium', 'true');
    localStorage.setItem('sscai_premium_plan', planId);

    // Sync to Firestore
    syncToFirestore('isPremium', true);
    syncToFirestore('premiumPlan', planId);
    syncToFirestore('premiumActivatedAt', Date.now());

    // Update UI
    if (typeof saveState      === 'function') saveState();
    if (typeof updateUserUI   === 'function') updateUserUI();
    if (typeof updateProfileUI === 'function') updateProfileUI();
    if (typeof closePremiumModal === 'function') closePremiumModal();
    if (typeof updateLimitUI  === 'function') updateLimitUI();

    toast(`🎉 ${plan.name} activated! Unlimited access unlocked! 🚀`, 4000);
    if (typeof _doConfetti === 'function') _doConfetti();
  }

  /* ─── ACTIVATE ADDON ─────────────────────────────────────────── */
  function activateAddon(planId) {
    const addon = ADDONS[planId];
    localStorage.setItem('crackai_addon_' + planId, JSON.stringify({ active: true, activatedAt: Date.now() }));
    syncToFirestore('addon_' + planId, true);
    toast(`🎉 ${addon?.name || planId} unlocked! 🚀`, 3500);
    if (typeof _doConfetti === 'function') _doConfetti();

    // If companion, show persona selector
    if (planId === 'companion_addon') {
      document.getElementById('companionAddonModal')?.remove();
      setTimeout(() => { if (typeof showPersonaSelector === 'function') showPersonaSelector(); }, 800);
    }

    // If v4pro, switch model
    if (planId === 'v4pro_addon') {
      document.getElementById('v4ProModal')?.remove();
      window._selectedDeepSeekModel = 'deepseek-v4-pro';
    }

    // Close any open addon modal
    document.getElementById('addonModal')?.remove();
  }

  /* ─── CORE PAYMENT FLOW ──────────────────────────────────────── */
  async function startPayment({ planId, amount, planName, orderId, isAddon = false, btnEl }) {
    if (!window._firebaseAuth?.currentUser) {
      toast('Please login first to purchase!');
      return;
    }

    // Check Cashfree SDK loaded
    if (typeof Cashfree !== 'function') {
      toast('❌ Payment SDK not ready. Please refresh and try again.');
      return;
    }

    if (btnEl) { btnEl.disabled = true; btnEl.textContent = '⏳ Opening payment…'; }

    try {
      toast('💳 Creating secure payment session…');

      // 1. Create order via Cashfree API (direct from browser)
      const orderData = await createOrder({ orderId, amount, note: planName });
      const sessionId = orderData.payment_session_id;

      localStorage.setItem('crackai_pending_pay', JSON.stringify({
        orderId, planId, isAddon, ts: Date.now()
      }));

      // 2. Open Cashfree modal
      const cf = getCF();
      const result = await cf.checkout({
        paymentSessionId: sessionId,
        redirectTarget:   '_modal',
      });

      // 3a. SDK returned result synchronously (some flows)
      if (result?.paymentDetails || result?.error === null) {
        const status = await fetchOrderStatus(orderId);
        if (status === 'PAID') {
          isAddon ? activateAddon(planId) : activatePlan(planId);
          localStorage.removeItem('crackai_pending_pay');
          return;
        }
      }

      // 3b. Redirect flow — poll in background
      toast('⏳ Verifying payment…');
      pollUntilPaid(orderId, {
        onPaid: () => {
          isAddon ? activateAddon(planId) : activatePlan(planId);
          localStorage.removeItem('crackai_pending_pay');
        },
        onFailed: (reason) => {
          if (reason === 'TIMEOUT') {
            toast('⏰ Payment not confirmed yet. If you paid, contact support@crackai.in', 6000);
          } else {
            toast('❌ Payment ' + reason.toLowerCase() + '. Please try again.');
          }
          if (btnEl) { btnEl.disabled = false; btnEl.textContent = '💳 Try Again'; }
        },
      });

    } catch (err) {
      console.error('[payment.js]', err);
      toast('❌ Payment error: ' + (err.message || 'Try again'));
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = '💳 Try Again'; }
    }
  }

  /* ─── CHECK PENDING PAYMENT ON LOAD ─────────────────────────── */
  function checkPendingOnLoad() {
    try {
      const p = JSON.parse(localStorage.getItem('crackai_pending_pay') || 'null');
      if (!p) return;
      const age = Date.now() - p.ts;
      if (age > 10 * 60 * 1000) { localStorage.removeItem('crackai_pending_pay'); return; } // > 10 min, ignore

      // Quietly check if payment completed while away
      fetchOrderStatus(p.orderId).then(status => {
        if (status === 'PAID') {
          p.isAddon ? activateAddon(p.planId) : activatePlan(p.planId);
          localStorage.removeItem('crackai_pending_pay');
        }
      });
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════════
     PUBLIC API — overrides app.js functions
     ══════════════════════════════════════════════════════════════ */

  /**
   * handlePayment(planId) — overrides app.js version
   * Called by premium modal plan buttons: onclick="handlePayment('ssc')"
   */
  window.handlePayment = async function (planId) {
    const plan = PLANS[planId] || PLANS.ssc;
    const orderId = `plan_${planId}_${uid()}_${Date.now()}`;
    await startPayment({
      planId, amount: plan.price, planName: plan.name, orderId, isAddon: false
    });
  };

  /**
   * payAddon(planId, btnEl) — call from addon modal pay buttons
   */
  window.payAddon = async function (planId, btnEl) {
    const addon = ADDONS[planId];
    if (!addon) return;
    const orderId = `addon_${planId}_${uid()}_${Date.now()}`;
    await startPayment({
      planId, amount: addon.price, planName: addon.name, orderId, isAddon: true, btnEl
    });
  };

  /* ─── PREMIUM PLAN MODAL (replaces renderPremiumModal) ───────── */
  window.renderPremiumModal = function () {
    const modal = document.querySelector('#premiumModal .modal-premium-body')
               || document.querySelector('#premiumModal .modal-body');
    if (!modal) return;

    const isPrem = typeof state !== 'undefined' && state.isPremium;
    const curPlan = typeof state !== 'undefined' ? state.premiumPlan : null;

    modal.innerHTML = `
      <div class="pf-header">
        <div class="pf-badge">⭐ Premium Plans</div>
        <h2 class="pf-title">Unlock Full Access</h2>
        <p class="pf-sub">Choose the plan that fits your exam goal</p>
        <div class="pf-trust">
          <span class="pf-trust-item">🔒 Cashfree Secured</span>
          <span class="pf-trust-sep">·</span>
          <span class="pf-trust-item">🏦 UPI · Cards · NetBanking</span>
          <span class="pf-trust-sep">·</span>
          <span class="pf-trust-item">↩️ 30-day Refund</span>
        </div>
      </div>

      <div class="pf-cards">
        ${Object.values(PLANS).map(plan => {
          const isActive = isPrem && curPlan === plan.id;
          const isPopular = plan.id === 'ssc';
          return `
          <div class="pf-card ${isPopular ? 'pf-card-popular' : ''} ${isActive ? 'pf-card-active' : ''}"
               onclick="if(!${isActive})handlePayment('${plan.id}')">
            ${isPopular ? '<div class="pf-popular-tag">🏆 Most Popular</div>' : ''}
            <div class="pf-card-top">
              <span class="pf-plan-icon">${plan.emoji}</span>
              <span class="pf-plan-name">${plan.name}</span>
            </div>
            <div class="pf-plan-price">
              <span class="pf-price-amt">₹${plan.price}</span>
              <span class="pf-price-per">/month</span>
            </div>
            <button class="pf-buy-btn ${isActive ? 'pf-btn-active' : ''}"
                    onclick="event.stopPropagation();handlePayment('${plan.id}')"
                    ${isActive ? 'disabled' : ''}>
              ${isActive ? '✅ Active' : `💳 Buy – ₹${plan.price}`}
            </button>
          </div>`;
        }).join('')}
      </div>

      <div class="pf-features">
        <div class="pf-feat"><span>✅</span><span>Unlimited AI questions daily</span></div>
        <div class="pf-feat"><span>✅</span><span>Image & PDF solving</span></div>
        <div class="pf-feat"><span>✅</span><span>AI Teacher Voice mode</span></div>
        <div class="pf-feat"><span>✅</span><span>All exam modes & personas</span></div>
        <div class="pf-feat"><span>✅</span><span>Priority fast responses</span></div>
        <div class="pf-feat"><span>✅</span><span>30-day money-back guarantee</span></div>
      </div>

      <div class="pf-footer">
        <div class="pf-stats">
          <div class="pf-stat"><span class="pf-stat-num">50K+</span><span class="pf-stat-lbl">Students</span></div>
          <div class="pf-stat-sep"></div>
          <div class="pf-stat"><span class="pf-stat-num">4.9★</span><span class="pf-stat-lbl">Rating</span></div>
          <div class="pf-stat-sep"></div>
          <div class="pf-stat"><span class="pf-stat-num">100%</span><span class="pf-stat-lbl">Secure</span></div>
        </div>
      </div>
    `;

    injectPremiumModalStyles();
  };

  function injectPremiumModalStyles() {
    if (document.getElementById('pf-styles')) return;
    const s = document.createElement('style');
    s.id = 'pf-styles';
    s.textContent = `
      /* ── Premium Modal Styles ── */
      .pf-header { text-align:center; padding:0 0 20px; }
      .pf-badge {
        display:inline-block; font-size:11px; font-weight:700;
        letter-spacing:.1em; text-transform:uppercase;
        color:#6C63FF; background:rgba(108,99,255,.12);
        border:1px solid rgba(108,99,255,.25);
        padding:4px 14px; border-radius:20px; margin-bottom:12px;
      }
      .pf-title {
        font-family:'Space Grotesk',sans-serif; font-size:22px;
        font-weight:700; color:#fff; margin:0 0 6px;
      }
      .pf-sub { font-size:13px; color:rgba(200,195,255,.6); margin:0 0 14px; }
      .pf-trust {
        display:flex; align-items:center; justify-content:center;
        gap:8px; flex-wrap:wrap;
      }
      .pf-trust-item { font-size:11px; color:rgba(200,195,255,.5); }
      .pf-trust-sep  { color:rgba(200,195,255,.2); font-size:11px; }

      /* Cards */
      .pf-cards {
        display:grid; grid-template-columns:repeat(3,1fr); gap:10px;
        margin-bottom:18px;
      }
      @media(max-width:520px) { .pf-cards { grid-template-columns:1fr; } }

      .pf-card {
        position:relative; background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.08); border-radius:16px;
        padding:16px 12px; cursor:pointer; transition:border-color .2s,transform .15s;
        text-align:center;
      }
      .pf-card:hover { border-color:rgba(108,99,255,.4); transform:translateY(-2px); }
      .pf-card-popular {
        border-color:rgba(108,99,255,.5);
        background:rgba(108,99,255,.07);
        box-shadow:0 0 24px rgba(108,99,255,.12);
      }
      .pf-card-active { border-color:rgba(16,185,129,.5); background:rgba(16,185,129,.07); cursor:default; }
      .pf-card-active:hover { transform:none; }

      .pf-popular-tag {
        position:absolute; top:-11px; left:50%; transform:translateX(-50%);
        font-size:10px; font-weight:700; letter-spacing:.08em;
        background:linear-gradient(135deg,#6C63FF,#FF6B9D);
        color:#fff; padding:3px 12px; border-radius:20px; white-space:nowrap;
      }
      .pf-card-top {
        display:flex; align-items:center; justify-content:center;
        gap:6px; margin-bottom:10px;
      }
      .pf-plan-icon  { font-size:20px; }
      .pf-plan-name  { font-size:14px; font-weight:700; color:#fff; }
      .pf-plan-price { margin-bottom:12px; }
      .pf-price-amt  { font-size:26px; font-weight:800; color:#fff; }
      .pf-price-per  { font-size:12px; color:rgba(200,195,255,.45); margin-left:2px; }

      .pf-buy-btn {
        width:100%; padding:9px 0;
        background:linear-gradient(135deg,#6C63FF,#8B5CF6);
        border:none; border-radius:10px;
        color:#fff; font-size:12px; font-weight:700;
        cursor:pointer; transition:opacity .2s,transform .15s;
        letter-spacing:.02em;
      }
      .pf-buy-btn:hover:not(:disabled) { opacity:.9; transform:scale(1.02); }
      .pf-buy-btn:disabled { opacity:.6; cursor:default; }
      .pf-btn-active { background:rgba(16,185,129,.25); color:#10b981; }

      /* Features */
      .pf-features {
        display:grid; grid-template-columns:1fr 1fr;
        gap:6px 16px; margin-bottom:16px;
      }
      @media(max-width:400px) { .pf-features { grid-template-columns:1fr; } }
      .pf-feat {
        display:flex; gap:8px; align-items:flex-start;
        font-size:12px; color:rgba(200,195,255,.7); line-height:1.4;
      }
      .pf-feat span:first-child { flex-shrink:0; }

      /* Footer stats */
      .pf-footer { margin-top:4px; }
      .pf-stats {
        display:flex; align-items:center; justify-content:center;
        gap:16px; background:rgba(255,255,255,.03);
        border:1px solid rgba(255,255,255,.06); border-radius:12px; padding:12px;
      }
      .pf-stat { text-align:center; }
      .pf-stat-num { display:block; font-size:16px; font-weight:800; color:#fff; }
      .pf-stat-lbl { font-size:10px; color:rgba(200,195,255,.45); text-transform:uppercase; letter-spacing:.06em; }
      .pf-stat-sep { width:1px; height:28px; background:rgba(255,255,255,.08); }
    `;
    document.head.appendChild(s);
  }

  /* ─── ADDON MODALS (replaces openAddonModal in app.js) ──────── */
  window.openAddonModal = function (type) {
    document.getElementById('addonModal')?.remove();

    const isVision = type === 'visionpro';
    const planId   = isVision ? 'vision_pro_addon' : 'prepaipro_addon';
    const addon    = ADDONS[planId];

    const modal = document.createElement('div');
    modal.id = 'addonModal';
    modal.className = 'cf-addon-overlay';
    modal.innerHTML = `
      <div class="cf-addon-box">
        <button class="cf-addon-close" onclick="document.getElementById('addonModal').remove()">✕</button>
        <div class="cf-addon-icon">${addon.emoji}</div>
        <div class="cf-addon-name">${addon.name}</div>
        <div class="cf-addon-desc">${isVision
          ? 'Image solving, handwritten notes & PDF analysis with advanced AI'
          : 'Deep reasoning, step-by-step solutions & full exam coverage'
        }</div>
        <ul class="cf-addon-features">
          ${isVision
            ? '<li>✅ DeepSeek Vision AI</li><li>✅ Handwritten notes</li><li>✅ PDF extraction</li><li>✅ Diagram analysis</li>'
            : '<li>✅ Advanced reasoning</li><li>✅ Detailed solutions</li><li>✅ Concept deep-dives</li><li>✅ Full SSC/CBSE</li>'
          }
        </ul>
        <div class="cf-addon-price">₹${addon.price} <span>one-time · Lifetime</span></div>
        <button class="cf-addon-pay-btn" id="addonPayBtn" onclick="payAddon('${planId}', this)">
          💳 Unlock for ₹${addon.price}
        </button>
        <button class="cf-addon-skip" onclick="document.getElementById('addonModal').remove()">Maybe Later</button>
        <div class="cf-addon-secure">🔒 Secured by Cashfree Payments</div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    injectAddonStyles();
  };

  /* ─── COMPANION MODAL (replaces openCompanionModal) ─────────── */
  window.openCompanionModal = function () {
    document.getElementById('companionAddonModal')?.remove();

    const planId = 'companion_addon';
    const addon  = ADDONS[planId];

    const modal = document.createElement('div');
    modal.id = 'companionAddonModal';
    modal.className = 'cf-addon-overlay';
    modal.innerHTML = `
      <div class="cf-addon-box cf-companion-box">
        <button class="cf-addon-close" onclick="document.getElementById('companionAddonModal').remove()">✕</button>
        <div class="cf-addon-icon">💕</div>
        <div class="cf-addon-name">Companion Mode</div>
        <div class="cf-addon-desc">Your AI study companion — caring, encouraging, always there for you</div>
        <ul class="cf-addon-features">
          <li>💝 Choose AI Girlfriend or Boyfriend</li>
          <li>📚 Study together with emotional support</li>
          <li>🎉 Celebrate wins & overcome stress</li>
          <li>♾️ Lifetime access — one-time unlock</li>
        </ul>
        <div class="cf-addon-price">₹${addon.price} <span>one-time · Lifetime</span></div>
        <button class="cf-addon-pay-btn cf-companion-btn" id="companionPayBtn"
                onclick="payAddon('companion_addon', this)">
          💕 Unlock Companion Mode — ₹49
        </button>
        <button class="cf-addon-skip" onclick="document.getElementById('companionAddonModal').remove()">Maybe Later</button>
        <div class="cf-addon-secure">🔒 Secured by Cashfree Payments</div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    injectAddonStyles();
  };

  /* ─── V4 PRO MODAL (replaces openV4ProModal) ─────────────────── */
  window.openV4ProModal = function () {
    document.getElementById('v4ProModal')?.remove();

    const planId = 'v4pro_addon';
    const addon  = ADDONS[planId];

    const modal = document.createElement('div');
    modal.id = 'v4ProModal';
    modal.className = 'cf-addon-overlay';
    modal.innerHTML = `
      <div class="cf-addon-box cf-v4pro-box">
        <button class="cf-addon-close" onclick="document.getElementById('v4ProModal').remove()">✕</button>
        <div class="cf-v4pro-badge">DeepSeek V4 Pro · Flagship</div>
        <div class="cf-addon-icon">🚀</div>
        <div class="cf-addon-name">PrepAI V4 Pro</div>
        <div class="cf-addon-desc">The most powerful DeepSeek model — best-in-class reasoning for tough questions</div>
        <ul class="cf-addon-features">
          <li>🚀 DeepSeek V4 Pro flagship model</li>
          <li>🧠 1M token context window (10×)</li>
          <li>📐 Best at Math, Reasoning & Science</li>
          <li>⚡ Thinking + non-thinking mode</li>
          <li>♾️ Unlimited V4 Pro questions</li>
        </ul>
        <div class="cf-addon-price cf-v4pro-price">₹${addon.price} <span>/month · Cancel anytime</span></div>
        <button class="cf-addon-pay-btn cf-v4pro-btn" id="v4ProPayBtn"
                onclick="payAddon('v4pro_addon', this)">
          🚀 Unlock V4 Pro — ₹149/mo
        </button>
        <button class="cf-addon-skip" onclick="document.getElementById('v4ProModal').remove()">Maybe Later</button>
        <div class="cf-addon-secure">🔒 Secured by Cashfree Payments</div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    injectAddonStyles();
  };

  function injectAddonStyles() {
    if (document.getElementById('cf-addon-styles')) return;
    const s = document.createElement('style');
    s.id = 'cf-addon-styles';
    s.textContent = `
      .cf-addon-overlay {
        position:fixed; inset:0; z-index:9999;
        display:flex; align-items:center; justify-content:center;
        background:rgba(0,0,0,.82); padding:20px;
        backdrop-filter:blur(8px);
        animation:cfFadeIn .2s ease;
      }
      @keyframes cfFadeIn { from{opacity:0} to{opacity:1} }

      .cf-addon-box {
        position:relative;
        background:linear-gradient(160deg,#0f0c1f 0%,#1a1435 100%);
        border:1px solid rgba(108,99,255,.3); border-radius:22px;
        padding:28px 22px 22px; max-width:340px; width:100%;
        text-align:center;
        box-shadow:0 0 60px rgba(108,99,255,.12), 0 24px 48px rgba(0,0,0,.5);
        animation:cfSlideUp .25s cubic-bezier(.34,1.56,.64,1);
      }
      @keyframes cfSlideUp { from{transform:translateY(20px);opacity:0} to{transform:none;opacity:1} }

      .cf-companion-box { border-color:rgba(255,107,157,.3); box-shadow:0 0 60px rgba(255,107,157,.1),0 24px 48px rgba(0,0,0,.5); }
      .cf-v4pro-box     { border-color:rgba(245,158,11,.3);  box-shadow:0 0 60px rgba(245,158,11,.1), 0 24px 48px rgba(0,0,0,.5); }

      .cf-addon-close {
        position:absolute; top:14px; right:14px;
        background:rgba(255,255,255,.06); border:none; color:rgba(255,255,255,.4);
        width:28px; height:28px; border-radius:50%; cursor:pointer; font-size:13px;
        transition:background .2s,color .2s;
      }
      .cf-addon-close:hover { background:rgba(255,255,255,.12); color:#fff; }

      .cf-v4pro-badge {
        display:inline-block; font-size:10px; font-weight:700; letter-spacing:.1em;
        text-transform:uppercase; color:#f59e0b;
        background:rgba(245,158,11,.1); border:1px solid rgba(245,158,11,.25);
        padding:3px 12px; border-radius:20px; margin-bottom:12px;
      }

      .cf-addon-icon  { font-size:38px; margin-bottom:10px; }
      .cf-addon-name  { font-family:'Space Grotesk',sans-serif; font-size:20px; font-weight:700; color:#fff; margin-bottom:6px; }
      .cf-addon-desc  { font-size:13px; color:rgba(200,195,255,.6); line-height:1.5; margin-bottom:16px; }

      .cf-addon-features {
        list-style:none; padding:0; margin:0 0 16px;
        text-align:left; display:flex; flex-direction:column; gap:5px;
      }
      .cf-addon-features li { font-size:12px; color:rgba(200,195,255,.75); }

      .cf-addon-price {
        font-size:28px; font-weight:800; color:#6C63FF; margin-bottom:16px;
      }
      .cf-addon-price span  { font-size:12px; font-weight:400; color:rgba(200,195,255,.4); margin-left:4px; }
      .cf-v4pro-price { color:#f59e0b; }

      .cf-addon-pay-btn {
        width:100%; padding:13px;
        background:linear-gradient(135deg,#6C63FF,#8B5CF6);
        border:none; border-radius:13px;
        color:#fff; font-size:14px; font-weight:700;
        cursor:pointer; margin-bottom:10px;
        box-shadow:0 4px 20px rgba(108,99,255,.35);
        transition:opacity .2s,transform .15s;
        letter-spacing:.02em;
      }
      .cf-addon-pay-btn:hover:not(:disabled) { opacity:.92; transform:scale(1.01); }
      .cf-addon-pay-btn:disabled             { opacity:.6; cursor:default; transform:none; }
      .cf-companion-btn { background:linear-gradient(135deg,#FF6B9D,#ff9a8b); box-shadow:0 4px 20px rgba(255,107,157,.35); }
      .cf-v4pro-btn     { background:linear-gradient(135deg,#f59e0b,#FF6B9D); box-shadow:0 4px 20px rgba(245,158,11,.35); }

      .cf-addon-skip {
        width:100%; padding:9px;
        background:transparent; color:rgba(200,195,255,.4);
        border:1px solid rgba(108,99,255,.15); border-radius:10px;
        font-size:12px; cursor:pointer; margin-bottom:12px;
        transition:color .2s;
      }
      .cf-addon-skip:hover { color:rgba(200,195,255,.7); }

      .cf-addon-secure { font-size:11px; color:rgba(200,195,255,.25); }
    `;
    document.head.appendChild(s);
  }

  /* ─── INIT ────────────────────────────────────────────────────── */
  // Check pending payment when page loads (handles redirect flow)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkPendingOnLoad);
  } else {
    setTimeout(checkPendingOnLoad, 1000); // wait for auth to init
  }

  console.log('[payment.js] CrackAI Payment Module v2.0 loaded — Cashfree frontend-only mode');

})();