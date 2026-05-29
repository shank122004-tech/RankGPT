/**
 * index.js — Cloud Functions entry point
 *
 * Add all future functions here as named exports.
 * Each function file is self-contained.
 */
const cors = require("cors")({
  origin: true
});
const { onRequest } = require("firebase-functions/v2/https");

// ─── Scheduled: Clean up expired pending bookings ────────────────────────────
const functions  = require("firebase-functions");
const admin      = require("firebase-admin");
const axios = require("axios");
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Runs every 30 minutes.
 * Deletes pending_bookings that are older than 30 minutes (payment never completed).
 * Also releases their slot locks.
 */
const cleanupExpiredPendingBookings = functions
  .pubsub.schedule("every 30 minutes")
  .onRun(async () => {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    functions.logger.info(`🧹 Cleaning up pending bookings older than ${cutoff.toISOString()}`);

    const expiredSnap = await db.collection("pending_bookings")
      .where("createdAt", "<", cutoff)
      .where("status", "==", "pending_payment")
      .get();

    if (expiredSnap.empty) {
      functions.logger.info("No expired pending bookings found");
      return null;
    }

    const batch = db.batch();

    for (const doc of expiredSnap.docs) {
      const pending = doc.data();
      functions.logger.info(`Expiring pending booking: ${doc.id}`);

      // Delete pending booking
      batch.delete(doc.ref);

      // Release slot lock
      try {
        const [startTime, endTime] = pending.slotTime.split("-");
        const slotSnap = await db.collection("slots")
          .where("groundId",    "==", pending.groundId)
          .where("date",        "==", pending.date)
          .where("startTime",   "==", startTime.trim())
          .where("lockOrderId", "==", doc.id)
          .limit(1)
          .get();

        if (!slotSnap.empty) {
          batch.update(slotSnap.docs[0].ref, {
            status        : "available",
            lockOrderId   : null,
            lockExpiresAt : null,
            updatedAt     : admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (e) {
        functions.logger.warn(`Could not release slot for expired booking ${doc.id}:`, e.message);
      }
    }

    await batch.commit();
    functions.logger.info(`✅ Cleaned up ${expiredSnap.size} expired pending bookings`);
    return null;
  });


exports.cleanupExpiredPendingBookings =
cleanupExpiredPendingBookings;



exports.geminiVision = onRequest((req, res) => {
  cors(req, res, async () => {
  try {
    // ── DEPRECATED: Gemini replaced by DeepSeek Vision ──
    // This endpoint now proxies to DeepSeek for backward compatibility
    const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || "sk-f617d7a27b2b42579f7093e4857d015c";
    const isPdf = req.body.isPdf || false;
    const isVision = req.body.isVision || false;
    let messages = req.body.contents
      ? req.body.contents.map(c => ({ role: c.role === 'model' ? 'assistant' : (c.role || 'user'), content: Array.isArray(c.parts) ? c.parts.map(p => p.text || '').join('') : '' }))
      : [{ role: 'user', content: req.body.message || '' }];

    const response = await axios.post(
      "https://api.deepseek.com/chat/completions",
      { model: "deepseek-chat", messages, max_tokens: 2048, temperature: 0.7 },
      { headers: { Authorization: `Bearer ${DEEPSEEK_KEY}` }, timeout: 30000 }
    );
    const text = response.data?.choices?.[0]?.message?.content;
    res.json({ text: text || '' });
  } catch (err) {
    console.error("[geminiVision->deepseek]", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});
});
// ─── Real-time search helper ────────────────────────────────────────────────
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

function needsRealTimeSearch(messages) {
  const lastUser = [...messages].reverse().find(m => m.role === "user");
  if (!lastUser) return false;
  const text = lastUser.content.toLowerCase();
  const signals = ["who is","who are","current","latest","recent","today","now",
    "president","prime minister","pm of","ceo of","winner","result","score","news",
    "2024","2025","2026","what happened","price of","rate of","stock","election",
    "appointed","resigned","died","government"];
  return signals.some(s => text.includes(s));
}

exports.deepseek = onRequest((req, res) => {
  cors(req, res, async () => {
  try {
    let messages = req.body.messages || [];
    const model = req.body.model || "deepseek-chat";
    const isPdf = req.body.isPdf || false;
    const isVision = req.body.isVision || false;
    const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || "sk-f617d7a27b2b42579f7093e4857d015c";

    // ── PDF: Extract text from base64 PDF then pass to DeepSeek ──
    if (isPdf && req.body.pdfBase64) {
      try {
        const pdfParse = require("pdf-parse");
        const pdfBuffer = Buffer.from(req.body.pdfBase64, "base64");
        const pdfData = await pdfParse(pdfBuffer);
        const extractedText = pdfData.text || "";
        // Replace last user message with extracted text context
        const lastUserIdx = [...messages].map((m,i) => m.role === "user" ? i : -1).filter(i => i >= 0).pop();
        if (lastUserIdx !== undefined && extractedText) {
          const origContent = typeof messages[lastUserIdx].content === "string"
            ? messages[lastUserIdx].content
            : JSON.stringify(messages[lastUserIdx].content);
          // Strip the base64 blob from message and replace with extracted text
          const cleanContent = origContent.replace(/PDF Base64 Data.*$/s, "").trim();
          messages[lastUserIdx] = {
            role: "user",
            content: `[PDF CONTENT EXTRACTED — ${pdfData.numpages} pages]\n\n${extractedText.substring(0, 12000)}\n\n---\nUser question: ${cleanContent.replace("[PDF DOCUMENT ATTACHED]", "").replace("The user has uploaded a PDF document (base64 encoded). Please extract and analyze the full text content from this PDF, then answer:", "").trim()}`
          };
        }
      } catch (pdfErr) {
        functions.logger.warn("[PDF parse error]", pdfErr.message);
        // Continue without extraction — DeepSeek will do its best
      }
    }

    // ── Vision: messages may contain image_url content arrays — pass as-is ──
    // DeepSeek V3 supports OpenAI-compatible image_url in content arrays

    // ── Real-time search injection (text-only messages) ──
    if (!isPdf && !isVision && needsRealTimeSearch(messages)) {
      const lastUser = [...messages].reverse().find(m => m.role === "user");
      if (lastUser) {
        const rawContent = typeof lastUser.content === "string" ? lastUser.content : JSON.stringify(lastUser.content);
        const searchQuery = rawContent.replace(/[^\w\s?]/g, " ").trim().substring(0, 120);
        const searchResult = await tavilySearch(searchQuery);
        if (searchResult) {
          const today = new Date().toISOString().split("T")[0];
          const ctx = {
            role: "system",
            content: `TODAY: ${today}\n\nREAL-TIME DATA for "${searchQuery}":\n${searchResult}\n\nUse this to give accurate, current answers.`
          };
          const sysIdx = messages.findIndex(m => m.role === "system");
          if (sysIdx >= 0) {
            messages = [...messages.slice(0, sysIdx + 1), ctx, ...messages.slice(sysIdx + 1)];
          } else {
            messages = [ctx, ...messages];
          }
        }
      }
    }

    const response = await axios.post(
      "https://api.deepseek.com/chat/completions",
      { model, messages, max_tokens: req.body.max_tokens || 2048, temperature: 0.7 },
      { headers: { Authorization: `Bearer ${DEEPSEEK_KEY}` }, timeout: 45000 }
    );
    res.json(response.data);

  } catch (err) {
    functions.logger.error("[deepseek]", err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});
});