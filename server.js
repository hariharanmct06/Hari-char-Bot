const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname)); // Serves index.html, static files, etc.

// Load the Mechatronics/Personal Knowledge Base dynamically on startup or requests
function getKnowledgeBase() {
  try {
    return fs.readFileSync(path.join(__dirname, 'personal_knowledge_base.md'), 'utf8');
  } catch (e) {
    console.error('Failed to read personal_knowledge_base.md:', e);
    return '';
  }
}

// Check if message query targets news context
function checkNewsQuery(message) {
  const t = message.toLowerCase();
  return t.includes('news') || t.includes('happening') || t.includes('latest info') || t.includes('current affairs') || t.includes('tamil nadu') || t.includes('india');
}

// Saurav.tech News API Retriever
let cachedNews = "";
let lastNewsFetchTime = 0;

async function fetchLatestNewsContext() {
  const now = Date.now();
  if (cachedNews && (now - lastNewsFetchTime < 300000)) {
    return cachedNews;
  }
  
  try {
    const res = await fetch('https://saurav.tech/NewsAPI/top-headlines/category/general/in.json');
    if (res.ok) {
      const data = await res.json();
      if (data.articles && data.articles.length > 0) {
        const tnKeywords = ['tamil', 'chennai', 'coimbatore', 'madurai', 'stalin', 'tn', 'south india'];
        const tnArticles = data.articles.filter(a => {
          const content = `${a.title} ${a.description || ''}`.toLowerCase();
          return tnKeywords.some(kw => content.includes(kw));
        });
        
        const selectedArticles = [...tnArticles];
        for (const art of data.articles) {
          if (selectedArticles.length >= 6) break;
          if (!selectedArticles.some(a => a.url === art.url)) {
            selectedArticles.push(art);
          }
        }
        
        const headlines = selectedArticles.map((art, idx) => {
          return `${idx + 1}. [${art.source.name}] ${art.title} - ${art.description || ''}`;
        }).join('\n');
        
        cachedNews = `LATEST INDIA & TAMIL NADU NEWS:\n${headlines}\n\n`;
        lastNewsFetchTime = now;
        return cachedNews;
      }
    }
  } catch (e) {
    console.error("Failed to fetch live news:", e);
  }
  return "";
}

// SSE Normalizer for Google Gemini API Stream
async function streamGeminiToClient(readableStream, clientResponse) {
  const decoder = new TextDecoder("utf-8");
  let buffer = '';

  for await (const chunk of readableStream) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine.startsWith('data: ')) {
        const dataStr = cleanLine.slice(6).trim();
        if (dataStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(dataStr);
          const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (content) {
            clientResponse.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch (e) {
          // Ignore partial chunk parsing errors
        }
      }
    }
  }
  clientResponse.write('data: [DONE]\n\n');
}

// SSE Normalizer for OpenRouter API Stream
async function streamOpenRouterToClient(readableStream, clientResponse) {
  const decoder = new TextDecoder("utf-8");
  let buffer = '';

  for await (const chunk of readableStream) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine.startsWith('data: ')) {
        const dataStr = cleanLine.slice(6).trim();
        if (dataStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(dataStr);
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) {
            clientResponse.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch (e) {
          // Ignore partial chunk parsing errors
        }
      }
    }
  }
  clientResponse.write('data: [DONE]\n\n');
}

// Secure Chat endpoint
app.post('/api/chat', async (req, res) => {
  const { message, chatHistory } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message content is required.' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const orKey = process.env.OPENROUTER_API_KEY;

  if (!geminiKey && !orKey) {
    console.warn("No keys configured on server. Client fallback triggered.");
    return res.status(503).json({ error: 'Server AI keys are not configured.' });
  }

  const HARI_KB = getKnowledgeBase();
  const isNewsQuery = checkNewsQuery(message);
  let newsContext = "";
  if (isNewsQuery) {
    newsContext = await fetchLatestNewsContext();
  }

  // Define dynamic prompt
  const systemPrompt = `You are HARI BOT — a witty, warm, and highly personalized AI assistant for Hariharan, a 17-year-old Mechatronics Engineering student at SNS College of Technology in Coimbatore. Keep all responses crisp, concise (1-3 sentences max), and engaging. Use emojis naturally.

IMPORTANT: Communicate exclusively in English or Tamil. Do not respond in Hindi or any other languages.

Answer queries about Hariharan using the Knowledge Base below. If the user asks something new, general, or unrelated to Hariharan, use your own intelligence (Gemini) to answer their question directly, clearly, and crisply! Do not refuse general questions or say "I don't know" if it's a general query (like math, science, programming, general facts, etc.).

If the user asks mechatronics, engineering, mathematics, or physics questions, guide them patiently through the concept. Explain clearly and tutor them step-by-step. In your answer, proudly mention that Mechatronics and Robotics is Hariharan's specialized field of study at SNS College of Technology!

KNOWLEDGE BASE:
${HARI_KB}

PERSONALITY RULES:
- Age question → explicitly answer that Hariharan is **17 years old**. Do not only reply with his DOB; state his age is 17!
- Healing questions (Reiki, Ama-Deus, Sujok) → explain with care and pride — this is Hariharan's special gift and his association with the Agasthiya Healing Centre!
- Tea vs Coffee → he loves BOTH, refuses to pick
- Vijay → big fan energy!
- Use **bold** for key terms and *italics* for emphasis
- Be fun and personal, not robotic`;

  const calendarContext = `\n\nCURRENT DATE & TIME:\nToday is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. The current time is ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}.`;
  const dynamicSystemPrompt = systemPrompt + calendarContext + (newsContext ? `\n\nUse the following live news context to answer queries about latest happenings in Tamil Nadu or India:\n${newsContext}` : "");

  let streamSuccess = false;

  // 1. Try native Google Gemini models
  if (geminiKey) {
    const geminiModels = [
      'gemini-3.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash'
    ];

    for (const model of geminiModels) {
      try {
        const contentsArray = chatHistory.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));
        contentsArray.push({
          role: 'user',
          parts: [{ text: message }]
        });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${geminiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: contentsArray,
            systemInstruction: {
              parts: [{ text: dynamicSystemPrompt }]
            }
          })
        });

        if (response.ok && response.body) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          await streamGeminiToClient(response.body, res);
          streamSuccess = true;
          break;
        } else {
          const errText = await response.text();
          console.warn(`Gemini model ${model} failed with status ${response.status}: ${errText}`);
        }
      } catch (err) {
        console.error(`Gemini model ${model} request error:`, err);
      }
    }
  }

  // 2. Try OpenRouter fallback models
  if (!streamSuccess && orKey) {
    const openRouterModels = [
      'google/gemini-2.5-flash',
      'google/gemini-2.5-flash-lite',
      'google/gemini-2.0-flash-lite',
      'google/gemini-2.0-flash'
    ];

    for (const model of openRouterModels) {
      try {
        const messages = [
          { role: 'system', content: dynamicSystemPrompt },
          ...chatHistory,
          { role: 'user', content: message }
        ];

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${orKey}`,
            'HTTP-Referer': 'https://hariharanmct06.github.io',
            'X-Title': 'HARI BOT'
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 800,
            messages,
            stream: true
          })
        });

        if (response.ok && response.body) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          await streamOpenRouterToClient(response.body, res);
          streamSuccess = true;
          break;
        } else {
          const errText = await response.text();
          console.warn(`OpenRouter model ${model} failed with status ${response.status}: ${errText}`);
        }
      } catch (err) {
        console.error(`OpenRouter model ${model} request error:`, err);
      }
    }
  }

  if (!streamSuccess) {
    return res.status(502).json({ error: 'All upstream AI services failed.' });
  }

  res.end();
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` HARI BOT Server successfully initialized.`);
  console.log(` Running securely on: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
