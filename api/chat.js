/**
 * api/chat.js — Vercel serverless proxy for the "Ask InvestIQ" chat
 * assistant, backed by NVIDIA NIM's OpenAI-compatible chat completions
 * API (https://build.nvidia.com), using Llama 3.3 70B Instruct.
 *
 * Previously backed by Google's Gemini API. Switched away because
 * Gemini's free tier kept hitting daily quota limits under normal
 * testing use. NVIDIA NIM's free developer API key has much more
 * generous per-model rate limits for the same "explain the app's own
 * data conversationally" workload this endpoint does.
 *
 * The key lives ONLY in the server-side environment variable
 * NVIDIA_API_KEY (set in Vercel Project Settings → Environment
 * Variables) — it is never sent to, or readable from, the browser.
 * Same pattern as RAPIDAPI_KEY in api/fundamentals.js.
 *
 * The frontend (js/chatWidget.js) gathers the user's REAL data client-side
 * (risk profile, holdings, portfolio health, recent transactions — all
 * already computed by the app's own deterministic engines) and sends it
 * as structured JSON in the request body. This function does not fetch
 * or know anything about the user's account itself — it only forwards
 * {message, history, context} to the model with a system instruction
 * that constrains it to that context.
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

const NIM_MODEL = "meta/llama-3.3-70b-instruct";
const NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

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

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "NVIDIA_API_KEY is not configured on the server." });
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

  // Turn the client-provided context + prior turns into OpenAI-style
  // `messages`. The context is injected as its own user turn right
  // after the system prompt so the model treats it as ground truth.
  const messages = [{ role: "system", content: SYSTEM_INSTRUCTION }];
  messages.push({
    role: "user",
    content: "Here is my current InvestIQ data as JSON — use only this for any numbers you reference:\n" + JSON.stringify(context)
  });
  messages.push({
    role: "assistant",
    content: "Got it — I'll use only that data for any numbers I mention. What would you like to know?"
  });

  history.slice(-20).forEach(function (turn) {
    if (!turn || !turn.text) return;
    messages.push({ role: turn.role === "assistant" ? "assistant" : "user", content: String(turn.text).slice(0, 2000) });
  });

  messages.push({ role: "user", content: message });

  const payload = {
    model: NIM_MODEL,
    messages: messages,
    temperature: 0.4,
    max_tokens: 700,
    stream: false
  };

  // NVIDIA NIM occasionally returns a transient 503/"model is currently
  // overloaded" during traffic spikes, or simply takes longer than usual
  // to respond — neither is anything wrong with our request, and both
  // typically clear on a second try. Retry once automatically rather
  // than surfacing a failure to the user for something that would
  // likely have just worked on the next try. Overall budget (both
  // attempts combined) stays under Vercel Hobby's 10s function limit.
  const deadline = Date.now() + 8500;
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 500) break;

    let timedOut = false;
    try {
      const result = await callNim(payload, apiKey, Math.min(remaining, 7500));
      if (result.ok) return res.status(200).json({ reply: result.reply });
      lastError = result;
      if (!result.overloaded) break; // a non-overload failure won't be fixed by retrying
    } catch (e) {
      timedOut = e.name === "AbortError";
      lastError = { detail: timedOut ? "Timed out waiting for the assistant to respond." : redact(e.message, apiKey), overloaded: timedOut };
      // A timeout on this attempt doesn't mean we're out of budget overall —
      // only that this one call ran long. If there's still time before the
      // deadline, give it one more try rather than giving up immediately.
      if (!timedOut) break;
    }

    if (attempt === 1 && lastError && lastError.overloaded) {
      await new Promise(function (r) { setTimeout(r, 500); });
    }
  }

  if (lastError && lastError.emptyReply) {
    return res.status(502).json({ error: "Assistant didn't return a response.", detail: lastError.detail });
  }
  if (lastError && lastError.quotaExceeded) {
    return res.status(429).json({
      error: "The assistant's free-tier quota has been used up for now.",
      detail: lastError.detail,
      quotaExceeded: true
    });
  }
  return res.status(502).json({ error: "Assistant is temporarily unavailable.", detail: (lastError && lastError.detail) || "Unknown error." });
}

// Single attempt at calling NVIDIA NIM. Returns either {ok:true, reply} or
// {ok:false, detail, overloaded, quotaExceeded, emptyReply} — never throws
// for a normal HTTP error response, only for a genuine network
// failure/timeout (left to the caller to catch).
async function callNim(payload, apiKey, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, timeoutMs);

  try {
    const resp = await fetch(NIM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const data = await resp.json();
    if (!resp.ok) {
      const detail = (data && data.error && (data.error.message || data.error)) || ("NVIDIA NIM responded " + resp.status);
      // A quota/rate-limit error (429) is NOT the same thing as a
      // transient overload — retrying it immediately just burns more of
      // an already-exhausted quota and will fail again. Check for it
      // first so it never gets misclassified as "overloaded" (which
      // triggers a retry) below.
      const quotaExceeded = resp.status === 429 || /quota|rate limit|too many requests/i.test(String(detail));
      const overloaded = !quotaExceeded && (resp.status === 503 || /overload|high demand|try again later/i.test(String(detail)));
      return { ok: false, detail: redact(String(detail), apiKey), overloaded: overloaded, quotaExceeded: quotaExceeded };
    }

    const choice = data.choices && data.choices[0];
    const reply = choice && choice.message && choice.message.content;

    if (!reply) {
      const finishReason = choice && choice.finish_reason;
      return { ok: false, emptyReply: true, detail: finishReason || "empty response" };
    }

    return { ok: true, reply: reply };
  } finally {
    clearTimeout(timeout);
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
