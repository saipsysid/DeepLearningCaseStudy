/**
 * Rate-limiting middleware using express-rate-limit.
 * Default: 100 requests per 15 minutes per IP.
 * A stricter limiter is exported for the /api/chat endpoint.
 */

import rateLimit from "express-rate-limit";

/** General API rate limiter — 100 req / 15 min */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: "Too many requests from this IP. Please try again after 15 minutes.",
      code: 429,
    },
  },
  // Use IP + optional forwarded header for proxy setups
  keyGenerator: (req) =>
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() ??
    req.ip ??
    "unknown",
});

/** Stricter limiter for chat endpoint — 30 messages / 1 min */
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: "Chat rate limit exceeded. Please wait a moment before sending another message.",
      code: 429,
    },
  },
});
