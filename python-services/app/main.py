"""FastAPI entry point for intent classification and sentiment analysis."""

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, HTTPException

from app.models.runtime_intent import RuntimeIntentMLP
from app.schemas import TextInput
from app.sentiment import analyze_sentiment

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

intent_model: RuntimeIntentMLP | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global intent_model
    intent_model = RuntimeIntentMLP()
    logger.info("Trained the runtime intent MLP on its bundled examples.")
    yield
    intent_model = None


app = FastAPI(
    title="Blinkit Support NLP Service",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "models_loaded": {
            "intent_mlp": intent_model is not None,
            "sentiment_lexicon": True,
        },
        "device": "cpu",
        "version": app.version,
    }


@app.post("/intent")
def classify_intent(payload: TextInput) -> dict[str, object]:
    if intent_model is None:
        raise HTTPException(status_code=503, detail="Intent model is still starting.")
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text must not be blank.")
    return intent_model.predict(text)


@app.post("/sentiment")
def classify_sentiment(payload: TextInput) -> dict[str, object]:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text must not be blank.")
    return analyze_sentiment(text)
