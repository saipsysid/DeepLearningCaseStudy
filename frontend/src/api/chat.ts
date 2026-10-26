/**
 * Talks to the Express backend through Vite's /api proxy.
 * The OpenRouter key never leaves the server.
 */

import axios from "axios";
import { API_ENDPOINTS } from "../utils/constants";
import type { ChatMessage } from "../types/chat";

const client = axios.create({
  timeout: 45000,
});

export type ChatResponse = {
  success: boolean;
  sessionId: string;
  reply: string;
  agent?: string;
};

export type HealthResponse = {
  success: boolean;
  status: string;
  openRouterConfigured: boolean;
  pythonServiceAvailable?: boolean;
  chromaAvailable?: boolean;
  sqliteAvailable?: boolean;
};

export type ChatHistoryResponse = {
  success: boolean;
  sessionId: string;
  messages: ChatMessage[];
};

export async function checkBackendHealth(): Promise<HealthResponse> {
  const { data } = await client.get<HealthResponse>("/api/health");
  return data;
}

export async function getChatHistory(sessionId: string): Promise<ChatMessage[]> {
  const { data } = await client.get<ChatHistoryResponse>(
    `/api/chat/${encodeURIComponent(sessionId)}/history`
  );
  return data.messages;
}

export async function sendChatMessage(
  message: string,
  sessionId: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  const { data } = await client.post<ChatResponse>(API_ENDPOINTS.CHAT, {
    message,
    sessionId,
    history: history.map((item) => ({
      role: item.role,
      content: item.content,
    })),
  });
  return data;
}
