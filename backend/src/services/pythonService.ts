/**
 * HTTP client for the Python FastAPI NLP service.
 * Provides typed wrappers for all NLP endpoints:
 *   /sentiment, /intent, /summarize, /embedding, /image/analyze
 *
 * Python-service errors are surfaced to the chat route; a fake classification
 * would otherwise be stored as if it came from the model.
 */

import axios, { AxiosInstance } from "axios";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SentimentResult {
  label: "positive" | "neutral" | "negative";
  score: number; // 0.0 – 1.0
}

export interface IntentResult {
  label: string;   // e.g. "order_status", "refund_request"
  confidence: number;
  all_intents: { label: string; confidence: number }[];
}

export interface SummaryResult {
  summary: string;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

export interface DamageAnalysisResult {
  damaged: boolean;
  confidence: number;
  description: string;
  severity: "none" | "minor" | "moderate" | "severe";
}

// ── Client ───────────────────────────────────────────────────────────────────

const PYTHON_BASE_URL =
  process.env.PYTHON_SERVICE_URL ?? "http://127.0.0.1:8001";

const TIMEOUT_MS = parseInt(process.env.PYTHON_SERVICE_TIMEOUT ?? "8000", 10);

let client: AxiosInstance;

function getClient(): AxiosInstance {
  if (!client) {
    client = axios.create({
      baseURL: PYTHON_BASE_URL,
      timeout: TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
    });
  }
  return client;
}

function serviceUnavailable(operation: string, error: unknown): Error & { statusCode: number } {
  const detail = error instanceof Error ? error.message : "Unknown request error";
  console.error(`[PythonService] ${operation} failed: ${detail}`);
  return Object.assign(
    new Error(`Python NLP service is unavailable while running ${operation}.`),
    { statusCode: 503 }
  );
}

// ── Service Functions ────────────────────────────────────────────────────────

/**
 * Classify sentiment of the provided text.
 */
export async function getSentiment(text: string): Promise<SentimentResult> {
  try {
    const res = await getClient().post<SentimentResult>("/sentiment", { text });
    return res.data;
  } catch (err) {
    throw serviceUnavailable("sentiment analysis", err);
  }
}

/**
 * Classify the intent of a user message.
 */
export async function getIntent(text: string): Promise<IntentResult> {
  try {
    const res = await getClient().post<IntentResult>("/intent", { text });
    return res.data;
  } catch (err) {
    throw serviceUnavailable("intent classification", err);
  }
}

/**
 * Summarize a long piece of text (e.g., conversation transcript).
 */
export async function getSummary(text: string): Promise<SummaryResult> {
  try {
    const res = await getClient().post<SummaryResult>("/summarize", { text });
    return res.data;
  } catch (err) {
    console.warn("[PythonService] getSummary fallback:", (err as Error).message);
    return { summary: text.slice(0, 200) };
  }
}

/**
 * Get a vector embedding for a text string.
 * Used for RAG semantic search when ChromaDB is not embedding locally.
 */
export async function getEmbedding(text: string): Promise<EmbeddingResult> {
  const res = await getClient().post<EmbeddingResult>("/embedding", { text });
  return res.data;
}

/**
 * Analyze a base64-encoded image for delivery damage.
 * Falls back to undamaged/low confidence if service is unavailable.
 */
export async function analyzeDamageImage(
  base64Image: string,
  mimeType = "image/jpeg"
): Promise<DamageAnalysisResult> {
  try {
    const res = await getClient().post<DamageAnalysisResult>("/image/analyze", {
      image: base64Image,
      mime_type: mimeType,
    });
    return res.data;
  } catch (err) {
    console.warn(
      "[PythonService] analyzeDamageImage fallback:",
      (err as Error).message
    );
    return {
      damaged: false,
      confidence: 0.0,
      description: "Image analysis service unavailable.",
      severity: "none",
    };
  }
}

/**
 * Health check — returns true if the Python service is reachable.
 */
export async function checkPythonServiceHealth(): Promise<boolean> {
  try {
    await getClient().get("/health", { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}
