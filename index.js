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
    

    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyCmzArFqO2Y1-Mm4THkiN7y_1xjogWNqyY",
      {
        contents: [
          {
            parts: [{ text: req.body.message || req.body.contents?.[0]?.parts?.[0]?.text }]
          }
        ]
      }
    );

    res.json(response.data);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message
    });
  }
});
});
exports.deepseek = onRequest((req, res) => {
  cors(req, res, async () => {
  try {
    const response = await axios.post(
      "https://api.deepseek.com/chat/completions",
      {
        model: req.body.model || "deepseek-v3",
        messages: req.body.messages
      },
      {
        headers: {
          Authorization: `Bearer sk-f617d7a27b2b42579f7093e4857d015c`
        }
      }
    );

    res.json(response.data);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});
  });