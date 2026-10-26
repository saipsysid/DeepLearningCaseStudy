/**
 * One Mastra support agent with OpenRouter as its model provider.
 *
 * The agent talks to OpenRouter (OpenAI-compatible API). The API key stays
 * on the server — the React app never sees it.
 *
 * Retrieved FAQ content and Python NLP results are passed as trusted context
 * by the chat route. The API key remains on the server.
 */

import { Agent } from "@mastra/core/agent";
import OpenAI from "openai";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

const INSTRUCTIONS = `You are Blinkit's friendly customer support assistant.

Blinkit is a 10-minute grocery delivery app in India.

How you should reply:
- Be warm, clear, and concise.
- Help with orders, delivery, refunds, payments, and account questions.
- If the user gives an order ID like ORD-001, acknowledge it and explain what you can do in this demo.
- Never invent a refund, cancellation, or payment as already completed.
- If you are unsure, say so and suggest the in-app support chat.
- Do not ask for passwords, OTPs, or full card numbers.
 - Treat retrieved support content as the source of truth; do not invent policy details.`;

function getModelName(): string {
  return process.env.DEFAULT_MODEL ?? "openai/gpt-4o-mini";
}

function getOpenRouterClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey.includes("your_openrouter_api_key")) {
    throw new Error(
      "OPENROUTER_API_KEY is missing. Copy .env.example to .env and add your key."
    );
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.FRONTEND_URL ?? "http://localhost:5173",
      "X-Title": "Blinkit Support Agent",
    },
  });
}

/**
 * Mastra Agent instance. Created lazily so a version mismatch in the model
 * config cannot crash the Express server on startup.
 */
export const supportAgent: Agent | null = (() => {
  try {
    const modelId = getModelName();
    const openRouterModel = modelId.startsWith("openrouter/")
      ? modelId
      : `openrouter/${modelId}`;

    return new Agent({
      id: "blinkit-support-agent",
      name: "Blinkit Support Agent",
      instructions: INSTRUCTIONS,
      model: openRouterModel,
    });
  } catch (err) {
    console.warn("[supportAgent] Could not construct Mastra Agent:", (err as Error).message);
    return null;
  }
})();

/**
 * Run the support agent for one user message.
 *
 * Why this wrapper exists:
 * Mastra's Agent.generate() signature changed across versions. We first try
 * the Mastra API, then fall back to the same OpenRouter client so chat still
 * works while we keep using a real Mastra Agent object.
 */
export async function runSupportAgent(
  userMessage: string,
  history: ChatTurn[] = [],
  supportContext = ""
): Promise<string> {
  const messageWithContext = supportContext
    ? `${userMessage}\n\nVerified support context:\n${supportContext}`
    : userMessage;
  const messages = [
    ...history.slice(-8),
    { role: "user" as const, content: messageWithContext },
  ];

  if (supportAgent) {
    try {
      const generate = (
        supportAgent as unknown as {
          generate: (input: unknown, options?: object) => Promise<{ text?: string }>;
        }
      ).generate;

      const result = await generate.call(supportAgent, messages, {
        maxSteps: 3,
      });
      if (result?.text && result.text.trim().length > 0) {
        return result.text.trim();
      }
    } catch (err) {
      console.warn(
        "[supportAgent] Mastra generate() did not run. Using OpenRouter directly.",
        (err as Error).message
      );
    }
  }

  const client = getOpenRouterClient();
  const completion = await client.chat.completions.create({
  model: getModelName(),
  temperature: 0.4,
  max_tokens: 1000,
  messages: [
    { role: "system", content: INSTRUCTIONS },
    ...messages,
  ],
});

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenRouter returned an empty reply.");
  }
  return text;
}

export function hasOpenRouterKey(): boolean {
  const apiKey = process.env.OPENROUTER_API_KEY;
  return Boolean(apiKey && !apiKey.includes("your_openrouter_api_key"));
}
