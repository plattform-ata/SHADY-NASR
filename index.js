/* Cloudflare Worker — وسيط بين صفحة الشات و Groq
   المفتاح بيتقري من Secret اسمه API_KEY (Settings ← Variables and Secrets) */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// دومينات موقعك المسموحة (مثال: "https://yoursite.com"). لو سيبتها فاضية بيقبل من أي دومين.
const ALLOWED_ORIGINS = [];

// الموديلات المسموحة بس (نفس الموجودة في chat.js)
const ALLOWED_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

const MAX_BODY_BYTES = 60000;   // أقصى حجم للطلب
const MAX_MESSAGES = 30;        // أقصى عدد رسايل في الطلب
const MAX_TOKENS = 2000;        // أقصى طول للرد

function corsHeaders(origin) {
  const ok = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? (ALLOWED_ORIGINS.length ? origin : "*") : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors } });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

    if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)) return json({ error: "forbidden" }, 403, cors);
    if (!env.API_KEY) return json({ error: "missing_api_key" }, 500, cors);

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: "too_large" }, 413, cors);

    let body;
    try { body = JSON.parse(raw); } catch (e) { return json({ error: "bad_json" }, 400, cors); }

    if (!ALLOWED_MODELS.includes(body.model)) return json({ error: "model_not_allowed" }, 400, cors);
    if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > MAX_MESSAGES) {
      return json({ error: "bad_messages" }, 400, cors);
    }

    // بنبعت بس الحقول المسموحة
    const payload = {
      model: body.model,
      messages: body.messages.map(m => ({ role: String(m.role), content: String(m.content || "") })),
      temperature: typeof body.temperature === "number" ? Math.min(Math.max(body.temperature, 0), 1.5) : 0.6,
      max_completion_tokens: Math.min(Number(body.max_completion_tokens) || MAX_TOKENS, MAX_TOKENS),
      stream: body.stream !== false
    };
    if (["low", "medium", "high"].includes(body.reasoning_effort)) payload.reasoning_effort = body.reasoning_effort;

    const upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.API_KEY },
      body: JSON.stringify(payload)
    });

    // بنرجّع نفس الـ status والـ stream زي ما هو
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
        ...cors
      }
    });
  }
};
