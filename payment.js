/**
 * payment.js — CrackAI Payment Module v2.1
 * ──────────────────────────────────────────
 * Uses your already-deployed Cloud Run backend for order creation
 * (Cashfree blocks direct browser API calls via CORS).
 * Verification also goes through your backend for security.
 *
 * Your live endpoints (from app.js):
 *   ORDER:  https://createcashfreeorder-419137308157.us-central1.run.app
 *   VERIFY: https://verifypayment-419137308157.us-central1.run.app
 *
 * Drop in AFTER app.js — auto-overrides all payment functions.
 */

(function () {
  'use strict';

  /* ─── CONFIG ────────────────────────────────────────────────── */
  // Switch to 'sandbox' for testing, 'production' for real payments
  const CF_ENV = 'production';

  // Auto-detect: if served from Firebase Hosting use relative /api/ paths.
  // If served from GitHub Pages or any other domain use the new Cloud Run URLs
  // (these were just deployed and have origin:true CORS — allow all domains).
  const _onFirebase = location.hostname.includes('web.app') || location.hostname.includes('firebaseapp.com');
  const ORDER_URL  = _onFirebase ? '/api/create-cashfree-order' : 'https://createcashfreeorder-56khnynjia-uc.a.run.app';
  const VERIFY_URL = _onFirebase ? '/api/verify-payment'        : 'https://verifypayment-56khnynjia-uc.a.run.app';

  const PLANS = {
    ssc:     { id: 'ssc',     name: 'SSC Pro',      price: 199, emoji: '🎯' },
    class10: { id: 'class10', name: 'Class 10 Pro', price: 99,  emoji: '📖' },
    class12: { id: 'class12', name: 'Class 12 Pro', price: 99,  emoji: '🔬' },
  };

  const ADDONS = {
    vision_pro_addon: { name: 'PrepAI Vision Pro', price: 49,  emoji: '🔬' },
    prepaipro_addon:  { name: 'PrepAI Pro',         price: 49,  emoji: '✨' },
    companion_addon:  { name: 'Companion Mode',     price: 49,  emoji: '💕' },
    v4pro_addon:      { name: 'PrepAI V4 Pro',       price: 149, emoji: '🚀' },
  };

  /* ─── HELPERS ───────────────────────────────────────────────── */
  function currentUser()  { return window._firebaseAuth?.currentUser || null; }
  function uid()          { return currentUser()?.uid || ('guest_' + Date.now()); }
  function userEmail()    { return currentUser()?.email || 'student@crackai.in'; }
  function userName()     { return currentUser()?.displayName || 'Student'; }

  async function getToken() {
    try { return await currentUser()?.getIdToken() || null; } catch { return null; }
  }

  function toast(msg, duration = 3000) {
    if (typeof showToast === 'function') showToast(msg, duration);
  }

  function getCF() {
    if (typeof Cashfree === 'function') return Cashfree({ mode: CF_ENV });
    throw new Error('Cashfree SDK not loaded.');
  }

  /* ─── ORDER CREATION via your Cloud Run backend ─────────────── */
  async function createOrder({ orderId, amount, planId, note }) {
    const token = await getToken();
    const res = await fetch(ORDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        order_id:       orderId,
        amount,
        currency:       'INR',
        plan:           planId,
        order_note:     note || planId,
        customer_id:    uid(),
        customer_name:  userName(),
        customer_email: userEmail(),
        customer_phone: currentUser()?.phoneNumber?.replace(/\D/g,'').slice(-10) || '9000000000',
        uid:            uid(),
        name:           userName(),
        email:          userEmail(),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Order failed (${res.status})`);
    }

    const data = await res.json();
    if (!data.payment_session_id) throw new Error('No payment session returned from server');
    return data; // { order_id, payment_session_id }
  }

  /* ─── PAYMENT VERIFICATION via your Cloud Run backend ───────── */
  async function verifyOrder(orderId) {
    try {
      const token = await getToken();
      const res = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ order_id: orderId }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data; // { status: 'PAID' | 'FAILED' | ... }
    } catch { return null; }
  }

  /* ─── POLL UNTIL PAID ───────────────────────────────────────── */
  function pollUntilPaid(orderId, { onPaid, onFailed, maxAttempts = 24, interval = 5000 }) {
    let attempt = 0;
    const timer = setInterval(async () => {
      attempt++;
      const result = await verifyOrder(orderId);
      if (result?.status === 'PAID') {
        clearInterval(timer);
        onPaid();
      } else if (result?.status === 'FAILED' || attempt >= maxAttempts) {
        clearInterval(timer);
        onFailed(result?.status || 'TIMEOUT');
      }
    }, interval);
  }

  /* ─── SYNC TO FIRESTORE ─────────────────────────────────────── */
  function syncFirestore(fields) {
    try {
      const db  = window._firebaseDb;
      const fns = window._firebaseFns;
      const u   = currentUser();
      if (!db || !fns || !u) return;
      const { doc, updateDoc } = fns;
      updateDoc(doc(db, 'users', u.uid), { ...fields, updatedAt: Date.now() }).catch(() => {});
    } catch {}
  }

  /* ─── ACTIVATE PLAN ─────────────────────────────────────────── */
  function activatePlan(planId) {
    const plan = PLANS[planId] || PLANS.ssc;
    if (typeof state !== 'undefined') {
      state.isPremium   = true;
      state.premiumPlan = planId;
    }
    localStorage.setItem('sscai_premium', 'true');
    localStorage.setItem('sscai_premium_plan', planId);
    syncFirestore({ isPremium: true, premiumPlan: planId, premiumActivatedAt: Date.now() });
    if (typeof saveState       === 'function') saveState();
    if (typeof updateUserUI    === 'function') updateUserUI();
    if (typeof updateProfileUI === 'function') updateProfileUI();
    if (typeof closePremiumModal === 'function') closePremiumModal();
    if (typeof updateLimitUI   === 'function') updateLimitUI();
    toast(`🎉 ${plan.name} activated! Unlimited access unlocked! 🚀`, 4000);
    if (typeof _doConfetti === 'function') _doConfetti();
  }

  /* ─── ACTIVATE ADDON ────────────────────────────────────────── */
  /* ─── MODEL GUARD HELPERS ──────────────────────────────────── */
  // Revert model selector UI back to the previous valid model
  // when user cancels payment without completing it.
  function revertModelSelector() {
    try {
      const dropdown   = document.querySelector('.model-selector-dropdown, #modelDropdown, [class*="model-dropdown"]');
      const allOptions = document.querySelectorAll('.model-option[data-model]');
      if (!allOptions.length) return;

      // Find whichever option is currently "active" (the locked one user clicked)
      // and revert it. The safe fallback model is 'smart'.
      const safeModel = 'smart';

      allOptions.forEach(opt => {
        const m   = opt.dataset.model;
        const chk = opt.querySelector('.model-opt-check');
        if (m === safeModel) {
          opt.classList.add('active');
          opt.setAttribute('aria-selected', 'true');
          if (chk) chk.textContent = '✓';
        } else {
          opt.classList.remove('active');
          opt.setAttribute('aria-selected', 'false');
          if (chk) chk.textContent = '';
        }
      });

      // Reset global model
      window._selectedDeepSeekModel = 'deepseek-chat';

      // Reset selector button label
      const selectorIcon  = document.getElementById('modelSelectorIcon');
      const selectorLabel = document.getElementById('modelSelectorLabel');
      const chipIcon      = document.querySelector('.model-chip-icon, #chipIcon');
      const chipName      = document.querySelector('.model-chip-name, #chipName');
      if (selectorIcon)  selectorIcon.textContent  = '⚡';
      if (selectorLabel) selectorLabel.textContent = 'PrepAI Smart';
      if (chipIcon) chipIcon.textContent = '⚡';
      if (chipName) chipName.textContent = 'Smart';
    } catch (e) {}
  }

  function activateAddon(planId) {
    const addon = ADDONS[planId];
    localStorage.setItem('crackai_addon_' + planId, JSON.stringify({ active: true, activatedAt: Date.now() }));
    syncFirestore({ ['addon_' + planId]: true });
    toast(`🎉 ${addon?.name || planId} unlocked!`, 3500);
    if (typeof _doConfetti === 'function') _doConfetti();
    if (planId === 'companion_addon') {
      document.getElementById('companionAddonModal')?.remove();
      setTimeout(() => { if (typeof showPersonaSelector === 'function') showPersonaSelector(); }, 800);
    }
    if (planId === 'v4pro_addon') {
      document.getElementById('v4ProModal')?.remove();
      window._selectedDeepSeekModel = 'deepseek-v4-pro';
      // Update UI to show V4 Pro as selected
      try {
        document.querySelectorAll('.model-option[data-model]').forEach(opt => {
          const chk = opt.querySelector('.model-opt-check');
          if (opt.dataset.model === 'v4-pro') {
            opt.classList.add('active'); opt.setAttribute('aria-selected','true');
            if (chk) chk.textContent = '✓';
          } else {
            opt.classList.remove('active'); opt.setAttribute('aria-selected','false');
            if (chk) chk.textContent = '';
          }
        });
        const selectorIcon  = document.getElementById('modelSelectorIcon');
        const selectorLabel = document.getElementById('modelSelectorLabel');
        if (selectorIcon)  selectorIcon.textContent  = '🚀';
        if (selectorLabel) selectorLabel.textContent = 'V4 Pro';
      } catch(e) {}
    }
    if (planId === 'prepaipro_addon') {
      document.getElementById('addonModal')?.remove();
      // Switch selector to Pro model after unlock
      try {
        document.querySelectorAll('.model-option[data-model]').forEach(opt => {
          const chk = opt.querySelector('.model-opt-check');
          if (opt.dataset.model === 'pro') {
            opt.classList.add('active'); opt.setAttribute('aria-selected','true');
            if (chk) chk.textContent = '✓';
          } else {
            opt.classList.remove('active'); opt.setAttribute('aria-selected','false');
            if (chk) chk.textContent = '';
          }
        });
        window._selectedDeepSeekModel = 'deepseek-reasoner';
        const selectorIcon  = document.getElementById('modelSelectorIcon');
        const selectorLabel = document.getElementById('modelSelectorLabel');
        if (selectorIcon)  selectorIcon.textContent  = '✨';
        if (selectorLabel) selectorLabel.textContent = 'PrepAI Pro';
      } catch(e) {}
      return;
    }
    document.getElementById('addonModal')?.remove();
  }

  /* ─── CORE PAYMENT FLOW ─────────────────────────────────────── */
  async function startPayment({ planId, amount, planName, orderId, isAddon = false, btnEl, btnOrigText, onSuccess }) {
    if (!currentUser()) {
      toast('Please login first to purchase!');
      return;
    }
    if (typeof Cashfree !== 'function') {
      toast('❌ Payment SDK not ready. Please refresh and try again.');
      return;
    }

    if (btnEl) { btnEl.disabled = true; btnEl.textContent = '⏳ Opening payment…'; }
    toast('💳 Creating secure payment session…');

    try {
      // 1. Create order via your backend
      const orderData = await createOrder({ orderId, amount, planId, note: planName });
      const sessionId = orderData.payment_session_id;

      localStorage.setItem('crackai_pending_pay', JSON.stringify({
        orderId, planId, isAddon, ts: Date.now()
      }));

      // 2. Open Cashfree checkout popup
      const cf     = getCF();
      const result = await cf.checkout({
        paymentSessionId: sessionId,
        redirectTarget:   '_modal',
      });

      // 3a. SDK returned result directly (UPI, some card flows)
      if (result?.paymentDetails || result?.error === null) {
        const verify = await verifyOrder(orderId);
        if (verify?.status === 'PAID') {
          if (onSuccess) onSuccess();
          else isAddon ? activateAddon(planId) : activatePlan(planId);
          localStorage.removeItem('crackai_pending_pay');
          return;
        }
      }

      // 3b. Redirect/async flow — poll backend
      toast('⏳ Verifying payment…');
      pollUntilPaid(orderId, {
        onPaid: () => {
          if (onSuccess) onSuccess();
          else isAddon ? activateAddon(planId) : activatePlan(planId);
          localStorage.removeItem('crackai_pending_pay');
        },
        onFailed: (reason) => {
          if (reason === 'TIMEOUT') {
            toast('⏰ Not confirmed yet. If you paid, contact support@crackai.in', 6000);
          } else {
            toast('❌ Payment ' + reason.toLowerCase() + '. Please try again.');
          }
          if (btnEl) { btnEl.disabled = false; btnEl.textContent = btnOrigText || '💳 Try Again'; }
        },
      });

    } catch (err) {
      console.error('[payment.js]', err);
      toast('❌ ' + (err.message || 'Payment failed. Try again.'));
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = btnOrigText || '💳 Try Again'; }
    }
  }

  /* ─── CHECK PENDING ON LOAD ─────────────────────────────────── */
  function checkPendingOnLoad() {
    try {
      const p = JSON.parse(localStorage.getItem('crackai_pending_pay') || 'null');
      if (!p || (Date.now() - p.ts) > 10 * 60 * 1000) {
        localStorage.removeItem('crackai_pending_pay');
        return;
      }
      verifyOrder(p.orderId).then(result => {
        if (result?.status === 'PAID') {
          if (p.planId === 'companion_bf_addon')  activateCompanion('boyfriend');
          else if (p.planId === 'companion_gf_addon') activateCompanion('girlfriend');
          else p.isAddon ? activateAddon(p.planId) : activatePlan(p.planId);
          localStorage.removeItem('crackai_pending_pay');
        }
      });
    } catch {}
  }

  /* ══════════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════════ */

  /** handlePayment(planId) — overrides app.js, called by premium modal buttons */
  window.handlePayment = async function (planId) {
    const plan = PLANS[planId] || PLANS.ssc;
    await startPayment({
      planId, amount: plan.price, planName: plan.name,
      orderId: `plan_${planId}_${uid()}_${Date.now()}`,
      isAddon: false,
    });
  };

  /** payAddon(planId, btnEl) — called by addon modal pay buttons */
  window.payAddon = async function (planId, btnEl) {
    const addon = ADDONS[planId];
    if (!addon) return;
    const origText = btnEl?.textContent;
    await startPayment({
      planId, amount: addon.price, planName: addon.name,
      orderId: `addon_${planId}_${uid()}_${Date.now()}`,
      isAddon: true, btnEl, btnOrigText: origText,
    });
  };

  /* ─── PREMIUM MODAL UI ──────────────────────────────────────── */
  window.renderPremiumModal = function () {
    const modal = document.querySelector('#premiumModal .modal-premium-body')
               || document.querySelector('#premiumModal .modal-body');
    if (!modal) return;

    const isPrem  = typeof state !== 'undefined' && state.isPremium;
    const curPlan = typeof state !== 'undefined' ? state.premiumPlan : null;

    modal.innerHTML = `
      <div class="pf-header">
        <div class="pf-badge">⭐ Premium Plans</div>
        <h2 class="pf-title">Unlock Full Access</h2>
        <p class="pf-sub">Choose the plan that fits your exam goal</p>
        <div class="pf-trust">
          <span>🔒 Cashfree Secured</span>
          <span class="pf-trust-sep">·</span>
          <span>🏦 UPI · Cards · NetBanking</span>
          <span class="pf-trust-sep">·</span>
          <span>↩️ 30-day Refund</span>
        </div>
      </div>

      <div class="pf-cards">
        ${Object.values(PLANS).map(plan => {
          const isActive  = isPrem && curPlan === plan.id;
          const isPopular = plan.id === 'ssc';
          return `
          <div class="pf-card ${isPopular ? 'pf-card-popular' : ''} ${isActive ? 'pf-card-active' : ''}">
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
                    onclick="handlePayment('${plan.id}')"
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
        <div class="pf-feat"><span>✅</span><span>All exam modes &amp; personas</span></div>
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
      </div>`;

    injectPremiumModalStyles();
  };

  function injectPremiumModalStyles() {
    if (document.getElementById('pf-styles')) return;
    const s = document.createElement('style');
    s.id = 'pf-styles';
    s.textContent = `
      .pf-header{text-align:center;padding:0 0 20px}
      .pf-badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6C63FF;background:rgba(108,99,255,.12);border:1px solid rgba(108,99,255,.25);padding:4px 14px;border-radius:20px;margin-bottom:12px}
      .pf-title{font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;color:#fff;margin:0 0 6px}
      .pf-sub{font-size:13px;color:rgba(200,195,255,.6);margin:0 0 12px}
      .pf-trust{display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap;font-size:11px;color:rgba(200,195,255,.45)}
      .pf-trust-sep{color:rgba(200,195,255,.2)}
      .pf-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}
      @media(max-width:520px){.pf-cards{grid-template-columns:1fr}}
      .pf-card{position:relative;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:18px 12px;text-align:center;transition:border-color .2s,transform .15s}
      .pf-card:hover{border-color:rgba(108,99,255,.4);transform:translateY(-2px)}
      .pf-card-popular{border-color:rgba(108,99,255,.45);background:rgba(108,99,255,.07);box-shadow:0 0 24px rgba(108,99,255,.12)}
      .pf-card-active{border-color:rgba(16,185,129,.45);background:rgba(16,185,129,.06)}
      .pf-popular-tag{position:absolute;top:-11px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:700;background:linear-gradient(135deg,#6C63FF,#FF6B9D);color:#fff;padding:3px 12px;border-radius:20px;white-space:nowrap}
      .pf-card-top{display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:10px}
      .pf-plan-icon{font-size:20px}
      .pf-plan-name{font-size:14px;font-weight:700;color:#fff}
      .pf-plan-price{margin-bottom:12px}
      .pf-price-amt{font-size:26px;font-weight:800;color:#fff}
      .pf-price-per{font-size:12px;color:rgba(200,195,255,.4);margin-left:2px}
      .pf-buy-btn{width:100%;padding:9px 0;background:linear-gradient(135deg,#6C63FF,#8B5CF6);border:none;border-radius:10px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;transition:opacity .2s,transform .15s;letter-spacing:.02em}
      .pf-buy-btn:hover:not(:disabled){opacity:.9;transform:scale(1.02)}
      .pf-buy-btn:disabled{opacity:.6;cursor:default}
      .pf-btn-active{background:rgba(16,185,129,.2);color:#10b981}
      .pf-features{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;margin-bottom:16px}
      @media(max-width:400px){.pf-features{grid-template-columns:1fr}}
      .pf-feat{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:rgba(200,195,255,.7);line-height:1.4}
      .pf-feat span:first-child{flex-shrink:0}
      .pf-footer{margin-top:4px}
      .pf-stats{display:flex;align-items:center;justify-content:center;gap:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px}
      .pf-stat{text-align:center}
      .pf-stat-num{display:block;font-size:16px;font-weight:800;color:#fff}
      .pf-stat-lbl{font-size:10px;color:rgba(200,195,255,.4);text-transform:uppercase;letter-spacing:.06em}
      .pf-stat-sep{width:1px;height:28px;background:rgba(255,255,255,.08)}
    `;
    document.head.appendChild(s);
  }

  /* ─── ADDON MODAL ───────────────────────────────────────────── */
  window.openAddonModal = function (type) {
    document.getElementById('addonModal')?.remove();
    const isVision = type === 'visionpro';
    const planId   = isVision ? 'vision_pro_addon' : 'prepaipro_addon';
    const addon    = ADDONS[planId];
    _spawnAddonModal({
      id: 'addonModal', planId, icon: addon.emoji, title: addon.name,
      desc: isVision
        ? 'Image solving, handwritten notes & PDF analysis with advanced AI'
        : 'Deep reasoning, step-by-step solutions & full exam coverage',
      features: isVision
        ? ['✅ DeepSeek Vision AI', '✅ Handwritten notes', '✅ PDF extraction', '✅ Diagram analysis']
        : ['✅ Advanced reasoning', '✅ Detailed solutions', '✅ Concept deep-dives', '✅ Full SSC/CBSE'],
      price: addon.price, priceLabel: 'one-time · Lifetime',
      btnText: `💳 Unlock for ₹${addon.price}`, btnClass: '',
    });
  };

  window.openCompanionModal = function () {
    document.getElementById('companionAddonModal')?.remove();
    _spawnAddonModal({
      id: 'companionAddonModal', planId: 'companion_addon',
      icon: '💕', title: 'Companion Mode',
      desc: 'Your AI study companion — caring, encouraging, always there for you',
      features: ['💝 AI Girlfriend or Boyfriend', '📚 Study with emotional support', '🎉 Celebrate wins & beat stress', '♾️ Lifetime access'],
      price: 49, priceLabel: 'one-time · Lifetime',
      btnText: '💕 Unlock Companion Mode — ₹49', btnClass: 'cf-companion-btn',
      boxClass: 'cf-companion-box',
    });
  };

  window.openV4ProModal = function () {
    document.getElementById('v4ProModal')?.remove();
    _spawnAddonModal({
      id: 'v4ProModal', planId: 'v4pro_addon',
      icon: '🚀', title: 'PrepAI V4 Pro',
      badge: 'DeepSeek V4 Pro · Flagship',
      desc: 'The most powerful DeepSeek model — best-in-class reasoning for tough questions',
      features: ['🚀 DeepSeek V4 Pro flagship model', '🧠 1M token context (10×)', '📐 Best for Math, Reasoning & Science', '⚡ Thinking + non-thinking mode', '♾️ Unlimited V4 Pro questions'],
      price: 149, priceLabel: '/month · Cancel anytime',
      btnText: '🚀 Unlock V4 Pro — ₹149/mo', btnClass: 'cf-v4pro-btn',
      boxClass: 'cf-v4pro-box',
    });
  };

  function _spawnAddonModal({ id, planId, icon, title, badge, desc, features, price, priceLabel, btnText, btnClass = '', boxClass = '' }) {
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'cf-addon-overlay';
    modal.innerHTML = `
      <div class="cf-addon-box ${boxClass}">
        <button class="cf-addon-close" onclick="document.getElementById('${id}').remove();revertModelSelector()">✕</button>
        ${badge ? `<div class="cf-v4pro-badge">${badge}</div>` : ''}
        <div class="cf-addon-icon">${icon}</div>
        <div class="cf-addon-name">${title}</div>
        <div class="cf-addon-desc">${desc}</div>
        <ul class="cf-addon-features">${features.map(f => `<li>${f}</li>`).join('')}</ul>
        <div class="cf-addon-price ${boxClass === 'cf-v4pro-box' ? 'cf-v4pro-price' : ''}">
          ₹${price} <span>${priceLabel}</span>
        </div>
        <button class="cf-addon-pay-btn ${btnClass}" onclick="payAddon('${planId}', this)">
          ${btnText}
        </button>
        <button class="cf-addon-skip" onclick="document.getElementById('${id}').remove();revertModelSelector()">Maybe Later</button>
        <div class="cf-addon-secure">🔒 Secured by Cashfree Payments</div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); revertModelSelector(); } });
    injectAddonStyles();
  }

  function injectAddonStyles() {
    if (document.getElementById('cf-addon-styles')) return;
    const s = document.createElement('style');
    s.id = 'cf-addon-styles';
    s.textContent = `
      .cf-addon-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.82);padding:20px;backdrop-filter:blur(8px);animation:cfFadeIn .2s ease}
      @keyframes cfFadeIn{from{opacity:0}to{opacity:1}}
      .cf-addon-box{position:relative;background:linear-gradient(160deg,#0f0c1f,#1a1435);border:1px solid rgba(108,99,255,.3);border-radius:22px;padding:28px 22px 22px;max-width:340px;width:100%;text-align:center;box-shadow:0 0 60px rgba(108,99,255,.12),0 24px 48px rgba(0,0,0,.5);animation:cfSlideUp .25s cubic-bezier(.34,1.56,.64,1)}
      @keyframes cfSlideUp{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}
      .cf-companion-box{border-color:rgba(255,107,157,.3);box-shadow:0 0 60px rgba(255,107,157,.1),0 24px 48px rgba(0,0,0,.5)}
      .cf-v4pro-box{border-color:rgba(245,158,11,.3);box-shadow:0 0 60px rgba(245,158,11,.1),0 24px 48px rgba(0,0,0,.5)}
      .cf-addon-close{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.06);border:none;color:rgba(255,255,255,.4);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:13px;transition:background .2s,color .2s}
      .cf-addon-close:hover{background:rgba(255,255,255,.12);color:#fff}
      .cf-v4pro-badge{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#f59e0b;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);padding:3px 12px;border-radius:20px;margin-bottom:12px}
      .cf-addon-icon{font-size:38px;margin-bottom:10px}
      .cf-addon-name{font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:700;color:#fff;margin-bottom:6px}
      .cf-addon-desc{font-size:13px;color:rgba(200,195,255,.6);line-height:1.5;margin-bottom:16px}
      .cf-addon-features{list-style:none;padding:0;margin:0 0 16px;text-align:left;display:flex;flex-direction:column;gap:5px}
      .cf-addon-features li{font-size:12px;color:rgba(200,195,255,.75)}
      .cf-addon-price{font-size:28px;font-weight:800;color:#6C63FF;margin-bottom:16px}
      .cf-addon-price span{font-size:12px;font-weight:400;color:rgba(200,195,255,.4);margin-left:4px}
      .cf-v4pro-price{color:#f59e0b}
      .cf-addon-pay-btn{width:100%;padding:13px;background:linear-gradient(135deg,#6C63FF,#8B5CF6);border:none;border-radius:13px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px;box-shadow:0 4px 20px rgba(108,99,255,.35);transition:opacity .2s,transform .15s;letter-spacing:.02em}
      .cf-addon-pay-btn:hover:not(:disabled){opacity:.92;transform:scale(1.01)}
      .cf-addon-pay-btn:disabled{opacity:.6;cursor:default;transform:none}
      .cf-companion-btn{background:linear-gradient(135deg,#FF6B9D,#ff9a8b);box-shadow:0 4px 20px rgba(255,107,157,.35)}
      .cf-v4pro-btn{background:linear-gradient(135deg,#f59e0b,#FF6B9D);box-shadow:0 4px 20px rgba(245,158,11,.35)}
      .cf-addon-skip{width:100%;padding:9px;background:transparent;color:rgba(200,195,255,.4);border:1px solid rgba(108,99,255,.15);border-radius:10px;font-size:12px;cursor:pointer;margin-bottom:12px;transition:color .2s}
      .cf-addon-skip:hover{color:rgba(200,195,255,.7)}
      .cf-addon-secure{font-size:11px;color:rgba(200,195,255,.25)}
    `;
    document.head.appendChild(s);
  }

  // Expose revertModelSelector globally for inline onclick handlers
  window.revertModelSelector = revertModelSelector;
  window.openCompanionGateModal = openCompanionGateModal;

  /* ══════════════════════════════════════════════════════════════
     COMPANION PERSONA GATE
     Intercepts selectPersona('boyfriend') / selectPersona('girlfriend')
     and requires payment before activating.
  ══════════════════════════════════════════════════════════════ */

  const COMPANION_ADDONS = {
    boyfriend: { planId: 'companion_bf_addon',  name: 'AI Boyfriend', emoji: '💙', price: 49 },
    girlfriend: { planId: 'companion_gf_addon', name: 'AI Girlfriend', emoji: '💕', price: 49 },
  };

  function isCompanionUnlocked(persona) {
    try {
      const key = 'crackai_addon_' + COMPANION_ADDONS[persona].planId;
      const d = JSON.parse(localStorage.getItem(key) || 'null');
      return d?.active === true;
    } catch { return false; }
  }

  function activateCompanion(persona) {
    const cfg = COMPANION_ADDONS[persona];
    localStorage.setItem('crackai_addon_' + cfg.planId, JSON.stringify({ active: true, activatedAt: Date.now() }));
    syncFirestore({ ['addon_' + cfg.planId]: true });

    // Remove 🔒 from the settings dropdown option
    const sel = document.getElementById('personaSettingsSelect');
    if (sel) {
      const opt = sel.querySelector(`option[value="${persona}"]`);
      if (opt) opt.textContent = opt.textContent.replace(' 🔒', '');
    }

    // Remove lock badge from persona card
    document.querySelectorAll(`[data-companion-lock="true"]`).forEach(card => {
      const badge = card.querySelector('.companion-lock-badge');
      if (badge) badge.remove();
    });

    // Now select the persona via original function
    if (typeof _origSelectPersona === 'function') _origSelectPersona(persona);
    toast(`🎉 ${cfg.name} unlocked! Enjoy your companion 💕`, 3500);
    if (typeof _doConfetti === 'function') _doConfetti();
  }

  function openCompanionGateModal(persona) {
    const cfg = COMPANION_ADDONS[persona];
    const id  = 'companionGateModal_' + persona;
    document.getElementById(id)?.remove();

    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'cf-addon-overlay';
    modal.innerHTML = `
      <div class="cf-addon-box cf-companion-box" style="max-width:320px;">
        <button class="cf-addon-close"
          onclick="document.getElementById('${id}').remove()">✕</button>

        <div style="font-size:42px;margin-bottom:8px;">${cfg.emoji}</div>
        <div class="cf-addon-name">${cfg.name}</div>
        <div class="cf-addon-desc">
          ${persona === 'boyfriend'
            ? 'A caring, loving desi boyfriend who supports you through studies & life — in sweet Hinglish 💙'
            : 'A sweet, expressive desi girlfriend — always there for you, celebrating every win 🌸'}
        </div>

        <ul class="cf-addon-features">
          <li>${persona === 'boyfriend' ? '💙' : '💕'} Full romantic companion persona</li>
          <li>🗣️ Hinglish — Hindi + English naturally mixed</li>
          <li>📚 Study support in character — always</li>
          <li>♾️ Lifetime access · One-time unlock</li>
        </ul>

        <div class="cf-addon-price" style="${persona === 'girlfriend' ? 'color:#FF6B9D' : 'color:#7C72FF'}">
          ₹${cfg.price} <span>one-time · Lifetime</span>
        </div>

        <button class="cf-addon-pay-btn ${persona === 'girlfriend' ? 'cf-companion-btn' : ''}"
                style="${persona === 'boyfriend' ? 'background:linear-gradient(135deg,#7C72FF,#6C63FF);box-shadow:0 4px 20px rgba(108,99,255,.35)' : ''}"
                onclick="payCompanion('${persona}', this)">
          ${cfg.emoji} Unlock ${cfg.name} — ₹${cfg.price}
        </button>
        <button class="cf-addon-skip"
          onclick="document.getElementById('${id}').remove()">Maybe Later</button>
        <div class="cf-addon-secure">🔒 One-time payment · Secured by Cashfree</div>
      </div>`;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  window.payCompanion = async function(persona, btnEl) {
    const cfg     = COMPANION_ADDONS[persona];
    const orderId = `companion_${persona}_${uid()}_${Date.now()}`;
    const origText = btnEl?.textContent;
    await startPayment({
      planId:   cfg.planId,
      amount:   cfg.price,
      planName: cfg.name,
      orderId,
      isAddon:  true,
      btnEl,
      btnOrigText: origText,
      onSuccess: () => activateCompanion(persona),
    });
  };

  // ── handlePersonaSettingsChange — called by settings <select> ──
  // Reverts dropdown cleanly without triggering selectPersona('') side-effects
  window.handlePersonaSettingsChange = function(selectEl) {
    const persona   = selectEl.value;
    const prevValue = (typeof state !== 'undefined' ? state.aiPersona : null) || '';

    if (persona === 'boyfriend' || persona === 'girlfriend') {
      if (!isCompanionUnlocked(persona)) {
        // Revert dropdown to previous value immediately — before any modal opens
        selectEl.value = prevValue;
        openCompanionGateModal(persona);
        return;
      }
    }
    // Free or already unlocked — call original
    if (typeof _origSelectPersona === 'function') _origSelectPersona(persona);
    else if (typeof window.selectPersona === 'function') window.selectPersona(persona);
  };

  // ── Intercept selectPersona globally (for persona modal card clicks) ──
  const _origSelectPersona = window.selectPersona;
  window.selectPersona = function(persona) {
    if (persona === 'boyfriend' || persona === 'girlfriend') {
      if (!isCompanionUnlocked(persona)) {
        if (typeof closePersonaSelector === 'function') closePersonaSelector();
        openCompanionGateModal(persona);
        return; // block — do NOT call original
      }
    }
    // Free or unlocked — pass through to app.js original
    if (typeof _origSelectPersona === 'function') _origSelectPersona(persona);
  };

  /* ─── INIT ──────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(checkPendingOnLoad, 1500));
  } else {
    setTimeout(checkPendingOnLoad, 1500);
  }

  // ── Add lock badges to BF/GF persona cards on load ─────────────
  function refreshCompanionLockUI() {
    const bfUnlocked = isCompanionUnlocked('boyfriend');
    const gfUnlocked = isCompanionUnlocked('girlfriend');

    // Persona modal cards
    document.querySelectorAll('[data-companion-lock="true"]').forEach(card => {
      const isBF = card.onclick?.toString().includes('boyfriend') ||
                   card.getAttribute('onclick')?.includes('boyfriend');
      const unlocked = isBF ? bfUnlocked : gfUnlocked;

      // Remove existing badge first
      card.querySelector('.companion-lock-badge')?.remove();

      if (!unlocked) {
        const badge = document.createElement('span');
        badge.className = 'companion-lock-badge';
        badge.textContent = '🔒 ₹49';
        badge.style.cssText = `
          position:absolute; top:8px; right:8px;
          font-size:10px; font-weight:700;
          background:rgba(255,107,157,0.2);
          border:1px solid rgba(255,107,157,0.4);
          color:#FF6B9D; padding:2px 7px;
          border-radius:20px; pointer-events:none;
        `;
        card.style.position = 'relative';
        card.appendChild(badge);
      }
    });

    // Settings dropdown options — update lock text
    const sel = document.getElementById('personaSettingsSelect');
    if (sel) {
      const bfOpt = sel.querySelector('option[value="boyfriend"]');
      const gfOpt = sel.querySelector('option[value="girlfriend"]');
      if (bfOpt) bfOpt.textContent = bfUnlocked ? '💕 Boyfriend' : '💕 Boyfriend 🔒';
      if (gfOpt) gfOpt.textContent = gfUnlocked ? '💕 Girlfriend' : '💕 Girlfriend 🔒';
    }
  }

  // Run on load + whenever persona modal opens
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(refreshCompanionLockUI, 800));
  } else {
    setTimeout(refreshCompanionLockUI, 800);
  }

  // Patch showPersonaSelector to refresh badges each time modal opens
  const _origShowPersonaSelector = window.showPersonaSelector;
  window.showPersonaSelector = function() {
    if (typeof _origShowPersonaSelector === 'function') _origShowPersonaSelector();
    setTimeout(refreshCompanionLockUI, 50);
  };

  console.log('[payment.js] v2.1 loaded — using Cloud Run backend for order creation');

})();
