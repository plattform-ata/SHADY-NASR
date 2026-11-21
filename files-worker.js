/* ==========================================================================
   files-worker.js — Worker "shady-files"
   بيحوّل ملف أسئلة (Word / PDF / صورة / نص) لأسئلة جاهزة للمنصة، بـ Groq.
   - المفتاح: Secret على Cloudflare اسمه  files-exame  (من console.groq.com/keys)
   - اختياري (متغيرات عادية): FILES_MODEL (افتراضي openai/gpt-oss-120b) · FILES_VISION_MODEL (للصور) · ALLOWED_ORIGINS
   - افتح رابط الـ Worker في المتصفح عشان تشوف حالته
   ========================================================================== */
const ADMIN_KEY_DEFAULT = "f3xTpDzfVCkeYQEr3IFKbG5k";   // لازم يطابق AI_TOKEN في exams-admin.js (أو ضيف Secret اسمه ADMIN_KEY)
const BASE = "https://api.groq.com/openai/v1";
const TEXT_MODEL_DEFAULT = "openai/gpt-oss-120b";
const VISION_PREF = ["qwen/qwen3.8-27b", "qwen/qwen3.6-27b", "meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct"];
const CHUNK_CHARS = 6000, MAX_CHUNKS = 8, MAX_IMAGES = 4, MAX_FILE_B64 = 12 * 1024 * 1024;
const KNOWN_TYPES = ["mcq", "vocab", "correction", "translation", "conversation", "essay"];

const keyOf = (env) => env["files-exame"] || env.FILES_API_KEY || env.GROQ_API_KEY || "";
const arr = (x) => (Array.isArray(x) ? x.filter((v) => v != null) : x && typeof x === "object" ? Object.keys(x).map((k) => x[k]).filter((v) => v != null) : []);
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function corsHeaders(req, env) {
  const h = { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" };
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("Origin") || "";
  if (!allowed.length) h["Access-Control-Allow-Origin"] = "*";
  else if (allowed.includes(origin)) { h["Access-Control-Allow-Origin"] = origin; h["Vary"] = "Origin"; }
  else if (origin) h["X-Origin-Blocked"] = "1";
  return h;
}
function json(obj, status, headers) {
  const h = Object.assign({}, headers); delete h["X-Origin-Blocked"];
  return new Response(JSON.stringify(obj), { status: status || 200, headers: h });
}
function sameKey(a, b) {
  a = String(a || ""); b = String(b || "");
  if (!a || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const fail = (code, status) => Object.assign(new Error(code), { code, status });

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method === "GET") return json(await health(env), 200, cors);
    if (req.method !== "POST") return json({ ok: false, error: "method" }, 405, cors);
    if (cors["X-Origin-Blocked"]) return json({ ok: false, error: "origin" }, 403, cors);
    let body;
    try { body = await req.json(); } catch (e) { return json({ ok: false, error: "bad_json" }, 400, cors); }
    if (!body || body.action !== "extract_questions") return json({ ok: false, error: "unknown_action" }, 400, cors);
    if (!(sameKey(body.adminKey, ADMIN_KEY_DEFAULT) || (env.ADMIN_KEY && sameKey(body.adminKey, env.ADMIN_KEY)))) return json({ ok: false, error: "auth" }, 401, cors);
    try {
      return json(await extractQuestions(env, body), 200, cors);
    } catch (e) {
      console.log("extract error", e && e.code, e && e.message);
      const code = (e && e.code) || (e && e.status === 429 ? "rate_limited" : "server");
      const bad = ["bad_file", "too_big", "no_key", "empty", "unsupported"].indexOf(code) >= 0;
      return json({ ok: false, error: code, status: (e && e.status) || 0 }, bad ? 400 : code === "rate_limited" ? 429 : code === "provider_auth" ? 502 : 500, cors);
    }
  }
};

/* ---------------------------------------------------------------- فحص الحالة (GET) */
let _vision = { at: 0, id: "" };
async function pickVision(env, key) {
  if (env.FILES_VISION_MODEL) return env.FILES_VISION_MODEL;
  if (_vision.id && Date.now() - _vision.at < 600000) return _vision.id;
  let id = VISION_PREF[1];
  try {
    const r = await fetch(BASE + "/models", { headers: { Authorization: "Bearer " + key } });
    if (r.ok) { const have = arr((await r.json()).data).map((m) => m.id); id = VISION_PREF.find((m) => have.indexOf(m) >= 0) || id; }
  } catch (e) { /* نكمّل بالافتراضي */ }
  _vision = { at: Date.now(), id };
  return id;
}
async function health(env) {
  const key = keyOf(env);
  const out = { ok: true, worker: "shady-files", hasKey: !!key, textModel: env.FILES_MODEL || TEXT_MODEL_DEFAULT };
  if (!key) { out.ok = false; out.provider = "مفيش مفتاح: لازم Secret اسمه files-exame"; return out; }
  try {
    const r = await fetch(BASE + "/models", { headers: { Authorization: "Bearer " + key } });
    out.provider = r.ok ? "ok" : "FAILED: HTTP " + r.status + (r.status === 401 ? " (المفتاح غلط أو مش بتاع Groq)" : "");
    if (!r.ok) out.ok = false;
  } catch (e) { out.provider = "FAILED: " + String(e && e.message).slice(0, 80); out.ok = false; }
  out.visionModel = await pickVision(env, key);
  return out;
}

const b64bytes = (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

/* قراءة نص ملف Word (.docx) من غير مكتبات: docx هو zip فيه word/document.xml */
async function docxText(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw Object.assign(new Error("not zip"), { code: "bad_file" });
  const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + elen + clen;
    if (name !== "word/document.xml") continue;
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    let data = bytes.subarray(start, start + csize);
    if (method === 8) data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    else if (method !== 0) throw Object.assign(new Error("zip method"), { code: "bad_file" });
    const xml = dec.decode(data);
    return xml.replace(/<w:tab\/>/g, "\t").replace(/<\/w:p>/g, "\n").replace(/<w:br[^>]*\/>/g, "\n").replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();
  }
  throw Object.assign(new Error("no document.xml"), { code: "bad_file" });
}

function normSection(g, letters) {
  const type = String((g && g.type) || "").toLowerCase();
  if (KNOWN_TYPES.indexOf(type) < 0) return null;
  const qs = arr(g.questions).map((q) => {
    const text = String((q && q.text) || "").trim();
    const out = { text, options: [], answer: "" };
    if (type === "mcq") {
      out.options = arr(q.options).map((o) => String(o || "").trim()).slice(0, letters.length);
      const ix = parseInt(q.answer_index, 10);
      out.answer = out.options.length >= 2 && ix >= 0 && ix < out.options.length && out.options[ix] ? letters[ix] : "";
    } else if (type === "correction") out.answer = String(q.answer || "").trim();
    return out;
  }).filter((q) => q.text && (type !== "mcq" || q.options.length >= 2));
  return qs.length ? { type, questions: qs } : null;
}


/* ---------------------------------------------------------------- استدعاء Groq */
const SCHEMA = {
  type: "object",
  properties: { sections: { type: "array", items: { type: "object", properties: {
    type: { type: "string" },
    questions: { type: "array", items: { type: "object", properties: {
      text: { type: "string" }, options: { type: "array", items: { type: "string" } }, answer_index: { type: "integer" }, answer: { type: "string" }
    }, required: ["text", "options", "answer_index", "answer"], additionalProperties: false } }
  }, required: ["type", "questions"], additionalProperties: false } } },
  required: ["sections"], additionalProperties: false
};

/* strict schema أول، ولو اترفض بنكمّل بـ json_object. بنستنى لو الحد المجاني وصل (429) */
async function chat(env, key, payload, useSchema, timeoutMs) {
  let strict = !!useSchema, lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const body = { ...payload };
    if (strict) body.response_format = { type: "json_schema", json_schema: { name: "questions", strict: true, schema: SCHEMA } };
    else {
      body.response_format = { type: "json_object" };
      body.messages = payload.messages.map((m, i) => i === 0 && typeof m.content === "string" ? { ...m, content: m.content + "\nReturn ONLY one JSON object that matches this JSON schema: " + JSON.stringify(SCHEMA) } : m);
    }
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
      let r;
      try { r = await fetch(BASE + "/chat/completions", { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json", Authorization: "Bearer " + key }, body: JSON.stringify(body) }); }
      finally { clearTimeout(t); }
      if (!r.ok) {
        const er = new Error("ai " + r.status + " " + String(await r.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 140));
        er.status = r.status; er.retry = num(r.headers.get("retry-after"), 0); throw er;
      }
      const j = await r.json();
      let txt = String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "").trim();
      txt = txt.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      return JSON.parse(txt);
    } catch (e) {
      lastErr = e;
      if (e && e.status === 429) { if (attempt < 2) { await wait(Math.min(20, Math.max(3, e.retry || 8)) * 1000); continue; } throw e; }
      if (e && e.status === 401) throw fail("provider_auth", 401);
      if (strict) { strict = false; continue; }
      throw e;
    }
  }
  throw lastErr || new Error("ai failed");
}

const INSTRUCTION = (hint, part) => [
  "You convert a teacher's document (questions for an English-language school course in Egypt) into structured exam questions for an online platform.",
  "Extract the questions that exist in the document. Do NOT invent new questions and do not change their meaning; fix only obvious typing/OCR errors. Skip titles, page numbers and answer-key tables (but use them to find correct answers).",
  "Classify every question into exactly one type: mcq (multiple choice), vocab (give the meaning of a word), correction (find and correct a mistake), translation, conversation (complete a dialogue / fill blanks), essay (writing task).",
  "Rules per type: mcq -> 'text' is the stem, 'options' are the choices WITHOUT their letters (A/B/C/D), 'answer_index' is the 0-based index of the correct choice (use the document's answer key if present, otherwise decide the correct one), 'answer' is ''. correction -> 'text' is the wrong sentence and 'answer' is the corrected sentence. Other types -> 'options' is [], 'answer_index' is -1, 'answer' is ''.",
  "For a reading passage with several questions, put the passage once at the start of the first question's 'text' so each question stays understandable.",
  part && part.of > 1 ? "This is part " + part.i + " of " + part.of + " of the same document. If a question is clearly cut off at the very start or end of this part, skip it." : "",
  "Return JSON only: {\"sections\":[{\"type\":\"mcq|vocab|correction|translation|conversation|essay\",\"questions\":[{\"text\":\"\",\"options\":[],\"answer_index\":-1,\"answer\":\"\"}]}]}. Group questions of the same type in one section, in document order.",
  hint ? "Teacher's note: " + String(hint).slice(0, 500) : ""
].filter(Boolean).join("\n");

/* تقسيم النص على فواصل الفقرات عشان السؤال مايتقطعش */
function chunkText(text) {
  const parts = text.split(/\n{2,}/), chunks = []; let cur = "";
  for (const p of parts) {
    if (cur && cur.length + p.length + 2 > CHUNK_CHARS) { chunks.push(cur); cur = ""; }
    if (p.length > CHUNK_CHARS) { for (let i = 0; i < p.length; i += CHUNK_CHARS) chunks.push(p.slice(i, i + CHUNK_CHARS)); continue; }
    cur += (cur ? "\n\n" : "") + p;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

async function extractQuestions(env, body) {
  const key = keyOf(env);
  if (!key) throw fail("no_key");
  const letters = (Array.isArray(body.letters) && body.letters.length >= 2 && body.letters.length <= 6 ? body.letters : ["A", "B", "C", "D"]).map(String);
  const hint = body.hint ? String(body.hint) : "";
  const merged = {}; const seen = new Set(); let chunksDone = 0;
  const add = (raw) => arr(raw && raw.sections).forEach((g) => {
    const s = normSection(g, letters); if (!s) return;
    s.questions.forEach((q) => {
      const k = s.type + "|" + q.text.toLowerCase().replace(/\W+/g, "");
      if (seen.has(k)) return; seen.add(k);
      (merged[s.type] = merged[s.type] || []).push(q);
    });
  });
  const textModel = env.FILES_MODEL || TEXT_MODEL_DEFAULT;

  const images = arr(body.images).slice(0, MAX_IMAGES).filter((im) => im && /^image\/(png|jpe?g|webp)$/.test(String(im.mime || "")) && im.data);
  if (images.length) {
    const model = await pickVision(env, key);
    const content = [{ type: "text", text: INSTRUCTION(hint, null) }].concat(images.map((im) => ({ type: "image_url", image_url: { url: "data:" + im.mime + ";base64," + im.data } })));
    add(await chat(env, key, { model, temperature: 0.1, max_completion_tokens: 6000, messages: [{ role: "user", content }] }, false, 90000));
    chunksDone = 1;
  } else {
    let text = String(body.text || "");
    const f = body.file;
    if (!text && f) {
      const data = String(f.data || "");
      if (!data) throw fail("bad_file");
      if (data.length > MAX_FILE_B64) throw fail("too_big");
      const name = String(f.name || ""), ext = ((name.match(/\.([a-z0-9]+)$/i) || [])[1] || "").toLowerCase();
      if (ext === "docx") text = await docxText(b64bytes(data));
      else if (ext === "doc") throw fail("unsupported");
      else if (/^(txt|md|csv)$/.test(ext) || /^text\//.test(String(f.mime || ""))) text = new TextDecoder().decode(b64bytes(data));
      else throw fail("unsupported");
    }
    text = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
    if (text.length < 20) throw fail("empty");
    const chunks = chunkText(text);
    if (chunks.length > MAX_CHUNKS) throw fail("too_big");
    for (let i = 0; i < chunks.length; i++) {
      const msgs = [{ role: "system", content: INSTRUCTION(hint, { i: i + 1, of: chunks.length }) }, { role: "user", content: chunks[i] }];
      const payload = { model: textModel, temperature: 0.1, max_completion_tokens: 6000, messages: msgs };
      if (/gpt-oss/i.test(textModel)) payload.reasoning_effort = "low";
      add(await chat(env, key, payload, true, 60000));
      chunksDone++;
    }
  }
  const sections = KNOWN_TYPES.filter((t) => merged[t] && merged[t].length).map((t) => ({ type: t, asked: merged[t].length, questions: merged[t] }));
  if (!sections.length) throw fail("empty");
  return { ok: true, sections, parts: chunksDone };
}
