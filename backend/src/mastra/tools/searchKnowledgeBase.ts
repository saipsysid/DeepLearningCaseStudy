/**
 * Mastra Tool: searchKnowledgeBase
 * Searches the ChromaDB knowledge base for FAQ / policy content
 * relevant to the user's query.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchKnowledge } from "../../services/ragService";

export const searchKnowledgeBase = createTool({
  id: "searchKnowledgeBase",
  description:
    "Search the Blinkit customer support knowledge base (FAQs, policies, product info) for content relevant to the user's question.",
  inputSchema: z.object({
    query: z.string().describe("The user's question or topic to search for"),
    topK: z
      .number()
      .int()
      .min(1)
      .max(5)
      .default(3)
      .describe("Number of relevant articles to retrieve"),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        text: z.string(),
        category: z.string(),
        relevanceScore: z.number(),
      })
    ),
    found: z.boolean(),
  }),
  execute: async ({ context }) => {
    const { query, topK } = context;

    const rawResults = await searchKnowledge(query, topK);

    const results = rawResults
      .filter((r) => r.relevanceScore > 0.3) // only return reasonably relevant results
      .map((r) => ({
        id: r.id,
        title: r.metadata.title ?? "Support Article",
        text: r.text,
        category: r.metadata.category ?? "general",
        relevanceScore: r.relevanceScore,
      }));

    return {
      results,
      found: results.length > 0,
    };
  },
});
