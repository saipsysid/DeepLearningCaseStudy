"""
schemas.py — All Pydantic models for the Blinkit Support Agent ML service.

Each model corresponds to an API endpoint's request or response body.
Pydantic v2 is used for fast validation and serialization.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class TextInput(BaseModel):
    """Generic text input used by sentiment, intent, summarize, embedding, priority."""
    text: str = Field(..., min_length=1, max_length=8192, description="Customer message or conversation text")


class ImageAnalysisInput(BaseModel):
    """Base64-encoded image for damage detection (alternative to multipart upload)."""
    image_base64: str = Field(..., description="Base64-encoded image bytes")
    filename: str = Field(default="upload.jpg", description="Original filename (used to infer MIME type)")


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class SentimentOutput(BaseModel):
    """Sentiment analysis result with granular emotion scores."""
    label: str = Field(..., description="POSITIVE, NEGATIVE, or NEUTRAL")
    score: float = Field(..., ge=0.0, le=1.0, description="Confidence score for the predicted label")
    emotions: dict = Field(
        ...,
        description="Estimated emotion intensities: joy, anger, frustration, satisfaction (0-1 each)"
    )


class IntentOutput(BaseModel):
    """Intent classification result from the MLP classifier."""
    intent: str = Field(..., description="Predicted intent class")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Softmax probability of predicted intent")
    all_probs: dict = Field(..., description="Probability for every intent class")


class SummaryOutput(BaseModel):
    """Conversation summarization result."""
    summary: str = Field(..., description="Concise summary of the conversation")
    compression_ratio: float = Field(..., ge=0.0, le=1.0, description="Ratio: summary_tokens / input_tokens")


class EmbeddingOutput(BaseModel):
    """Dense vector embedding for semantic search / RAG retrieval."""
    embedding: list[float] = Field(..., description="Dense embedding vector")
    model: str = Field(..., description="Name of the embedding model used")


class ImageAnalysisOutput(BaseModel):
    """CNN-based damage detection result."""
    is_damaged: bool = Field(..., description="True if damage is detected")
    damage_type: str = Field(..., description="Type of damage: intact, bruised, broken, leaking, mold")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence")
    recommendation: str = Field(..., description="Suggested resolution action")


class PriorityOutput(BaseModel):
    """Ticket priority predicted by the BiLSTM classifier."""
    priority: str = Field(..., description="low, medium, or high")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Softmax confidence")
    reasoning: str = Field(..., description="Human-readable explanation for the assigned priority")


# ---------------------------------------------------------------------------
# Health check response
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    """Service health-check response."""
    status: str
    models_loaded: dict
    device: str
    version: str = "1.0.0"
