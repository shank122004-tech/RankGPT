'use strict';

// ===== CONFIGURATION =====
const GEMINI_API_KEY = 'AIzaSyATbNbVxK5PQY39Z6HSXPPphsf4sp4A-kM';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
const FREE_DAILY_LIMIT = 10;
const APP_NAME = 'RankGPT';
const CASHFREE_PAYMENT_LINK = 'https://payments.cashfree.com/forms/subscription4u';

// ===== STATE =====
let state = {
  theme: localStorage.getItem('rankgpt_theme') || 'dark',
  user: JSON.parse(localStorage.getItem('rankgpt_user') || 'null'),
  chatSessions: JSON.parse(localStorage.getItem('rankgpt_sessions') || '[]'),
  currentSessionId: localStorage.getItem('rankgpt_current_session'),
  chatCount: parseInt(localStorage.getItem('rankgpt_chat_count') || '0'),
  chatCountDate: localStorage.getItem('rankgpt_chat_date') || '',
  aiLang: localStorage.getItem('rankgpt_lang') || 'hinglish',
  isPremium: localStorage.getItem('rankgpt_premium') === 'true',
  // Cost-saving settings
  cachingEnabled: localStorage.getItem('rankgpt_caching') !== 'false',
  shortResponseMode: localStorage.getItem('rankgpt_short_response') === 'true',
  limitHistoryMode: localStorage.getItem('rankgpt_limit_history') === 'true',
  noSystemPrompt: localStorage.getItem('rankgpt_no_sysprompt') === 'true',
  // Response cache map
  responseCache: JSON.parse(localStorage.getItem('rankgpt_cache') || '{}')
};

let currentMessages = [];
let isSending = false;

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
  // Profile modals
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
  // Premium modal
  premiumModal: document.getElementById('premiumModal'),
  closePremiumBtn: document.getElementById('closePremiumBtn'),
  payWithCashfreeBtn: document.getElementById('payWithCashfreeBtn'),
  // Terms & Privacy
  termsLink: document.getElementById('termsLink'),
  privacyLink: document.getElementById('privacyLink'),
  termsModal: document.getElementById('termsModal'),
  privacyModal: document.getElementById('privacyModal'),
  closeTermsBtn: document.getElementById('closeTermsBtn'),
  closePrivacyBtn: document.getElementById('closePrivacyBtn')
};

// ===== HELPER FUNCTIONS =====
function showToast(message, duration = 2500) {
  if (!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.classList.add('show');
  setTimeout(() => dom.toast.classList.remove('show'), duration);
}

function saveState() {
  if (state.user) localStorage.setItem('rankgpt_user', JSON.stringify(state.user));
  localStorage.setItem('rankgpt_sessions', JSON.stringify(state.chatSessions));
  if (state.currentSessionId) localStorage.setItem('rankgpt_current_session', state.currentSessionId);
  localStorage.setItem('rankgpt_chat_count', state.chatCount);
  localStorage.setItem('rankgpt_chat_date', state.chatCountDate);
  localStorage.setItem('rankgpt_lang', state.aiLang);
  localStorage.setItem('rankgpt_premium', state.isPremium);
  localStorage.setItem('rankgpt_caching', state.cachingEnabled);
  localStorage.setItem('rankgpt_short_response', state.shortResponseMode);
  localStorage.setItem('rankgpt_limit_history', state.limitHistoryMode);
  localStorage.setItem('rankgpt_no_sysprompt', state.noSystemPrompt);
  // Save cache (limit to 50 entries to avoid quota issues)
  const cacheKeys = Object.keys(state.responseCache);
  if (cacheKeys.length > 50) {
    const trimmed = {};
    cacheKeys.slice(-50).forEach(k => { trimmed[k] = state.responseCache[k]; });
    state.responseCache = trimmed;
  }
  try { localStorage.setItem('rankgpt_cache', JSON.stringify(state.responseCache)); } catch(e) {}
}

function checkChatLimit() {
  if (state.isPremium) return true;
  return state.chatCount < FREE_DAILY_LIMIT;
}

function incrementChatCount() {
  state.chatCount++;
  saveState();
  if (dom.chatCount) dom.chatCount.textContent = state.chatCount;
  updateMessageLimitUI();
}

function resetDailyChatCount() {
  const today = new Date().toDateString();
  if (state.chatCountDate !== today) {
    state.chatCount = 0;
    state.chatCountDate = today;
    saveState();
  }
  if (dom.chatCount) dom.chatCount.textContent = state.chatCount;
  updateMessageLimitUI();
}

function updateMessageLimitUI() {
  if (!dom.messageLimitInfo) return;
  if (state.isPremium) {
    dom.messageLimitInfo.innerHTML = '⭐ Premium: Unlimited';
  } else {
    const remaining = FREE_DAILY_LIMIT - state.chatCount;
    dom.messageLimitInfo.innerHTML = `Free: ${state.chatCount}/${FREE_DAILY_LIMIT} messages today`;
  }
}

function updateUserUI() {
  const name = state.user?.name || 'Guest';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const plan = state.isPremium ? '⭐ Premium' : 'Free Plan';
  
  if (dom.headerAvatar) dom.headerAvatar.textContent = initials;
  if (dom.drawerAvatar) dom.drawerAvatar.textContent = initials;
  if (dom.drawerUserName) dom.drawerUserName.textContent = name;
  if (dom.drawerUserPlan) dom.drawerUserPlan.textContent = plan;
  
  // Update drawer stats
  const totalChats = state.chatSessions.reduce((acc, s) => acc + s.messages.filter(m => m.role === 'user').length, 0);
  const remaining = state.isPremium ? '∞' : Math.max(0, FREE_DAILY_LIMIT - state.chatCount);
  if (document.getElementById('drawerTotalChats')) document.getElementById('drawerTotalChats').textContent = totalChats;
  if (document.getElementById('drawerTodayChats')) document.getElementById('drawerTodayChats').textContent = state.chatCount;
  if (document.getElementById('drawerRemainingChats')) document.getElementById('drawerRemainingChats').textContent = remaining;

  // Hide upgrade button if premium
  const upgradeDrawerBtn = document.getElementById('upgradeDrawerBtn');
  if (upgradeDrawerBtn) upgradeDrawerBtn.style.display = state.isPremium ? 'none' : '';

  updateMessageLimitUI();
}

// ===== SYSTEM PROMPT =====
function getSystemPrompt() {
  if (state.noSystemPrompt) return '';
  
  const langInstructions = {
    hinglish: 'Always respond in Hinglish (mix of Hindi and English). Example: "Bhai, yeh formula bohot important hai SSC ke liye!"',
    hindi: 'Always respond in Hindi using Romanized script.',
    english: 'Always respond in clear, simple English.'
  };
  
  const wordLimit = state.shortResponseMode ? 150 : 200;
  
  return `You are RankGPT, an expert SSC exam tutor. Keep answers short, clear, and practical.

${langInstructions[state.aiLang]}

Guidelines:
- Give formulas and shortcuts first
- Use examples relevant to SSC CGL/CHSL/GD/MTS/CPO
- Keep responses under ${wordLimit} words
- End with a quick tip or formula

Topics: Quant (Arithmetic, Algebra, Geometry, Trigonometry), English (Grammar, Vocabulary), Reasoning, GK.`;
}

// ===== GEMINI API CALL =====
async function callGemini(userMessage, chatHistory = []) {
  // --- COST SAVING: Check cache first ---
  if (state.cachingEnabled) {
    const cacheKey = `${state.aiLang}:${userMessage.trim().toLowerCase().substring(0, 100)}`;
    if (state.responseCache[cacheKey]) {
      console.log('Cache hit! Saved API call.');
      return state.responseCache[cacheKey];
    }
  }

  // --- COST SAVING: Limit history context ---
  const historyLimit = state.limitHistoryMode ? 2 : 4;
  const recentHistory = chatHistory.slice(-historyLimit).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));
  
  const systemPrompt = getSystemPrompt();
  const body = {
    ...(systemPrompt ? { system_instruction: { parts: [{ text: systemPrompt }] } } : {}),
    contents: [
      ...recentHistory,
      { role: 'user', parts: [{ text: userMessage }] }
    ],
    generationConfig: { 
      temperature: 0.7, 
      maxOutputTokens: state.shortResponseMode ? 200 : 300,
      topP: 0.9
    }
  };
  
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const result = text || 'Sorry, I could not generate a response. Please try again.';

  // --- COST SAVING: Store in cache ---
  if (state.cachingEnabled && text) {
    const cacheKey = `${state.aiLang}:${userMessage.trim().toLowerCase().substring(0, 100)}`;
    state.responseCache[cacheKey] = result;
    saveState();
  }

  return result;
}

// ===== MESSAGE RENDERING =====
function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```([^`]+)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

function addMessage(role, content, isStreaming = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const avatarText = role === 'ai' ? 'AI' : (state.user?.name?.[0] || 'U');
  
  messageDiv.innerHTML = `
    <div class="message-avatar">${role === 'ai' ? '🤖' : avatarText}</div>
    <div class="message-content">
      <div class="message-bubble">${isStreaming ? content : formatMarkdown(content)}</div>
      <div class="message-meta">
        <span class="message-time">${time}</span>
        ${role === 'ai' ? `<button class="copy-btn" onclick="copyMessageContent(this)">Copy</button>` : ''}
      </div>
    </div>
  `;
  
  dom.messages.appendChild(messageDiv);
  scrollToBottom();
  return messageDiv;
}

function updateMessageBubble(messageDiv, content) {
  const bubble = messageDiv.querySelector('.message-bubble');
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
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.remove();
}

function scrollToBottom() {
  setTimeout(() => {
    if (dom.messagesContainer) {
      dom.messagesContainer.scrollTo({
        top: dom.messagesContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, 100);
}

window.copyMessageContent = function(btn) {
  const bubble = btn.closest('.message-content')?.querySelector('.message-bubble');
  if (bubble) {
    navigator.clipboard.writeText(bubble.innerText);
    showToast('Copied to clipboard!');
  }
};

// ===== CHAT SESSION MANAGEMENT =====
function createNewSession() {
  const sessionId = Date.now().toString();
  const newSession = {
    id: sessionId,
    title: 'New Chat',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  state.chatSessions.unshift(newSession);
  state.currentSessionId = sessionId;
  currentMessages = [];
  saveState();
  renderChatHistory();
  loadSession(sessionId);
  showToast('New chat started');
}

function loadSession(sessionId) {
  const session = state.chatSessions.find(s => s.id === sessionId);
  if (!session) return;
  
  state.currentSessionId = sessionId;
  currentMessages = [...session.messages];
  
  dom.messages.innerHTML = '';
  
  if (currentMessages.length === 0) {
    if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'block';
    dom.messages.appendChild(dom.welcomeScreen);
  } else {
    if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'none';
    currentMessages.forEach(msg => {
      addMessage(msg.role, msg.content);
    });
  }
  
  renderChatHistory();
  scrollToBottom();
  saveState();
}

function saveCurrentSession() {
  if (!state.currentSessionId) return;
  
  const sessionIndex = state.chatSessions.findIndex(s => s.id === state.currentSessionId);
  if (sessionIndex !== -1) {
    state.chatSessions[sessionIndex].messages = [...currentMessages];
    state.chatSessions[sessionIndex].updatedAt = new Date().toISOString();
    
    const firstUserMsg = currentMessages.find(m => m.role === 'user');
    if (firstUserMsg && state.chatSessions[sessionIndex].title === 'New Chat') {
      state.chatSessions[sessionIndex].title = firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
    }
  } else if (currentMessages.length > 0) {
    const newSession = {
      id: state.currentSessionId,
      title: currentMessages[0]?.content?.substring(0, 30) || 'Chat',
      messages: [...currentMessages],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.chatSessions.unshift(newSession);
  }
  
  saveState();
  renderChatHistory();
}

function renderChatHistory() {
  if (!dom.historyList) return;
  
  dom.historyList.innerHTML = '';
  
  if (state.chatSessions.length === 0) {
    dom.historyList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">No chat history yet</div>';
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
    
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('history-item-delete')) {
        loadSession(session.id);
        closeDrawer();
      }
    });
    
    const deleteBtn = item.querySelector('.history-item-delete');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSession(session.id);
    });
    
    dom.historyList.appendChild(item);
  });
}

function deleteSession(sessionId) {
  state.chatSessions = state.chatSessions.filter(s => s.id !== sessionId);
  
  if (state.currentSessionId === sessionId) {
    if (state.chatSessions.length > 0) {
      loadSession(state.chatSessions[0].id);
    } else {
      createNewSession();
    }
  }
  
  saveState();
  renderChatHistory();
  showToast('Chat deleted');
}

function deleteAllSessions() {
  if (confirm('Delete all chat history? This cannot be undone.')) {
    state.chatSessions = [];
    createNewSession();
    saveState();
    renderChatHistory();
    showToast('All chat history cleared');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== SEND MESSAGE =====
async function sendMessage() {
  const message = dom.messageInput.value.trim();
  if (!message || isSending) return;
  
  if (!checkChatLimit()) {
    openPremiumModal();
    return;
  }
  
  isSending = true;
  dom.sendBtn.disabled = true;
  dom.messageInput.value = '';
  dom.messageInput.style.height = 'auto';
  
  if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'none';
  
  addMessage('user', message);
  currentMessages.push({ role: 'user', content: message });
  
  addTypingIndicator();
  
  if (dom.aiStatus) dom.aiStatus.innerHTML = '● AI Thinking...';
  
  try {
    const response = await callGemini(message, currentMessages.slice(-4));
    
    removeTypingIndicator();
    addMessage('ai', response);
    currentMessages.push({ role: 'ai', content: response });
    
    saveCurrentSession();
    incrementChatCount();
    
    if (dom.aiStatus) dom.aiStatus.innerHTML = '● AI Ready';
    
  } catch (error) {
    console.error('Error:', error);
    removeTypingIndicator();
    addMessage('ai', '⚠️ Connection error. Please check your internet and try again.');
    if (dom.aiStatus) dom.aiStatus.innerHTML = '● Error';
  }
  
  isSending = false;
  dom.sendBtn.disabled = false;
  scrollToBottom();
}

// ===== DRAWER FUNCTIONS =====
function openDrawer() {
  dom.drawer.classList.add('open');
  dom.drawerOverlay.classList.add('active');
  renderChatHistory();
}

function closeDrawer() {
  dom.drawer.classList.remove('open');
  dom.drawerOverlay.classList.remove('active');
}

// ===== THEME FUNCTIONS =====
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('rankgpt_theme', theme);
  if (dom.darkModeToggle) dom.darkModeToggle.checked = theme === 'dark';
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

// ===== VOICE INPUT WITH ANIMATION =====
function setupVoiceInput() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    if (dom.voiceInputBtn) dom.voiceInputBtn.style.display = 'none';
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'hi-IN';
  recognition.interimResults = false;
  recognition.continuous = false;
  
  dom.voiceInputBtn.addEventListener('click', () => {
    // Add recording animation
    dom.voiceInputBtn.classList.add('recording');
    
    // Change icon to listening state
    const voiceIcon = dom.voiceInputBtn.querySelector('.voice-icon');
    if (voiceIcon) {
      voiceIcon.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>';
    }
    
    showToast('🎤 Listening... Speak now', 3000);
    recognition.start();
  });
  
  recognition.onstart = () => {
    console.log('Voice recognition started');
  };
  
  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    dom.messageInput.value = transcript;
    dom.messageInput.dispatchEvent(new Event('input'));
    dom.messageInput.focus();
    showToast(`🎤 "${transcript}"`, 2000);
    
    // Auto-send after voice input
    setTimeout(() => {
      if (transcript.trim()) {
        sendMessage();
      }
    }, 500);
  };
  
  recognition.onerror = (e) => {
    console.error('Voice recognition error:', e.error);
    dom.voiceInputBtn.classList.remove('recording');
    showToast('🎤 Voice recognition failed. Please try again.', 3000);
    
    // Reset icon
    const voiceIcon = dom.voiceInputBtn.querySelector('.voice-icon');
    if (voiceIcon) {
      voiceIcon.innerHTML = '<path d="M12 1a3 3 0 013 3v8a3 3 0 01-6 0V4a3 3 0 013-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>';
    }
  };
  
  recognition.onend = () => {
    dom.voiceInputBtn.classList.remove('recording');
    
    // Reset icon
    const voiceIcon = dom.voiceInputBtn.querySelector('.voice-icon');
    if (voiceIcon) {
      voiceIcon.innerHTML = '<path d="M12 1a3 3 0 013 3v8a3 3 0 01-6 0V4a3 3 0 013-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>';
    }
  };
}

// ===== PROFILE & AUTH FUNCTIONS =====
function openProfileModal() {
  updateProfileUI();
  dom.profileModal.classList.add('active');
}

function closeProfileModal() {
  dom.profileModal.classList.remove('active');
}

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

    // Stats
    const totalUserMsgs = state.chatSessions.reduce((acc, s) => acc + s.messages.filter(m => m.role === 'user').length, 0);
    const profileTotalChats = document.getElementById('profileTotalChats');
    const profileTodayChats = document.getElementById('profileTodayChats');
    if (profileTotalChats) profileTotalChats.textContent = totalUserMsgs;
    if (profileTodayChats) profileTodayChats.textContent = state.chatCount;
  } else {
    dom.profileLoggedOut.classList.remove('hidden');
    dom.profileLoggedIn.classList.add('hidden');
    dom.loginForm.classList.add('hidden');
    dom.signupForm.classList.add('hidden');
  }
}

function showLoginForm() {
  dom.profileLoggedOut.classList.add('hidden');
  dom.loginForm.classList.remove('hidden');
  dom.signupForm.classList.add('hidden');
}

function showSignupForm() {
  dom.profileLoggedOut.classList.add('hidden');
  dom.loginForm.classList.add('hidden');
  dom.signupForm.classList.remove('hidden');
}

function handleLogin() {
  const email = document.getElementById('loginEmail')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;
  
  if (!email || !password) {
    showToast('Please fill in all fields');
    return;
  }
  
  const savedUser = localStorage.getItem('rankgpt_user');
  if (savedUser) {
    const user = JSON.parse(savedUser);
    if (user.email === email) {
      state.user = user;
      saveState();
      updateUserUI();
      updateProfileUI();
      closeProfileModal();
      showToast(`Welcome back, ${user.name}!`);
      return;
    }
  }
  
  state.user = {
    name: email.split('@')[0],
    email: email,
    mobile: '',
    joinedDate: new Date().toLocaleDateString()
  };
  saveState();
  updateUserUI();
  updateProfileUI();
  closeProfileModal();
  showToast(`Welcome, ${state.user.name}!`);
}

function handleSignup() {
  const name = document.getElementById('signupName')?.value.trim();
  const email = document.getElementById('signupEmail')?.value.trim();
  const mobile = document.getElementById('signupMobile')?.value.trim();
  const password = document.getElementById('signupPassword')?.value;
  
  if (!name || !email || !password) {
    showToast('Please fill in all fields');
    return;
  }
  
  if (password.length < 6) {
    showToast('Password must be at least 6 characters');
    return;
  }
  
  state.user = {
    name: name,
    email: email,
    mobile: mobile || '',
    joinedDate: new Date().toLocaleDateString()
  };
  saveState();
  updateUserUI();
  updateProfileUI();
  closeProfileModal();
  showToast(`Welcome to RankGPT, ${name}!`);
}

function handleLogout() {
  state.user = null;
  state.isPremium = false;
  saveState();
  updateUserUI();
  updateProfileUI();
  closeProfileModal();
  showToast('Logged out successfully');
}

// ===== PREMIUM FUNCTIONS =====
function openPremiumModal() {
  dom.premiumModal.classList.add('active');
}

function closePremiumModal() {
  dom.premiumModal.classList.remove('active');
}

function handlePayment() {
  window.open(CASHFREE_PAYMENT_LINK, '_blank');
  showToast('Payment initiated. After payment, click "Verify Payment"');
  
  setTimeout(() => {
    if (confirm('Payment completed? Click OK to activate Premium.')) {
      activatePremium();
    }
  }, 10000);
}

function activatePremium() {
  state.isPremium = true;
  saveState();
  updateUserUI();
  updateProfileUI();
  closePremiumModal();
  showToast('🎉 Premium activated! Unlimited access unlocked.');
}

// ===== SETTINGS FUNCTIONS =====
function openSettingsModal() {
  dom.settingsModal.classList.add('active');
}

function closeSettingsModal() {
  dom.settingsModal.classList.remove('active');
}

// ===== TERMS & PRIVACY =====
function openTermsModal() { dom.termsModal.classList.add('active'); }
function closeTermsModal() { dom.termsModal.classList.remove('active'); }
function openPrivacyModal() { dom.privacyModal.classList.add('active'); }
function closePrivacyModal() { dom.privacyModal.classList.remove('active'); }

function openRefundModal() {
  const el = document.getElementById('refundModal');
  if (el) el.classList.add('active');
}
function closeRefundModal() {
  const el = document.getElementById('refundModal');
  if (el) el.classList.remove('active');
}

function openAiDisclaimerModal() {
  const el = document.getElementById('aiDisclaimerModal');
  if (el) el.classList.add('active');
}
function closeAiDisclaimerModal() {
  const el = document.getElementById('aiDisclaimerModal');
  if (el) el.classList.remove('active');
}

function openAboutModal() {
  const el = document.getElementById('aboutModal');
  if (el) el.classList.add('active');
}
function closeAboutModal() {
  const el = document.getElementById('aboutModal');
  if (el) el.classList.remove('active');
}

// ===== WELCOME CHIPS =====
function setupWelcomeChips() {
  document.querySelectorAll('.welcome-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.dataset.prompt;
      if (prompt) {
        dom.messageInput.value = prompt;
        sendMessage();
      }
    });
  });
}

// ===== AUTO-RESIZE TEXTAREA =====
function autoResizeTextarea() {
  dom.messageInput.style.height = 'auto';
  dom.messageInput.style.height = Math.min(dom.messageInput.scrollHeight, 100) + 'px';
}

// ===== INITIALIZATION =====
function initApp() {
  applyTheme(state.theme);
  if (dom.darkModeToggle) dom.darkModeToggle.checked = state.theme === 'dark';
  if (dom.aiLangSelect) dom.aiLangSelect.value = state.aiLang;
  
  resetDailyChatCount();
  updateUserUI();
  
  if (state.chatSessions.length === 0) {
    createNewSession();
  } else if (state.currentSessionId) {
    const sessionExists = state.chatSessions.some(s => s.id === state.currentSessionId);
    if (sessionExists) {
      loadSession(state.currentSessionId);
    } else {
      loadSession(state.chatSessions[0].id);
    }
  } else {
    loadSession(state.chatSessions[0].id);
  }
  
  renderChatHistory();
  
  // Event listeners
  dom.sendBtn.addEventListener('click', sendMessage);
  dom.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  dom.messageInput.addEventListener('input', autoResizeTextarea);
  
  dom.menuBtn.addEventListener('click', openDrawer);
  dom.closeDrawerBtn.addEventListener('click', closeDrawer);
  dom.drawerOverlay.addEventListener('click', closeDrawer);
  
  dom.newChatBtn.addEventListener('click', () => {
    createNewSession();
    closeDrawer();
  });
  
  dom.clearAllHistoryBtn.addEventListener('click', () => deleteAllSessions());
  
  dom.settingsBtn.addEventListener('click', openSettingsModal);
  dom.closeSettingsBtn.addEventListener('click', closeSettingsModal);
  dom.themeToggleBtn.addEventListener('click', toggleTheme);
  
  // Upgrade from drawer
  const upgradeDrawerBtn = document.getElementById('upgradeDrawerBtn');
  if (upgradeDrawerBtn) upgradeDrawerBtn.addEventListener('click', () => { closeDrawer(); openPremiumModal(); });

  if (dom.darkModeToggle) {
    dom.darkModeToggle.addEventListener('change', (e) => applyTheme(e.target.checked ? 'dark' : 'light'));
  }
  
  if (dom.aiLangSelect) {
    dom.aiLangSelect.addEventListener('change', (e) => {
      state.aiLang = e.target.value;
      saveState();
      showToast('Language preference saved');
    });
  }

  // ===== COST SAVING TOGGLES =====
  const cachingToggle = document.getElementById('cachingToggle');
  const shortResponseToggle = document.getElementById('shortResponseToggle');
  const limitHistoryToggle = document.getElementById('limitHistoryToggle');
  const noSystemPromptToggle = document.getElementById('noSystemPromptToggle');

  if (cachingToggle) {
    cachingToggle.checked = state.cachingEnabled;
    cachingToggle.addEventListener('change', (e) => {
      state.cachingEnabled = e.target.checked;
      saveState();
      showToast(e.target.checked ? '✅ Caching ON — saves Gemini tokens' : '❌ Caching disabled');
    });
  }
  if (shortResponseToggle) {
    shortResponseToggle.checked = state.shortResponseMode;
    shortResponseToggle.addEventListener('change', (e) => {
      state.shortResponseMode = e.target.checked;
      saveState();
      showToast(e.target.checked ? '✅ Short mode ON — 40% token savings' : '❌ Short mode off');
    });
  }
  if (limitHistoryToggle) {
    limitHistoryToggle.checked = state.limitHistoryMode;
    limitHistoryToggle.addEventListener('change', (e) => {
      state.limitHistoryMode = e.target.checked;
      saveState();
      showToast(e.target.checked ? '✅ History limit ON — saves context tokens' : '❌ History limit off');
    });
  }
  if (noSystemPromptToggle) {
    noSystemPromptToggle.checked = state.noSystemPrompt;
    noSystemPromptToggle.addEventListener('change', (e) => {
      state.noSystemPrompt = e.target.checked;
      saveState();
      showToast(e.target.checked ? '✅ No system prompt ON — leaner requests' : '❌ System prompt restored');
    });
  }

  // Update plan badge in settings
  const planBadgeSettings = document.getElementById('planBadgeSettings');
  if (planBadgeSettings) planBadgeSettings.textContent = state.isPremium ? 'Unlimited' : '10/day';
  
  // Profile modal events
  if (dom.headerAvatar) dom.headerAvatar.addEventListener('click', openProfileModal);
  if (document.getElementById('drawerUserCard')) {
    document.getElementById('drawerUserCard').addEventListener('click', openProfileModal);
  }
  dom.closeProfileBtn?.addEventListener('click', closeProfileModal);
  dom.loginShowBtn?.addEventListener('click', showLoginForm);
  dom.signupShowBtn?.addEventListener('click', showSignupForm);
  dom.switchToSignup?.addEventListener('click', (e) => { e.preventDefault(); showSignupForm(); });
  dom.switchToLogin?.addEventListener('click', (e) => { e.preventDefault(); showLoginForm(); });
  dom.loginBtn?.addEventListener('click', handleLogin);
  dom.signupBtn?.addEventListener('click', handleSignup);
  dom.logoutBtn?.addEventListener('click', handleLogout);
  dom.upgradeFromProfileBtn?.addEventListener('click', () => {
    closeProfileModal();
    openPremiumModal();
  });
  dom.upgradeFromSettingsBtn?.addEventListener('click', () => {
    closeSettingsModal();
    openPremiumModal();
  });
  
  // Premium modal events
  dom.closePremiumBtn?.addEventListener('click', closePremiumModal);
  dom.payWithCashfreeBtn?.addEventListener('click', handlePayment);
  
  // Terms & Privacy & new legal modals
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
  
  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });
  
  setupVoiceInput();
  setupWelcomeChips();
  
  // Hide splash
  setTimeout(() => {
    if (dom.splash) {
      dom.splash.style.opacity = '0';
      setTimeout(() => {
        dom.splash.style.display = 'none';
        dom.app.classList.remove('hidden');
        scrollToBottom();
      }, 500);
    }
  }, 1800);
}

// Start app
document.addEventListener('DOMContentLoaded', initApp);