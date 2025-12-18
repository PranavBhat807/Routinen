const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Gemini Suggestions (TEXT ONLY)
 */
async function getGeminiSuggestions({ user, date, tasks, schedule, analytics }) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: "application/json"
    },
    systemInstruction: `
You are a productivity coach.
You DO NOT modify schedules.
You ONLY give suggestions.
Return ONLY valid JSON.
`
  });

  const prompt = `
User preferences:
${JSON.stringify(user.preferences, null, 2)}

Date: ${date}

Tasks:
${JSON.stringify(tasks, null, 2)}

Schedule:
${JSON.stringify(schedule, null, 2)}

Analytics:
${JSON.stringify(analytics, null, 2)}

Give 3–5 actionable productivity or health suggestions.
Return JSON like:
[
  { "text": "...", "confidence": "high|medium|low" }
]
`;

  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (err) {
    console.error("⚠️ Gemini suggestions failed:", err.message);
    return [];
  }
}

/**
 * Gemini Scheduling (STRUCTURAL CHANGE)
 * ⚠️ This is ONLY used when user explicitly asks for AI mode
 */
async function getGeminiSchedule({ tasks, preferences, date }) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: "application/json"
    },
    systemInstruction: `
You are a smart task scheduler.

RULES YOU MUST FOLLOW:
1. Do NOT create or delete tasks
2. Respect wakeTime and sleepTime
3. High priority tasks first
4. No overlapping times
5. Output ONLY valid JSON
`
  });

  const prompt = `
Date: ${date}

Preferences:
${JSON.stringify(preferences, null, 2)}

Tasks:
${JSON.stringify(tasks, null, 2)}

Return a rescheduled plan in this EXACT format:
[
  {
    "taskId": number,
    "title": string,
    "start": "ISO_TIMESTAMP",
    "durationMinutes": number
  }
]
`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}

module.exports = {
  getGeminiSuggestions,
  getGeminiSchedule
};
