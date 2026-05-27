const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const admin = require("firebase-admin");

require("dotenv").config();

admin.initializeApp();

const app = express();

// CORS — must be the very first middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.setHeader("Access-Control-Max-Age", "3600");

  // Respond immediately to all preflight requests
  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }
  next();
});

app.use(cors({ origin: "*", credentials: false }));

// JSON parsing with increased limit
app.use(express.json({ limit: "25mb" }));

// Firebase Auth Middleware
async function verifyFirebaseToken(req, res, next) {

  if (req.method === "OPTIONS") {
    return next();
  }

  try {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "No token provided"
      });
    }

    const token = authHeader.split("Bearer ")[1];

    const decodedToken = await admin.auth().verifyIdToken(token);

    req.user = decodedToken;

    next();

  } catch (error) {

    console.error("Auth Error:", error.message);

    return res.status(401).json({
      error: "Invalid token",
      message: error.message
    });
  }
}

// GEMINI Endpoint
app.post("/gemini", verifyFirebaseToken, async (req, res) => {

  try {
    console.log("Gemini request received from user:", req.user.uid);

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      req.body,
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    res.json(response.data);

  } catch (error) {

    console.error("Gemini Error:", error.response?.data || error.message);

    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({
      error: "Gemini API Error",
      message: error.response?.data?.error?.message || error.message,
      details: error.response?.data
    });
  }
});

// DEEPSEEK Endpoint
app.post("/deepseek", verifyFirebaseToken, async (req, res) => {

  try {
    console.log("DeepSeek request received from user:", req.user.uid);

    const response = await axios.post(
      "https://api.deepseek.com/chat/completions",
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        timeout: 30000
      }
    );

    res.json(response.data);

  } catch (error) {

    console.error("DeepSeek Error:", error.response?.data || error.message);

    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({
      error: "DeepSeek API Error",
      message: error.response?.data?.error?.message || error.message,
      details: error.response?.data
    });
  }
});

// HEALTH CHECK
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SSC PrepAI Backend Running 🚀"
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    timestamp: new Date().toISOString()
  });
});

exports.api = functions.https.onRequest(app);