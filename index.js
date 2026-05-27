const express = require("express");
const cors = require("cors");
const axios = require("axios");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();

// =========================
// FIREBASE ADMIN
// =========================
const serviceAccount = require("./rankgpt-f8a64-firebase-adminsdk-fbsvc-f089c1b6a2.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// =========================
// MIDDLEWARE
// =========================
app.use(cors());
app.use(express.json({ limit: "25mb" }));

// =========================
// AUTH MIDDLEWARE
// =========================
async function verifyFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    const token = authHeader.split("Bearer ")[1];

    const decodedToken = await admin.auth().verifyIdToken(token);

    req.user = decodedToken;

    next();

  } catch (error) {
    console.error(error);

    return res.status(401).json({
      error: "Invalid token"
    });
  }
}

// =========================
// GEMINI API
// =========================
app.post("/gemini", verifyFirebaseToken, async (req, res) => {
  try {

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      req.body,
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);

  } catch (error) {

    console.error(error.response?.data || error.message);

    res.status(500).json({
      error: error.response?.data || error.message
    });
  }
});

// =========================
// DEEPSEEK API
// =========================
app.post("/deepseek", verifyFirebaseToken, async (req, res) => {
  try {

    const response = await axios.post(
      "https://api.deepseek.com/chat/completions",
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
        }
      }
    );

    res.json(response.data);

  } catch (error) {

    console.error(error.response?.data || error.message);

    res.status(500).json({
      error: error.response?.data || error.message
    });
  }
});

// =========================
// HEALTH CHECK
// =========================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AI Backend Running 🚀"
  });
});

// =========================
// START SERVER
// =========================
const functions = require("firebase-functions");

exports.api = functions.https.onRequest(app);