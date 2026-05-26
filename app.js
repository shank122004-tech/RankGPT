'use strict';

// ===== CONFIGURATION =====

// --- DeepSeek (TEXT questions — cheap & smart) ---
const DEEPSEEK_API_KEY = 'sk-b200d3c4df854ef1b3f32e7eb64fcff0';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat'; // deepseek-V3 (cheapest, very capable)

// --- Gemini (IMAGE + PDF solving — multimodal) ---
const GEMINI_API_KEY = 'AIzaSyATbNbVxK5PQY39Z6HSXPPphsf4sp4A-kM';
const GEMINI_VISION_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const APP_NAME = 'SSC PrepAI';

// ===== SMART DAILY LIMITS =====
const FREE_TEXT_LIMIT = 100;
const FREE_IMAGE_LIMIT = 5;
const FREE_PDF_LIMIT = 2;

// ===== CASHFREE CONFIG =====
const CASHFREE_APP_ID = ''; // keep server-side in production
const CASHFREE_SECRET = '';
const PREMIUM_PRICE = 199;

// ===== STATE =====
let state = {
  theme: localStorage.getItem('sscai_theme') || 'dark',
  user: JSON.parse(localStorage.getItem('sscai_user') || 'null'),
  chatSessions: JSON.parse(localStorage.getItem('sscai_sessions') || '[]'),
  currentSessionId: localStorage.getItem('sscai_current_session'),
  // Smart counters
  textCount: parseInt(localStorage.getItem('sscai_text_count') || '0'),
  imageCount: parseInt(localStorage.getItem('sscai_image_count') || '0'),
  pdfCount: parseInt(localStorage.getItem('sscai_pdf_count') || '0'),
  chatCountDate: localStorage.getItem('sscai_chat_date') || '',
  aiLang: localStorage.getItem('sscai_lang') || 'hinglish',
  isPremium: localStorage.getItem('sscai_premium') === 'true',
  sscMode: localStorage.getItem('sscai_mode') || 'cgl',
  // Cost-saving
  cachingEnabled: localStorage.getItem('sscai_caching') !== 'false',
  shortResponseMode: localStorage.getItem('sscai_short_response') === 'true',
  limitHistoryMode: localStorage.getItem('sscai_limit_history') === 'true',
  noSystemPrompt: localStorage.getItem('sscai_no_sysprompt') === 'true',
  responseCache: JSON.parse(localStorage.getItem('sscai_cache') || '{}'),
  // Bookmarks
  bookmarks: JSON.parse(localStorage.getItem('sscai_bookmarks') || '[]'),
  // Progress
  streakDays: parseInt(localStorage.getItem('sscai_streak') || '0'),
  lastActiveDate: localStorage.getItem('sscai_last_active') || '',
  totalSolved: parseInt(localStorage.getItem('sscai_total_solved') || '0'),
};

let currentMessages = [];
let isSending = false;
let pendingImageFiles = [];
let pendingPdfFile = null;
let currentAiMsgDiv = null;

// ===== DOM ELEMENTS =====
const dom = {
  splash: document.getElementById('splash'),
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
  chatCount: document.getElementById('chatCount'),
  aiStatus: document.getElementById('aiStatus'),
  toast: document.getElementById('toast'),
  headerAvatar: document.getElementById('headerAvatar'),
  drawerAvatar: document.getElementById('drawerAvatar'),
  drawerUserName: document.getElementById('drawerUserName'),
  drawerUserPlan: document.getElementById('drawerUserPlan'),
  welcomeScreen: document.getElementById('welcomeScreen'),
  profileModal: document.getElementById('profileModal'),
  closeProfileBtn: document.getElementById('closeProfileBtn'),
  loginShowBtn: document.getElementById('loginShowBtn'),
  signupShowBtn: document.getElementById('signupShowBtn'),
  loginForm: document.getElementById('loginForm'),
  signupForm: document.getElementById('signupForm'),
  profileLoggedOut: document.getElementById('profileLoggedOut'),
  profileLoggedIn: document.getElementById('profileLoggedIn'),
  loginBtn: document.getElementById('loginBtn'),
  signupBtn: document.getElementById('signupBtn'),
  switchToSignup: document.getElementById('switchToSignup'),
  switchToLogin: document.getElementById('switchToLogin'),
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
  // New elements
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
  if (state.user) localStorage.setItem('sscai_user', JSON.stringify(state.user));
  localStorage.setItem('sscai_sessions', JSON.stringify(state.chatSessions));
  if (state.currentSessionId) localStorage.setItem('sscai_current_session', state.currentSessionId);
  localStorage.setItem('sscai_text_count', state.textCount);
  localStorage.setItem('sscai_image_count', state.imageCount);
  localStorage.setItem('sscai_pdf_count', state.pdfCount);
  localStorage.setItem('sscai_chat_date', state.chatCountDate);
  localStorage.setItem('sscai_lang', state.aiLang);
  localStorage.setItem('sscai_premium', state.isPremium);
  localStorage.setItem('sscai_mode', state.sscMode);
  localStorage.setItem('sscai_caching', state.cachingEnabled);
  localStorage.setItem('sscai_short_response', state.shortResponseMode);
  localStorage.setItem('sscai_limit_history', state.limitHistoryMode);
  localStorage.setItem('sscai_no_sysprompt', state.noSystemPrompt);
  localStorage.setItem('sscai_bookmarks', JSON.stringify(state.bookmarks));
  localStorage.setItem('sscai_streak', state.streakDays);
  localStorage.setItem('sscai_last_active', state.lastActiveDate);
  localStorage.setItem('sscai_total_solved', state.totalSolved);
  const cacheKeys = Object.keys(state.responseCache);
  if (cacheKeys.length > 100) {
    const trimmed = {};
    cacheKeys.slice(-100).forEach(k => { trimmed[k] = state.responseCache[k]; });
    state.responseCache = trimmed;
  }
  try { localStorage.setItem('sscai_cache', JSON.stringify(state.responseCache)); } catch(e) {}
}

// ===== SMART DAILY LIMIT =====
function resetDailyCounts() {
  const today = new Date().toDateString();
  if (state.chatCountDate !== today) {
    state.textCount = 0;
    state.imageCount = 0;
    state.pdfCount = 0;
    state.chatCountDate = today;
    saveState();
  }
  updateLimitUI();
  updateStreak();
}

function canSendText() {
  if (state.isPremium) return true;
  return state.textCount < FREE_TEXT_LIMIT;
}
function canSendImage() {
  if (state.isPremium) return true;
  return state.imageCount < FREE_IMAGE_LIMIT;
}
function canSendPdf() {
  if (state.isPremium) return true;
  return state.pdfCount < FREE_PDF_LIMIT;
}

function incrementCount(type) {
  if (type === 'text') state.textCount++;
  else if (type === 'image') state.imageCount++;
  else if (type === 'pdf') state.pdfCount++;
  state.totalSolved++;
  saveState();
  updateLimitUI();
}

function updateLimitUI() {
  if (!dom.messageLimitInfo) return;
  if (state.isPremium) {
    dom.messageLimitInfo.innerHTML = '<span style="color:#f59e0b">⭐ Premium: Unlimited</span>';
  } else {
    const textLeft = FREE_TEXT_LIMIT - state.textCount;
    const imgLeft = FREE_IMAGE_LIMIT - state.imageCount;
    dom.messageLimitInfo.innerHTML = `💬 ${textLeft} text · 🖼️ ${imgLeft} img · 📄 ${FREE_PDF_LIMIT - state.pdfCount} pdf`;
  }
}

function updateStreak() {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (state.lastActiveDate === yesterday) {
    state.streakDays++;
  } else if (state.lastActiveDate !== today) {
    state.streakDays = 1;
  }
  state.lastActiveDate = today;
  saveState();
}

// ===== SYSTEM PROMPT (shared by both APIs) =====
function getSystemPrompt() {
  if (state.noSystemPrompt) return '';
  const langMap = {
    hinglish: 'Always respond in Hinglish (Hindi + English mix). Example: "Bhai, yeh formula important hai SSC ke liye!"',
    hindi: 'Always respond in Hindi (Romanized script).',
    english: 'Always respond in clear, simple English.'
  };
  const modeMap = {
    cgl: 'SSC CGL (Tier 1 & 2: Quant, English, Reasoning, GK)',
    chsl: 'SSC CHSL (10+2 level: simple questions)',
    gd: 'SSC GD Constable (basic level GK, Math, English)',
    mts: 'SSC MTS (10th level, objective questions)',
    cpo: 'SSC CPO/SI (Police recruitment: GK, Reasoning, Maths)',
  };
  const wordLimit = state.shortResponseMode ? 120 : 250;
  return `You are SSC PrepAI, an expert SSC exam tutor focused on ${modeMap[state.sscMode] || 'SSC exams'}.
${langMap[state.aiLang]}
Rules:
- Formulas and shortcuts first
- Use real SSC exam examples
- Keep responses under ${wordLimit} words
- End with a quick tip or trick
- For math: show step-by-step solution
Topics: Quant (Arithmetic, Algebra, Geometry, Trigonometry), English (Grammar, Vocab, Comprehension), Reasoning (Verbal+Non-verbal), GK/Current Affairs.`;
}

// ===== SMART ROUTER — DeepSeek for TEXT, Gemini for IMAGE/PDF =====
async function callAI(userMessage, chatHistory = [], imageBase64Array = [], pdfBase64 = null) {
  const hasImage = imageBase64Array.length > 0;
  const hasPdf = !!pdfBase64;

  if (hasImage || hasPdf) {
    // Multimodal → Gemini Vision
    if (dom.aiStatus) dom.aiStatus.innerHTML = '● 🔍 Gemini Vision Solving...';
    return await callGeminiVision(userMessage, chatHistory, imageBase64Array, pdfBase64);
  } else {
    // Pure text → DeepSeek (cheaper + very smart for SSC)
    if (dom.aiStatus) dom.aiStatus.innerHTML = '● 🧠 DeepSeek Thinking...';
    return await callDeepSeek(userMessage, chatHistory);
  }
}

// ===== DEEPSEEK API (Text Questions) =====
async function callDeepSeek(userMessage, chatHistory = []) {
  // Cache check
  if (state.cachingEnabled) {
    const cacheKey = `ds:${state.aiLang}:${state.sscMode}:${userMessage.trim().toLowerCase().substring(0, 100)}`;
    if (state.responseCache[cacheKey]) {
      console.log('DeepSeek cache hit!');
      return state.responseCache[cacheKey];
    }
  }

  const historyLimit = state.limitHistoryMode ? 2 : 6;
  const messages = [];

  // System prompt
  const systemPrompt = getSystemPrompt();
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

  // Chat history
  chatHistory.slice(-historyLimit).forEach(m => {
    messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content });
  });

  // Current user message
  messages.push({ role: 'user', content: userMessage });

  const body = {
    model: DEEPSEEK_MODEL,
    messages,
    max_tokens: state.shortResponseMode ? 300 : 800,
    temperature: 0.7,
    stream: false
  };

  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`DeepSeek Error ${response.status}: ${errData?.error?.message || 'Unknown'}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  const result = text || 'Sorry, kuch ho gaya. Please try again.';

  // Cache the result
  if (state.cachingEnabled && text) {
    const cacheKey = `ds:${state.aiLang}:${state.sscMode}:${userMessage.trim().toLowerCase().substring(0, 100)}`;
    state.responseCache[cacheKey] = result;
    saveState();
  }

  return result;
}

// ===== GEMINI VISION API (Image + PDF) =====
async function callGeminiVision(userMessage, chatHistory = [], imageBase64Array = [], pdfBase64 = null) {
  const historyLimit = state.limitHistoryMode ? 2 : 4;
  const recentHistory = chatHistory.slice(-historyLimit).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  // Build multimodal user parts
  const userParts = [];

  // Attach images
  imageBase64Array.forEach(img => {
    userParts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
  });

  // Attach PDF
  if (pdfBase64) {
    userParts.push({ inline_data: { mime_type: 'application/pdf', data: pdfBase64 } });
  }

  userParts.push({ text: userMessage });

  const systemPrompt = getSystemPrompt();
  const body = {
    ...(systemPrompt ? { system_instruction: { parts: [{ text: systemPrompt }] } } : {}),
    contents: [
      ...recentHistory,
      { role: 'user', parts: userParts }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: state.shortResponseMode ? 300 : 800,
      topP: 0.9
    }
  };

  const response = await fetch(GEMINI_VISION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Gemini Error ${response.status}: ${errData?.error?.message || 'Unknown'}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || 'Sorry, image/PDF analyze nahi ho paya. Please try again.';
}

// ===== MARKDOWN FORMATTER =====
function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([^`]+)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

// ===== MESSAGE RENDERING =====
function addMessage(role, content, isStreaming = false, attachments = null) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const avatarText = role === 'ai' ? '🤖' : (state.user?.name?.[0]?.toUpperCase() || 'U');

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
    <div class="message-avatar">${avatarText}</div>
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
    <div class="message-avatar">🤖</div>
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

function removeTypingIndicator() {
  document.getElementById('typing-indicator')?.remove();
}

function scrollToBottom() {
  setTimeout(() => {
    if (dom.messagesContainer) {
      dom.messagesContainer.scrollTo({ top: dom.messagesContainer.scrollHeight, behavior: 'smooth' });
    }
  }, 100);
}

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
  saveState();
  btn.textContent = '✅';
  setTimeout(() => { btn.textContent = '🔖'; }, 2000);
  showToast('🔖 Bookmarked!');
};

window.shareMessage = function(btn) {
  const bubble = btn.closest('.message-content')?.querySelector('.message-bubble');
  if (!bubble) return;
  const text = `SSC PrepAI Answer:\n\n${bubble.innerText.substring(0, 500)}\n\nPrepare with SSC PrepAI 🎯`;
  if (navigator.share) {
    navigator.share({ title: 'SSC PrepAI', text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text);
    showToast('📋 Copied to clipboard for sharing!');
  }
};

// ===== AI FOLLOW-UP SUGGESTIONS =====
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

window.sendFollowUp = function(text) {
  dom.messageInput.value = text;
  sendMessage();
};

function getFollowUpSuggestions(question) {
  const q = question.toLowerCase();
  if (q.includes('formula') || q.includes('math')) {
    return ['Give me practice questions', 'Show a trick to solve faster', 'Common mistakes in this topic?'];
  }
  if (q.includes('grammar') || q.includes('english')) {
    return ['Give me example sentences', 'Practice questions on this', 'Common errors in SSC?'];
  }
  if (q.includes('reasoning') || q.includes('puzzle')) {
    return ['Give me similar questions', 'What is the shortcut?', 'More examples please'];
  }
  if (q.includes('gk') || q.includes('current affairs') || q.includes('history')) {
    return ['Give me MCQs on this', 'What is asked in SSC exams?', 'Important related facts?'];
  }
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

  if (!canSendImage()) {
    showToast(`❌ Daily image limit (${FREE_IMAGE_LIMIT}) reached. Upgrade to Premium!`);
    openPremiumModal();
    return;
  }

  const MAX_SIZE = 4 * 1024 * 1024; // 4MB
  for (const file of files) {
    if (file.size > MAX_SIZE) {
      showToast(`❌ ${file.name} too large. Max 4MB per image.`);
      continue;
    }
    const compressed = await compressImage(file);
    pendingImageFiles.push({ data: compressed.base64, mimeType: compressed.mimeType, name: file.name });
  }

  updateAttachmentPreview();
  e.target.value = '';
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
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
        else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
    };
    img.onerror = () => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ base64: e.target.result.split(',')[1], mimeType: file.type });
      reader.readAsDataURL(file);
    };
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
  const file = e.target.files[0];
  if (!file) return;

  if (!canSendPdf()) {
    showToast(`❌ Daily PDF limit (${FREE_PDF_LIMIT}) reached. Upgrade to Premium!`);
    openPremiumModal();
    return;
  }

  const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_PDF_SIZE) {
    showToast('❌ PDF too large. Max 10MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    pendingPdfFile = { data: ev.target.result.split(',')[1], name: file.name };
    updateAttachmentPreview();
    showToast(`📄 PDF "${file.name}" ready. Ask a question about it!`);
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function updateAttachmentPreview() {
  if (!dom.attachmentPreview) return;
  const items = [];
  pendingImageFiles.forEach((img, i) => {
    items.push(`<div class="attach-item">
      <img src="data:${img.mimeType};base64,${img.data}" class="attach-thumb" />
      <button onclick="removeImage(${i})" class="attach-remove">✕</button>
    </div>`);
  });
  if (pendingPdfFile) {
    items.push(`<div class="attach-item attach-pdf">
      <span>📄 ${escapeHtml(pendingPdfFile.name)}</span>
      <button onclick="removePdf()" class="attach-remove">✕</button>
    </div>`);
  }
  dom.attachmentPreview.innerHTML = items.join('');
  dom.attachmentPreview.style.display = items.length ? 'flex' : 'none';
}

window.removeImage = function(i) {
  pendingImageFiles.splice(i, 1);
  updateAttachmentPreview();
};
window.removePdf = function() {
  pendingPdfFile = null;
  updateAttachmentPreview();
};

// ===== SEND MESSAGE =====
async function sendMessage() {
  const message = dom.messageInput.value.trim();
  const hasImages = pendingImageFiles.length > 0;
  const hasPdf = !!pendingPdfFile;

  if (!message && !hasImages && !hasPdf) return;
  if (isSending) return;

  // Check limits
  if (hasImages && !canSendImage()) {
    showToast(`❌ Daily image limit reached. Upgrade to Premium!`);
    openPremiumModal(); return;
  }
  if (hasPdf && !canSendPdf()) {
    showToast(`❌ Daily PDF limit reached. Upgrade to Premium!`);
    openPremiumModal(); return;
  }
  if (!canSendText()) {
    showToast(`❌ Daily text limit (${FREE_TEXT_LIMIT}) reached. Upgrade to Premium!`);
    openPremiumModal(); return;
  }

  isSending = true;
  dom.sendBtn.disabled = true;
  const msgText = message || (hasImages ? 'Solve this question from the image.' : 'Analyze this PDF and give key points.');
  dom.messageInput.value = '';
  dom.messageInput.style.height = 'auto';

  if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'none';

  // Snapshot attachments
  const snapImages = [...pendingImageFiles];
  const snapPdf = pendingPdfFile ? { ...pendingPdfFile } : null;
  pendingImageFiles = [];
  pendingPdfFile = null;
  updateAttachmentPreview();

  // Display user message
  const attachDisplay = snapImages.length || snapPdf ? { images: snapImages, pdfName: snapPdf?.name } : null;
  addMessage('user', msgText, false, attachDisplay);
  currentMessages.push({ role: 'user', content: msgText });

  addTypingIndicator();
  if (dom.aiStatus) dom.aiStatus.innerHTML = '● Routing to AI...';

  try {
    const response = await callAI(
      msgText,
      currentMessages.slice(-6),
      snapImages,
      snapPdf?.data || null
    );

    removeTypingIndicator();
    addMessage('ai', response);
    currentMessages.push({ role: 'ai', content: response });

    // Add follow-up suggestions
    setTimeout(() => addFollowUpSuggestions(msgText), 500);

    // Increment correct counters
    if (snapImages.length) incrementCount('image');
    else if (snapPdf) incrementCount('pdf');
    else incrementCount('text');

    saveCurrentSession();

    if (dom.aiStatus) dom.aiStatus.innerHTML = '● AI Ready';

  } catch (error) {
    console.error('Error:', error);
    removeTypingIndicator();
    let errMsg = '⚠️ Connection error. Please check your internet and try again.';
    if (error.message?.includes('400')) errMsg = '⚠️ File too large or unsupported format. Try a smaller file.';
    if (error.message?.includes('429')) errMsg = '⚠️ Too many requests. Please wait a moment and try again.';
    addMessage('ai', errMsg);
    if (dom.aiStatus) dom.aiStatus.innerHTML = '● Error';
  }

  isSending = false;
  dom.sendBtn.disabled = false;
  scrollToBottom();
}

// ===== CHAT SESSION MANAGEMENT =====
function createNewSession() {
  const sessionId = Date.now().toString();
  const newSession = { id: sessionId, title: 'New Chat', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  state.chatSessions.unshift(newSession);
  state.currentSessionId = sessionId;
  currentMessages = [];
  saveState();
  renderChatHistory();
  loadSession(sessionId);
  showToast('💬 New chat started');
}

function loadSession(sessionId) {
  const session = state.chatSessions.find(s => s.id === sessionId);
  if (!session) return;
  state.currentSessionId = sessionId;
  currentMessages = [...session.messages];
  dom.messages.innerHTML = '';
  if (currentMessages.length === 0) {
    if (dom.welcomeScreen) { dom.welcomeScreen.style.display = 'block'; dom.messages.appendChild(dom.welcomeScreen); }
  } else {
    if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'none';
    currentMessages.forEach(msg => addMessage(msg.role, msg.content));
  }
  renderChatHistory();
  scrollToBottom();
  saveState();
}

function saveCurrentSession() {
  if (!state.currentSessionId) return;
  const idx = state.chatSessions.findIndex(s => s.id === state.currentSessionId);
  if (idx !== -1) {
    state.chatSessions[idx].messages = [...currentMessages];
    state.chatSessions[idx].updatedAt = new Date().toISOString();
    const firstUserMsg = currentMessages.find(m => m.role === 'user');
    if (firstUserMsg && state.chatSessions[idx].title === 'New Chat') {
      state.chatSessions[idx].title = firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
    }
  }
  saveState();
  renderChatHistory();
}

function renderChatHistory() {
  if (!dom.historyList) return;
  dom.historyList.innerHTML = '';
  if (!state.chatSessions.length) {
    dom.historyList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">No chat history yet</div>';
    return;
  }
  state.chatSessions.forEach(session => {
    const date = new Date(session.updatedAt);
    const formattedDate = date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const item = document.createElement('div');
    item.className = `history-item ${session.id === state.currentSessionId ? 'active' : ''}`;
    item.innerHTML = `
      <div class="history-item-icon">💬</div>
      <div class="history-item-content">
        <div class="history-item-title">${escapeHtml(session.title)}</div>
        <div class="history-item-date">${formattedDate}</div>
      </div>
      <button class="history-item-delete" data-id="${session.id}">🗑️</button>
    `;
    item.addEventListener('click', (e) => { if (!e.target.classList.contains('history-item-delete')) { loadSession(session.id); closeDrawer(); } });
    item.querySelector('.history-item-delete').addEventListener('click', (e) => { e.stopPropagation(); deleteSession(session.id); });
    dom.historyList.appendChild(item);
  });
}

function deleteSession(id) {
  state.chatSessions = state.chatSessions.filter(s => s.id !== id);
  if (state.currentSessionId === id) {
    state.chatSessions.length ? loadSession(state.chatSessions[0].id) : createNewSession();
  }
  saveState(); renderChatHistory(); showToast('Chat deleted');
}

function deleteAllSessions() {
  if (confirm('Delete all chat history? This cannot be undone.')) {
    state.chatSessions = [];
    createNewSession();
    saveState(); renderChatHistory();
    showToast('All history cleared');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
}

// ===== DRAWER =====
function openDrawer() { dom.drawer.classList.add('open'); dom.drawerOverlay.classList.add('active'); renderChatHistory(); }
function closeDrawer() { dom.drawer.classList.remove('open'); dom.drawerOverlay.classList.remove('active'); }

// ===== THEME =====
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sscai_theme', theme);
  if (dom.darkModeToggle) dom.darkModeToggle.checked = theme === 'dark';
}
function toggleTheme() { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); }

// ===== VOICE INPUT =====
function setupVoiceInput() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    if (dom.voiceInputBtn) dom.voiceInputBtn.style.display = 'none';
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SR();
  recognition.lang = state.aiLang === 'hindi' ? 'hi-IN' : 'hi-IN';
  recognition.interimResults = false;
  recognition.continuous = false;

  dom.voiceInputBtn?.addEventListener('click', () => {
    dom.voiceInputBtn.classList.add('recording');
    showToast('🎤 Listening... Speak now', 3000);
    recognition.start();
  });

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    dom.messageInput.value = transcript;
    dom.messageInput.dispatchEvent(new Event('input'));
    showToast(`🎤 "${transcript}"`, 2000);
    setTimeout(() => { if (transcript.trim()) sendMessage(); }, 500);
  };
  recognition.onerror = () => { dom.voiceInputBtn.classList.remove('recording'); showToast('🎤 Voice failed. Try again.'); };
  recognition.onend = () => dom.voiceInputBtn.classList.remove('recording');
}

// ===== USER UI =====
function updateUserUI() {
  const name = state.user?.name || 'Guest';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const plan = state.isPremium ? '⭐ Premium' : 'Free Plan';
  if (dom.headerAvatar) dom.headerAvatar.textContent = initials;
  if (dom.drawerAvatar) dom.drawerAvatar.textContent = initials;
  if (dom.drawerUserName) dom.drawerUserName.textContent = name;
  if (dom.drawerUserPlan) dom.drawerUserPlan.textContent = plan;

  const totalChats = state.chatSessions.reduce((acc, s) => acc + s.messages.filter(m => m.role === 'user').length, 0);
  if (document.getElementById('drawerTotalChats')) document.getElementById('drawerTotalChats').textContent = totalChats;
  if (document.getElementById('drawerTodayChats')) document.getElementById('drawerTodayChats').textContent = state.textCount;
  const remaining = state.isPremium ? '∞' : Math.max(0, FREE_TEXT_LIMIT - state.textCount);
  if (document.getElementById('drawerRemainingChats')) document.getElementById('drawerRemainingChats').textContent = remaining;

  const upgradeDrawerBtn = document.getElementById('upgradeDrawerBtn');
  if (upgradeDrawerBtn) upgradeDrawerBtn.style.display = state.isPremium ? 'none' : '';

  // Streak
  const streakEl = document.getElementById('streakCount');
  if (streakEl) streakEl.textContent = `🔥 ${state.streakDays} day streak`;

  updateLimitUI();
}

// ===== PROFILE & AUTH =====
function openProfileModal() { updateProfileUI(); dom.profileModal.classList.add('active'); }
function closeProfileModal() { dom.profileModal.classList.remove('active'); }

function updateProfileUI() {
  if (state.user) {
    dom.profileLoggedOut.classList.add('hidden');
    dom.profileLoggedIn.classList.remove('hidden');
    dom.loginForm.classList.add('hidden');
    dom.signupForm.classList.add('hidden');
    const initials = state.user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    dom.profileAvatar.textContent = initials;
    dom.profileName.textContent = state.user.name;
    dom.profileEmail.textContent = state.user.email || '—';
    dom.profileMobile.textContent = state.user.mobile || '—';
    dom.profileSubscription.textContent = state.isPremium ? '⭐ Premium' : 'Free';
    dom.profileSince.textContent = state.user.joinedDate || new Date().toLocaleDateString();
    dom.profileBadge.textContent = state.isPremium ? '⭐ Premium' : 'Free Plan';
    const totalUserMsgs = state.chatSessions.reduce((acc, s) => acc + s.messages.filter(m => m.role === 'user').length, 0);
    const el1 = document.getElementById('profileTotalChats'); if (el1) el1.textContent = totalUserMsgs;
    const el2 = document.getElementById('profileTodayChats'); if (el2) el2.textContent = state.textCount;
    const el3 = document.getElementById('profileTotalSolved'); if (el3) el3.textContent = state.totalSolved;
    const el4 = document.getElementById('profileStreak'); if (el4) el4.textContent = `🔥 ${state.streakDays}`;
  } else {
    dom.profileLoggedOut.classList.remove('hidden');
    dom.profileLoggedIn.classList.add('hidden');
    dom.loginForm.classList.add('hidden');
    dom.signupForm.classList.add('hidden');
  }
}

function showLoginForm() { dom.profileLoggedOut.classList.add('hidden'); dom.loginForm.classList.remove('hidden'); dom.signupForm.classList.add('hidden'); }
function showSignupForm() { dom.profileLoggedOut.classList.add('hidden'); dom.loginForm.classList.add('hidden'); dom.signupForm.classList.remove('hidden'); }

function handleLogin() {
  const email = document.getElementById('loginEmail')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;
  if (!email || !password) { showToast('Please fill all fields'); return; }
  const savedUser = localStorage.getItem('sscai_user');
  if (savedUser) {
    const user = JSON.parse(savedUser);
    if (user.email === email) { state.user = user; saveState(); updateUserUI(); updateProfileUI(); closeProfileModal(); showToast(`Welcome back, ${user.name}!`); return; }
  }
  state.user = { name: email.split('@')[0], email, mobile: '', joinedDate: new Date().toLocaleDateString() };
  saveState(); updateUserUI(); updateProfileUI(); closeProfileModal(); showToast(`Welcome, ${state.user.name}!`);
}

function handleSignup() {
  const name = document.getElementById('signupName')?.value.trim();
  const email = document.getElementById('signupEmail')?.value.trim();
  const mobile = document.getElementById('signupMobile')?.value.trim();
  const password = document.getElementById('signupPassword')?.value;
  if (!name || !email || !password) { showToast('Please fill all fields'); return; }
  if (password.length < 6) { showToast('Password min 6 characters'); return; }
  state.user = { name, email, mobile: mobile || '', joinedDate: new Date().toLocaleDateString() };
  saveState(); updateUserUI(); updateProfileUI(); closeProfileModal(); showToast(`Welcome to SSC PrepAI, ${name}! 🎉`);
}

function handleLogout() {
  state.user = null; state.isPremium = false;
  saveState(); updateUserUI(); updateProfileUI(); closeProfileModal(); showToast('Logged out');
}

// ===== BOOKMARKS =====
function openBookmarksModal() {
  renderBookmarks();
  dom.bookmarksModal.classList.add('active');
}
function closeBookmarksModal() { dom.bookmarksModal.classList.remove('active'); }

function renderBookmarks() {
  if (!dom.bookmarksList) return;
  if (!state.bookmarks.length) {
    dom.bookmarksList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">No bookmarks yet. Bookmark important AI answers!</div>';
    return;
  }
  dom.bookmarksList.innerHTML = state.bookmarks.map((b, i) => `
    <div class="bookmark-item">
      <div class="bookmark-content">${escapeHtml(b.content)}${b.content.length >= 300 ? '...' : ''}</div>
      <div class="bookmark-meta">
        <span class="bookmark-time">${b.time}</span>
        <button onclick="deleteBookmark(${i})" class="bookmark-delete">🗑️</button>
      </div>
    </div>
  `).join('');
}

window.deleteBookmark = function(i) {
  state.bookmarks.splice(i, 1);
  saveState();
  renderBookmarks();
};

// ===== PREMIUM =====
function openPremiumModal() { dom.premiumModal.classList.add('active'); }
function closePremiumModal() { dom.premiumModal.classList.remove('active'); }

function handlePayment() {
  // Cashfree payment flow
  const orderData = {
    order_id: `ORDER_${Date.now()}`,
    order_amount: PREMIUM_PRICE,
    order_currency: 'INR',
    customer_details: {
      customer_id: state.user?.email || `guest_${Date.now()}`,
      customer_name: state.user?.name || 'Student',
      customer_email: state.user?.email || 'student@prepai.com',
      customer_phone: state.user?.mobile || '9999999999'
    }
  };

  // For production, this should go via your backend to create order securely
  // Here we use the payment link as fallback
  const paymentUrl = `https://payments.cashfree.com/forms/sscprepai?amount=${PREMIUM_PRICE}&name=${encodeURIComponent(state.user?.name || 'Student')}`;
  window.open(paymentUrl, '_blank');
  showToast('💳 Payment page opening... After payment, click "Verify Payment"');

  setTimeout(() => {
    if (confirm('✅ Payment completed? Click OK to activate Premium access.')) {
      activatePremium();
    }
  }, 12000);
}

function activatePremium() {
  state.isPremium = true;
  saveState(); updateUserUI(); updateProfileUI(); closePremiumModal();
  showToast('🎉 Premium activated! Unlimited access unlocked! 🚀');
}

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
window.openProfileModal = openProfileModal;

// ===== WELCOME CHIPS =====
function setupWelcomeChips() {
  document.querySelectorAll('.welcome-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.dataset.prompt;
      if (prompt) { dom.messageInput.value = prompt; sendMessage(); }
    });
  });
}

// ===== SSC MODE =====
function setupSscMode() {
  if (!dom.sscModeSelect) return;
  dom.sscModeSelect.value = state.sscMode;
  dom.sscModeSelect.addEventListener('change', (e) => {
    state.sscMode = e.target.value;
    saveState();
    const modeNames = { cgl: 'SSC CGL', chsl: 'SSC CHSL', gd: 'SSC GD', mts: 'SSC MTS', cpo: 'SSC CPO' };
    showToast(`✅ Mode: ${modeNames[state.sscMode] || state.sscMode}`);
    updateModeHeaderBadge();
  });
}

function updateModeHeaderBadge() {
  const badge = document.getElementById('sscModeBadge');
  if (badge) badge.textContent = state.sscMode.toUpperCase();
}

// ===== AUTO RESIZE TEXTAREA =====
function autoResizeTextarea() {
  dom.messageInput.style.height = 'auto';
  dom.messageInput.style.height = Math.min(dom.messageInput.scrollHeight, 100) + 'px';
}

// ===== INITIALIZATION =====
function initApp() {
  applyTheme(state.theme);
  if (dom.darkModeToggle) dom.darkModeToggle.checked = state.theme === 'dark';
  if (dom.aiLangSelect) dom.aiLangSelect.value = state.aiLang;

  resetDailyCounts();
  updateUserUI();
  updateModeHeaderBadge();

  if (!state.chatSessions.length) {
    createNewSession();
  } else if (state.currentSessionId && state.chatSessions.some(s => s.id === state.currentSessionId)) {
    loadSession(state.currentSessionId);
  } else {
    loadSession(state.chatSessions[0].id);
  }

  renderChatHistory();

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

  // Upgrade drawer
  document.getElementById('upgradeDrawerBtn')?.addEventListener('click', () => { closeDrawer(); openPremiumModal(); });

  if (dom.darkModeToggle) dom.darkModeToggle.addEventListener('change', (e) => applyTheme(e.target.checked ? 'dark' : 'light'));
  if (dom.aiLangSelect) dom.aiLangSelect.addEventListener('change', (e) => { state.aiLang = e.target.value; saveState(); showToast('Language saved'); });

  // Cost saving toggles
  const toggles = [
    ['cachingToggle', 'cachingEnabled', '✅ Caching ON', '❌ Caching OFF'],
    ['shortResponseToggle', 'shortResponseMode', '✅ Short mode ON', '❌ Short mode OFF'],
    ['limitHistoryToggle', 'limitHistoryMode', '✅ History limit ON', '❌ History limit OFF'],
    ['noSystemPromptToggle', 'noSystemPrompt', '✅ No system prompt ON', '❌ System prompt ON'],
  ];
  toggles.forEach(([id, key, onMsg, offMsg]) => {
    const el = document.getElementById(id);
    if (el) {
      el.checked = state[key];
      el.addEventListener('change', (e) => { state[key] = e.target.checked; saveState(); showToast(e.target.checked ? onMsg : offMsg); });
    }
  });

  // Plan badge
  const planBadge = document.getElementById('planBadgeSettings');
  if (planBadge) planBadge.textContent = state.isPremium ? 'Unlimited' : '100/day';

  // Profile events
  if (dom.headerAvatar) dom.headerAvatar.addEventListener('click', openProfileModal);
  document.getElementById('drawerUserCard')?.addEventListener('click', openProfileModal);
  dom.closeProfileBtn?.addEventListener('click', closeProfileModal);
  dom.loginShowBtn?.addEventListener('click', showLoginForm);
  dom.signupShowBtn?.addEventListener('click', showSignupForm);
  dom.switchToSignup?.addEventListener('click', (e) => { e.preventDefault(); showSignupForm(); });
  dom.switchToLogin?.addEventListener('click', (e) => { e.preventDefault(); showLoginForm(); });
  dom.loginBtn?.addEventListener('click', handleLogin);
  dom.signupBtn?.addEventListener('click', handleSignup);
  dom.logoutBtn?.addEventListener('click', handleLogout);
  dom.upgradeFromProfileBtn?.addEventListener('click', () => { closeProfileModal(); openPremiumModal(); });
  dom.upgradeFromSettingsBtn?.addEventListener('click', () => { closeSettingsModal(); openPremiumModal(); });

  // Premium
  dom.closePremiumBtn?.addEventListener('click', closePremiumModal);
  dom.payWithCashfreeBtn?.addEventListener('click', handlePayment);

  // Legal
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

  // Bookmarks
  dom.bookmarksBtn?.addEventListener('click', openBookmarksModal);
  dom.closeBookmarksBtn?.addEventListener('click', closeBookmarksModal);

  // Modal overlay close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
  });

  // File uploads
  setupImageUpload();
  setupPdfUpload();

  // SSC mode
  setupSscMode();

  // Voice
  setupVoiceInput();

  // Welcome chips
  setupWelcomeChips();

  // Hide splash
  setTimeout(() => {
    if (dom.splash) {
      dom.splash.style.opacity = '0';
      setTimeout(() => { dom.splash.style.display = 'none'; dom.app.classList.remove('hidden'); scrollToBottom(); }, 500);
    }
  }, 1800);
}

document.addEventListener('DOMContentLoaded', initApp);
