"""Small NumPy MLP used by the online intent endpoint.

The larger educational classifier in intent_mlp.py uses downloaded sentence
encoders and PyTorch. This runtime model keeps the API fast and self-contained:
it learns a tiny bag-of-words MLP from curated examples at startup.
"""

from __future__ import annotations

import re

import numpy as np


INTENT_EXAMPLES: dict[str, tuple[str, ...]] = {
    "order_status": (
        "Where is my order?",
        "Track my order please",
        "My order has not arrived",
        "What is the status of my delivery?",
        "When will my groceries arrive?",
    ),
    "refund_request": (
        "I want a refund",
        "Please give me a refund for my order",
        "I need a refund for my order",
        "Please refund my order",
        "Please return my money",
        "How do I get reimbursed?",
        "The refund has not arrived",
        "I need my money back",
    ),
    "payment_issue": (
        "I was charged twice",
        "My UPI payment failed",
        "There is a problem with my payment",
        "The coupon code does not work",
        "I paid but my order was not placed",
    ),
    "delivery_problem": (
        "My delivery is late",
        "The delivery person went to the wrong address",
        "My rider cannot find my location",
        "The order was delivered to the wrong place",
        "I have a problem with delivery",
    ),
    "damage_complaint": (
        "The item arrived damaged",
        "My groceries are spoiled",
        "The package is broken",
        "I received an expired product",
        "The milk is leaking",
    ),
    "general_inquiry": (
        "How can I contact support?",
        "What are your delivery hours?",
        "I need help with my account",
        "Tell me about the service",
        "I have a question",
    ),
}

TOKEN_RE = re.compile(r"[a-z0-9']+")
STOP_WORDS = {"a", "an", "the", "is", "are", "to", "my", "i", "it", "of", "with"}
VOCABULARY = sorted(
    {
        token
        for examples in INTENT_EXAMPLES.values()
        for text in examples
        for token in TOKEN_RE.findall(text.lower())
        if token not in STOP_WORDS
    }
)
LABELS = list(INTENT_EXAMPLES)


def _features(text: str) -> np.ndarray:
    tokens = TOKEN_RE.findall(text.lower())
    token_set = set(tokens)
    return np.asarray([float(word in token_set) for word in VOCABULARY], dtype=np.float64)


class RuntimeIntentMLP:
    """A small one-hidden-layer classifier trained with backpropagation."""

    def __init__(self) -> None:
        examples: list[str] = []
        labels: list[int] = []
        for label_index, label in enumerate(LABELS):
            for text in INTENT_EXAMPLES[label]:
                examples.append(text)
                labels.append(label_index)

        inputs = np.stack([_features(text) for text in examples])
        targets = np.eye(len(LABELS), dtype=np.float64)[labels]
        rng = np.random.default_rng(17)
        hidden_size = 24
        self.weights1 = rng.normal(0, 0.15, (inputs.shape[1], hidden_size))
        self.bias1 = np.zeros(hidden_size, dtype=np.float64)
        self.weights2 = rng.normal(0, 0.15, (hidden_size, len(LABELS)))
        self.bias2 = np.zeros(len(LABELS), dtype=np.float64)

        for _ in range(500):
            hidden_pre = inputs @ self.weights1 + self.bias1
            hidden = np.maximum(hidden_pre, 0)
            logits = hidden @ self.weights2 + self.bias2
            probabilities = self._softmax(logits)
            output_gradient = (probabilities - targets) / len(inputs)
            hidden_gradient = (output_gradient @ self.weights2.T) * (hidden_pre > 0)

            learning_rate = 0.2
            self.weights2 -= learning_rate * (hidden.T @ output_gradient)
            self.bias2 -= learning_rate * output_gradient.sum(axis=0)
            self.weights1 -= learning_rate * (inputs.T @ hidden_gradient)
            self.bias1 -= learning_rate * hidden_gradient.sum(axis=0)

    @staticmethod
    def _softmax(logits: np.ndarray) -> np.ndarray:
        shifted = logits - np.max(logits, axis=-1, keepdims=True)
        exponentials = np.exp(shifted)
        return exponentials / exponentials.sum(axis=-1, keepdims=True)

    def predict(self, text: str) -> dict[str, object]:
        features = _features(text)
        if not features.any():
            probabilities = np.full(len(LABELS), 0.1)
            probabilities[LABELS.index("general_inquiry")] = 0.5
        else:
            hidden = np.maximum(features @ self.weights1 + self.bias1, 0)
            probabilities = self._softmax(hidden @ self.weights2 + self.bias2)

        ranked = sorted(
            zip(LABELS, probabilities.tolist()),
            key=lambda item: item[1],
            reverse=True,
        )
        return {
            "label": ranked[0][0],
            "confidence": float(ranked[0][1]),
            "all_intents": [
                {"label": label, "confidence": float(score)}
                for label, score in ranked
            ],
        }
