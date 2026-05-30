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

async function tavilySearch(query) {
  try {
    const key = process.env.TAVILY_API_KEY || "";
    if (!key) throw new Error("no key");
    const r = await axios.post("https://api.tavily.com/search", {
      api_key: key, query, search_depth: "basic", max_results: 4, include_answer: true
    }, { timeout: 8000 });
    const answer = r.data?.answer || "";
    const snippets = (r.data?.results || []).map(x => `[${x.title}]: ${x.content}`).join("\n\n");
    return answer ? `Answer: ${answer}\n\nSources:\n${snippets}` : snippets;
  } catch(e) {
    try {
      const ddg = await axios.get(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
        { timeout: 5000 }
      );
      const d = ddg.data;
      if (d.AbstractText) return d.AbstractText;
      if (d.Answer) return d.Answer;
    } catch(e2) {}
    return null;
  }
}

// Safe: handles content that may be a string OR an array (vision messages)
function getTextContent(content) {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter(p => p.type === "text").map(p => p.text || "").join(" ");
  }
  return String(content);
}

function needsRealTimeSearch(messages) {
  const lastUser = [...messages].reverse().find(m => m.role === "user");
  if (!lastUser) return false;
  const text = getTextContent(lastUser.content).toLowerCase();
  const signals = ["who is","who are","current","latest","recent","today","now",
    "president","prime minister","pm of","ceo of","winner","result","score","news",
    "2024","2025","2026","what happened","price of","rate of","stock","election",
    "appointed","resigned","died","government"];
  return signals.some(s => text.includes(s));
}

// ─── geminiVision (kept for backward compat, now proxies to DeepSeek) ────────
exports.geminiVision = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      let messages = req.body.contents
        ? req.body.contents.map(c => ({
            role: c.role === "model" ? "assistant" : (c.role || "user"),
            content: Array.isArray(c.parts) ? c.parts.map(p => p.text || "").join("") : ""
          }))
        : [{ role: "user", content: req.body.message || "" }];

      const response = await axios.post(
        "https://api.deepseek.com/chat/completions",
        { model: "deepseek-chat", messages, max_tokens: 2048, temperature: 0.7 },
        { headers: { Authorization: `Bearer ${DEEPSEEK_KEY()}` }, timeout: 30000 }
      );
      const text = response.data?.choices?.[0]?.message?.content;
      res.json({ text: text || "" });
    } catch (err) {
      functions.logger.error("[geminiVision->deepseek]", err.response?.data || err.message);
      res.status(500).json({ error: err.response?.data?.error?.message || err.message });
    }
  });
});

// ─── deepseek — main AI endpoint ─────────────────────────────────────────────
exports.deepseek = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      let messages = req.body.messages || [];
      const model   = req.body.model || "deepseek-chat";
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

      // ── Real-time search (text messages only, skip vision/pdf) ──────────────
      if (!isPdf && !isVision && needsRealTimeSearch(messages)) {
        const lastUser = [...messages].reverse().find(m => m.role === "user");
        if (lastUser) {
          const searchQuery  = getTextContent(lastUser.content).replace(/[^\w\s?]/g, " ").trim().substring(0, 120);
          const searchResult = await tavilySearch(searchQuery);
          if (searchResult) {
            const today = new Date().toISOString().split("T")[0];
            const ctx   = { role: "system", content: `TODAY: ${today}\n\nREAL-TIME DATA:\n${searchResult}\n\nUse this for accurate, current answers.` };
            const sysIdx = messages.findIndex(m => m.role === "system");
            messages = sysIdx >= 0
              ? [...messages.slice(0, sysIdx + 1), ctx, ...messages.slice(sysIdx + 1)]
              : [ctx, ...messages];
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
