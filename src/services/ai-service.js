const OpenAI = require("openai");
const env = require("../config/env");

let client = null;

function getOpenAIClient() {
  if (!env.openaiApiKey) {
    return null;
  }

  if (!client) {
    client = new OpenAI({ apiKey: env.openaiApiKey });
  }

  return client;
}

function stripCodeFences(value) {
  return String(value || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function buildModeInstruction(mode) {
  switch (mode) {
    case "fix_text":
      return "Correct grammar, spelling, flow, and clarity while preserving the user's meaning and core offer.";
    case "professional":
      return "Rewrite the message to sound more professional, polished, and trustworthy while staying warm and customer-friendly.";
    case "html_email":
      return "Create a polished email-safe HTML version with inline CSS, clear spacing, and a strong structure suitable for broad email client compatibility.";
    default:
      return "Improve the email while keeping it accurate, clear, and suitable for customers.";
  }
}

async function generateEmailDraft({ mode, userText, subject, senderDomain, language = "sv" }) {
  const openai = getOpenAIClient();

  if (!openai) {
    const error = new Error("OPENAI_API_KEY is not configured. Add it to your environment before using the AI email generator.");
    error.code = "missing_openai_key";
    throw error;
  }

  const safeMode = ["fix_text", "professional", "html_email"].includes(mode) ? mode : "professional";
  const inputSubject = String(subject || "").trim();
  const inputText = String(userText || "").trim();
  const domain = String(senderDomain || "").trim();
  const lang = String(language || "sv").trim().toLowerCase() || "sv";

  const systemPrompt = [
    "You are an expert email copywriter for customer-facing campaigns.",
    `Write in ${lang === "sv" ? "Swedish" : lang}.`,
    "Keep the tone professional, helpful, and friendly.",
    "Do not invent false technical claims, guarantees, or unsupported facts.",
    "Use {{name}} naturally when personalization fits.",
    "Always include {{unsubscribe_url}} in a short footer.",
    "For htmlBody, produce email-safe HTML with inline CSS only.",
    "Do not use external images, external fonts, scripts, forms, or unsupported interactive elements.",
    "Return only valid JSON with keys: subject, textBody, htmlBody.",
  ].join(" ");

  const userPrompt = [
    `Mode: ${safeMode}.`,
    buildModeInstruction(safeMode),
    `Sender domain: ${domain || "not provided"}.`,
    `Existing subject: ${inputSubject || "none provided"}.`,
    "User draft text follows.",
    inputText || "No message body provided.",
  ].join("\n");

  const response = await openai.responses.create({
    model: env.openaiModel,
    input: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const text = stripCodeFences(response.output_text || "");
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const parseError = new Error("AI response could not be parsed into a valid email draft.");
    parseError.code = "invalid_ai_response";
    throw parseError;
  }

  return {
    subject: String(parsed.subject || inputSubject || "").trim(),
    textBody: String(parsed.textBody || inputText || "").trim(),
    htmlBody: String(parsed.htmlBody || "").trim(),
  };
}

module.exports = {
  generateEmailDraft,
};
