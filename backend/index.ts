import 'dotenv/config';
import express from 'express';
import { tavily } from '@tavily/core';
import Groq from 'groq-sdk';
import { PROMPT_TEMPLATE, SYSTEM_PROMPT } from './prompt';
import cors from 'cors';
import { prisma } from './db'
import { middleware } from './middleware';

const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const app = express();
app.use(express.json());
app.use(cors());


// Helper: generate a URL-friendly slug from a query string
function generateSlug(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 80);
}


// ─── 1. GET /conversations ─────────────────────────────────────────────────────
// Returns all conversations for the authenticated user, ordered by most recent first.
app.get('/conversations', middleware, async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        userId: req.userId!,
      },
      orderBy: {
        id: 'desc',
      },
      select: {
        id: true,
        title: true,
        slug: true,
        message: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            content: true,
            createdAt: true,
          },
        },
      },
    });

    res.json({ conversations });
  } catch (err) {
    console.error("❌ Error fetching conversations:", err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});


// ─── 2. GET /conversations/:conversationId ──────────────────────────────────────
// Returns a single conversation with all its messages, only if it belongs to the user.
app.get('/conversations/:conversationId', middleware, async (req, res) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: req.params.conversationId as string,
        userId: req.userId!,
      },
      include: {
        message: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.json({ conversation });
  } catch (err) {
    console.error("❌ Error fetching conversation:", err);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});


// ─── 3. POST /purplexity_ask ────────────────────────────────────────────────────
// Creates a NEW conversation, performs web search, streams LLM answer, and persists everything to DB.
app.post("/purplexity_ask", middleware, async (req, res) => {
  console.log("📥 Request received:", req.body);
  const query = req.body.query;

  if (!query) {
    console.log("❌ No query provided");
    res.status(400).json({ error: "Query is required" });
    return;
  }

  try {
    // Create the conversation in the database
    const conversation = await prisma.conversation.create({
      data: {
        title: query.substring(0, 200),
        slug: generateSlug(query),
        userId: req.userId!,
      },
    });

    // Save the user's message
    await prisma.message.create({
      data: {
        content: query,
        role: "User",
        conversationId: conversation.id,
      },
    });

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
    res.header('X-Conversation-Id', conversation.id);
    console.log("📡 Streaming started...");

    let fullResponse = '';
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        fullResponse += text;
        res.write(text);
      }
    }

    // Save the assistant's full response to DB
    await prisma.message.create({
      data: {
        content: fullResponse,
        role: "Assistant",
        conversationId: conversation.id,
      },
    });

    res.write("\n-----------SOURCES-----------\n");
    webSearchResponse.results.forEach((result) => {
      res.write(JSON.stringify({ title: result.title, url: result.url }) + "\n");
    });

    res.write("\n-----------CONVERSATION_ID-----------\n");
    res.write(conversation.id);

    res.end();
    console.log("✅ Stream complete, conversation saved:", conversation.id);

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


// ─── 4. POST /purplextiy_ask/follow_up ──────────────────────────────────────────
// Follow-up question within an existing conversation. Loads past messages for context.
app.post("/purplextiy_ask/follow_up", middleware, async (req, res) => {
  console.log("📥 Follow-up request received:", req.body);
  const { query, conversationId } = req.body;

  if (!query) {
    res.status(400).json({ error: "Query is required" });
    return;
  }

  if (!conversationId) {
    res.status(400).json({ error: "conversationId is required for follow-up" });
    return;
  }

  try {
    // Verify the conversation exists and belongs to this user
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: req.userId!,
      },
      include: {
        message: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // Save the user's follow-up message
    await prisma.message.create({
      data: {
        content: query,
        role: "User",
        conversationId: conversation.id,
      },
    });

    // Perform a fresh web search for the follow-up query
    console.log("🔍 Starting web search for follow-up...");
    const webSearchResponse = await tavilyClient.search(query, {
      searchDepth: "advanced"
    });
    console.log("✅ Web search done, results:", webSearchResponse.results.length);

    const prompt = PROMPT_TEMPLATE
      .replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(webSearchResponse.results))
      .replace("{{USER_QUERY}}", query);

    // Build the messages array with conversation history for context
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add past conversation messages for context
    for (const msg of conversation.message) {
      messages.push({
        role: msg.role === "User" ? "user" : "assistant",
        content: msg.content,
      });
    }

    // Add the current follow-up with fresh search results
    messages.push({ role: "user", content: prompt });

    console.log("🤖 Calling Groq with conversation history...");
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      stream: true,
    });

    res.header('Cache-Control', 'no-cache');
    res.header('Content-Type', 'text/event-stream');
    res.header('X-Conversation-Id', conversation.id);
    console.log("📡 Streaming started...");

    let fullResponse = '';
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        fullResponse += text;
        res.write(text);
      }
    }

    // Save the assistant's response to DB
    await prisma.message.create({
      data: {
        content: fullResponse,
        role: "Assistant",
        conversationId: conversation.id,
      },
    });

    res.write("\n-----------SOURCES-----------\n");
    webSearchResponse.results.forEach((result) => {
      res.write(JSON.stringify({ title: result.title, url: result.url }) + "\n");
    });

    res.end();
    console.log("✅ Follow-up stream complete");

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


app.listen(3001, () => {
  console.log('Server is running on port 3001');
});