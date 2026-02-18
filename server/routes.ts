import type { Express } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/generate-notes", async (req, res) => {
    try {
      const { topic, subject } = req.body;

      if (!topic || !topic.trim()) {
        return res.status(400).json({ error: "Topic is required" });
      }

      if (!subject) {
        return res.status(400).json({ error: "Subject is required" });
      }

      const systemPrompt = `You are an expert study notes generator for students. You create clear, structured, and comprehensive study notes.

Your notes should follow this exact format:

# [Topic Title]

## Overview
A brief, simple explanation of the topic in 2-3 sentences using student-friendly language.

## Key Concepts
- Concept 1: Clear explanation
- Concept 2: Clear explanation
- Concept 3: Clear explanation
(add as many as needed)

## Important Formulas
List all relevant formulas with explanations. Use plain text for formulas.
- Formula name: formula expression
  - Where each variable is explained
(skip this section if no formulas apply)

## Step-by-Step Examples
### Example 1: [Title]
Walk through a solved example step by step.

### Example 2: [Title]
Another solved example if relevant.

## Quick Summary
- Bullet point summary of the most important takeaways
- Keep each point concise and memorable

## Study Tips
- Practical tips for remembering this topic
- Common mistakes to avoid

Rules:
- Use simple, student-friendly language
- Be thorough but concise
- Include real formulas where applicable
- Make examples practical and easy to follow
- Use bullet points extensively for readability
- The subject context is: ${subject}`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate detailed study notes about: ${topic}` },
        ],
        stream: true,
        max_completion_tokens: 8192,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error generating notes:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to generate notes" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to generate notes" });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
