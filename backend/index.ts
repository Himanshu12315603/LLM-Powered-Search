import 'dotenv/config';
import express from 'express';
import { tavily } from '@tavily/core';
import Groq from 'groq-sdk';
import { PROMPT_TEMPLATE, SYSTEM_PROMPT } from './prompt';
import { prisma } from './db'

const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const app = express();
app.use(express.json());


// Test DB connection and create a user
// const res = await prisma.user.create({
//   data: {
//     email: "ram@gmail.com",
//     provider: "Google",
//     name: "Himanshu",
//   }
// })
// console.log("User created:", res);

// Sign Up
app.post('/signup', async(req, res) => {

});
// Sign In
app.post('/signin', async(req, res) => {

});
//Past converstaion get 
app.get('/conversations', async(req, res) => {

});
//Past conversations get 
app.get('/conversations/:conversationId', async(req, res) => {

});


app.post("/purplexity_ask", async (req, res) => {
  console.log("📥 Request received:", req.body);
  const query = req.body.query;

  if (!query) {
    console.log("❌ No query provided");
    res.status(400).json({ error: "Query is required" });
    return;
  }

  try {
    console.log("🔍 Starting web search...");
    const webSearchResponse = await tavilyClient.search(query, {
      searchDepth: "advanced"
    });
    console.log("✅ Web search done, results:", webSearchResponse.results.length);

    const prompt = PROMPT_TEMPLATE
      .replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(webSearchResponse.results))
      .replace("{{USER_QUERY}}", query);

    console.log("🤖 Calling Groq...");
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      stream: true,
    });

    res.header('Cache-Control', 'no-cache');
    res.header('Content-Type', 'text/event-stream');
    console.log("📡 Streaming started...");

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) res.write(text);
    }

    res.write("\n-----------SOURCES-----------\n");
    webSearchResponse.results.forEach((result) => {
      res.write(JSON.stringify({ title: result.title, url: result.url }) + "\n");
    });

    res.end();
    console.log("✅ Stream complete");

  } catch (err) {
    console.error("❌ ERROR:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: String(err) });
    } else {
      res.write("\n[ERROR]: " + String(err));
      res.end();
    }
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});