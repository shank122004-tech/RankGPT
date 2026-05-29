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
    // Use gemini-1.5-flash — supports text, images, and PDFs
    const GEMINI_KEY = process.env.GEMINI_API_KEY || "AIzaSyCmzArFqO2Y1-Mm4THkiN7y_1xjogWNqyY";
    const GEMINI_MODEL = "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

    // Forward the full body (contents, generationConfig etc) as sent by client
    const requestBody = {
      contents: req.body.contents || [{ parts: [{ text: req.body.message || "" }] }],
      generationConfig: req.body.generationConfig || { maxOutputTokens: 2048, temperature: 0.7 }
    };

    const response = await axios.post(url, requestBody, {
      timeout: 30000,
      headers: { "Content-Type": "application/json" }
    });

    const candidate = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidate) {
      res.json({ text: candidate });
    } else {
      res.json(response.data);
    }

  } catch (err) {
    console.error("[geminiVision]", err.response?.data || err.message);
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

    // Inject real-time context when needed
    if (needsRealTimeSearch(messages)) {
      const lastUser = [...messages].reverse().find(m => m.role === "user");
      if (lastUser) {
        const searchQuery = lastUser.content.replace(/[^\w\s?]/g, " ").trim().substring(0, 120);
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
      { model, messages },
      { headers: { Authorization: `Bearer sk-f617d7a27b2b42579f7093e4857d015c` } }
    );
    res.json(response.data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
  });