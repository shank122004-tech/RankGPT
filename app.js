'use strict';

// ===== CONFIGURATION =====


// ── API endpoints: relative paths → Firebase Hosting rewrites → Functions
// Never call *.a.run.app directly — those URLs bypass your CORS config.
const DEEPSEEK_API_URL    = "/api/deepseek";
const GEMINI_API_URL      = "/api/gemini";
const CASHFREE_ORDER_URL  = "/api/create-cashfree-order";
const VERIFY_PAYMENT_URL  = "/api/verify-payment";
// DeepSeek Configuration
const DEEPSEEK_MODEL = 'deepseek-chat';



const APP_NAME = 'SSC PrepAI';
const FREE_TEXT_LIMIT = 100;
const FREE_IMAGE_LIMIT = 5;
const FREE_PDF_LIMIT = 2;
// CASHFREE_APP_ID removed — SDK is initialized server-side via Secret Manager
const PREMIUM_PRICE = 199;
const PREMIUM_CLASS10_PRICE = 99;
const PREMIUM_CLASS12_PRICE = 99;

// Premium plan types
const PREMIUM_PLANS = {
  ssc: { id: 'ssc', name: 'SSC Pro', price: 199, label: 'SSC Exams' },
  class10: { id: 'class10', name: 'Class 10 Pro', price: 99, label: 'Class 10th' },
  class12: { id: 'class12', name: 'Class 12 Pro', price: 99, label: 'Class 12th' },
};

// ─────────────────────────────────────────────────────────────
// ██████╗ ███████╗██╗    ██╗ █████╗ ██████╗ ██████╗ ███████╗██████╗
// ██╔══██╗██╔════╝██║    ██║██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗
// ██████╔╝█████╗  ██║ █╗ ██║███████║██████╔╝██║  ██║█████╗  ██║  ██║
// ██╔══██╗██╔══╝  ██║███╗██║██╔══██║██╔══██╗██║  ██║██╔══╝  ██║  ██║
// ██║  ██║███████╗╚███╔███╔╝██║  ██║██║  ██║██████╔╝███████╗██████╔╝
//  MONETIZATION SYSTEM v1.0 — SSC PrepAI
// ─────────────────────────────────────────────────────────────

// ── REWARDED ADS CONFIG ──────────────────────────────────────
const REWARD_DURATION_MS = 60 * 60 * 1000; // 1 hour in ms
const REWARD_CHAT_BONUS    = 9999;          // effectively unlimited
const REWARD_UPLOAD_BONUS  = 15;
const LS_REWARD_KEY        = 'sscai_reward_unlock';

// ── USER TIER HELPERS ────────────────────────────────────────
function getUserTier() {
  if (state.isPremium) return 'premium';
  if (isRewardActive()) return 'rewarded';
  return 'free';
}

// ── REWARD STATE ─────────────────────────────────────────────
function getRewardState() {
  try { return JSON.parse(localStorage.getItem(LS_REWARD_KEY) || 'null'); } catch(e) { return null; }
}
function setRewardState(data) {
  localStorage.setItem(LS_REWARD_KEY, JSON.stringify(data));
}
function clearRewardState() {
  localStorage.removeItem(LS_REWARD_KEY);
}
function isRewardActive() {
  const r = getRewardState();
  if (!r) return false;
  return (Date.now() - r.activatedAt) < REWARD_DURATION_MS;
}
function rewardRemainingMs() {
  const r = getRewardState();
  if (!r) return 0;
  const elapsed = Date.now() - r.activatedAt;
  return Math.max(0, REWARD_DURATION_MS - elapsed);
}
function rewardRemainingLabel() {
  const ms = rewardRemainingMs();
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ── REWARD LIMIT OVERRIDES ───────────────────────────────────
// Patch the canSend* functions to respect reward tier
const _origCanSendText  = () => state.isPremium || state.textCount  < FREE_TEXT_LIMIT;
const _origCanSendImage = () => state.isPremium || state.imageCount < FREE_IMAGE_LIMIT;
const _origCanSendPdf   = () => state.isPremium || state.pdfCount   < FREE_PDF_LIMIT;

// ── MODULAR AD PROVIDER INTERFACE ───────────────────────────
// Replace these functions to connect Monetag or any ad provider.
// All ad logic is isolated here — nothing else needs to change.

const AdProvider = {
  /**
   * showRewardedAd()
   * Called when user clicks "Watch Sponsored Content".
   * Replace this stub with your actual Monetag / AdSense call.
   * Must return a Promise that resolves with { success: boolean }.
   */
  showRewardedAd: function() {
    return new Promise((resolve) => {
      // ── STUB: Simulate a 3-second ad view ──────────────────
      // TODO: Replace with Monetag SDK call, e.g.:
      //   window.monetag?.showRewardedAd?.().then(r => resolve({ success: !!r }));
      const adModal = document.getElementById('adSimulatorModal');
      if (adModal) {
        adModal.classList.add('active');
        let countdown = 5;
        const countEl = document.getElementById('adCountdown');
        const skipBtn = document.getElementById('adSkipBtn');
        const prog    = document.getElementById('adProgressBar');
        if (countEl) countEl.textContent = countdown;
        if (skipBtn) skipBtn.style.display = 'none';

        const interval = setInterval(() => {
          countdown--;
          if (countEl) countEl.textContent = countdown;
          if (prog)    prog.style.width = `${((5 - countdown) / 5) * 100}%`;
          if (countdown <= 0) {
            clearInterval(interval);
            if (skipBtn) { skipBtn.style.display = 'block'; }
          }
        }, 1000);

        // skip button closes ad & resolves
        document.getElementById('adSkipBtn')?.addEventListener('click', function handler() {
          this.removeEventListener('click', handler);
          clearInterval(interval);
          adModal.classList.remove('active');
          resolve({ success: true });
        }, { once: true });
      } else {
        // fallback: instant resolve (no ad UI available)
        setTimeout(() => resolve({ success: true }), 1500);
      }
    });
  },

  /**
   * showBannerAd(containerId)
   * Renders a banner/native ad inside the given container element.
   * Replace with Monetag native ad code.
   */
  showBannerAd: function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    // TODO: Replace innerHTML with Monetag/AdSense banner tag
    container.innerHTML = `
      <div class="native-ad-card">
        <div class="native-ad-label">Sponsored</div>
        <div class="native-ad-content">
          <div class="native-ad-icon">📚</div>
          <div class="native-ad-text">
            <div class="native-ad-title">Boost Your SSC Prep</div>
            <div class="native-ad-desc">Premium study materials for SSC CGL 2025</div>
          </div>
          <div class="native-ad-cta">Learn More</div>
        </div>
      </div>`;
  }
};

// ── REWARD UNLOCK FLOW ───────────────────────────────────────
let _rewardCountdownInterval = null;

function showRewardPopup() {
  // Don't show if already premium or reward active
  if (state.isPremium) { openPremiumModal(); return; }
  if (isRewardActive()) { showToast('⚡ Unlimited mode already active! ' + rewardRemainingLabel() + ' left.'); return; }
  const popup = document.getElementById('rewardPopup');
  if (popup) popup.classList.add('active');
}

function closeRewardPopup() {
  const popup = document.getElementById('rewardPopup');
  if (popup) popup.classList.remove('active');
}

async function triggerRewardedAd() {
  closeRewardPopup();

  // Show loading state
  showToast('⏳ Loading sponsored content...');

  try {
    const result = await AdProvider.showRewardedAd();
    if (result && result.success) {
      activateRewardUnlock();
    } else {
      showToast('⚠️ Ad not completed. Please try again.');
    }
  } catch(e) {
    showToast('⚠️ Could not load ad. Try again shortly.');
  }
}

function activateRewardUnlock() {
  // Prevent double-activation abuse
  if (isRewardActive()) return;

  setRewardState({ activatedAt: Date.now(), version: 1 });
  updateRewardBadge();
  startRewardCountdown();
  updateLimitUI();
  updateUserUI();

  showToast('🚀 Unlimited mode active for 1 hour!', 3500);

  // Show reward active banner in header
  const badge = document.getElementById('rewardActiveBadge');
  if (badge) badge.style.display = 'flex';
}

function startRewardCountdown() {
  clearInterval(_rewardCountdownInterval);
  updateRewardBadge();
  _rewardCountdownInterval = setInterval(() => {
    if (!isRewardActive()) {
      clearInterval(_rewardCountdownInterval);
      expireReward();
      return;
    }
    updateRewardBadge();
  }, 1000);
}

function expireReward() {
  clearRewardState();
  updateLimitUI();
  updateUserUI();
  const badge = document.getElementById('rewardActiveBadge');
  if (badge) badge.style.display = 'none';
  showToast('⏰ Unlimited mode expired. Watch another ad to re-unlock!', 4000);
}

function updateRewardBadge() {
  const countdownEl = document.getElementById('rewardCountdown');
  if (countdownEl) countdownEl.textContent = rewardRemainingLabel();
  const drawerBadge = document.getElementById('drawerRewardTimer');
  if (drawerBadge) drawerBadge.textContent = isRewardActive() ? '⚡ ' + rewardRemainingLabel() : '';
}

// Resume countdown if page is refreshed mid-reward
function resumeRewardIfActive() {
  if (isRewardActive()) {
    updateRewardBadge();
    startRewardCountdown();
    const badge = document.getElementById('rewardActiveBadge');
    if (badge) badge.style.display = 'flex';
    updateLimitUI();
  }
}

// ── NATIVE AD RENDERING ──────────────────────────────────────
function renderNativeAds() {
  if (state.isPremium) return; // no ads for premium users
  ['settingsAdSlot', 'profileAdSlot', 'drawerAdSlot'].forEach(id => {
    AdProvider.showBannerAd(id);
  });
}

// ── LIMIT GATE WITH REWARD OFFER ─────────────────────────────
// Intercept limit hits and offer reward instead of just blocking
function handleLimitHit(type) {
  const tier = getUserTier();
  if (tier === 'free') {
    // Offer reward unlock
    showRewardPopup();
  } else {
    openPremiumModal();
  }
}

// ===== PER-USER localStorage NAMESPACE =====
// All user-specific data is keyed by UID: "sscai_u:{uid}:{key}"
// Global keys (not per-user): sscai_theme, sscai_active_uid

function _up(uid) { return uid ? ('sscai_u:' + uid + ':') : 'sscai_guest:'; }

function loadUserState(uid) {
  var p = _up(uid);
  state.chatSessions     = JSON.parse(localStorage.getItem(p+'sessions') || '[]');
  state.currentSessionId = localStorage.getItem(p+'current_session');
  state.textCount        = parseInt(localStorage.getItem(p+'text_count') || '0');
  state.imageCount       = parseInt(localStorage.getItem(p+'image_count') || '0');
  state.pdfCount         = parseInt(localStorage.getItem(p+'pdf_count') || '0');
  state.chatCountDate    = localStorage.getItem(p+'chat_date') || '';
  state.aiLang           = localStorage.getItem(p+'lang') || 'hinglish';
  state.isPremium        = localStorage.getItem(p+'premium') === 'true';
  state.premiumPlan      = localStorage.getItem(p+'premium_plan') || null;
  state.sscMode          = localStorage.getItem(p+'mode') || 'cgl';
  state.cachingEnabled   = localStorage.getItem(p+'caching') !== 'false';
  state.shortResponseMode= localStorage.getItem(p+'short_response') === 'true';
  state.limitHistoryMode = localStorage.getItem(p+'limit_history') === 'true';
  state.noSystemPrompt   = localStorage.getItem(p+'no_sysprompt') === 'true';
  state.bookmarks        = JSON.parse(localStorage.getItem(p+'bookmarks') || '[]');
  state.streakDays       = parseInt(localStorage.getItem(p+'streak') || '0');
  state.lastActiveDate   = localStorage.getItem(p+'last_active') || '';
  state.totalSolved      = parseInt(localStorage.getItem(p+'total_solved') || '0');
  try { state.responseCache = JSON.parse(localStorage.getItem(p+'cache') || '{}'); } catch(e) { state.responseCache = {}; }
}

function clearUserState() {
  state.chatSessions=[]; state.currentSessionId=null;
  state.textCount=0; state.imageCount=0; state.pdfCount=0;
  state.chatCountDate=''; state.aiLang='hinglish'; state.isPremium=false;
  state.premiumPlan=null;
  state.sscMode='cgl'; state.cachingEnabled=true; state.shortResponseMode=false;
  state.limitHistoryMode=false; state.noSystemPrompt=false;
  state.responseCache={}; state.bookmarks=[];
  state.streakDays=0; state.lastActiveDate=''; state.totalSolved=0;
  currentMessages=[];
}

// ===== STATE =====
let state = {
  theme: localStorage.getItem('sscai_theme') || 'dark',
  user: null,
  firebaseUser: null,
  chatSessions: [],
  currentSessionId: null,
  textCount: 0, imageCount: 0, pdfCount: 0,
  chatCountDate: '',
  aiLang: 'hinglish',
  isPremium: false,
  premiumPlan: null, // 'ssc' | 'class10' | 'class12'
  sscMode: 'cgl',
  cachingEnabled: true,
  shortResponseMode: false,
  limitHistoryMode: false,
  noSystemPrompt: false,
  responseCache: {},
  bookmarks: [],
  streakDays: 0,
  lastActiveDate: '',
  totalSolved: 0,
};

// Restore last active user on page load for instant paint
(function() {
  var lastUid = localStorage.getItem('sscai_active_uid');
  if (lastUid) {
    try { state.user = JSON.parse(localStorage.getItem('sscai_u:'+lastUid+':user') || 'null'); } catch(e) {}
  }
  if (state.user) loadUserState(state.user.uid);
})();

let currentMessages = [];
let isSending = false;
let pendingImageFiles = [];
let pendingPdfFile = null;
let currentAiMsgDiv = null;

// ===== DOM =====
const dom = {
  authScreen: document.getElementById('authScreen'),
  app: document.getElementById('app'),
  messages: document.getElementById('messages'),
  messagesContainer: document.getElementById('messagesContainer'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  menuBtn: document.getElementById('menuBtn'),
  drawer: document.getElementById('historyDrawer'),
  drawerOverlay: document.getElementById('drawerOverlay'),
  closeDrawerBtn: document.getElementById('closeDrawerBtn'),
  historyList: document.getElementById('historyList'),
  newChatBtn: document.getElementById('newChatBtn'),
  clearAllHistoryBtn: document.getElementById('clearAllHistoryBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  darkModeToggle: document.getElementById('darkModeToggle'),
  aiLangSelect: document.getElementById('aiLangSelect'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  voiceInputBtn: document.getElementById('voiceInputBtn'),
  aiStatus: document.getElementById('aiStatus'),
  toast: document.getElementById('toast'),
  headerAvatar: document.getElementById('headerAvatar'),
  drawerAvatar: document.getElementById('drawerAvatar'),
  drawerUserName: document.getElementById('drawerUserName'),
  drawerUserPlan: document.getElementById('drawerUserPlan'),
  welcomeScreen: document.getElementById('welcomeScreen'),
  profileModal: document.getElementById('profileModal'),
  closeProfileBtn: document.getElementById('closeProfileBtn'),
  loginShowBtn: null,
  signupShowBtn: null,
  loginForm: document.getElementById('loginForm'),
  signupForm: document.getElementById('signupForm'),
  profileLoggedOut: document.getElementById('profileLoggedOut'),
  profileLoggedIn: document.getElementById('profileLoggedIn'),
  loginBtn: null,
  signupBtn: null,
  switchToSignup: null,
  switchToLogin: null,
  logoutBtn: document.getElementById('logoutBtn'),
  profileAvatar: document.getElementById('profileAvatar'),
  profileName: document.getElementById('profileName'),
  profileEmail: document.getElementById('profileEmail'),
  profileMobile: document.getElementById('profileMobile'),
  profileSubscription: document.getElementById('profileSubscription'),
  profileSince: document.getElementById('profileSince'),
  profileBadge: document.getElementById('profileBadge'),
  upgradeFromProfileBtn: document.getElementById('upgradeFromProfileBtn'),
  upgradeFromSettingsBtn: document.getElementById('upgradeFromSettingsBtn'),
  premiumModal: document.getElementById('premiumModal'),
  closePremiumBtn: document.getElementById('closePremiumBtn'),
  payWithCashfreeBtn: document.getElementById('payWithCashfreeBtn'),
  termsLink: document.getElementById('termsLink'),
  privacyLink: document.getElementById('privacyLink'),
  termsModal: document.getElementById('termsModal'),
  privacyModal: document.getElementById('privacyModal'),
  closeTermsBtn: document.getElementById('closeTermsBtn'),
  closePrivacyBtn: document.getElementById('closePrivacyBtn'),
  imageUploadBtn: document.getElementById('imageUploadBtn'),
  imageInput: document.getElementById('imageInput'),
  pdfUploadBtn: document.getElementById('pdfUploadBtn'),
  pdfInput: document.getElementById('pdfInput'),
  attachmentPreview: document.getElementById('attachmentPreview'),
  sscModeSelect: document.getElementById('sscModeSelect'),
  bookmarksBtn: document.getElementById('bookmarksBtn'),
  bookmarksModal: document.getElementById('bookmarksModal'),
  closeBookmarksBtn: document.getElementById('closeBookmarksBtn'),
  bookmarksList: document.getElementById('bookmarksList'),
  messageLimitInfo: document.getElementById('messageLimitInfo'),
};

// ===== TOAST =====
function showToast(message, duration = 2500) {
  if (!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.classList.add('show');
  setTimeout(() => dom.toast.classList.remove('show'), duration);
}

// ===== SAVE STATE =====
function saveState() {
  var uid = state.user ? state.user.uid : null;
  var p = _up(uid);
  // Save user identity in two places: per-uid slot + active uid pointer
  if (state.user) {
    localStorage.setItem('sscai_u:' + uid + ':user', JSON.stringify(state.user));
    localStorage.setItem('sscai_active_uid', uid);
  }
  // Global pref
  localStorage.setItem('sscai_theme', state.theme);
  // Per-user data
  localStorage.setItem(p+'sessions', JSON.stringify(state.chatSessions));
  if (state.currentSessionId) localStorage.setItem(p+'current_session', state.currentSessionId);
  localStorage.setItem(p+'text_count', state.textCount);
  localStorage.setItem(p+'image_count', state.imageCount);
  localStorage.setItem(p+'pdf_count', state.pdfCount);
  localStorage.setItem(p+'chat_date', state.chatCountDate);
  localStorage.setItem(p+'lang', state.aiLang);
  localStorage.setItem(p+'premium', state.isPremium);
  localStorage.setItem(p+'premium_plan', state.premiumPlan || '');
  localStorage.setItem(p+'mode', state.sscMode);
  localStorage.setItem(p+'caching', state.cachingEnabled);
  localStorage.setItem(p+'short_response', state.shortResponseMode);
  localStorage.setItem(p+'limit_history', state.limitHistoryMode);
  localStorage.setItem(p+'no_sysprompt', state.noSystemPrompt);
  localStorage.setItem(p+'bookmarks', JSON.stringify(state.bookmarks));
  localStorage.setItem(p+'streak', state.streakDays);
  localStorage.setItem(p+'last_active', state.lastActiveDate);
  localStorage.setItem(p+'total_solved', state.totalSolved);
  const cacheKeys = Object.keys(state.responseCache);
  if (cacheKeys.length > 100) {
    const trimmed = {};
    cacheKeys.slice(-100).forEach(k => { trimmed[k] = state.responseCache[k]; });
    state.responseCache = trimmed;
  }
  try { localStorage.setItem(p+'cache', JSON.stringify(state.responseCache)); } catch(e) {}
}

// ===== DAILY LIMITS =====
function resetDailyCounts() {
  const today = new Date().toDateString();
  if (state.chatCountDate !== today) {
    state.textCount = 0; state.imageCount = 0; state.pdfCount = 0;
    state.chatCountDate = today; saveState();
  }
  updateLimitUI(); updateStreak();
}

function canSendText()  { return state.isPremium || isRewardActive() || state.textCount  < FREE_TEXT_LIMIT; }
function canSendImage() { return state.isPremium || isRewardActive() || state.imageCount < FREE_IMAGE_LIMIT; }
function canSendPdf()   { return state.isPremium || isRewardActive() || state.pdfCount   < FREE_PDF_LIMIT; }

function incrementCount(type) {
  if (type === 'text') state.textCount++;
  else if (type === 'image') state.imageCount++;
  else if (type === 'pdf') state.pdfCount++;
  state.totalSolved++; saveState(); updateLimitUI();
}

function updateLimitUI() {
  if (!dom.messageLimitInfo) return;
  if (state.isPremium) {
    dom.messageLimitInfo.innerHTML = '<span style="color:#f59e0b">⭐ Premium: Unlimited</span>';
  } else if (isRewardActive()) {
    dom.messageLimitInfo.innerHTML = `<span style="color:#22d3ee">⚡ Unlimited mode · <span id="inlinRewardTimer">${rewardRemainingLabel()}</span> left</span>`;
  } else {
    dom.messageLimitInfo.innerHTML = `💬 ${FREE_TEXT_LIMIT - state.textCount} text · 🖼️ ${FREE_IMAGE_LIMIT - state.imageCount} img · 📄 ${FREE_PDF_LIMIT - state.pdfCount} pdf`;
  }
}

function updateStreak() {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (state.lastActiveDate === yesterday) state.streakDays++;
  else if (state.lastActiveDate !== today) state.streakDays = 1;
  state.lastActiveDate = today; saveState();
}

// ===== SYSTEM PROMPT =====
function getSystemPrompt() {
  if (state.noSystemPrompt) return '';
  const langMap = { hinglish: 'Always respond in Hinglish (Hindi + English mix). Example: "Bhai, yeh formula important hai SSC ke liye!"', hindi: 'Always respond in Hindi (Romanized script).', english: 'Always respond in clear, simple English.' };
  const modeMap = {
    cgl: 'SSC CGL (Tier 1 & 2: Quant, English, Reasoning, GK)',
    chsl: 'SSC CHSL (10+2 level)',
    gd: 'SSC GD Constable',
    mts: 'SSC MTS (10th level)',
    cpo: 'SSC CPO/SI',
    class1: 'Class 1 (CBSE/NCERT: Basic English, Numbers, EVS)',
    class2: 'Class 2 (CBSE/NCERT: English, Math, EVS)',
    class3: 'Class 3 (CBSE/NCERT: English, Math, EVS)',
    class4: 'Class 4 (CBSE/NCERT: English, Math, Science, EVS)',
    class5: 'Class 5 (CBSE/NCERT: English, Math, Science, Social)',
    class6: 'Class 6 (CBSE/NCERT: Math, Science, Social Science, English, Hindi)',
    class7: 'Class 7 (CBSE/NCERT: Math, Science, Social Science, English, Hindi)',
    class8: 'Class 8 (CBSE/NCERT: Math, Science, Social Science, English, Hindi)',
    class9: 'Class 9 (CBSE/NCERT: Math, Science, Social Science, English, Hindi)',
    class10: 'Class 10 Board Exam (CBSE/NCERT: Math, Science, Social Science, English, Hindi)',
    class11_sci: 'Class 11 Science (CBSE/NCERT: Physics, Chemistry, Math/Biology, English)',
    class11_com: 'Class 11 Commerce (CBSE/NCERT: Accounts, Business Studies, Economics, Math)',
    class11_arts: 'Class 11 Arts/Humanities (CBSE/NCERT: History, Geography, Political Science, Economics)',
    class12_sci: 'Class 12 Science Board Exam (CBSE/NCERT: Physics, Chemistry, Math/Biology, English)',
    class12_com: 'Class 12 Commerce Board Exam (CBSE/NCERT: Accounts, Business Studies, Economics, Math)',
    class12_arts: 'Class 12 Arts/Humanities Board Exam (CBSE/NCERT: History, Geography, Political Science, Economics)',
  };
  const wordLimit = state.shortResponseMode ? 120 : 250;
  const modeDesc = modeMap[state.sscMode] || 'general education';
  const isClassMode = state.sscMode.startsWith('class');
  if (isClassMode) {
    return `You are PrepAI, an expert tutor for ${modeDesc}.
${langMap[state.aiLang]}
Rules:
- Use NCERT/CBSE syllabus as the primary reference
- Give clear, step-by-step explanations suitable for the grade level
- Use simple language appropriate for students
- Keep responses under ${wordLimit} words
- End with a memory tip or exam trick
- For math/science: show step-by-step solutions
Topics: Follow the official CBSE/NCERT syllabus for this class.`;
  }
  return `You are PrepAI, an expert SSC exam tutor focused on ${modeDesc}.
${langMap[state.aiLang]}
Rules:
- Formulas and shortcuts first
- Use real SSC exam examples
- Keep responses under ${wordLimit} words
- End with a quick tip or trick
- For math: show step-by-step solution
Topics: Quant (Arithmetic, Algebra, Geometry, Trigonometry), English, Reasoning, GK/Current Affairs.`;
}

// ===== AI CALLS =====
async function callAI(userMessage, chatHistory = [], imageBase64Array = [], pdfBase64 = null) {
  const hasImage = imageBase64Array.length > 0;
  const hasPdf = !!pdfBase64;
  if (hasImage || hasPdf) {
    if (dom.aiStatus) dom.aiStatus.innerHTML = '● 🔍 Vision AI Solving...';
    return await callGeminiVision(userMessage, chatHistory, imageBase64Array, pdfBase64);
  } else {
    if (dom.aiStatus) dom.aiStatus.innerHTML = '● 🧠 AI Thinking...';
    return await callDeepSeek(userMessage, chatHistory);
  }
}

async function callDeepSeek(userMessage, chatHistory = []) {
  if (state.cachingEnabled) {
    const cacheKey = `ds:${state.aiLang}:${state.sscMode}:${userMessage.trim().toLowerCase().substring(0, 100)}`;
    if (state.responseCache[cacheKey]) return state.responseCache[cacheKey];
  }
  
  // Get Firebase token
  const firebaseUser = window._firebaseAuth?.currentUser;
  if (!firebaseUser) {
    throw new Error("Please login first");
  }
  
  const token = await firebaseUser.getIdToken();
  
  const historyLimit = state.limitHistoryMode ? 2 : 6;
  const messages = [];
  const systemPrompt = getSystemPrompt();
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  chatHistory.slice(-historyLimit).forEach(m => messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
  messages.push({ role: 'user', content: userMessage });
  
  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      max_tokens: state.shortResponseMode ? 300 : 800,
      temperature: 0.7
    })
  });
  
  if (!response.ok) { 
    const errData = await response.json().catch(() => ({})); 
    throw new Error(`DeepSeek Error ${response.status}: ${errData?.error?.message || 'Unknown'}`); 
  }
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  const result = text || 'Sorry, kuch ho gaya. Please try again.';
  if (state.cachingEnabled && text) {
    const cacheKey = `ds:${state.aiLang}:${state.sscMode}:${userMessage.trim().toLowerCase().substring(0, 100)}`;
    state.responseCache[cacheKey] = result; 
    saveState();
  }
  return result;
}

async function callGeminiVision(userMessage, chatHistory = [], imageBase64Array = [], pdfBase64 = null) {
  // Get Firebase token
  const firebaseUser = window._firebaseAuth?.currentUser;
  if (!firebaseUser) {
    throw new Error("Please login first");
  }
  
  const token = await firebaseUser.getIdToken();
  
  const historyLimit = state.limitHistoryMode ? 2 : 4;
  const recentHistory = chatHistory.slice(-historyLimit).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
  const userParts = [];
  imageBase64Array.forEach(img => userParts.push({ inline_data: { mime_type: img.mimeType, data: img.data } }));
  if (pdfBase64) userParts.push({ inline_data: { mime_type: 'application/pdf', data: pdfBase64 } });
  userParts.push({ text: userMessage });
  const systemPrompt = getSystemPrompt();
  const body = { 
    ...(systemPrompt ? { system_instruction: { parts: [{ text: systemPrompt }] } } : {}), 
    contents: [...recentHistory, { role: 'user', parts: userParts }], 
    generationConfig: { temperature: 0.7, maxOutputTokens: state.shortResponseMode ? 300 : 800, topP: 0.9 } 
  };
  
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) { 
    const errData = await response.json().catch(() => ({})); 
    throw new Error(`Gemini Error ${response.status}: ${errData?.error?.message || 'Unknown'}`); 
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, image/PDF analyze nahi ho paya.';
}

// ===== MARKDOWN =====
function formatMarkdown(text) {
  if (!text) return '';

  function esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Extract fenced code blocks first
  const codeBlocks = [];
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, function(_, lang, code) {
    var idx = codeBlocks.length;
    var langLabel = lang ? '<span class="cb-lang">' + esc(lang) + '</span>' : '';
    codeBlocks.push(
      '<div class="code-block">' +
        '<div class="cb-header">' + langLabel +
          '<button class="cb-copy" onclick="(function(b){var p=b.closest(\'.code-block\').querySelector(\'code\');navigator.clipboard.writeText(p.innerText);b.textContent=\'Copied!\';setTimeout(function(){b.textContent=\'Copy\'},1500);})(this)">Copy</button>' +
        '</div>' +
        '<pre><code>' + esc(code.trim()) + '</code></pre>' +
      '</div>'
    );
    return '\x00CODE' + idx + '\x00';
  });

  function inlineFormat(s) {
    return s
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>');
  }

  var lines = text.split('\n');
  var out = [];
  var inUL = false, inOL = false;

  function closeList() {
    if (inUL) { out.push('</ul>'); inUL = false; }
    if (inOL) { out.push('</ol>'); inOL = false; }
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var h3 = line.match(/^### (.+)/);
    var h2 = line.match(/^## (.+)/);
    var h1 = line.match(/^# (.+)/);
    var hr = /^---+$/.test(line.trim());
    var ul = line.match(/^[-*]\s+(.+)/);
    var ol = line.match(/^\d+\.\s+(.+)/);

    if (h3) { closeList(); out.push('<h3>' + inlineFormat(esc(h3[1])) + '</h3>'); continue; }
    if (h2) { closeList(); out.push('<h2>' + inlineFormat(esc(h2[1])) + '</h2>'); continue; }
    if (h1) { closeList(); out.push('<h1>' + inlineFormat(esc(h1[1])) + '</h1>'); continue; }
    if (hr) { closeList(); out.push('<hr class="md-hr">'); continue; }

    if (ul) {
      if (inOL) { out.push('</ol>'); inOL = false; }
      if (!inUL) { out.push('<ul>'); inUL = true; }
      out.push('<li>' + inlineFormat(esc(ul[1])) + '</li>');
      continue;
    }
    if (ol) {
      if (inUL) { out.push('</ul>'); inUL = false; }
      if (!inOL) { out.push('<ol>'); inOL = true; }
      out.push('<li>' + inlineFormat(esc(ol[1])) + '</li>');
      continue;
    }

    if (line.trim() === '') { closeList(); out.push('<br>'); continue; }

    closeList();
    out.push('<p>' + inlineFormat(esc(line)) + '</p>');
  }
  closeList();

  var html = out.join('\n');
  // Restore code blocks
  html = html.replace(/\x00CODE(\d+)\x00/g, function(_, i) { return codeBlocks[i]; });
  // Clean leading/trailing breaks
  html = html.replace(/^(<br>\s*\n?)+/, '').replace(/(<br>\s*\n?)+$/, '');
  return html;
}

// ===== MESSAGES =====
function addMessage(role, content, isStreaming = false, attachments = null) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // AI uses app logo SVG, user uses initials
  let avatarHtml;
  if (role === 'ai') {
    avatarHtml = `<div class="message-avatar ai-avatar-svg">
      <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
        <path d="M24 4L44 15V33L24 44L4 33V15L24 4Z" fill="url(#msgGrad${Date.now()})"/>
        <path d="M17 24h14M24 17v14" stroke="white" stroke-width="2.8" stroke-linecap="round"/>
        <defs><linearGradient id="msgGrad${Date.now()}" x1="4" y1="4" x2="44" y2="44"><stop stop-color="#6C63FF"/><stop offset="1" stop-color="#FF6B9D"/></linearGradient></defs>
      </svg>
    </div>`;
  } else {
    const userInitial = state.user?.name?.[0]?.toUpperCase() || 'U';
    avatarHtml = `<div class="message-avatar">${userInitial}</div>`;
  }

  let attachHtml = '';
  if (attachments?.images?.length) {
    attachHtml = `<div class="msg-attachments">${attachments.images.map(img =>
      `<img src="data:${img.mimeType};base64,${img.data}" class="msg-thumb" alt="uploaded image"/>`
    ).join('')}</div>`;
  }
  if (attachments?.pdfName) {
    attachHtml += `<div class="msg-pdf-badge">📄 ${escapeHtml(attachments.pdfName)}</div>`;
  }

  const actionBtns = role === 'ai' ? `
    <button class="msg-action-btn copy-btn" onclick="copyMessageContent(this)" title="Copy">📋</button>
    <button class="msg-action-btn bookmark-btn" onclick="bookmarkMessage(this)" title="Bookmark">🔖</button>
    <button class="msg-action-btn share-btn" onclick="shareMessage(this)" title="Share">📤</button>
  ` : '';

  messageDiv.innerHTML = `
    ${avatarHtml}
    <div class="message-content">
      ${attachHtml}
      <div class="message-bubble">${isStreaming ? content : formatMarkdown(content)}</div>
      <div class="message-meta">
        <span class="message-time">${time}</span>
        <div class="msg-actions">${actionBtns}</div>
      </div>
    </div>
  `;

  dom.messages.appendChild(messageDiv);
  scrollToBottom();
  return messageDiv;
}

function updateMessageBubble(messageDiv, content) {
  const bubble = messageDiv?.querySelector('.message-bubble');
  if (bubble) bubble.innerHTML = formatMarkdown(content);
  scrollToBottom();
}

function addTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message ai';
  typingDiv.id = 'typing-indicator';
  typingDiv.innerHTML = `
    <div class="message-avatar ai-avatar-svg">
      <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
        <path d="M24 4L44 15V33L24 44L4 33V15L24 4Z" fill="url(#typingGrad)"/>
        <path d="M17 24h14M24 17v14" stroke="white" stroke-width="2.8" stroke-linecap="round"/>
        <defs><linearGradient id="typingGrad" x1="4" y1="4" x2="44" y2="44"><stop stop-color="#6C63FF"/><stop offset="1" stop-color="#FF6B9D"/></linearGradient></defs>
      </svg>
    </div>
    <div class="message-content">
      <div class="message-bubble">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>
  `;
  dom.messages.appendChild(typingDiv);
  scrollToBottom();
}

function removeTypingIndicator() { document.getElementById('typing-indicator')?.remove(); }
function scrollToBottom() { setTimeout(() => { if (dom.messagesContainer) dom.messagesContainer.scrollTo({ top: dom.messagesContainer.scrollHeight, behavior: 'smooth' }); }, 100); }

// ===== MESSAGE ACTIONS =====
window.copyMessageContent = function(btn) {
  const bubble = btn.closest('.message-content')?.querySelector('.message-bubble');
  if (bubble) { navigator.clipboard.writeText(bubble.innerText); showToast('✅ Copied!'); }
};
window.bookmarkMessage = function(btn) {
  const bubble = btn.closest('.message-content')?.querySelector('.message-bubble');
  if (!bubble) return;
  const content = bubble.innerText.substring(0, 300);
  const bookmark = { id: Date.now(), content, time: new Date().toLocaleString('en-IN'), sessionId: state.currentSessionId };
  state.bookmarks.unshift(bookmark);
  if (state.bookmarks.length > 50) state.bookmarks = state.bookmarks.slice(0, 50);
  saveState(); btn.textContent = '✅'; setTimeout(() => { btn.textContent = '🔖'; }, 2000); showToast('🔖 Bookmarked!');
};
window.shareMessage = function(btn) {
  const bubble = btn.closest('.message-content')?.querySelector('.message-bubble');
  if (!bubble) return;
  const text = `SSC PrepAI Answer:\n\n${bubble.innerText.substring(0, 500)}\n\nPrepare with SSC PrepAI 🎯`;
  if (navigator.share) { navigator.share({ title: 'SSC PrepAI', text }).catch(() => {}); }
  else { navigator.clipboard.writeText(text); showToast('📋 Copied to clipboard!'); }
};

// ===== FOLLOW-UP =====
function addFollowUpSuggestions(previousQuestion) {
  const suggestions = getFollowUpSuggestions(previousQuestion);
  if (!suggestions.length) return;
  const suggestDiv = document.createElement('div');
  suggestDiv.className = 'followup-chips';
  suggestDiv.innerHTML = `<div class="followup-label">🔗 Ask follow-up:</div>` +
    suggestions.map(s => `<button class="followup-chip" onclick="sendFollowUp('${s.replace(/'/g, "\\'")}')">${s}</button>`).join('');
  dom.messages.appendChild(suggestDiv);
  scrollToBottom();
}
window.sendFollowUp = function(text) { dom.messageInput.value = text; sendMessage(); };
function getFollowUpSuggestions(question) {
  const q = question.toLowerCase();
  if (q.includes('formula') || q.includes('math')) return ['Give me practice questions', 'Show a trick to solve faster', 'Common mistakes in this topic?'];
  if (q.includes('grammar') || q.includes('english')) return ['Give me example sentences', 'Practice questions on this', 'Common errors in SSC?'];
  if (q.includes('reasoning') || q.includes('puzzle')) return ['Give me similar questions', 'What is the shortcut?', 'More examples please'];
  if (q.includes('gk') || q.includes('current affairs')) return ['Give me MCQs on this', 'What is asked in SSC exams?', 'Important related facts?'];
  return ['Give me MCQ practice', 'Explain more simply', 'Show exam tips for this topic'];
}

// ===== IMAGE HANDLING =====
function setupImageUpload() {
  if (!dom.imageUploadBtn || !dom.imageInput) return;
  dom.imageUploadBtn.addEventListener('click', () => dom.imageInput.click());
  dom.imageInput.addEventListener('change', handleImageSelect);
}
async function handleImageSelect(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  if (!canSendImage()) { showToast(`❌ Daily image limit reached!`); handleLimitHit('image'); return; }
  const MAX_SIZE = 4 * 1024 * 1024;
  for (const file of files) {
    if (file.size > MAX_SIZE) { showToast(`❌ ${file.name} too large. Max 4MB.`); continue; }
    const compressed = await compressImage(file);
    pendingImageFiles.push({ data: compressed.base64, mimeType: compressed.mimeType, name: file.name });
  }
  updateAttachmentPreview(); e.target.value = '';
  showToast(`🖼️ ${pendingImageFiles.length} image(s) ready. Type your question and send!`);
}
async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const MAX_DIM = 1024;
      let w = img.width, h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) { if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; } else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; } }
      canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
    };
    img.onerror = () => { const reader = new FileReader(); reader.onload = (e) => resolve({ base64: e.target.result.split(',')[1], mimeType: file.type }); reader.readAsDataURL(file); };
    img.src = url;
  });
}

// ===== PDF HANDLING =====
function setupPdfUpload() {
  if (!dom.pdfUploadBtn || !dom.pdfInput) return;
  dom.pdfUploadBtn.addEventListener('click', () => dom.pdfInput.click());
  dom.pdfInput.addEventListener('change', handlePdfSelect);
}
async function handlePdfSelect(e) {
  const file = e.target.files[0]; if (!file) return;
  if (!canSendPdf()) { showToast(`❌ Daily PDF limit reached!`); handleLimitHit('pdf'); return; }
  if (file.size > 10 * 1024 * 1024) { showToast('❌ PDF too large. Max 10MB.'); return; }
  const reader = new FileReader();
  reader.onload = (ev) => { pendingPdfFile = { data: ev.target.result.split(',')[1], name: file.name }; updateAttachmentPreview(); showToast(`📄 PDF "${file.name}" ready!`); };
  reader.readAsDataURL(file); e.target.value = '';
}
function updateAttachmentPreview() {
  if (!dom.attachmentPreview) return;
  const items = [];
  pendingImageFiles.forEach((img, i) => items.push(`<div class="attach-item"><img src="data:${img.mimeType};base64,${img.data}" class="attach-thumb" /><button onclick="removeImage(${i})" class="attach-remove">✕</button></div>`));
  if (pendingPdfFile) items.push(`<div class="attach-item attach-pdf"><span>📄 ${escapeHtml(pendingPdfFile.name)}</span><button onclick="removePdf()" class="attach-remove">✕</button></div>`);
  dom.attachmentPreview.innerHTML = items.join('');
  dom.attachmentPreview.style.display = items.length ? 'flex' : 'none';
}
window.removeImage = function(i) { pendingImageFiles.splice(i, 1); updateAttachmentPreview(); };
window.removePdf = function() { pendingPdfFile = null; updateAttachmentPreview(); };

// ===== SEND MESSAGE =====
async function sendMessage() {
  const message = dom.messageInput.value.trim();
  const hasImages = pendingImageFiles.length > 0;
  const hasPdf = !!pendingPdfFile;
  if (!message && !hasImages && !hasPdf) return;
  if (isSending) return;
  if (hasImages && !canSendImage()) { showToast(`❌ Daily image limit reached!`); handleLimitHit('image'); return; }
  if (hasPdf && !canSendPdf()) { showToast(`❌ Daily PDF limit reached!`); handleLimitHit('pdf'); return; }
  if (!canSendText()) { showToast(`❌ Daily text limit (${FREE_TEXT_LIMIT}) reached.`); handleLimitHit('text'); return; }
  isSending = true;
  dom.sendBtn.disabled = true;
  const msgText = message || (hasImages ? 'Solve this question from the image.' : 'Analyze this PDF and give key points.');
  dom.messageInput.value = '';
  dom.messageInput.style.height = 'auto';
  if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'none';
  const attachSnap = { images: [...pendingImageFiles], pdfName: pendingPdfFile?.name || null };
  const imageData = [...pendingImageFiles];
  const pdfData = pendingPdfFile ? pendingPdfFile.data : null;
  pendingImageFiles = []; pendingPdfFile = null; updateAttachmentPreview();
  addMessage('user', msgText, false, attachSnap);
  currentMessages.push({ role: 'user', content: msgText });
  addTypingIndicator();
  if (dom.aiStatus) dom.aiStatus.innerHTML = '● Processing...';
  try {
    const response = await callAI(msgText, currentMessages.slice(-10), imageData, pdfData);
    removeTypingIndicator();
    addMessage('ai', response);
    currentMessages.push({ role: 'ai', content: response });
    const type = imageData.length ? 'image' : (pdfData ? 'pdf' : 'text');
    incrementCount(type);
    if (dom.aiStatus) dom.aiStatus.innerHTML = '● AI Ready';
    saveCurrentSession(msgText);
    addFollowUpSuggestions(msgText);
  } catch (err) {
    removeTypingIndicator();
    addMessage('ai', `❌ Error: ${err.message}. Please try again.`);
    if (dom.aiStatus) dom.aiStatus.innerHTML = '● AI Ready';
  }
  isSending = false;
  dom.sendBtn.disabled = false;
}

// ===== SESSION MANAGEMENT =====
function createNewSession() {
  const id = `session_${Date.now()}`;
  const session = { id, title: 'New Chat', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
  state.chatSessions.unshift(session);
  state.currentSessionId = id;
  currentMessages = [];
  if (dom.messages) {
    dom.messages.innerHTML = '';
    if (dom.welcomeScreen) { dom.welcomeScreen.style.display = ''; dom.messages.appendChild(dom.welcomeScreen); }
  }
  saveState(); renderChatHistory();
}
function saveCurrentSession(lastUserMsg) {
  const session = state.chatSessions.find(s => s.id === state.currentSessionId);
  if (!session) return;
  session.messages = currentMessages;
  session.updatedAt = Date.now();
  if (session.messages.length <= 2) session.title = lastUserMsg.substring(0, 40) || 'Chat';
  saveState(); renderChatHistory();
}
function loadSession(id) {
  const session = state.chatSessions.find(s => s.id === id);
  if (!session) return;
  state.currentSessionId = id; currentMessages = session.messages || [];
  if (dom.messages) {
    dom.messages.innerHTML = '';
    if (!currentMessages.length) {
      if (dom.welcomeScreen) { dom.welcomeScreen.style.display = ''; dom.messages.appendChild(dom.welcomeScreen); }
    } else {
      if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'none';
      currentMessages.forEach(m => addMessage(m.role, m.content));
    }
  }
  saveState();
}
function renderChatHistory() {
  if (!dom.historyList) return;
  dom.historyList.innerHTML = '';
  if (!state.chatSessions.length) { dom.historyList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">No chat history yet</div>'; return; }
  state.chatSessions.forEach(session => {
    const date = new Date(session.updatedAt);
    const formattedDate = date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const item = document.createElement('div');
    item.className = `history-item ${session.id === state.currentSessionId ? 'active' : ''}`;
    item.innerHTML = `<div class="history-item-icon">💬</div><div class="history-item-content"><div class="history-item-title">${escapeHtml(session.title)}</div><div class="history-item-date">${formattedDate}</div></div><button class="history-item-delete" data-id="${session.id}">🗑️</button>`;
    item.addEventListener('click', (e) => { if (!e.target.classList.contains('history-item-delete')) { loadSession(session.id); closeDrawer(); } });
    item.querySelector('.history-item-delete').addEventListener('click', (e) => { e.stopPropagation(); deleteSession(session.id); });
    dom.historyList.appendChild(item);
  });
}
function deleteSession(id) {
  state.chatSessions = state.chatSessions.filter(s => s.id !== id);
  if (state.currentSessionId === id) { state.chatSessions.length ? loadSession(state.chatSessions[0].id) : createNewSession(); }
  saveState(); renderChatHistory(); showToast('Chat deleted');
}
function deleteAllSessions() {
  if (confirm('Delete all chat history? This cannot be undone.')) { state.chatSessions = []; createNewSession(); saveState(); renderChatHistory(); showToast('All history cleared'); }
}
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

// ===== DRAWER =====
function openDrawer() { dom.drawer.classList.add('open'); dom.drawerOverlay.classList.add('active'); renderChatHistory(); }
function closeDrawer() { dom.drawer.classList.remove('open'); dom.drawerOverlay.classList.remove('active'); }

// ===== THEME =====
function applyTheme(theme) { state.theme = theme; document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('sscai_theme', theme); if (dom.darkModeToggle) dom.darkModeToggle.checked = theme === 'dark'; }
function toggleTheme() { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); }

// ===== VOICE INPUT =====
function setupVoiceInput() {
  const voiceOverlay = document.getElementById('voiceOverlay');
  const voiceLabel   = document.getElementById('voiceLabel');
  const cancelBtn    = document.getElementById('voiceCancelBtn');

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    if (dom.voiceInputBtn) dom.voiceInputBtn.style.display = 'none';
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SR();
  recognition.lang = 'hi-IN';
  recognition.interimResults = false;
  recognition.continuous = false;

  let _active = false;

  function openVoiceOverlay() {
    _active = true;
    voiceOverlay.classList.remove('got-result');
    if (voiceLabel) voiceLabel.textContent = 'Listening…';
    voiceOverlay.classList.add('active');
    voiceOverlay.setAttribute('aria-hidden', 'false');
    dom.voiceInputBtn?.classList.add('recording');
  }

  function closeVoiceOverlay() {
    _active = false;
    voiceOverlay.classList.remove('active', 'got-result');
    voiceOverlay.setAttribute('aria-hidden', 'true');
    dom.voiceInputBtn?.classList.remove('recording');
  }

  dom.voiceInputBtn?.addEventListener('click', () => {
    if (_active) { recognition.abort(); closeVoiceOverlay(); return; }
    openVoiceOverlay();
    try { recognition.start(); } catch(e) { closeVoiceOverlay(); }
  });

  cancelBtn?.addEventListener('click', () => {
    recognition.abort();
    closeVoiceOverlay();
  });

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    // Flash green "Got it" state briefly
    if (voiceLabel) voiceLabel.textContent = `"${transcript}"`;
    voiceOverlay.classList.add('got-result');
    dom.messageInput.value = transcript;
    dom.messageInput.dispatchEvent(new Event('input'));
    setTimeout(() => {
      closeVoiceOverlay();
      if (transcript.trim()) sendMessage();
    }, 700);
  };

  recognition.onerror = (err) => {
    if (err.error === 'aborted') return; // user cancelled
    if (voiceLabel) voiceLabel.textContent = 'Didn\'t catch that…';
    setTimeout(closeVoiceOverlay, 1000);
  };

  recognition.onend = () => {
    // Only close if we didn't already handle it in onresult
    if (_active) setTimeout(closeVoiceOverlay, 300);
  };
}

// ===== USER UI =====
function updateUserUI() {
  const name = state.user?.name || 'Guest';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const plan = state.isPremium ? '⭐ Premium' : isRewardActive() ? '⚡ Unlimited (Reward)' : 'Free Plan';
  if (dom.headerAvatar) { dom.headerAvatar.textContent = ''; if (state.user?.photoURL) { dom.headerAvatar.style.backgroundImage = `url(${state.user.photoURL})`; dom.headerAvatar.style.backgroundSize = 'cover'; dom.headerAvatar.style.backgroundPosition = 'center'; } else { dom.headerAvatar.textContent = initials; dom.headerAvatar.style.backgroundImage = ''; } }
  if (dom.drawerAvatar) { if (state.user?.photoURL) { dom.drawerAvatar.style.backgroundImage = `url(${state.user.photoURL})`; dom.drawerAvatar.style.backgroundSize = 'cover'; dom.drawerAvatar.textContent = ''; } else { dom.drawerAvatar.textContent = initials; dom.drawerAvatar.style.backgroundImage = ''; } }
  if (dom.drawerUserName) dom.drawerUserName.textContent = name;
  if (dom.drawerUserPlan) dom.drawerUserPlan.textContent = plan;
  const totalChats = state.chatSessions.reduce((acc, s) => acc + s.messages.filter(m => m.role === 'user').length, 0);
  const el1 = document.getElementById('drawerTotalChats'); if (el1) el1.textContent = totalChats;
  const el2 = document.getElementById('drawerTodayChats'); if (el2) el2.textContent = state.textCount;
  const remaining = state.isPremium ? '∞' : Math.max(0, FREE_TEXT_LIMIT - state.textCount);
  const el3 = document.getElementById('drawerRemainingChats'); if (el3) el3.textContent = remaining;
  const upgradeDrawerBtn = document.getElementById('upgradeDrawerBtn'); if (upgradeDrawerBtn) upgradeDrawerBtn.style.display = state.isPremium ? 'none' : '';
  const streakEl = document.getElementById('streakCount'); if (streakEl) streakEl.textContent = `🔥 ${state.streakDays} day streak`;
  updateLimitUI();
}

// ===== PROFILE MODAL =====
function openProfileModal() { updateProfileUI(); dom.profileModal.classList.add('active'); }
function closeProfileModal() { dom.profileModal.classList.remove('active'); }

function updateProfileUI() {
  if (state.user) {
    dom.profileLoggedOut.classList.add('hidden');
    dom.profileLoggedIn.classList.remove('hidden');
    const name = state.user.name || 'User';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    if (state.user.photoURL) {
      dom.profileAvatar.style.backgroundImage = `url(${state.user.photoURL})`;
      dom.profileAvatar.style.backgroundSize = 'cover';
      dom.profileAvatar.textContent = '';
    } else {
      dom.profileAvatar.textContent = initials;
      dom.profileAvatar.style.backgroundImage = '';
    }
    dom.profileName.textContent = name;
    const emailEl = document.getElementById('profileEmail'); if (emailEl) emailEl.textContent = state.user.email || '—';
    const emailDetailEl = document.getElementById('profileEmailDetail'); if (emailDetailEl) emailDetailEl.textContent = state.user.email || '—';
    if (dom.profileMobile) dom.profileMobile.textContent = state.user.mobile || '—';
    if (dom.profileSubscription) dom.profileSubscription.textContent = state.isPremium ? '⭐ Premium' : 'Free';
    if (dom.profileSince) dom.profileSince.textContent = state.user.joinedDate || new Date().toLocaleDateString();
    if (dom.profileBadge) dom.profileBadge.textContent = state.isPremium ? '⭐ Premium' : 'Free Plan';
    const verifiedChip = document.getElementById('profileVerifiedChip');
    if (verifiedChip) verifiedChip.style.display = state.user.verified ? '' : 'none';
    const totalUserMsgs = state.chatSessions.reduce((acc, s) => acc + s.messages.filter(m => m.role === 'user').length, 0);
    const el1 = document.getElementById('profileTotalChats'); if (el1) el1.textContent = totalUserMsgs;
    const el2 = document.getElementById('profileTodayChats'); if (el2) el2.textContent = state.textCount;
    const el3 = document.getElementById('profileTotalSolved'); if (el3) el3.textContent = state.totalSolved;
    const el4 = document.getElementById('profileStreak'); if (el4) el4.textContent = state.streakDays;
  } else {
    dom.profileLoggedOut.classList.remove('hidden');
    dom.profileLoggedIn.classList.add('hidden');
  }
}

function showLoginForm() { /* email auth removed */ }
function showSignupForm() { /* email auth removed */ }

// ===== AUTH FUNCTIONS =====

window.switchAuthTab = function() {}; // kept as no-op for safety
function clearAuthErrors() {}
function showAuthError() {}
function setAuthLoading() {}
window.togglePwd = function() {};

window.skipAuth = function() {
  // If switching from a real user to guest, wipe their data
  if (state.user) { clearUserState(); state.user = null; }
  state.firebaseUser = null;
  localStorage.removeItem('sscai_active_uid');
  // Load guest slot
  loadUserState(null);
  document.getElementById('authScreen').classList.add('hidden');
  showMainApp();
};

// Background Firestore sync — never blocks the UI
async function _syncFirestoreBackground(fbUser) {
  if (!window._firebaseDb || !window._firebaseFns) return;
  try {
    const { doc, getDoc, setDoc } = window._firebaseFns;
    const userRef = doc(window._firebaseDb, 'users', fbUser.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const d = snap.data();
      if (d.isPremium && !state.isPremium) {
        state.isPremium = true;
        saveState();
        updateUserUI(); updateProfileUI();
        showToast('⭐ Premium access restored!');
      }
      if (d.name && state.user) state.user.name = d.name;
      if (d.mobile && state.user) state.user.mobile = d.mobile;
      if (state.user) state.user = { ...state.user, ...d };
      saveState(); updateUserUI();
    } else {
      // First sign-in — write doc (non-blocking, fire-and-forget)
      const userData = state.user || {};
      setDoc(userRef, {
        uid: fbUser.uid,
        name: userData.name || fbUser.displayName || '',
        email: fbUser.email || '',
        photoURL: fbUser.photoURL || '',
        isPremium: false,
        createdAt: Date.now()
      }).catch(() => {});
    }
  } catch (e) { console.warn('Firestore background sync:', e); }
}

async function loginUserWithFirebase(fbUser, extraData = {}) {
  const uid = fbUser.uid;
  // If a DIFFERENT user was active, wipe their in-memory data first
  if (state.user && state.user.uid !== uid) {
    clearUserState();
    if (dom.messages) dom.messages.innerHTML = '';
  }
  const userData = {
    uid,
    name: fbUser.displayName || extraData.name || fbUser.email?.split('@')[0] || 'User',
    email: fbUser.email || '',
    mobile: extraData.mobile || '',
    photoURL: fbUser.photoURL || '',
    joinedDate: new Date().toLocaleDateString('en-IN'),
    verified: fbUser.emailVerified || false,
    provider: extraData.provider || 'email'
  };
  state.user = userData;
  state.firebaseUser = fbUser;
  // Load THIS user's data from their own localStorage slot
  loadUserState(uid);
  saveState();
  // Sync Firestore non-blocking — don't await
  _syncFirestoreBackground(fbUser);
}

// Google Sign In
window.handleGoogleSignIn = async function() {
  if (!window._firebaseAuth || !window._googleProvider || !window._firebaseFns) { showToast('Auth not ready. Please wait...'); return; }
  const btns = ['googleSignInBtn', 'profileGoogleBtn'].map(id => document.getElementById(id)).filter(Boolean);
  btns.forEach(b => { b.disabled = true; b.style.opacity = '0.7'; });
  try {
    const { signInWithPopup } = window._firebaseFns;
    const result = await signInWithPopup(window._firebaseAuth, window._googleProvider);
    // loginUserWithFirebase is now instant (Firestore sync is background)
    loginUserWithFirebase(result.user, { provider: 'google' });
    document.getElementById('authScreen').classList.add('hidden');
    if (dom.app.classList.contains('hidden')) showMainApp();
    else { updateUserUI(); updateProfileUI(); }
    showToast(`🎉 Welcome, ${state.user.name}!`);
  } catch (err) {
    console.error('Google sign-in error:', err);
    let msg = 'Google sign-in failed. Please try again.';
    if (err.code === 'auth/popup-blocked') msg = 'Popup blocked. Please allow popups for this site.';
    if (err.code === 'auth/cancelled-popup-request') msg = 'Sign-in cancelled.';
    showToast(msg, 3500);
  } finally {
    btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
  }
};

// Apple Sign In
window.handleAppleSignIn = async function() {
  if (!window._firebaseAuth || !window._appleProvider || !window._firebaseFns) { showToast('Auth not ready. Please wait...'); return; }
  const btns = ['appleSignInBtn', 'profileAppleBtn'].map(id => document.getElementById(id)).filter(Boolean);
  btns.forEach(b => { b.disabled = true; b.style.opacity = '0.7'; });
  try {
    const { signInWithPopup } = window._firebaseFns;
    const result = await signInWithPopup(window._firebaseAuth, window._appleProvider);
    loginUserWithFirebase(result.user, { provider: 'apple' });
    document.getElementById('authScreen').classList.add('hidden');
    if (dom.app.classList.contains('hidden')) showMainApp();
    else { updateUserUI(); updateProfileUI(); }
    showToast(`🎉 Welcome, ${state.user.name}!`);
  } catch (err) {
    console.error('Apple sign-in error:', err);
    showToast('Apple sign-in failed. Please try again.', 3500);
  } finally {
    btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
  }
};

// Email auth removed — Google & Apple only
window.handleFirebaseLogin = function() { showToast('Please use Google or Apple to sign in.'); };
window.handleFirebaseSignup = function() { showToast('Please use Google or Apple to sign in.'); };

// Profile modal Login (kept as no-op — email auth removed)
function handleLogin() { showToast('Please use Google or Apple to sign in.'); }
function handleSignup() { showToast('Please use Google or Apple to sign in.'); }

function handleLogout() {
  if (window._firebaseAuth && window._firebaseFns) {
    const { signOut } = window._firebaseFns;
    signOut(window._firebaseAuth).catch(() => {});
  }
  // Remove the "last active user" pointer so the next visitor
  // starts fresh and never sees this user's data
  localStorage.removeItem('sscai_active_uid');
  // Wipe ALL in-memory state for this user
  state.user = null;
  state.firebaseUser = null;
  clearUserState();
  // Clear the chat panel visually
  if (dom.messages) dom.messages.innerHTML = '';
  if (dom.welcomeScreen) { dom.welcomeScreen.style.display = ''; dom.messages && dom.messages.appendChild(dom.welcomeScreen); }
  // Close modals
  closeProfileModal();
  // Hide main app, show auth screen
  dom.app.classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  showToast('Signed out successfully');
}

// ===== BOOKMARKS =====
function openBookmarksModal() { renderBookmarks(); dom.bookmarksModal.classList.add('active'); }
function closeBookmarksModal() { dom.bookmarksModal.classList.remove('active'); }
function renderBookmarks() {
  if (!dom.bookmarksList) return;
  if (!state.bookmarks.length) { dom.bookmarksList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">No bookmarks yet. Bookmark important AI answers!</div>'; return; }
  dom.bookmarksList.innerHTML = state.bookmarks.map((b, i) => `<div class="bookmark-item"><div class="bookmark-content">${escapeHtml(b.content)}${b.content.length >= 300 ? '...' : ''}</div><div class="bookmark-meta"><span class="bookmark-time">${b.time}</span><button onclick="deleteBookmark(${i})" class="bookmark-delete">🗑️</button></div></div>`).join('');
}
window.deleteBookmark = function(i) { state.bookmarks.splice(i, 1); saveState(); renderBookmarks(); };

// ===== PREMIUM =====
function closePremiumModal() { dom.premiumModal.classList.remove('active'); }

// Cashfree automatic payment verification
async function verifyCashfreePayment(orderId) {
  try {
    const firebaseUser = window._firebaseAuth?.currentUser;
    const token = firebaseUser ? await firebaseUser.getIdToken() : null;
    // Call backend to verify order with Cashfree
    const res = await fetch(VERIFY_PAYMENT_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  },
  body: JSON.stringify({ order_id: orderId })
});
    if (!res.ok) return null;
    const data = await res.json();
    return data; // { status: 'PAID', plan: 'ssc'|'class10'|'class12' }
  } catch(e) {
    console.warn('Payment verify error:', e);
    return null;
  }
}

async function handlePayment(planId) {
  const plan = PREMIUM_PLANS[planId] || PREMIUM_PLANS.ssc;
  if (!state.user) { showToast('Please login first to upgrade!'); return; }

  const firebaseUser = window._firebaseAuth?.currentUser;
  if (!firebaseUser) { showToast('Please login first to upgrade!'); return; }

  showToast('💳 Creating secure payment session…');

  try {
    const token = await firebaseUser.getIdToken();

    // Step 1 — Call backend to create Cashfree order & get payment_session_id
  const response = await fetch(CASHFREE_ORDER_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    amount: plan.price,
    plan: planId,
    uid: state.user.uid,
    name: state.user.name || 'Student',
    email: state.user.email || ''
  })
});

    const data = await response.json();

    if (!data.payment_session_id || !data.order_id) {
      console.error('Order creation failed:', data);
      showToast('❌ Payment session failed. Please try again.');
      return;
    }

    const orderId = data.order_id;

    // Store pending order for post-payment verification
    localStorage.setItem('sscai_pending_order', JSON.stringify({
      orderId, planId, uid: state.user.uid, ts: Date.now()
    }));

    // Step 2 — Launch Cashfree checkout via SDK v3
    const cashfree = Cashfree({ mode: 'production' });

    cashfree.checkout({
      paymentSessionId: data.payment_session_id,
      redirectTarget: '_modal'
    });

    // Step 3 — Poll for payment confirmation after redirect returns
    pollPaymentStatus(orderId, planId);

  } catch (err) {
    console.error('Payment error:', err);
    showToast('❌ Payment failed. Please try again.');
  }
}

function pollPaymentStatus(orderId, planId, attempt = 0) {
  const MAX_ATTEMPTS = 24; // poll for up to ~2 minutes (every 5s)
  if (attempt >= MAX_ATTEMPTS) {
    showToast('⏰ Payment not detected yet. If you paid, contact support.');
    return;
  }
  setTimeout(async () => {
    const result = await verifyCashfreePayment(orderId);
    if (result && result.status === 'PAID') {
      activatePremium(planId);
      localStorage.removeItem('sscai_pending_order');
    } else if (result && result.status === 'FAILED') {
      showToast('❌ Payment failed. Please try again.');
      localStorage.removeItem('sscai_pending_order');
    } else {
      pollPaymentStatus(orderId, planId, attempt + 1);
    }
  }, 5000);
}

function activatePremium(planId = 'ssc') {
  const plan = PREMIUM_PLANS[planId] || PREMIUM_PLANS.ssc;
  state.isPremium = true;
  state.premiumPlan = planId;

  // Persist to Firestore
  if (window._firebaseDb && window._firebaseFns && state.firebaseUser) {
    const { doc, updateDoc } = window._firebaseFns;
    const userRef = doc(window._firebaseDb, 'users', state.firebaseUser.uid);
    updateDoc(userRef, { isPremium: true, premiumPlan: planId, premiumActivatedAt: Date.now() }).catch(() => {});
  }

  saveState(); updateUserUI(); updateProfileUI(); closePremiumModal();
  showToast(`🎉 ${plan.name} activated! Unlimited access unlocked! 🚀`);
}

window.handlePayment = handlePayment;

function checkPendingPayment() {
  try {
    const pending = JSON.parse(localStorage.getItem('sscai_pending_order') || 'null');
    if (pending && pending.uid === state.user?.uid && (Date.now() - pending.ts) < 600000) {
      pollPaymentStatus(pending.orderId, pending.planId);
    } else if (pending) {
      localStorage.removeItem('sscai_pending_order');
    }
  } catch(e) {}
}

function renderPremiumModal() {
  const modal = dom.premiumModal?.querySelector('.modal-premium-body') || dom.premiumModal?.querySelector('.modal-body');
  if (!modal) return;

  // ── Voice strip: build it fresh each time so audio element stays alive ──
  const voiceStripHTML = `
    <div class="premium-voice-strip" id="premiumVoiceStrip">
      <div class="pvs-orb-wrap" id="pvsOrbWrap">
        <div class="pvs-ring pvs-ring-1"></div>
        <div class="pvs-ring pvs-ring-2"></div>
        <div class="pvs-orb">👩‍🏫</div>
      </div>
      <div class="pvs-wave" id="pvsWave">
        <span class="pvs-bar" style="--i:0"></span>
        <span class="pvs-bar" style="--i:1"></span>
        <span class="pvs-bar" style="--i:2"></span>
        <span class="pvs-bar" style="--i:3"></span>
        <span class="pvs-bar" style="--i:2"></span>
        <span class="pvs-bar" style="--i:1"></span>
      </div>
      <div class="pvs-info">
        <div class="pvs-title">AI Teacher Voice <span class="pvs-new-tag">NEW</span></div>
        <div class="pvs-sub">Crystal-clear human-like voice explanations</div>
      </div>
      <button class="pvs-play-btn" id="pvsPlayBtn">
        <svg id="pvsPlayIcon" width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <svg id="pvsPauseIcon" style="display:none" width="16" height="16" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        Demo
      </button>
      <audio id="premiumDemoAudio2" preload="none">
        <source src="assets/premium-demo.wav" type="audio/wav">
      </audio>
    </div>`;

  modal.innerHTML = voiceStripHTML + `
    <div class="premium-hero">
      <div class="premium-hero-icon">⭐</div>
      <h2 class="premium-hero-title">Unlock Full Power</h2>
      <p class="premium-hero-sub">Choose your plan and start learning smarter today</p>
    </div>

    <div class="premium-trust-bar">
      <div class="trust-item"><span class="trust-num">50K+</span><span class="trust-label">Students</span></div>
      <div class="trust-sep"></div>
      <div class="trust-item"><span class="trust-num">4.9★</span><span class="trust-label">Rating</span></div>
      <div class="trust-sep"></div>
      <div class="trust-item"><span class="trust-num">100%</span><span class="trust-label">Secure</span></div>
    </div>

    <div class="premium-plans-grid">

      <!-- SSC Pro Plan -->
      <div class="premium-plan-card ${state.isPremium && state.premiumPlan==='ssc' ? 'active-plan' : ''}" data-plan="ssc">
        <div class="plan-card-header">
          <div class="plan-badge-row"><span class="plan-chip popular">🏆 Most Popular</span></div>
          <div class="plan-icon">🎯</div>
          <div class="plan-name">SSC Pro</div>
          <div class="plan-target">CGL · CHSL · GD · MTS · CPO</div>
          <div class="plan-price-row"><span class="plan-price">₹199</span><span class="plan-per">/month</span></div>
        </div>
        <ul class="plan-features-list">
          <li>✅ Unlimited AI questions daily</li>
          <li>✅ Unlimited image solving</li>
          <li>✅ Unlimited PDF uploads</li>
          <li>✅ All 5 SSC exam modes</li>
          <li>✅ Smart vision AI for handwritten notes</li>
          <li>✅ Priority fast responses</li>
          <li>✅ 30-day money-back guarantee</li>
        </ul>
        <button class="plan-buy-btn ssc-btn" onclick="handlePayment('ssc')">
          ${state.isPremium && state.premiumPlan==='ssc' ? '✅ Active Plan' : '💳 Buy SSC Pro – ₹199'}
        </button>
      </div>

      <!-- Class 10 Plan -->
      <div class="premium-plan-card ${state.isPremium && state.premiumPlan==='class10' ? 'active-plan' : ''}" data-plan="class10">
        <div class="plan-card-header">
          <div class="plan-badge-row"><span class="plan-chip board">📚 Board Special</span></div>
          <div class="plan-icon">📖</div>
          <div class="plan-name">Class 10 Pro</div>
          <div class="plan-target">CBSE · NCERT · Board Exams</div>
          <div class="plan-price-row"><span class="plan-price">₹99</span><span class="plan-per">/month</span></div>
        </div>
        <ul class="plan-features-list">
          <li>✅ All Class 9 & 10 subjects</li>
          <li>✅ Math, Science, SST, English, Hindi</li>
          <li>✅ NCERT-aligned explanations</li>
          <li>✅ Board exam question patterns</li>
          <li>✅ Step-by-step solutions</li>
          <li>✅ Unlimited image/PDF solving</li>
          <li>✅ 30-day money-back guarantee</li>
        </ul>
        <button class="plan-buy-btn class10-btn" onclick="handlePayment('class10')">
          ${state.isPremium && state.premiumPlan==='class10' ? '✅ Active Plan' : '💳 Buy Class 10 Pro – ₹99'}
        </button>
      </div>

      <!-- Class 12 Plan -->
      <div class="premium-plan-card ${state.isPremium && state.premiumPlan==='class12' ? 'active-plan' : ''}" data-plan="class12">
        <div class="plan-card-header">
          <div class="plan-badge-row"><span class="plan-chip board12">🎓 Board + JEE/NEET</span></div>
          <div class="plan-icon">🔬</div>
          <div class="plan-name">Class 12 Pro</div>
          <div class="plan-target">Science · Commerce · Arts</div>
          <div class="plan-price-row"><span class="plan-price">₹99</span><span class="plan-per">/month</span></div>
        </div>
        <ul class="plan-features-list">
          <li>✅ All Class 11 & 12 subjects</li>
          <li>✅ Sci, Commerce & Arts streams</li>
          <li>✅ JEE/NEET concept building</li>
          <li>✅ Board exam focus questions</li>
          <li>✅ Derivations & proofs explained</li>
          <li>✅ Unlimited image/PDF solving</li>
          <li>✅ 30-day money-back guarantee</li>
        </ul>
        <button class="plan-buy-btn class12-btn" onclick="handlePayment('class12')">
          ${state.isPremium && state.premiumPlan==='class12' ? '✅ Active Plan' : '💳 Buy Class 12 Pro – ₹99'}
        </button>
      </div>
    </div>

    <div class="premium-security-row">
      <span>🔒 Secured by Cashfree Payments</span>
      <span>|</span>
      <span>🏦 UPI · Cards · Net Banking</span>
      <span>|</span>
      <span>↩️ 30-day Refund</span>
    </div>
  `;
}

// ===== VOICE DEMO PLAYERS (welcome card + premium modal) =====
// Single shared audio element for premium-modal demo
var _pvs = { audio: null, playing: false };

function _makeDemoPlayer(audioId, playBtnId, playIconId, pauseIconId, orbId, barsId) {
  var audio   = document.getElementById(audioId);
  var playBtn = document.getElementById(playBtnId);
  var playIco = document.getElementById(playIconId);
  var pauIco  = document.getElementById(pauseIconId);
  var orb     = document.getElementById(orbId);
  var bars    = document.getElementById(barsId);
  if (!audio || !playBtn) return null;

  var playing = false;

  function setPlay(v) {
    playing = v;
    if (playIco) playIco.style.display = v ? 'none' : '';
    if (pauIco)  pauIco.style.display  = v ? '' : 'none';
    if (orb)  orb.classList.toggle('tvd-playing', v);
    if (orb)  orb.classList.toggle('tps-playing', v);
    if (bars) bars.classList.toggle('tvd-bars-active', v);
  }

  playBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    // Pause all other demo players
    ['teacherDemoAudio','premiumDemoAudio','premiumDemoAudio2'].forEach(function(id) {
      if (id !== audioId) { var a = document.getElementById(id); if (a) { a.pause(); a.currentTime = 0; } }
    });
    // Reset all other UI states
    document.querySelectorAll('.tvd-orb-wrap,.tps-orb-wrap,.pvs-orb-wrap').forEach(function(o) {
      o.classList.remove('tvd-playing','tps-playing');
    });
    document.querySelectorAll('.tvd-wave-bars,.tps-bars,.pvs-wave').forEach(function(b) {
      b.classList.remove('tvd-bars-active');
    });
    document.querySelectorAll('[id$="PlayIcon"],[id$="PlayIco"]').forEach(function(i) { i.style.display = ''; });
    document.querySelectorAll('[id$="PauseIcon"],[id$="PauseIco"]').forEach(function(i) { i.style.display = 'none'; });

    if (playing) {
      audio.pause(); setPlay(false);
    } else {
      audio.currentTime = 0;
      audio.play().then(function() { setPlay(true); }).catch(function() {
        // Browser blocked autoplay — animate anyway for demo effect
        setPlay(true);
        setTimeout(function() { setPlay(false); }, 7000);
      });
    }
  });

  audio.addEventListener('ended', function() { setPlay(false); });
  audio.addEventListener('pause', function() { if (playing) setPlay(false); });
  return { audio, setPlay };
}

function initVoiceDemos() {
  // Welcome screen card player
  _makeDemoPlayer('premiumDemoAudio','tvdPlayBtn','tvdPlayIcon','tvdPauseIcon','tvdOrbWrap','tvdWaveBars');
  // Teacher Mode dropdown player
  _makeDemoPlayer('teacherDemoAudio','tvdPlayBtn2','tpsPlayIcon','tpsPauseIcon','tpsOrbWrap','tpsBars');
  // Premium modal player — wired after renderPremiumModal() injects HTML
  _rewirePvsPlayer();
}

function _rewirePvsPlayer() {
  _makeDemoPlayer('premiumDemoAudio2','pvsPlayBtn','pvsPlayIcon','pvsPauseIcon','pvsOrbWrap','pvsWave');
}

// Patch openPremiumModal to re-wire the voice player after innerHTML is rebuilt
var _origOpenPremiumModal = openPremiumModal;
function openPremiumModal() {
  renderPremiumModal();
  dom.premiumModal.classList.add('active');
  // Re-wire the voice demo player now that DOM is fresh
  setTimeout(_rewirePvsPlayer, 0);
}
window.showPremiumModal = openPremiumModal;

// ===== SETTINGS =====
function openSettingsModal() { dom.settingsModal.classList.add('active'); }
function closeSettingsModal() { dom.settingsModal.classList.remove('active'); }

// ===== LEGAL MODALS =====
function openTermsModal() { dom.termsModal.classList.add('active'); }
function closeTermsModal() { dom.termsModal.classList.remove('active'); }
function openPrivacyModal() { dom.privacyModal.classList.add('active'); }
function closePrivacyModal() { dom.privacyModal.classList.remove('active'); }
function openRefundModal() { document.getElementById('refundModal')?.classList.add('active'); }
function closeRefundModal() { document.getElementById('refundModal')?.classList.remove('active'); }
function openAiDisclaimerModal() { document.getElementById('aiDisclaimerModal')?.classList.add('active'); }
function closeAiDisclaimerModal() { document.getElementById('aiDisclaimerModal')?.classList.remove('active'); }
function openAboutModal() { document.getElementById('aboutModal')?.classList.add('active'); }
function closeAboutModal() { document.getElementById('aboutModal')?.classList.remove('active'); }
// Terms/Privacy from auth screen (app not visible yet, open modal after showing app briefly)
window.openTermsFromAuth = function() { showMainApp(); openTermsModal(); };
window.openPrivacyFromAuth = function() { showMainApp(); openPrivacyModal(); };
window.openProfileModal = openProfileModal;
window.openTermsModal = openTermsModal;
window.openPrivacyModal = openPrivacyModal;

// ===== WELCOME CHIPS =====
function setupWelcomeChips() {
  document.querySelectorAll('.welcome-chip').forEach(chip => {
    chip.addEventListener('click', () => { const prompt = chip.dataset.prompt; if (prompt) { dom.messageInput.value = prompt; sendMessage(); } });
  });
}

// ===== SSC MODE =====
function setupSscMode() {
  if (!dom.sscModeSelect) return;
  dom.sscModeSelect.value = state.sscMode;
  dom.sscModeSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    // Check if class 10/12 premium mode requires premium
    const premiumModes = { class10: 'class10', class12_sci: 'class12', class12_com: 'class12', class12_arts: 'class12' };
    const requiredPlan = premiumModes[val];
    if (requiredPlan && (!state.isPremium || (state.premiumPlan !== requiredPlan && state.premiumPlan !== 'ssc'))) {
      dom.sscModeSelect.value = state.sscMode; // revert
      showToast(`⭐ This mode requires ${PREMIUM_PLANS[requiredPlan].name}!`);
      openPremiumModal();
      return;
    }
    state.sscMode = val;
    saveState();
    const modeNames = {
      cgl: 'SSC CGL', chsl: 'SSC CHSL', gd: 'SSC GD', mts: 'SSC MTS', cpo: 'SSC CPO',
      class1:'Class 1', class2:'Class 2', class3:'Class 3', class4:'Class 4', class5:'Class 5',
      class6:'Class 6', class7:'Class 7', class8:'Class 8', class9:'Class 9',
      class10:'Class 10', class11_sci:'Class 11 Science', class11_com:'Class 11 Commerce', class11_arts:'Class 11 Arts',
      class12_sci:'Class 12 Science', class12_com:'Class 12 Commerce', class12_arts:'Class 12 Arts'
    };
    showToast(`✅ Mode: ${modeNames[state.sscMode] || state.sscMode}`);
    updateModeHeaderBadge();
  });
}
function updateModeHeaderBadge() {
  const badge = document.getElementById('sscModeBadge');
  if (!badge) return;
  const shortMap = {
    cgl:'CGL', chsl:'CHSL', gd:'GD', mts:'MTS', cpo:'CPO',
    class1:'Cls 1', class2:'Cls 2', class3:'Cls 3', class4:'Cls 4', class5:'Cls 5',
    class6:'Cls 6', class7:'Cls 7', class8:'Cls 8', class9:'Cls 9',
    class10:'Cls 10', class11_sci:'XI Sci', class11_com:'XI Com', class11_arts:'XI Arts',
    class12_sci:'XII Sci', class12_com:'XII Com', class12_arts:'XII Arts'
  };
  badge.textContent = shortMap[state.sscMode] || state.sscMode.toUpperCase();
}

// ===== TEXTAREA AUTO-RESIZE =====
function autoResizeTextarea() { dom.messageInput.style.height = 'auto'; dom.messageInput.style.height = Math.min(dom.messageInput.scrollHeight, 100) + 'px'; }

// ===== SHOW MAIN APP =====
function showMainApp() {
  dom.app.classList.remove('hidden');
  applyTheme(state.theme);
  if (dom.darkModeToggle) dom.darkModeToggle.checked = state.theme === 'dark';
  if (dom.aiLangSelect) dom.aiLangSelect.value = state.aiLang;
  resetDailyCounts();
  updateUserUI();
  updateModeHeaderBadge();
  if (!state.chatSessions.length) { createNewSession(); }
  else if (state.currentSessionId && state.chatSessions.some(s => s.id === state.currentSessionId)) { loadSession(state.currentSessionId); }
  else { loadSession(state.chatSessions[0].id); }
  renderChatHistory();
  if (state.user) checkPendingPayment();
  resumeRewardIfActive();
  setTimeout(renderNativeAds, 500); // render ads after UI settles
}

// ===== MODEL SELECTOR =====
function setupModelSelector() {
  var selectorBtn = document.getElementById('modelSelectorBtn');
  var dropdown    = document.getElementById('modelDropdown');
  var selectorIcon  = document.getElementById('modelSelectorIcon');
  var selectorLabel = document.getElementById('modelSelectorLabel');
  var chipIcon = document.getElementById('activeModelChipIcon');
  var chipName = document.getElementById('activeModelChipName');
  if (!selectorBtn || !dropdown) return;

  var models = {
    smart:      { icon:'🧠', label:'PrepAI Smart',      chip:'Smart'   },
    flash:      { icon:'⚡', label:'PrepAI Flash',      chip:'Flash'   },
    pro:        { icon:'✨', label:'PrepAI Pro',         chip:'Pro'     },
    vision:     { icon:'🔍', label:'PrepAI Vision',     chip:'Vision'  },
    'vision-pro':{ icon:'🔬', label:'PrepAI Vision Pro', chip:'Vision Pro' },
    'voice-text':{ icon:'🎙️', label:'Voice → Text',    chip:'Voice'   },
    voice:      { icon:'🔊', label:'Voice Mode',        chip:'Voice'   },
    teacher:    { icon:'👩‍🏫', label:'Teacher Mode',    chip:'Teacher' },
  };

  var selectedModel = 'smart';

  // Toggle dropdown open/close
  selectorBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    var open = dropdown.classList.toggle('open');
    selectorBtn.setAttribute('aria-expanded', open);
    // Stop demo audio when closing
    if (!open) stopAllDemoAudio();
  });

  // Close on outside click
  document.addEventListener('click', function(e) {
    if (!dropdown.contains(e.target) && e.target !== selectorBtn) {
      dropdown.classList.remove('open');
      selectorBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // Option selection
  dropdown.querySelectorAll('.model-option').forEach(function(opt) {
    opt.addEventListener('click', function(e) {
      // Don't close if clicking teacher preview strip
      if (e.target.closest('.teacher-preview-strip')) return;
      var model = opt.dataset.model;
      if (!model) return;

      // Teacher mode — require premium
      if (model === 'teacher' && !state.isPremium) {
        showToast('👩‍🏫 Teacher Mode requires upgrade — hear the demo below!');
        // Keep dropdown open so they see the demo
        return;
      }
      // Pro/Vision-Pro — require premium
      if ((model === 'pro' || model === 'vision-pro') && !state.isPremium) {
        showToast('⭐ This model requires Premium!');
        openPremiumModal();
        dropdown.classList.remove('open');
        return;
      }

      selectedModel = model;
      // Update UI
      dropdown.querySelectorAll('.model-option').forEach(function(o) {
        o.classList.remove('active');
        o.setAttribute('aria-selected', 'false');
        var chk = o.querySelector('.model-opt-check');
        if (chk) chk.textContent = '';
      });
      opt.classList.add('active');
      opt.setAttribute('aria-selected', 'true');
      var chk = opt.querySelector('.model-opt-check');
      if (chk) chk.textContent = '✓';

      var m = models[model] || models.smart;
      if (selectorIcon)  selectorIcon.textContent  = m.icon;
      if (selectorLabel) selectorLabel.textContent = m.label;
      if (chipIcon) chipIcon.textContent = m.icon;
      if (chipName) chipName.textContent = m.chip;

      dropdown.classList.remove('open');
      selectorBtn.setAttribute('aria-expanded', 'false');
      stopAllDemoAudio();
    });
  });

  // Tapping the teacher preview strip orb should NOT close the dropdown
  var tpsOrb = document.getElementById('tpsOrbWrap');
  if (tpsOrb) {
    tpsOrb.addEventListener('click', function(e) { e.stopPropagation(); });
  }
  var tpsUpgrade = document.querySelector('.tps-upgrade');
  if (tpsUpgrade) {
    tpsUpgrade.addEventListener('click', function(e) {
      e.stopPropagation();
      dropdown.classList.remove('open');
      openPremiumModal();
    });
  }
}

function stopAllDemoAudio() {
  ['teacherDemoAudio','premiumDemoAudio','premiumDemoAudio2'].forEach(function(id) {
    var a = document.getElementById(id);
    if (a && !a.paused) { a.pause(); a.currentTime = 0; }
  });
  document.querySelectorAll('.tvd-orb-wrap,.tps-orb-wrap,.pvs-orb-wrap').forEach(function(o) {
    o.classList.remove('tvd-playing','tps-playing');
  });
  document.querySelectorAll('.tvd-wave-bars,.tps-bars,.pvs-wave').forEach(function(b) {
    b.classList.remove('tvd-bars-active');
  });
}

// ===== INITIALIZATION =====
function initApp() {
  applyTheme(state.theme);

  // Core events
  dom.sendBtn.addEventListener('click', sendMessage);
  dom.messageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  dom.messageInput.addEventListener('input', autoResizeTextarea);
  dom.menuBtn.addEventListener('click', openDrawer);
  dom.closeDrawerBtn.addEventListener('click', closeDrawer);
  dom.drawerOverlay.addEventListener('click', closeDrawer);
  dom.newChatBtn.addEventListener('click', () => { createNewSession(); closeDrawer(); });
  dom.clearAllHistoryBtn.addEventListener('click', deleteAllSessions);
  dom.settingsBtn.addEventListener('click', openSettingsModal);
  dom.closeSettingsBtn.addEventListener('click', closeSettingsModal);
  dom.themeToggleBtn.addEventListener('click', toggleTheme);
  document.getElementById('upgradeDrawerBtn')?.addEventListener('click', () => { closeDrawer(); openPremiumModal(); });
  if (dom.darkModeToggle) dom.darkModeToggle.addEventListener('change', (e) => applyTheme(e.target.checked ? 'dark' : 'light'));
  if (dom.aiLangSelect) dom.aiLangSelect.addEventListener('change', (e) => { state.aiLang = e.target.value; saveState(); showToast('Language saved'); });

  // Cost toggles
  [['cachingToggle', 'cachingEnabled', '✅ Caching ON', '❌ Caching OFF'], ['shortResponseToggle', 'shortResponseMode', '✅ Short mode ON', '❌ Short mode OFF'], ['limitHistoryToggle', 'limitHistoryMode', '✅ History limit ON', '❌ History limit OFF'], ['noSystemPromptToggle', 'noSystemPrompt', '✅ No system prompt', '❌ System prompt ON']].forEach(([id, key, on, off]) => {
    const el = document.getElementById(id);
    if (el) { el.checked = state[key]; el.addEventListener('change', (e) => { state[key] = e.target.checked; saveState(); showToast(e.target.checked ? on : off); }); }
  });

  const planBadge = document.getElementById('planBadgeSettings');
  if (planBadge) planBadge.textContent = state.isPremium ? 'Unlimited' : '100/day';

  // Profile events
  if (dom.headerAvatar) dom.headerAvatar.addEventListener('click', openProfileModal);
  document.getElementById('drawerUserCard')?.addEventListener('click', openProfileModal);
  dom.closeProfileBtn?.addEventListener('click', closeProfileModal);
  dom.logoutBtn?.addEventListener('click', handleLogout);
  dom.upgradeFromProfileBtn?.addEventListener('click', () => { closeProfileModal(); openPremiumModal(); });
  dom.upgradeFromSettingsBtn?.addEventListener('click', () => { closeSettingsModal(); openPremiumModal(); });
  dom.closePremiumBtn?.addEventListener('click', closePremiumModal);
  // payWithCashfreeBtn replaced by per-plan inline buttons in renderPremiumModal
  dom.termsLink?.addEventListener('click', (e) => { e.preventDefault(); openTermsModal(); });
  dom.privacyLink?.addEventListener('click', (e) => { e.preventDefault(); openPrivacyModal(); });
  dom.closeTermsBtn?.addEventListener('click', closeTermsModal);
  dom.closePrivacyBtn?.addEventListener('click', closePrivacyModal);
  document.getElementById('refundLink')?.addEventListener('click', (e) => { e.preventDefault(); openRefundModal(); });
  document.getElementById('closeRefundBtn')?.addEventListener('click', closeRefundModal);
  document.getElementById('aiDisclaimerLink')?.addEventListener('click', (e) => { e.preventDefault(); openAiDisclaimerModal(); });
  document.getElementById('closeAiDisclaimerBtn')?.addEventListener('click', closeAiDisclaimerModal);
  document.getElementById('aboutLink')?.addEventListener('click', (e) => { e.preventDefault(); openAboutModal(); });
  document.getElementById('closeAboutBtn')?.addEventListener('click', closeAboutModal);
  dom.bookmarksBtn?.addEventListener('click', openBookmarksModal);
  dom.closeBookmarksBtn?.addEventListener('click', closeBookmarksModal);

  // ── MONETIZATION EVENT WIRING ─────────────────────────────
  document.getElementById('watchAdBtn')?.addEventListener('click', triggerRewardedAd);
  document.getElementById('closeRewardPopupBtn')?.addEventListener('click', closeRewardPopup);
  document.getElementById('rewardUpgradeBtn')?.addEventListener('click', () => { closeRewardPopup(); openPremiumModal(); });
  document.getElementById('adSimulatorCloseBtn')?.addEventListener('click', () => {
    document.getElementById('adSimulatorModal')?.classList.remove('active');
  });
  document.getElementById('rewardBadgeDismiss')?.addEventListener('click', () => {
    document.getElementById('rewardActiveBadge').style.display = 'none';
  });
  // Expose globally
  window.showRewardPopup   = showRewardPopup;
  window.triggerRewardedAd = triggerRewardedAd;
  window.closeRewardPopup  = closeRewardPopup;

  // Profile modal social sign-in buttons
  document.getElementById('profileGoogleBtn')?.addEventListener('click', async () => {
    closeProfileModal();
    await window.handleGoogleSignIn();
  });
  document.getElementById('profileAppleBtn')?.addEventListener('click', async () => {
    closeProfileModal();
    await window.handleAppleSignIn();
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
  });

  // Auth screen Google/Apple buttons
  document.getElementById('googleSignInBtn')?.addEventListener('click', window.handleGoogleSignIn);
  document.getElementById('appleSignInBtn')?.addEventListener('click', window.handleAppleSignIn);

  // File uploads, mode, voice, chips
  setupImageUpload(); setupPdfUpload(); setupSscMode(); setupVoiceInput(); setupWelcomeChips();
  setupModelSelector();
  // Init all voice demo players after DOM is ready
  setTimeout(initVoiceDemos, 200);

  // ── Boot: zero-black-screen strategy ─────────────────────────
  //
  //  The intro overlay sits on z-index 99999. While it plays we
  //  paint the real app UI UNDERNEATH it so it is fully ready the
  //  moment the overlay disappears — user never sees black.
  //
  //  Timeline:
  //  1. DOMContentLoaded → initApp() runs immediately.
  //  2. If cached user exists  → showMainApp() RIGHT NOW (hidden
  //     under the intro). Firebase reconciles in background.
  //  3. If no cached user      → show auth screen RIGHT NOW (also
  //     hidden under intro). Firebase may upgrade it silently.
  //  4. Intro fires sscIntroComplete → just remove the overlay.
  //     The app/auth is already painted. Zero delay, zero black.
  //
  // ─────────────────────────────────────────────────────────────

  let _bootDone = false;

  // ── STEP 1: Paint immediately, don't wait for intro ──────────
  function _paintImmediately() {
    if (_bootDone) return;

    if (state.user) {
      // Cached user — show app right now, under the intro
      _bootDone = true;
      showMainApp();
      _waitForFirebaseThenSync();
    } else {
      // No cache — attach Firebase listener immediately
      _attachFirebaseOrShowAuth();
    }
  }

  // ── STEP 2: Firebase path for first-time / logged-out users ──
  function _attachFirebaseOrShowAuth() {
    if (window._firebaseAuth && window._firebaseFns) {
      _attachAuthListener();
    } else if (window.__firebaseReady) {
      setTimeout(_attachFirebaseOrShowAuth, 10);
    } else {
      // Firebase SDK still loading — show auth immediately as
      // fallback so there is never a blank screen
      const t = setTimeout(() => {
        if (!_bootDone) {
          _bootDone = true;
          dom.authScreen.classList.remove('hidden');
        }
      }, 1200); // reduced from 4000 → show auth fast
      window.addEventListener('firebaseReady', () => {
        clearTimeout(t);
        if (!_bootDone) _attachAuthListener();
      }, { once: true });
    }
  }

  function _attachAuthListener() {
    const { onAuthStateChanged } = window._firebaseFns;
    onAuthStateChanged(window._firebaseAuth, async (fbUser) => {
      if (_bootDone) return;
      _bootDone = true;
      if (fbUser) {
        state.firebaseUser = fbUser;
        const uid = fbUser.uid;
        if (state.user && state.user.uid !== uid) {
          clearUserState();
          state.user = null;
        }
        if (!state.user) {
          state.user = {
            uid,
            name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
            email: fbUser.email || '',
            photoURL: fbUser.photoURL || '',
            joinedDate: new Date().toLocaleDateString('en-IN'),
            verified: fbUser.emailVerified || false,
            provider: 'firebase'
          };
          loadUserState(uid);
          saveState();
        }
        showMainApp();
        _syncFirestoreBackground(fbUser);
      } else {
        if (state.user) { clearUserState(); state.user = null; }
        localStorage.removeItem('sscai_active_uid');
        dom.authScreen.classList.remove('hidden');
      }
    });
  }

  function _waitForFirebaseThenSync() {
    function _attach() {
      const { onAuthStateChanged } = window._firebaseFns;
      const unsub = onAuthStateChanged(window._firebaseAuth, (fbUser) => {
        unsub();
        if (fbUser) {
          if (state.user && state.user.uid !== fbUser.uid) {
            clearUserState();
            if (dom.messages) dom.messages.innerHTML = '';
            state.user = {
              uid: fbUser.uid,
              name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
              email: fbUser.email || '',
              photoURL: fbUser.photoURL || '',
              joinedDate: new Date().toLocaleDateString('en-IN'),
              verified: fbUser.emailVerified || false,
              provider: 'firebase'
            };
            loadUserState(fbUser.uid);
            saveState();
            showMainApp();
          } else {
            state.firebaseUser = fbUser;
            _syncFirestoreBackground(fbUser);
          }
        } else {
          clearUserState(); state.user = null;
          localStorage.removeItem('sscai_active_uid');
          dom.app.classList.add('hidden');
          dom.authScreen.classList.remove('hidden');
        }
      });
    }
    if (window._firebaseAuth && window._firebaseFns) {
      _attach();
    } else {
      window.addEventListener('firebaseReady', _attach, { once: true });
    }
  }

  // ── STEP 3: Paint the app NOW, before intro ends ─────────────
  // This is the key change: we don't wait for sscIntroComplete.
  // The intro overlay covers everything so painting early is safe.
  _paintImmediately();

  // ── STEP 4: When intro ends, just remove it — app already ready
  function _removeIntroOverlay() {
    const overlay = document.getElementById('sscIntroOverlay');
    if (overlay) {
      // Smooth fade-out so it doesn't feel abrupt
      overlay.style.transition = 'opacity 0.25s ease';
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
      setTimeout(() => overlay.remove(), 260);
    }
  }

  if (window.__introSkipped || window.__introComplete) {
    _removeIntroOverlay();
  } else {
    // Safety: remove intro after 5.5 s even if event never fires
    const introFallbackTimer = setTimeout(_removeIntroOverlay, 5500);
    window.addEventListener('sscIntroComplete', () => {
      clearTimeout(introFallbackTimer);
      _removeIntroOverlay();
    }, { once: true });
  }
  // ── END boot ──────────────────────────────────────────────────
}

// Wait for Firebase, then init
window.addEventListener('firebaseReady', () => {
  if (window._firebaseAuth && window._firebaseFns) {
    console.log('Firebase ready');
  }
});

document.addEventListener('DOMContentLoaded', initApp);