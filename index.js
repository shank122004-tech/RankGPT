/**
 * index.js — Cloud Functions entry point
 */
const cors = require("cors")({ origin: true });
const { onRequest } = require("firebase-functions/v2/https");
const functions  = require("firebase-functions");
const admin      = require("firebase-admin");
const axios      = require("axios");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ─── Scheduled: Clean up expired pending bookings ────────────────────────────
const cleanupExpiredPendingBookings = functions
  .pubsub.schedule("every 30 minutes")
  .onRun(async () => {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    functions.logger.info(`🧹 Cleaning up pending bookings older than ${cutoff.toISOString()}`);
    const expiredSnap = await db.collection("pending_bookings")
      .where("createdAt", "<", cutoff)
      .where("status", "==", "pending_payment")
      .get();
    if (expiredSnap.empty) { functions.logger.info("No expired pending bookings found"); return null; }
    const batch = db.batch();
    for (const doc of expiredSnap.docs) {
      const pending = doc.data();
      functions.logger.info(`Expiring pending booking: ${doc.id}`);
      batch.delete(doc.ref);
      try {
        const [startTime] = pending.slotTime.split("-");
        const slotSnap = await db.collection("slots")
          .where("groundId",    "==", pending.groundId)
          .where("date",        "==", pending.date)
          .where("startTime",   "==", startTime.trim())
          .where("lockOrderId", "==", doc.id)
          .limit(1).get();
        if (!slotSnap.empty) {
          batch.update(slotSnap.docs[0].ref, {
            status: "available", lockOrderId: null, lockExpiresAt: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (e) {
        functions.logger.warn(`Could not release slot for ${doc.id}:`, e.message);
      }
    }
    await batch.commit();
    functions.logger.info(`✅ Cleaned up ${expiredSnap.size} expired pending bookings`);
    return null;
  });

exports.cleanupExpiredPendingBookings = cleanupExpiredPendingBookings;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DEEPSEEK_KEY = () => process.env.DEEPSEEK_API_KEY || "sk-f617d7a27b2b42579f7093e4857d015c";

// Safe: handles content that may be a string OR an array (vision messages)
function getTextContent(content) {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter(p => p.type === "text").map(p => p.text || "").join(" ");
  }
  return String(content);
}

// ─── Multi-source real-time search ────────────────────────────────────────────
// Priority: Tavily (if key set) → Brave Search (if key set) → DuckDuckGo → Wikipedia
async function webSearch(query) {
  // 1. Tavily — best quality, needs key (set TAVILY_API_KEY in Firebase env)
  const tavilyKey = process.env.TAVILY_API_KEY || "";
  if (tavilyKey) {
    try {
      const r = await axios.post("https://api.tavily.com/search", {
        api_key: tavilyKey, query, search_depth: "basic",
        max_results: 5, include_answer: true
      }, { timeout: 8000 });
      const answer   = r.data?.answer || "";
      const snippets = (r.data?.results || []).slice(0, 3)
        .map(x => `• ${x.title}: ${x.content.substring(0, 300)}`).join("\n");
      if (answer || snippets) return answer ? `${answer}\n\n${snippets}` : snippets;
    } catch(e) { functions.logger.warn("[tavily]", e.message); }
  }

  // 2. Brave Search — 2000 free queries/month (set BRAVE_API_KEY in Firebase env)
  const braveKey = process.env.BRAVE_API_KEY || "";
  if (braveKey) {
    try {
      const r = await axios.get("https://api.search.brave.com/res/v1/web/search", {
        params: { q: query, count: 5 },
        headers: { "Accept": "application/json", "X-Subscription-Token": braveKey },
        timeout: 8000
      });
      const results = r.data?.web?.results || [];
      if (results.length > 0) {
        return results.slice(0, 3)
          .map(x => `• ${x.title}: ${x.description || ""}`)
          .join("\n");
      }
    } catch(e) { functions.logger.warn("[brave]", e.message); }
  }

  // 3. DuckDuckGo Instant Answer — no key needed
  try {
    const r = await axios.get(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { timeout: 6000 }
    );
    const d = r.data;
    const parts = [];
    if (d.Answer)       parts.push(d.Answer);
    if (d.AbstractText) parts.push(d.AbstractText);
    if (d.Definition)   parts.push(d.Definition);
    // Related topics
    (d.RelatedTopics || []).slice(0, 3).forEach(t => {
      if (t.Text) parts.push(`• ${t.Text}`);
    });
    if (parts.length > 0) return parts.join("\n");
  } catch(e) { functions.logger.warn("[ddg]", e.message); }

  // 4. Wikipedia API — no key needed, great for factual/person queries
  try {
    // Extract main subject from query for Wikipedia search
    const wikiQuery = query.replace(/who is|what is|current|president of|pm of|ceo of/gi, "").trim();
    const searchR = await axios.get("https://en.wikipedia.org/w/api.php", {
      params: {
        action: "query", list: "search", srsearch: wikiQuery,
        format: "json", utf8: 1, srlimit: 3
      },
      timeout: 5000
    });
    const titles = (searchR.data?.query?.search || []).map(s => s.title);
    if (titles.length > 0) {
      // Get extracts for top result
      const extractR = await axios.get("https://en.wikipedia.org/w/api.php", {
        params: {
          action: "query", prop: "extracts", exintro: true,
          exsentences: 4, titles: titles[0],
          format: "json", utf8: 1
        },
        timeout: 5000
      });
      const pages = extractR.data?.query?.pages || {};
      const page  = Object.values(pages)[0];
      if (page?.extract) {
        // Strip HTML tags
        const text = page.extract.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        return `Wikipedia — ${page.title}:\n${text.substring(0, 600)}`;
      }
    }
  } catch(e) { functions.logger.warn("[wikipedia]", e.message); }

  return null; // all sources failed
}

// Questions that ALWAYS need fresh data — even if no keyword matches
const ALWAYS_SEARCH_PATTERNS = [
  /who is (the )?(current |new |present )?/i,
  /who (is|are|was|were) .*(president|pm|prime minister|ceo|minister|chief|head|leader|governor|mayor|chairman)/i,
  /president of/i,
  /prime minister of/i,
  /(current|latest|recent|new|today|now|2025|2026).*(president|pm|minister|ceo|winner|champion|rank|result|score|rate|price)/i,
  /(price|rate|value) of/i,
  /latest (news|update|result|match|score)/i,
  /who won/i,
  /election result/i,
  /ipl|world cup|olympic|cricket|football|match result/i,
];

function needsRealTimeSearch(messages) {
  const lastUser = [...messages].reverse().find(m => m.role === "user");
  if (!lastUser) return false;
  const text = getTextContent(lastUser.content).toLowerCase();

  // High-confidence patterns — always search
  if (ALWAYS_SEARCH_PATTERNS.some(p => p.test(text))) return true;

  // Keyword signals
  const signals = [
    "who is","who are","current","latest","recent","today","now",
    "president","prime minister","pm of","ceo of","winner","result",
    "score","news","2024","2025","2026","what happened","price of",
    "rate of","stock","election","appointed","resigned","died",
    "government","minister","officer","rank","topper","exam date",
    "cutoff","vacancy","notification","admit card","answer key",
    "result date","ssc","upsc","ibps","rrb","neet","jee"
  ];
  return signals.some(s => text.includes(s));
}

// ─── geminiVision (kept for backward compat, now proxies to DeepSeek) ────────
exports.geminiVision = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const GEMINI_KEY   = process.env.GEMINI_API_KEY || "AIzaSyCmzArFqO2Y1-Mm4THkiN7y_1xjogWNqyY";
      const GEMINI_MODEL = "gemini-2.0-flash";
      const geminiUrl    = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

      // Accept the body as-is from the client (contents array with inline_data parts)
      const requestBody = {
        contents: req.body.contents || [{
          parts: [{ text: req.body.message || "Describe this image." }]
        }],
        generationConfig: req.body.generationConfig || {
          maxOutputTokens: 2048,
          temperature: 0.4
        }
      };

      const response = await axios.post(geminiUrl, requestBody, {
        timeout: 30000,
        headers: { "Content-Type": "application/json" }
      });

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        res.json({ text });
      } else {
        // Return raw response so client can debug if needed
        res.json({ text: "", raw: response.data });
      }
    } catch (err) {
      functions.logger.error("[geminiVision]", err.response?.data || err.message);
      res.status(500).json({ error: err.response?.data?.error?.message || err.message });
    }
  });
});

// ─── deepseek — main AI endpoint ─────────────────────────────────────────────
exports.deepseek = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      let messages = req.body.messages || [];
      // ── Allowed DeepSeek models (no random strings) ──────────────────────────
      const ALLOWED_MODELS = new Set([
        "deepseek-chat",      // V4 Flash (non-thinking) — default / smart / flash
        "deepseek-reasoner",  // V4 Flash (thinking/CoT) — pro / vision-pro
        "deepseek-v4-pro",    // V4 Pro flagship — PAID addon only (₹149/mo)
      ]);
      const requestedModel = req.body.model || "deepseek-chat";
      const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : "deepseek-chat";
      if (!ALLOWED_MODELS.has(requestedModel)) {
        functions.logger.warn(`[deepseek] Blocked disallowed model "${requestedModel}", falling back to deepseek-chat`);
      }
      const isPdf   = req.body.isPdf || false;
      const isVision = req.body.isVision || false;

      // ── PDF: try pdf-parse; gracefully skip if module missing ──────────────
      if (isPdf && req.body.pdfBase64) {
        try {
          // pdf-parse must be in functions/package.json: "pdf-parse": "^1.1.1"
          const pdfParse   = require("pdf-parse");
          const pdfBuffer  = Buffer.from(req.body.pdfBase64, "base64");
          const pdfData    = await pdfParse(pdfBuffer);
          const extracted  = (pdfData.text || "").substring(0, 12000);

          // Find the plain user question (strip our injected wrapper text)
          const lastUserIdx = messages.map((m,i) => m.role === "user" ? i : -1).filter(i => i >= 0).pop();
          if (lastUserIdx !== undefined && extracted) {
            const raw = getTextContent(messages[lastUserIdx].content);
            // Pull the actual question after "then answer:"
            const questionMatch = raw.match(/then answer:\s*([\s\S]+)$/i);
            const userQuestion  = questionMatch ? questionMatch[1].trim() : raw.replace(/\[PDF.*?\]/g, "").trim();
            messages[lastUserIdx] = {
              role: "user",
              content: `[PDF — ${pdfData.numpages} page(s)]\n\n${extracted}\n\n---\nQuestion: ${userQuestion}`
            };
          }
        } catch (pdfErr) {
          // pdf-parse not installed or parse failed — fall through with original messages
          functions.logger.warn("[PDF parse skipped]", pdfErr.message);
        }
      }

      // ── Vision: DeepSeek V3 (deepseek-chat) is TEXT-ONLY ──────────────────
      // Strip image_url parts and keep only text; describe images in prompt
      if (isVision) {
        messages = messages.map(m => {
          if (!Array.isArray(m.content)) return m;
          const textParts   = m.content.filter(p => p.type === "text").map(p => p.text || "").join("\n");
          const imageCount  = m.content.filter(p => p.type === "image_url").length;
          const imageNotice = imageCount > 0
            ? `[${imageCount} image(s) attached — describe, analyze, and answer based on the image content]\n\n`
            : "";
          return { ...m, content: imageNotice + textParts };
        });
      }

      // ── Always inject today's date so DeepSeek knows current date ──────────
      const TODAY_STR = new Date().toLocaleDateString("en-IN", {
        weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kolkata"
      });
      const sysIdx0 = messages.findIndex(m => m.role === "system");
      if (sysIdx0 >= 0) {
        if (!messages[sysIdx0].content.includes("TODAY IS")) {
          messages[sysIdx0] = {
            ...messages[sysIdx0],
            content: `TODAY IS: ${TODAY_STR}. Your training data has a cutoff — for anything current (who holds a position, recent events, prices, results, exam dates), always rely on real-time data provided below.\n\n${messages[sysIdx0].content}`
          };
        }
      } else {
        messages = [{
          role: "system",
          content: `TODAY IS: ${TODAY_STR}. You have a training cutoff. For current events, who holds positions, recent results, prices, or anything time-sensitive, always use the real-time data injected below. Never guess outdated answers.`
        }, ...messages];
      }

      // ── Real-time web search (text only, skip vision/pdf) ────────────────────
      if (!isPdf && !isVision && needsRealTimeSearch(messages)) {
        const lastUser = [...messages].reverse().find(m => m.role === "user");
        if (lastUser) {
          const rawQ = getTextContent(lastUser.content).trim().substring(0, 150);
          const searchResult = await webSearch(rawQ);
          if (searchResult) {
            const sysIdx = messages.findIndex(m => m.role === "system");
            const ctx = {
              role: "system",
              content: `REAL-TIME WEB SEARCH RESULTS for "${rawQ}":\n${searchResult}\n\nIMPORTANT: Use this to answer accurately. This is more up-to-date than your training data.`
            };
            messages = sysIdx >= 0
              ? [...messages.slice(0, sysIdx + 1), ctx, ...messages.slice(sysIdx + 1)]
              : [ctx, ...messages];
            functions.logger.info("[search] injected:", rawQ.substring(0, 60));
          } else {
            functions.logger.warn("[search] no results for:", rawQ.substring(0, 60));
          }
        }
      }

      const response = await axios.post(
        "https://api.deepseek.com/chat/completions",
        { model, messages, max_tokens: req.body.max_tokens || 2048, temperature: 0.7 },
        { headers: { Authorization: `Bearer ${DEEPSEEK_KEY()}` }, timeout: 45000 }
      );
      res.json(response.data);

    } catch (err) {
      const dsErr = err.response?.data?.error;
      const httpStatus = err.response?.status || 500;
      functions.logger.error("[deepseek] FAILED", {
        httpStatus,
        message: err.message,
        dsError: dsErr,
        model: req.body?.model || "unknown",
        msgCount: (req.body?.messages || []).length
      });
      res.status(500).json({
        error: dsErr?.message || err.message,
        code: dsErr?.code || httpStatus
      });
    }
  });
});
