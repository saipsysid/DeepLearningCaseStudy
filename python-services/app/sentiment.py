"""Lightweight lexicon-based sentiment analysis for customer messages."""

import re

POSITIVE_WORDS = {
    "amazing", "awesome", "best", "brilliant", "excellent", "fast", "good",
    "great", "happy", "helpful", "love", "perfect", "quick", "thanks",
    "thank", "wonderful",
}
NEGATIVE_WORDS = {
    "angry", "bad", "broken", "charged", "crushed", "damaged", "delay",
    "disappointed", "failed", "frustrated", "late", "missing", "problem",
    "refund", "rude", "spoiled", "terrible", "wrong", "worst",
}
NEGATIONS = {"not", "never", "no", "don't", "didn't", "isn't", "wasn't", "can't"}
TOKEN_RE = re.compile(r"[a-z']+")


def analyze_sentiment(text: str) -> dict[str, object]:
    tokens = TOKEN_RE.findall(text.lower())
    positive = 0
    negative = 0

    for index, token in enumerate(tokens):
        negated = any(previous in NEGATIONS for previous in tokens[max(0, index - 3):index])
        if token in POSITIVE_WORDS:
            negative += int(negated)
            positive += int(not negated)
        elif token in NEGATIVE_WORDS:
            positive += int(negated)
            negative += int(not negated)

    if positive == negative:
        return {"label": "neutral", "score": 0.5}

    label = "positive" if positive > negative else "negative"
    score = min(0.99, 0.5 + abs(positive - negative) / (2 * max(positive, negative, 1)))
    return {"label": label, "score": score}
