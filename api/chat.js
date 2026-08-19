/**
 * api/chat.js — Vercel serverless proxy for the "Ask InvestIQ" chat
 * assistant, backed by Google's Gemini API.
 *
 * The Gemini key lives ONLY in the server-side environment variable
 * GEMINI_API_KEY (set in Vercel Project Settings → Environment Variables)
 * — it is never sent to, or readable from, the browser. Same pattern as
 * RAPIDAPI_KEY in api/fundamentals.js.
 *
 * The frontend (js/chatWidget.js) gathers the user's REAL data client-side
 * (risk profile, holdings, portfolio health, recent transactions — all
 * already computed by the app's own deterministic engines) and sends it
 * as structured JSON in the request body. This function does not fetch
 * or know anything about the user's account itself — it only forwards
 * {message, history, context} to Gemini with a system instruction that
 * constrains the model to that context.
 *
 * Why the system instruction matters here specifically: this app's whole
 * design principle is "explain, don't just tell the user what to buy"
 * (see js/recommendationEngine.js, js/ai.js). The assistant is
 * instructed to only reference the structured context it's given, never
 * invent numbers, and never issue an authoritative buy/sell signal —
 * it explains what the app's own scoring/analytics already show, the
 * same way js/ai.js's canned explanations do, just conversationally.
 *
 * Usage: POST /api/chat  { message, history: [{role,text}], context: {...} }
 *
 * Timeout note: Vercel's Hobby (free) plan defaults serverless functions
 * to a 10-second max execution time unless maxDuration is configured
 * (and even then, Hobby plans may cap it below what's requested here).
 * The internal fetch timeout below is deliberately kept under that
 * default so THIS code's own clean timeout message fires — instead of
 * the platform killing the function first and producing a confusing
 * generic "aborted" error with no useful detail.
 */

export const config = { maxDuration: 15 };

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent";

const SYSTEM_INSTRUCTION = [
  "You are the \"Ask InvestIQ\" assistant inside InvestIQ, an educational, India-only virtual stock portfolio app. All trading in this app is simulated with virtual currency — no real money is ever involved.",
  "",
  "You will be given a JSON \"context\" object with the user's real risk profile, holdings, recent transactions, and portfolio health, all already computed by the app's own deterministic engines (never fabricated). Only reference numbers that appear in that context or in the conversation — never invent a price, ratio, or figure that isn't there. If you don't have data to answer something, say so plainly and suggest where in the app they could find it (Stocks page, Learn section, etc.) instead of guessing.",
  "",
  "Your job is to EXPLAIN, in plain, beginner-friendly language:",
  "- What the user's portfolio numbers mean and why they are what they are",
  "- Financial/investing concepts (P/E, beta, Sharpe ratio, diversification, etc.) in layman's terms",
  "- WHY the app's recommendation engine scored or allocated a stock the way it did, using the real sub-scores in the context",
  "",
  "You must NOT:",
  "- Tell the user to buy or sell a specific stock right now, or claim to know what the market will do next — that would be real financial advice, which you are not licensed to give and this app does not provide",
  "- Predict future prices or returns",
  "- Present your own opinion as a trading signal",
  "",
  "Instead of \"you should buy X now\", say things like \"the app's scoring currently rates X highly on growth and financial strength for your risk profile — you can review the full breakdown on that stock's page\", or \"a common way investors think about this is...\", always keeping it educational and tied to the real data you were given.",
  "",
  "Keep answers concise (a few short paragraphs at most, or a short list), warm, and beginner-friendly — this user may have limited investing experience. If a question drifts toward asking for personal financial advice (\"what should I do with my money\", \"is now a good time to invest\"), gently redirect: explain you can help them understand their own data and general concepts, but for real financial decisions they should consult a licensed advisor."
].join("\n");

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body." });
  }

  const message = body && body.message;
  const history = (body && body.history) || [];
  const context = (body && body.context) || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required." });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: "Message too long (max 2000 characters)." });
  }
  if (!Array.isArray(history) || history.length > 20) {
    return res.status(400).json({ error: "history must be an array of at most 20 turns." });
  }

  // Turn the client-provided context + prior turns into Gemini's
  // `contents` shape. The context is injected as the first "user" turn
  // so the model treats it as ground truth for the rest of the chat.
  const contents = [];
  contents.push({
    role: "user",
    parts: [{ text: "Here is my current InvestIQ data as JSON — use only this for any numbers you reference:\n" + JSON.stringify(context) }]
  });
  contents.push({
    role: "model",
    parts: [{ text: "Got it — I'll use only that data for any numbers I mention. What would you like to know?" }]
  });

  history.slice(-20).forEach(function (turn) {
    if (!turn || !turn.text) return;
    contents.push({ role: turn.role === "assistant" ? "model" : "user", parts: [{ text: String(turn.text).slice(0, 2000) }] });
  });

  contents.push({ role: "user", parts: [{ text: message }] });

  const payload = {
    contents: contents,
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    generationConfig: { temperature: 0.4, maxOutputTokens: 700 }
  };

  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 8500);

  try {
    const resp = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    const data = await resp.json();
    if (!resp.ok) {
      const detail = (data && data.error && data.error.message) || ("Gemini responded " + resp.status);
      return res.status(502).json({ error: "Assistant is temporarily unavailable.", detail: redact(detail, apiKey) });
    }

    const candidate = data.candidates && data.candidates[0];
    const reply = candidate && candidate.content && candidate.content.parts && candidate.content.parts.map(function (p) { return p.text || ""; }).join("");

    if (!reply) {
      const finishReason = candidate && candidate.finishReason;
      return res.status(502).json({ error: "Assistant didn't return a response.", detail: finishReason || "empty response" });
    }

    return res.status(200).json({ reply: reply });
  } catch (e) {
    clearTimeout(timeout);
    const detail = e.name === "AbortError" ? "Timed out waiting for Gemini to respond (>8.5s)." : redact(e.message, apiKey);
    return res.status(502).json({ error: "Failed to reach the assistant.", detail: detail });
  }
}

// Strips the raw API key (or any whitespace-separated fragment of it —
// covers a malformed value with embedded newlines/duplication) out of
// any string before it's ever allowed into an error response. Error
// text can otherwise leak the exact header value verbatim, and this
// endpoint's errors are visible to any caller — key material must
// never appear in a response body. (Same helper as api/fundamentals.js;
// duplicated rather than shared since these are independent serverless
// functions with no shared module in this project.)
function redact(text, apiKey) {
  if (!text) return text;
  let out = String(text);
  if (apiKey) {
    out = out.split(apiKey).join("[REDACTED]");
    String(apiKey).split(/\s+/).forEach(function (fragment) {
      if (fragment.length >= 8) out = out.split(fragment).join("[REDACTED]");
    });
  }
  return out;
}
