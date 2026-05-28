/**
 * SSC PrepAI — Firebase Functions Backend (FIXED v2)
 * ─────────────────────────────────────────────────────
 * FIXES APPLIED:
 *  1. API keys loaded from env with hardcoded fallback
 *     (deploy properly via: firebase functions:secrets:set DEEPSEEK_API_KEY)
 *  2. Auth errors now show clear messages — 401 won't silently fail
 *  3. CORS improved — accepts all your dev/prod origins
 *  4. DeepSeek + Gemini errors mapped to friendly messages
 *  5. Gemini upgraded to gemini-2.0-flash (better free quota)
 *  6. Health endpoint reveals key status for easy debugging
 *  7. All errors console.error'd with full context for Firebase logs
 *  8. FIXED: CORS handlers moved inside each function body
 */

'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const https = require('https');

initializeApp();

// ──────────────────────────────────────────────────────────
// API KEYS — loaded from Firebase Secret Manager env
// To deploy them run:
//   firebase functions:secrets:set DEEPSEEK_API_KEY
//   firebase functions:secrets:set GEMINI_API_KEY
// Fallback values below are used if env var is not set.
// ──────────────────────────────────────────────────────────
// Keys come from functions/.env (already working — Firebase CLI loads it automatically)
// DO NOT also declare these via secrets:[] in onRequest config — causes deploy conflict.
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const GEMINI_KEY   = process.env.GEMINI_API_KEY   || '';
const CASHFREE_ENV = process.env.CASHFREE_ENV || 'production';

const DEEPSEEK_BASE = 'api.deepseek.com';
const GEMINI_BASE   = 'generativelanguage.googleapis.com';

const TOKEN_LIMITS = { short: 200, normal: 500, vision: 800 };

// Rate limiter (in-memory — resets on cold start)
const _rateLimitMap = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_FREE  = 20;
const RATE_MAX_PREM  = 100;

// ──────────────────────────────────────────────────────────
// CORS
// ──────────────────────────────────────────────────────────
function setCors(req, res) {
  const allowedOrigins = [
    'https://rankgpt-f8a64.web.app',
    'https://rankgpt-f8a64.firebaseapp.com',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5501',
    'http://127.0.0.1:5502',
    'http://127.0.0.1:5000',
    'http://localhost:5500',
    'http://localhost:5501',
    'http://localhost:5502',
    'http://localhost:5000',
  ];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  } else {
    res.set('Access-Control-Allow-Origin', 'https://rankgpt-f8a64.web.app');
  }
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Credentials', 'true');
}

function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    setCors(req, res);
    res.status(204).send('');
    return true;
  }
  return false;
}

// ──────────────────────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────────────────────
async function verifyAuth(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    console.warn('[Auth] Missing Bearer token');
    return null;
  }
  try {
    return await getAuth().verifyIdToken(authHeader.slice(7));
  } catch (e) {
    console.error('[Auth] Token verification failed:', e.code, e.message);
    return null;
  }
}

// ──────────────────────────────────────────────────────────
// RATE LIMITER
// ──────────────────────────────────────────────────────────
function checkRateLimit(uid, isPremium) {
  const now = Date.now();
  const key = uid || 'anon';
  let entry = _rateLimitMap.get(key);
  if (!entry || (now - entry.start) > RATE_WINDOW_MS) entry = { start: now, count: 0 };
  entry.count++;
  _rateLimitMap.set(key, entry);
  return entry.count <= (isPremium ? RATE_MAX_PREM : RATE_MAX_FREE);
}

// ──────────────────────────────────────────────────────────
// HTTP HELPERS
// ──────────────────────────────────────────────────────────
function httpsPost(hostname, path, headers, bodyObj, timeoutMs) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(bodyObj);
    const req = https.request(
      { hostname, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers } },
      (res) => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      }
    );
    req.on('error', (e) => { console.error(`[HTTP] POST ${hostname} error:`, e.message); reject(e); });
    req.setTimeout(timeoutMs || 30_000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

function httpsGet(hostname, path, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET', headers }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs || 25_000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

// ──────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ──────────────────────────────────────────────────────────
function buildSystemPrompt(mode, lang, short) {
  const langInstr = {
    hinglish: 'Respond in Hinglish (Hindi + English mix). Example: "Bhai, yeh SSC ke liye bahut important hai!"',
    hindi:    'Respond in Romanized Hindi only.',
    english:  'Respond in simple, clear English.',
  }[lang] || 'Respond in Hinglish.';

  const modeDesc = {
    cgl:          'SSC CGL (Tier 1 & 2: Quant, English, Reasoning, GK)',
    chsl:         'SSC CHSL',
    gd:           'SSC GD Constable',
    mts:          'SSC MTS',
    cpo:          'SSC CPO/SI',
    class1:       'Class 1 (CBSE/NCERT: Basic English, Numbers, EVS)',
    class2:       'Class 2 (CBSE/NCERT: English, Math, EVS)',
    class3:       'Class 3 (CBSE/NCERT: English, Math, EVS)',
    class4:       'Class 4 (CBSE/NCERT: English, Math, Science, EVS)',
    class5:       'Class 5 (CBSE/NCERT: English, Math, Science, Social)',
    class6:       'Class 6 (CBSE/NCERT: Math, Science, Social, English, Hindi)',
    class7:       'Class 7 (CBSE/NCERT: Math, Science, Social, English, Hindi)',
    class8:       'Class 8 (CBSE/NCERT: Math, Science, Social, English, Hindi)',
    class9:       'Class 9 (CBSE/NCERT: Math, Science, Social, English, Hindi)',
    class10:      'Class 10 Board Exam (CBSE/NCERT)',
    class11_sci:  'Class 11 Science (CBSE/NCERT: Physics, Chemistry, Math/Biology)',
    class11_com:  'Class 11 Commerce (CBSE/NCERT: Accounts, Business Studies, Economics)',
    class11_arts: 'Class 11 Arts (CBSE/NCERT: History, Geography, Political Science)',
    class12_sci:  'Class 12 Science Board Exam (CBSE/NCERT)',
    class12_com:  'Class 12 Commerce Board Exam (CBSE/NCERT)',
    class12_arts: 'Class 12 Arts Board Exam (CBSE/NCERT)',
  }[mode] || 'general studies';

  const isClassMode = mode && mode.startsWith('class');
  const gradeMatch  = mode && mode.match(/^class(\d+)/);
  const grade       = gradeMatch ? parseInt(gradeMatch[1], 10) : null;

  // Token-efficient word limits by grade
  const wordLimit = short ? 100
    : grade && grade <= 2 ? 150
    : grade && grade <= 5 ? 200
    : grade && grade <= 8 ? 230
    : 260;

  if (isClassMode) {
    // Grade-appropriate language style
    const gradeStyle = grade && grade <= 2
      ? 'Use VERY simple words and short sentences. Like explaining to a 6-7 year old. Use emojis and fun examples.'
      : grade && grade <= 5
      ? 'Use simple, easy words. Short sentences. Friendly tone like a helpful elder sibling. Use fun real-life examples.'
      : grade && grade <= 8
      ? 'Use clear language for a middle school student. Give relatable, everyday examples.'
      : 'Use precise academic language for board exam prep. Give exam-focused concise answers.';

    return `You are PrepAI, a friendly AI tutor for ${modeDesc}.
${langInstr}
${gradeStyle}
Rules:
- Follow NCERT/CBSE syllabus strictly
- Step-by-step solution for math/science
- Keep response under ${wordLimit} words
- End with 1 memory tip or fun trick`;
  }

  return `You are PrepAI, an expert SSC exam tutor for ${modeDesc}.
${langInstr}
Rules:
- Formula or shortcut first
- Real SSC exam-style examples
- Keep response under ${wordLimit} words
- End with 1 exam tip
- Math: show step-by-step working`;
}

// ──────────────────────────────────────────────────────────
// DEEPSEEK — all text questions
// ──────────────────────────────────────────────────────────
exports.deepseek = onRequest(
  {
    timeoutSeconds: 30,
    memory: '256MiB',
    minInstances: 0,
    region: 'us-central1',
  },
  async (req, res) => {
    setCors(req, res);
    if (handleOptions(req, res)) return;

    const decoded = await verifyAuth(req);
    if (!decoded) {
      res.status(401).json({ error: 'Session expired or not logged in. Please login again.' });
      return;
    }

    if (!checkRateLimit(decoded.uid, !!decoded.premium)) {
      res.status(429).json({ error: 'Too many requests. Please slow down.' });
      return;
    }

    const { messages, max_tokens, temperature, mode, lang, shortMode } = req.body || {};

    if (!Array.isArray(messages) || !messages.length) {
      res.status(400).json({ error: 'messages array is required.' });
      return;
    }
    if (JSON.stringify(req.body).length > 32_000) {
      res.status(413).json({ error: 'Request too large.' });
      return;
    }

    const sysprompt = buildSystemPrompt(mode || 'cgl', lang || 'hinglish', !!shortMode);
    const userMessages = messages.filter(m => m.role !== 'system').slice(-8);
    // Use client-supplied max_tokens (grade-optimised) capped at normal limit
    const resolvedMaxTokens = max_tokens
      ? Math.min(max_tokens, TOKEN_LIMITS.normal)
      : TOKEN_LIMITS.normal;

    const payload = {
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: sysprompt }, ...userMessages],
      max_tokens: resolvedMaxTokens,
      temperature: temperature || 0.7,
      stream: false,
    };

    if (!DEEPSEEK_KEY) {
      console.error('[DeepSeek] API key missing!');
      res.status(500).json({ error: 'AI service not configured. Contact support.' });
      return;
    }

    console.log(`[DeepSeek] uid=${decoded.uid} mode=${mode} msgs=${userMessages.length}`);

    try {
      const result = await httpsPost(
        DEEPSEEK_BASE, '/v1/chat/completions',
        { Authorization: `Bearer ${DEEPSEEK_KEY}` },
        payload, 28_000
      );

      console.log(`[DeepSeek] HTTP ${result.status}`);

      if (result.status !== 200) {
        console.error('[DeepSeek] Error:', result.status, JSON.stringify(result.body));
        if (result.status === 401) {
          res.status(500).json({ error: 'AI auth failed. Contact support.' });
        } else if (result.status === 402) {
          res.status(500).json({ error: 'AI quota exhausted. Contact support.' });
        } else if (result.status === 429) {
          res.status(429).json({ error: 'AI is very busy. Please retry in a moment.' });
        } else {
          res.status(502).json({ error: result.body?.error?.message || 'AI error. Please retry.' });
        }
        return;
      }

      const usage = result.body?.usage;
      if (usage) console.log(`[DeepSeek] prompt=${usage.prompt_tokens} completion=${usage.completion_tokens}`);

      res.status(200).json(result.body);
    } catch (err) {
      console.error('[DeepSeek] Exception:', err.message);
      res.status(503).json({ error: 'AI temporarily unavailable. Please retry in a few seconds.' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// GEMINI — image + PDF vision
// ──────────────────────────────────────────────────────────
exports.geminiVision = onRequest(
  {
    timeoutSeconds: 60,
    memory: '512MiB',
    minInstances: 0,
    region: 'us-central1',
  },
  async (req, res) => {
    setCors(req, res);
    if (handleOptions(req, res)) return;

    const decoded = await verifyAuth(req);
    if (!decoded) {
      res.status(401).json({ error: 'Session expired. Please login again.' });
      return;
    }

    if (!checkRateLimit('gem_' + decoded.uid, !!decoded.premium)) {
      res.status(429).json({ error: 'Vision AI rate limit hit. Retry in a minute.' });
      return;
    }

    const body = req.body || {};
    const contents = body.contents || [];
    const clientMaxTokens = body.maxOutputTokens;
    const shortMode = !!body.shortMode;

    const hasMedia = contents.some(c =>
      Array.isArray(c.parts) && c.parts.some(p => p.inline_data || p.file_data)
    );
    if (!hasMedia) {
      res.status(400).json({ error: 'Please upload an image or PDF to use Vision AI.' });
      return;
    }
    if (JSON.stringify(body).length > 10 * 1024 * 1024) {
      res.status(413).json({ error: 'File too large. Maximum 10MB.' });
      return;
    }

    const sysprompt = buildSystemPrompt(body.mode || 'cgl', body.lang || 'hinglish', shortMode);
    // Use client-requested token limit (grade-optimised) or fallback to vision default
    const maxTokens = clientMaxTokens
      ? Math.min(clientMaxTokens, TOKEN_LIMITS.vision)
      : TOKEN_LIMITS.vision;
    const payload = {
      system_instruction: { parts: [{ text: sysprompt }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens, topP: 0.9 },
    };

    if (!GEMINI_KEY) {
      console.error('[Gemini] API key missing!');
      res.status(500).json({ error: 'Vision AI not configured. Contact support.' });
      return;
    }

    // gemini-2.0-flash: better free-tier quota than 1.5-flash
    const geminiModel = 'gemini-2.0-flash';
    const apiPath = `/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_KEY}`;

    console.log(`[Gemini] uid=${decoded.uid} model=${geminiModel} items=${contents.length}`);

    try {
      const result = await httpsPost(GEMINI_BASE, apiPath, {}, payload, 55_000);

      console.log(`[Gemini] HTTP ${result.status}`);

      if (result.status !== 200) {
        console.error('[Gemini] Error:', result.status, JSON.stringify(result.body));
        if (result.status === 429) {
          res.status(429).json({ error: 'Vision AI is busy. Retry in a minute.' });
        } else if (result.status === 400) {
          res.status(400).json({ error: 'Unsupported file format. Try a different image/PDF.' });
        } else if (result.status === 401 || result.status === 403) {
          res.status(500).json({ error: 'Vision AI auth failed. Contact support.' });
        } else {
          res.status(result.status).json({ error: result.body?.error?.message || 'Vision AI error. Retry.' });
        }
        return;
      }

      const text =
  result.body?.candidates?.[0]?.content?.parts?.[0]?.text || '';

res.status(200).json({
  text
});
    } catch (err) {
      console.error('[Gemini] Exception:', err.message);
      res.status(503).json({ error: 'Vision AI temporarily unavailable. Please retry.' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// CASHFREE — create order
// ──────────────────────────────────────────────────────────
exports.createCashfreeOrder = onRequest(
  {
    timeoutSeconds: 20,
    memory: '128MiB',
    region: 'us-central1',
    secrets: ['CASHFREE_CLIENT_ID', 'CASHFREE_CLIENT_SECRET'],
  },
  async (req, res) => {
    setCors(req, res);
    if (handleOptions(req, res)) return;

    const decoded = await verifyAuth(req);
    if (!decoded) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { amount, plan, name, email } = req.body || {};
    if (!amount || !plan) { res.status(400).json({ error: 'Missing amount or plan' }); return; }

    const clientId     = process.env.CASHFREE_CLIENT_ID;
    const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
    if (!clientId || !clientSecret) { res.status(500).json({ error: 'Payment not configured' }); return; }

    const cfHost = CASHFREE_ENV === 'sandbox' ? 'sandbox.cashfree.com' : 'api.cashfree.com';
    const orderId = `sscprepai_${plan}_${decoded.uid}_${Date.now()}`;

    try {
      const result = await httpsPost(
        cfHost, '/pg/orders',
        { 'x-client-id': clientId, 'x-client-secret': clientSecret, 'x-api-version': '2023-08-01' },
        {
          order_id: orderId, order_amount: Number(amount), order_currency: 'INR',
          customer_details: { customer_id: decoded.uid, customer_name: name || 'Student', customer_email: email || `${decoded.uid}@sscprepai.app`, customer_phone: '9999999999' },
          order_meta: { return_url: `https://rankgpt-f8a64.web.app/?order_id=${orderId}&plan=${plan}` },
        },
        15_000
      );

      console.log('[Cashfree] Create order:', result.status);
      if (result.status !== 200 && result.status !== 201) {
        res.status(502).json({ error: result.body?.message || 'Order creation failed' });
        return;
      }
      res.status(200).json({ order_id: result.body.order_id, payment_session_id: result.body.payment_session_id });
    } catch (err) {
      console.error('[Cashfree] Error:', err.message);
      res.status(500).json({ error: 'Order creation failed. Please retry.' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// CASHFREE — verify payment + update Firestore
// ──────────────────────────────────────────────────────────
exports.verifyPayment = onRequest(
  {
    timeoutSeconds: 20,
    memory: '128MiB',
    region: 'us-central1',
    secrets: ['CASHFREE_CLIENT_ID', 'CASHFREE_CLIENT_SECRET'],
  },
  async (req, res) => {
    setCors(req, res);
    if (handleOptions(req, res)) return;

    const decoded = await verifyAuth(req);
    if (!decoded) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { order_id } = req.body || {};
    if (!order_id || typeof order_id !== 'string' || order_id.length > 100) {
      res.status(400).json({ error: 'Invalid order_id' });
      return;
    }

    const clientId     = process.env.CASHFREE_CLIENT_ID;
    const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
    if (!clientId || !clientSecret) { res.status(500).json({ error: 'Payment config missing' }); return; }

    const cfHost = (process.env.CASHFREE_ENV || 'production') === 'sandbox'
      ? 'sandbox.cashfree.com' : 'api.cashfree.com';

    try {
      const result = await httpsGet(
        cfHost, `/pg/orders/${encodeURIComponent(order_id)}/payments`,
        { 'x-client-id': clientId, 'x-client-secret': clientSecret, 'x-api-version': '2023-08-01' },
        15_000
      );

      if (result.status !== 200 && result.status !== 201) {
        res.status(200).json({ status: 'PENDING' });
        return;
      }

      const payments = Array.isArray(result.body) ? result.body : [result.body];
      const successful = payments.find(p => p.payment_status === 'SUCCESS');
      const failed     = payments.find(p => p.payment_status === 'FAILED');

      if (successful) {
        const plan = order_id.split('_')[1] || 'ssc';
        try {
          await getFirestore().collection('users').doc(decoded.uid).set(
            { isPremium: true, premiumPlan: plan, premiumActivatedAt: Date.now(), lastOrderId: order_id },
            { merge: true }
          );
        } catch (e) { console.error('[Firestore] Update error:', e); }
        res.status(200).json({ status: 'PAID', plan });
      } else if (failed) {
        res.status(200).json({ status: 'FAILED' });
      } else {
        res.status(200).json({ status: 'PENDING' });
      }
    } catch (err) {
      console.error('[Cashfree] Verify error:', err.message);
      res.status(200).json({ status: 'PENDING' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// HEALTH CHECK
// Visit https://rankgpt-f8a64.web.app/api/health to verify
// that deepseekKey: true and geminiKey: true are shown.
// ──────────────────────────────────────────────────────────
exports.health = onRequest((req, res) => {

  setCors(req, res);

  if (handleOptions(req, res)) return;

  res.json({
    ok: true,
    deepseekKey: !!process.env.DEEPSEEK_API_KEY,
    geminiKey: !!process.env.GEMINI_API_KEY
  });

});
