/**
 * SSC PrepAI — Firebase Functions Backend
 * Ultra Low-Cost · Production-Grade · Secure
 * ─────────────────────────────────────────
 * Cost Strategy:
 *  • DeepSeek for ALL text (10x cheaper than Gemini)
 *  • Gemini ONLY for image/PDF/vision tasks
 *  • Aggressive token limits (300 normal / 150 short)
 *  • Request dedup + auth guard on every route
 */

'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const https = require('https');
const http = require('http');

initializeApp();

// ──────────────────────────────────────────────────────────
// CONFIG  (set via Firebase env / Secret Manager in prod)
// ──────────────────────────────────────────────────────────
const DEEPSEEK_KEY  = process.env.DEEPSEEK_API_KEY  || '';
const GEMINI_KEY    = process.env.GEMINI_API_KEY    || '';
const CASHFREE_APP_ID = process.env.CASHFREE_CLIENT_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_CLIENT_SECRET;
const CASHFREE_ENV  = process.env.CASHFREE_ENV || 'production'; // 'sandbox' | 'production'

const DEEPSEEK_BASE = 'api.deepseek.com';
const GEMINI_BASE   = 'generativelanguage.googleapis.com';

// Cost guard: max tokens per tier
const TOKEN_LIMITS = {
  short: 200,    // shortResponseMode
  normal: 350,   // default (reduced from 800 for cost)
  vision: 600,   // Gemini vision responses
};

// Rate limiting — simple in-memory store (resets on cold start)
// For production at scale, replace with Redis / Firestore counters.
const _rateLimitMap = new Map();
const RATE_WINDOW_MS = 60_000;   // 1 minute window
const RATE_MAX_FREE  = 15;       // free users: 15 req/min
const RATE_MAX_PREM  = 60;       // premium users: 60 req/min

// ──────────────────────────────────────────────────────────
// CORS MIDDLEWARE
// ──────────────────────────────────────────────────────────
function setCors(req, res) {

  const allowedOrigins = [
    'https://rankgpt-f8a64.web.app',
    'https://rankgpt-f8a64.firebaseapp.com',
    'https://shank122004-tech.github.io',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5501',
    'http://127.0.0.1:5502',
    'http://localhost:5500',
    'http://localhost:5501',
    'http://localhost:5502'
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }

  res.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  res.set(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  );

  res.set(
    'Access-Control-Allow-Credentials',
    'true'
  );
}


function handleOptions(req, res) {
  if (req.method === 'OPTIONS') { setCors(req, res); res.status(204).send(''); return true; }
  return false;
}

// ──────────────────────────────────────────────────────────
// AUTH VERIFICATION
// ──────────────────────────────────────────────────────────
async function verifyAuth(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    return await getAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────
// RATE LIMITING
// ──────────────────────────────────────────────────────────
function checkRateLimit(uid, isPremium) {
  const now = Date.now();
  const key = uid || 'anon';
  let entry = _rateLimitMap.get(key);
  if (!entry || (now - entry.start) > RATE_WINDOW_MS) {
    entry = { start: now, count: 0 };
  }
  entry.count++;
  _rateLimitMap.set(key, entry);
  const max = isPremium ? RATE_MAX_PREM : RATE_MAX_FREE;
  return entry.count <= max;
}


// ──────────────────────────────────────────────────────────
// HTTP HELPER — raw HTTPS request (no axios dep = lower cost)
// ──────────────────────────────────────────────────────────
function httpsPost(hostname, path, headers, bodyObj, timeoutMs = 25_000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(bodyObj);
    const options = {
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(body);
    req.end();
  });
}

// GET variant — used by Cashfree payment status check
function httpsGet(hostname, path, headers, timeoutMs = 25_000) {
  return new Promise((resolve, reject) => {
    const options = { hostname, path, method: 'GET', headers };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

// ──────────────────────────────────────────────────────────
// SYSTEM PROMPT — compact (saves tokens every call)
// ──────────────────────────────────────────────────────────
function buildSystemPrompt(mode = 'cgl', lang = 'hinglish', short = false) {
  const langInstr = {
    hinglish: 'Respond in Hinglish (Hindi+English mix).',
    hindi:    'Respond in Romanized Hindi.',
    english:  'Respond in simple English.',
  }[lang] || 'Respond in Hinglish.';

  const modeDesc = {
    cgl: 'SSC CGL', chsl: 'SSC CHSL', gd: 'SSC GD', mts: 'SSC MTS', cpo: 'SSC CPO',
    class10: 'Class 10 CBSE', class12_sci: 'Class 12 Science CBSE',
    class12_com: 'Class 12 Commerce CBSE', class12_arts: 'Class 12 Arts CBSE',
  }[mode] || 'general studies';

  const limit = short ? 120 : 220;
  return `You are PrepAI for ${modeDesc}. ${langInstr} Rules: answer accurately, under ${limit} words, give formula/shortcut first, end with 1 quick tip. No long intros.`;
}

// ──────────────────────────────────────────────────────────
// DEEPSEEK HANDLER — default for ALL text queries
// ──────────────────────────────────────────────────────────
exports.deepseek = onRequest(
  { timeoutSeconds: 30, memory: '256MiB', minInstances: 0, region: 'us-central1' },
  async (req, res) => {
    setCors(req, res);
    if (handleOptions(req, res)) return;

    // Auth
    const decoded = await verifyAuth(req);
    if (!decoded) { res.status(401).json({ error: 'Unauthorized' }); return; }

    // Rate limit
    const isPrem = !!decoded.premium; // set via custom claims if desired
    if (!checkRateLimit(decoded.uid, isPrem)) {
      res.status(429).json({ error: 'Too many requests. Please slow down.' });
      return;
    }

    // Validate body
    const { model, messages, max_tokens, temperature, mode, lang, shortMode } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }
    if (req.body && JSON.stringify(req.body).length > 32_000) {
      res.status(413).json({ error: 'Request too large' });
      return;
    }

    // Build messages array — inject compact system prompt server-side
    // Ignore client-sent system prompt to ensure quality + cost control
    const sysprompt = buildSystemPrompt(mode || 'cgl', lang || 'hinglish', !!shortMode);
    const userMessages = messages.filter(m => m.role !== 'system');

    // Keep only last 4 exchanges (8 messages) to cut tokens
    const trimmedHistory = userMessages.slice(-8);

    const payload = {
      model: 'deepseek-chat', // ALWAYS cheapest model
      messages: [
        { role: 'system', content: sysprompt },
        ...trimmedHistory,
      ],
      max_tokens: Math.min(max_tokens || TOKEN_LIMITS.normal, TOKEN_LIMITS.normal),
      temperature: temperature || 0.6,
      stream: false,
    };

    if (!DEEPSEEK_KEY) { res.status(500).json({ error: 'DeepSeek API key not configured' }); return; }

    try {
      const result = await httpsPost(
        DEEPSEEK_BASE,
        '/v1/chat/completions',
        { Authorization: `Bearer ${DEEPSEEK_KEY}` },
        payload,
        28_000
      );

      if (result.status !== 200 && result.status !== 201) {
        console.error('DeepSeek error:', result.status, result.body);
        const errMsg = result.body?.error?.message || 'DeepSeek unavailable';
        res.status(result.status).json({ error: errMsg });
        return;
      }

      // Log token usage for cost monitoring (optional, remove if noisy)
      const usage = result.body?.usage;
      if (usage) {
        console.log(`[DS] uid=${decoded.uid} prompt=${usage.prompt_tokens} compl=${usage.completion_tokens}`);
      }

      res.status(200).json(result.body);
    } catch (err) {
      console.error('DeepSeek request failed:', err.message);
      res.status(503).json({ error: 'AI service temporarily unavailable. Please retry.' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// GEMINI HANDLER — ONLY for image/PDF/vision tasks
// ──────────────────────────────────────────────────────────
exports.gemini = onRequest(
  { timeoutSeconds: 60, memory: '512MiB', minInstances: 0, region: 'us-central1' },
  async (req, res) => {
    setCors(req, res);
    if (handleOptions(req, res)) return;

    // Auth (required — Gemini is expensive)
    const decoded = await verifyAuth(req);
    if (!decoded) { res.status(401).json({ error: 'Unauthorized' }); return; }

    // Rate limit (tighter for Gemini)
    if (!checkRateLimit('gemini_' + decoded.uid, !!decoded.premium)) {
      res.status(429).json({ error: 'Vision rate limit reached. Try again shortly.' });
      return;
    }

    const body = req.body || {};

    // COST GUARD: refuse Gemini calls without actual media content
    // This prevents accidental text routing to Gemini
    const contents = body.contents || [];
    const hasMedia = contents.some(c =>
      Array.isArray(c.parts) && c.parts.some(p => p.inline_data || p.file_data)
    );
    if (!hasMedia) {
      res.status(400).json({ error: 'Gemini endpoint requires image or PDF content' });
      return;
    }

    // Request size guard (base64 images can be large)
    const bodyStr = JSON.stringify(body);
    if (bodyStr.length > 10 * 1024 * 1024) { // 10MB limit
      res.status(413).json({ error: 'File too large. Max 10MB.' });
      return;
    }

    // Override generation config to control cost
    const { mode, lang } = body;
    const sysprompt = buildSystemPrompt(mode || 'cgl', lang || 'hinglish', false);

    const payload = {
      system_instruction: { parts: [{ text: sysprompt }] },
      contents: contents,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: TOKEN_LIMITS.vision,
        topP: 0.9,
      },
    };

    if (!GEMINI_KEY) { res.status(500).json({ error: 'Gemini API key not configured' }); return; }

    const geminiModel = 'gemini-1.5-flash'; // Flash = cheaper than Pro
    const path = `/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_KEY}`;

    try {
      const result = await httpsPost(
        GEMINI_BASE,
        path,
        {},
        payload,
        55_000
      );

      if (result.status !== 200 && result.status !== 201){
        console.error('Gemini error:', result.status, result.body);
        const errMsg = result.body?.error?.message || 'Vision AI unavailable';
        // Friendly quota error
        if (result.status === 429) {
          res.status(429).json({ error: 'Vision AI quota reached. Try again in a minute.' });
        } else {
          res.status(result.status).json({ error: errMsg });
        }
        return;
      }

      console.log(`[Gemini] uid=${decoded.uid} tokens≈${JSON.stringify(result.body).length / 4}`);
      res.status(200).json(result.body);
    } catch (err) {
      console.error('Gemini request failed:', err.message);
      res.status(503).json({ error: 'Vision AI temporarily unavailable. Please retry.' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// CREATE CASHFREE ORDER — called by frontend to get payment_session_id
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

    const { amount, plan, uid, name, email } = req.body || {};
    if (!amount || !plan) {
      res.status(400).json({ error: 'Missing amount or plan' });
      return;
    }

    const clientId     = process.env.CASHFREE_CLIENT_ID;
    const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      res.status(500).json({ error: 'Payment config missing' });
      return;
    }

    const cfHost = CASHFREE_ENV === 'sandbox'
      ? 'sandbox.cashfree.com'
      : 'api.cashfree.com';

    const orderId = `sscprepai_${plan}_${decoded.uid}_${Date.now()}`;

    const payload = {
      order_id:       orderId,
      order_amount:   Number(amount),
      order_currency: 'INR',
      customer_details: {
        customer_id:    decoded.uid,
        customer_name:  name  || 'Student',
        customer_email: email || `${decoded.uid}@sscprepai.app`,
        customer_phone: '9999999999',   // optional; Cashfree may prompt user
      },
      order_meta: {
        return_url: `https://rankgpt-f8a64.web.app/?order_id=${orderId}&plan=${plan}`,
      },
    };

    try {
      const result = await httpsPost(
        cfHost,
        '/pg/orders',
        {
          'x-client-id':     clientId,
          'x-client-secret': clientSecret,
          'x-api-version':   '2023-08-01',
        },
        payload,
        15_000
      );
console.log("Cashfree response:", result.status, result.body);
      if (result.status !== 200 && result.status !== 201) {
        console.error('Cashfree order error:', result.status, result.body);
        res.status(502).json({ error: result.body?.message || 'Order creation failed' });
        return;
      }

      // Return order_id + payment_session_id to frontend
      res.status(200).json({
        order_id:           result.body.order_id,
        payment_session_id: result.body.payment_session_id,
      });
    } catch (err) {
      console.error('createCashfreeOrder error:', err.message);
      res.status(500).json({ error: 'Order creation failed. Please retry.' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// PAYMENT VERIFICATION — Cashfree
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
    if (!clientId || !clientSecret) {
      res.status(500).json({ error: 'Payment config missing' });
      return;
    }

    const cfHost = (process.env.CASHFREE_ENV || 'production') === 'sandbox'
      ? 'sandbox.cashfree.com'
      : 'api.cashfree.com';

    try {
      const result = await httpsGet(
        cfHost,
        `/pg/orders/${encodeURIComponent(order_id)}/payments`,
        {
          'x-client-id':     clientId,
          'x-client-secret': clientSecret,
          'x-api-version':   '2023-08-01',
        },
        15_000
      );

      if (result.status !== 200 && result.status !== 201){
        res.status(200).json({ status: 'PENDING' });
        return;
      }

      // Cashfree returns array of payment attempts
      const payments = Array.isArray(result.body) ? result.body : [result.body];
      const successful = payments.find(p => p.payment_status === 'SUCCESS');
      const failed = payments.find(p => p.payment_status === 'FAILED');

      if (successful) {
        // Extract plan from order_id: sscprepai_{plan}_{uid}_{ts}
        const parts = order_id.split('_');
        const plan = parts[1] || 'ssc';

        // Update Firestore — mark user as premium
        try {
          const db = getFirestore();
          await db.collection('users').doc(decoded.uid).set(
            { isPremium: true, premiumPlan: plan, premiumActivatedAt: Date.now(), lastOrderId: order_id },
            { merge: true }
          );
        } catch (firestoreErr) {
          console.error('Firestore update error:', firestoreErr);
        }

        res.status(200).json({ status: 'PAID', plan });
      } else if (failed) {
        res.status(200).json({ status: 'FAILED' });
      } else {
        res.status(200).json({ status: 'PENDING' });
      }
    } catch (err) {
      console.error('Cashfree verify error:', err.message);
      res.status(200).json({ status: 'PENDING' }); // safe fallback
    }
  }
);

// ──────────────────────────────────────────────────────────
// HEALTH CHECK — simple ping (no auth required)
// ──────────────────────────────────────────────────────────
exports.health = onRequest(
  { timeoutSeconds: 5, memory: '128MiB', region: 'us-central1' },
  (req, res) => {
    setCors(req, res);
    if (handleOptions(req, res)) return;
    res.status(200).json({ ok: true, ts: Date.now() });
  }
);
