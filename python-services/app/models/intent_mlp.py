"""
intent_mlp.py — Unit I: MLP Intent Classifier
===============================================

This module implements several concepts from Unit I:

  1. MCPNeuron — the original McCulloch-Pitts (1943) model: threshold-based
     binary decision unit, inspired by biological neurons.

  2. Perceptron — Rosenblatt (1958): single-layer trainable binary classifier
     with a simple Hebbian-style update rule.

  3. IntentMLP — modern multilayer perceptron using PyTorch, trained with
     backpropagation and Adam optimizer.

Biological inspiration:
  Biological neuron:          Dendrites collect signals → soma integrates →
                              axon fires if threshold exceeded
  Artificial (MCP) neuron:   Weighted inputs → sum → threshold → 0 or 1
  Perceptron:                 Same, but weights are learnable via error signal
  MLP:                        Multiple layers of perceptrons → universal approximator

Architecture of IntentMLP:
  Input:    384-dim BGE embedding
  Hidden 1: 256 units | ReLU | BatchNorm1d | Dropout(0.3)
  Hidden 2: 128 units | ReLU | BatchNorm1d | Dropout(0.3)
  Hidden 3:  64 units | ReLU
  Output:     6 units (intent classes) | Softmax

  ReLU is preferred over sigmoid/tanh in hidden layers because:
    • No vanishing gradient for positive inputs
    • Computationally simple: max(0, x)
    • Promotes sparse activations (many zeros) → efficient representations
"""

import os
import logging
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from typing import Optional

logger = logging.getLogger(__name__)

# Path where trained weights are saved
SAVED_MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "models", "saved", "intent_mlp.pt"
)
SAVED_MODEL_PATH = os.path.normpath(SAVED_MODEL_PATH)

# ---------------------------------------------------------------------------
# Intent label set
# ---------------------------------------------------------------------------

INTENT_LABELS = [
    "order_status",
    "refund_request",
    "payment_issue",
    "delivery_problem",
    "damage_complaint",
    "general_inquiry",
]

# ---------------------------------------------------------------------------
# Unit I Demo: McCulloch-Pitts Neuron
# ---------------------------------------------------------------------------

class MCPNeuron:
    """
    McCulloch-Pitts Neuron (1943) — the earliest formal model of a neuron.

    Decision rule:  output = 1  if  Σ(wᵢ · xᵢ) ≥ threshold
                             = 0  otherwise

    Weights are fixed (not learned) and are typically +1 (excitatory) or −1 (inhibitory).
    Can implement basic Boolean logic gates (AND, OR, NOT).

    Example — AND gate:
        inputs = [1, 1], weights = [1, 1], threshold = 2  → fires
        inputs = [1, 0], weights = [1, 1], threshold = 2  → silent

    Limitations:
        • Cannot learn (fixed weights)
        • Cannot handle non-linearly-separable problems (e.g., XOR)
        • Binary inputs and outputs only
    """

    def __init__(self, weights: list, threshold: float):
        self.weights = np.array(weights, dtype=float)
        self.threshold = threshold

    def activate(self, inputs: list) -> int:
        """Fire (1) if weighted sum meets or exceeds threshold."""
        x = np.array(inputs, dtype=float)
        weighted_sum = np.dot(self.weights, x)
        return 1 if weighted_sum >= self.threshold else 0

    @classmethod
    def and_gate(cls) -> "MCPNeuron":
        """Create a 2-input AND gate using MCP neuron."""
        return cls(weights=[1, 1], threshold=2)

    @classmethod
    def or_gate(cls) -> "MCPNeuron":
        """Create a 2-input OR gate using MCP neuron."""
        return cls(weights=[1, 1], threshold=1)


# ---------------------------------------------------------------------------
# Unit I Demo: Perceptron
# ---------------------------------------------------------------------------

class Perceptron:
    """
    Rosenblatt Perceptron (1958) — single-layer binary classifier.

    Unlike the MCP neuron, the Perceptron learns its weights from data using
    the Perceptron Learning Rule (a precursor to gradient descent).

    Update rule (on misclassified sample):
        w ← w + η · (y − ŷ) · x
        b ← b + η · (y − ŷ)

    Where:
        η   = learning rate
        y   = true label (0 or 1)
        ŷ   = predicted label
        x   = input features

    Convergence guarantee (Perceptron Convergence Theorem):
        If the data is linearly separable, the perceptron will converge
        in a finite number of steps.

    Limitation: Cannot solve XOR (not linearly separable) → motivated MLPs.
    """

    def __init__(self, n_features: int, lr: float = 0.1):
        self.lr = lr
        self.weights = np.zeros(n_features)
        self.bias = 0.0

    def _activate(self, x: np.ndarray) -> int:
        return 1 if np.dot(self.weights, x) + self.bias >= 0.5 else 0

    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.array([self._activate(x) for x in X])

    def train(self, X: np.ndarray, y: np.ndarray, epochs: int = 100) -> list:
        """Train using the perceptron update rule. Returns loss per epoch."""
        losses = []
        for _ in range(epochs):
            errors = 0
            for xi, yi in zip(X, y):
                y_pred = self._activate(xi)
                error = yi - y_pred
                if error != 0:
                    # Hebbian-style weight update
                    self.weights += self.lr * error * xi
                    self.bias += self.lr * error
                    errors += 1
            losses.append(errors)
            if errors == 0:
                break  # converged
        return losses


# ---------------------------------------------------------------------------
# Unit I Core: MLP in PyTorch
# ---------------------------------------------------------------------------

class IntentMLP(nn.Module):
    """
    Multilayer Perceptron for 6-class intent classification.

    Architecture:
        384 → [256 → BN → ReLU → Drop(0.3)]
            → [128 → BN → ReLU → Drop(0.3)]
            → [64  → ReLU]
            → 6 (logits)

    Training uses:
        • Loss:      CrossEntropyLoss (includes softmax internally)
        • Optimizer: Adam (lr=1e-3)
        • Scheduler: ReduceLROnPlateau

    BatchNorm: normalises each mini-batch → faster convergence, mild regularizer.
    Dropout:   randomly zeros activations during training → prevents co-adaptation.
    """

    def __init__(
        self,
        input_dim: int = 384,
        hidden1: int = 256,
        hidden2: int = 128,
        hidden3: int = 64,
        n_classes: int = 6,
        dropout_rate: float = 0.3,
    ):
        super().__init__()

        self.network = nn.Sequential(
            # --- Layer 1 ---
            nn.Linear(input_dim, hidden1),
            nn.BatchNorm1d(hidden1),
            nn.ReLU(),
            nn.Dropout(dropout_rate),

            # --- Layer 2 ---
            nn.Linear(hidden1, hidden2),
            nn.BatchNorm1d(hidden2),
            nn.ReLU(),
            nn.Dropout(dropout_rate),

            # --- Layer 3 ---
            nn.Linear(hidden2, hidden3),
            nn.ReLU(),

            # --- Output ---
            nn.Linear(hidden3, n_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass.
        Input:  x — shape (batch_size, 384)
        Output: logits — shape (batch_size, 6)  [NOT softmax; CE loss handles that]
        """
        return self.network(x)


# ---------------------------------------------------------------------------
# IntentClassifier: wraps embedding + MLP + training + inference
# ---------------------------------------------------------------------------

class IntentClassifier:
    """
    End-to-end intent classifier:
        1. Encode text with a sentence-transformer (BGE / MiniLM)
        2. Pass embedding through IntentMLP
        3. Apply softmax → probability distribution over 6 intents

    Falls back to rule-based keyword matching if the model isn't trained.
    """

    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model: Optional[IntentMLP] = None
        self.encoder = None          # SentenceTransformer
        self.encoder_name = "unknown"
        self.is_trained = False
        self._load_encoder()
        self._try_load_saved_model()

    # ------------------------------------------------------------------
    # Encoder loading
    # ------------------------------------------------------------------

    def _load_encoder(self) -> None:
        """Load sentence-transformer encoder with fallback."""
        models_to_try = [
            "BAAI/bge-small-en-v1.5",
            "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
            "sentence-transformers/all-MiniLM-L6-v2",
        ]
        for model_name in models_to_try:
            try:
                from sentence_transformers import SentenceTransformer
                self.encoder = SentenceTransformer(model_name)
                self.encoder_name = model_name
                logger.info(f"Intent encoder loaded: {model_name}")
                return
            except Exception as exc:
                logger.warning(f"Could not load {model_name}: {exc}")

        logger.error("No sentence-transformer available; will use rule-based fallback.")

    def _encode(self, texts: list) -> np.ndarray:
        """Encode a list of strings → (N, embedding_dim) float32 array."""
        if self.encoder is None:
            # Fallback: deterministic random embedding seeded by text hash
            dim = 384
            result = []
            for t in texts:
                rng = np.random.default_rng(abs(hash(t)) % (2 ** 31))
                result.append(rng.standard_normal(dim).astype(np.float32))
            return np.array(result)
        return self.encoder.encode(texts, convert_to_numpy=True, show_progress_bar=False)

    # ------------------------------------------------------------------
    # Saved model loading
    # ------------------------------------------------------------------

    def _try_load_saved_model(self) -> None:
        """Load pre-saved MLP weights if they exist."""
        if not os.path.exists(SAVED_MODEL_PATH):
            logger.info("No saved intent model found; will train on first call.")
            return
        try:
            checkpoint = torch.load(SAVED_MODEL_PATH, map_location=self.device)
            input_dim = checkpoint.get("input_dim", 384)
            self.model = IntentMLP(input_dim=input_dim).to(self.device)
            self.model.load_state_dict(checkpoint["model_state_dict"])
            self.model.eval()
            self.is_trained = True
            logger.info(f"Loaded saved intent MLP from {SAVED_MODEL_PATH}")
        except Exception as exc:
            logger.warning(f"Failed to load saved intent model: {exc}")

    # ------------------------------------------------------------------
    # Training data
    # ------------------------------------------------------------------

    def _get_training_data(self) -> tuple:
        """
        Return (texts, labels) training corpus.
        60+ examples per intent class for a total of ~370 samples.
        """
        data = {
            "order_status": [
                "Where is my order?",
                "Can you tell me the status of my order?",
                "When will my package arrive?",
                "I haven't received my order yet",
                "My order is taking too long",
                "What's the estimated delivery time?",
                "Track my order please",
                "Order number 12345 – where is it?",
                "Has my order been dispatched?",
                "Why is my order delayed?",
                "Can I see the tracking information?",
                "My order was supposed to come yesterday",
                "Please update me on my order",
                "I placed an order 2 days ago and no update",
                "Is my order still being processed?",
                "When will the delivery arrive?",
                "How long does shipping take?",
                "Show me the live tracking for my package",
                "My order status shows 'processing' for hours",
                "Give me an ETA for my delivery",
                "Where exactly is my delivery right now?",
                "Order confirmation received but no delivery",
                "Order placed this morning, still not shipped",
                "Check my order status immediately",
                "Need to know if my groceries are on the way",
                "My delivery was scheduled for today",
                "Can you ping the delivery person?",
                "My package hasn't left the warehouse yet",
                "Why is the status stuck at 'pending'?",
                "Expected delivery time has passed",
                "I need real-time tracking for my order",
                "Order is showing delayed on the app",
                "Delivery window is 5 PM but it's already 7 PM",
                "No notification about my order shipment",
                "Where did my order go?",
                "Blinkit app says delivered but I didn't get it",
                "Order shows 'out for delivery' since morning",
                "Still waiting for my order",
                "How many minutes until delivery?",
                "Delivery boy location not updating",
                "Package marked delivered but not received",
                "Did the rider pick up my order?",
                "My delivery agent hasn't called me",
                "I want to reschedule my delivery",
                "Can I pick up the order myself?",
                "Estimated arrival keeps changing",
                "Order confirmation email not received",
                "Track my groceries delivery",
                "Dispatch team not responding",
                "My order timeline is unclear",
                "I'm concerned about my order delay",
                "Notify me when my package arrives",
                "Is my order lost in transit?",
                "Order date was yesterday, no sign of delivery",
                "App shows 'preparing' for the past 3 hours",
                "No tracking number provided for my order",
                "I urgently need my order today",
                "Can the delivery be expedited?",
                "I ordered last night and still waiting",
                "Expected time was 30 minutes but it's been 2 hours",
                "Order details are not visible on the app",
            ],
            "refund_request": [
                "I want a refund for my order",
                "Please process my refund",
                "How do I get my money back?",
                "My order was wrong, I need a refund",
                "I want to cancel and get a refund",
                "When will my refund be credited?",
                "Refund not received yet",
                "Request refund for damaged product",
                "I'm not happy with the product, want refund",
                "The product was expired, please refund",
                "Wrong items delivered, request full refund",
                "I never received my order, I need my money back",
                "Product quality was very poor, refund needed",
                "Refund status for order 567 please",
                "How long does refund processing take?",
                "Charge my account but order failed",
                "Payment deducted but order not placed",
                "I want compensation for my bad experience",
                "Please initiate refund for cancelled order",
                "Refund request submitted, need confirmation",
                "I returned the product, where's my refund?",
                "Double charged for same order",
                "Extra money deducted, want refund",
                "Refund initiated but not in bank",
                "Partial refund received, want full refund",
                "It's been 7 days and no refund",
                "Refund shows pending for a week",
                "Money returned to wrong account",
                "Why is my refund delayed?",
                "Escalate my refund request",
                "Refund policy says 3 days but it's been 10",
                "I want store credits as refund",
                "My refund was rejected, I disagree",
                "I need refund for the full cart amount",
                "Reverse the payment please",
                "Can I get cashback instead of refund?",
                "Issue refund to original payment method",
                "Wrong quantity delivered, requesting refund",
                "Substitute product sent, I want original or refund",
                "Refund for missing items in order",
                "I changed my mind, can I get a refund?",
                "Unused item, want refund within 24 hours",
                "Refund for item that arrived damaged",
                "Complaint raised, refund not initiated",
                "My refund case number is 98765",
                "I need an urgent refund",
                "Refund for a product I can't use",
                "Refund to wallet or bank?",
                "How to track my refund status?",
                "Refund approved by agent but not credited",
                "I want written confirmation of my refund",
                "Initiate refund for my whole order",
                "Only part of my order arrived, refund rest",
                "Charge reversed but not reflected in app",
                "Need refund for groceries that were rotten",
                "Milk was spoiled, want immediate refund",
                "I deserve a refund for this poor service",
                "Refund for item past expiry date",
                "Food was inedible, requesting refund",
                "Service was terrible, please refund me",
            ],
            "payment_issue": [
                "My payment failed",
                "Unable to pay online",
                "Payment gateway is not working",
                "Transaction declined",
                "Money deducted but order not placed",
                "UPI payment failed",
                "Credit card declined",
                "My wallet balance didn't apply",
                "Coupon code not working",
                "Promo code invalid",
                "Unable to add card",
                "Payment stuck at processing",
                "Net banking error during checkout",
                "OTP not received for payment",
                "Payment timed out",
                "Double charged for my order",
                "Amount deducted twice",
                "Wrong amount charged",
                "Discount not applied at checkout",
                "My wallet balance is missing",
                "Transaction failed but amount debited",
                "Can't checkout, payment error",
                "Blinkit cash not accepted",
                "Gift card not applying",
                "Applying coupon gives error",
                "Payment method not available",
                "Secure payment page not loading",
                "My UPI ID is not valid on Blinkit",
                "Debit card not supported?",
                "Pay on delivery option missing",
                "Can I pay in cash?",
                "PayTM payment not going through",
                "Google Pay integration broken",
                "PhonePe payment failed",
                "Payment app keeps crashing",
                "Error code 500 on payment page",
                "Can't apply referral credits",
                "I have Blinkit coins but can't use them",
                "Subscription discount not working",
                "Why was I charged a delivery fee?",
                "Surprise charges on my bill",
                "Billing address mismatch",
                "CVV verification failed",
                "Card expired but I updated it",
                "Can't save new payment method",
                "Delete old card not working",
                "Payment declined due to low balance",
                "Insufficient funds error",
                "BNPL option not showing",
                "EMI option not available",
                "Pay later declined",
                "Voucher code expired error",
                "Bank server error during payment",
                "Payment confirmation not received",
                "Transaction ID not generated",
                "Unable to complete payment on iOS",
                "Android payment issue",
                "International card not accepted",
                "Foreign currency checkout error",
                "GST invoice incorrect",
                "I need a proper tax invoice",
            ],
            "delivery_problem": [
                "Delivery agent was rude",
                "My delivery is very late",
                "The rider delivered to wrong address",
                "Delivery executive not answering calls",
                "Wrong address delivery",
                "I was not home, why wasn't there a re-delivery?",
                "Delivery person left without ringing the bell",
                "Rider is asking for extra charges",
                "My order was delivered to my neighbor",
                "Delivery agent attitude was bad",
                "The package was thrown at my door",
                "Delivery to wrong floor",
                "Delivery guy demanded tip",
                "My order was left outside in rain",
                "No re-attempt for failed delivery",
                "Delivery partner cancelled my order",
                "Delivery zone not serviceable today",
                "My area shows unavailable",
                "Can't order to my pincode",
                "Blinkit doesn't deliver to my location",
                "Delivery address was auto-changed",
                "GPS location wrong for my house",
                "Rider went to wrong locality",
                "Delivery failed without reason",
                "Order cancelled by delivery person",
                "No one to deliver at night time",
                "Delivery person arrived very early",
                "Package not left at security desk",
                "Contactless delivery option missing",
                "I want doorstep delivery, not lobby",
                "Delivery instructions not followed",
                "Special delivery note was ignored",
                "Delivery person demanded OTP before arrival",
                "Rider shared fake OTP",
                "Wrong OTP entered, order marked delivered",
                "Delivery not possible before 9 AM?",
                "Night delivery not available",
                "Emergency delivery not offered",
                "I need same-day delivery",
                "Hyperlocal delivery too slow",
                "Store is close but delivery takes 2 hours",
                "Why is delivery time 60 min instead of 10?",
                "Delivery estimation wildly off",
                "No delivery agent assigned",
                "Rider unassigned and order stuck",
                "Multiple delivery failures in a row",
                "Address not found by delivery app",
                "Coordinates are wrong on map",
                "Landmark not recognised",
                "I added delivery instructions, not followed",
                "Delivery guy called once and left",
                "Package weight damaged in transit",
                "Bag seal was opened on delivery",
                "Items missing from delivery bag",
                "Partial delivery without notice",
                "Some items out of stock after ordering",
                "Substitution sent without permission",
                "Rider stole items from order",
                "Security would not allow delivery",
                "Gated community access refused",
                "Society delivery timings conflict",
            ],
            "damage_complaint": [
                "My product arrived damaged",
                "The packaging was broken",
                "Items were crushed",
                "Received broken eggs",
                "Milk carton was leaking",
                "The bottle was cracked",
                "Fruits were bruised",
                "Vegetables are rotten",
                "Product is expired",
                "The seal was broken",
                "Item was squished in the bag",
                "Bread was squashed",
                "Frozen items arrived melted",
                "Ice cream was liquid",
                "Chocolates had melted",
                "Chips packet was torn",
                "Biscuits arrived crumbled",
                "Jar was cracked and leaking",
                "Shampoo bottle broken",
                "Liquid spilled all over the bag",
                "Bag had oil stain from a leak",
                "The mango was completely rotten",
                "Apple had mold on it",
                "Curd container was damaged",
                "Yogurt was expired",
                "Cheese had fungus",
                "Meat arrived smelling bad",
                "Chicken was not fresh",
                "Fish was spoiled",
                "Paneer was sour",
                "Packaged product missing barcode",
                "Product tampered with",
                "Shrink wrap was removed",
                "Evidence of repackaging",
                "Canned food was dented",
                "Can was bulging — might be expired",
                "Rice packet had a hole",
                "Dal was full of insects",
                "Flour had weevils",
                "Spice packet was half empty",
                "Wrong brand was sent",
                "Wrong flavor delivered",
                "Different size than ordered",
                "Product looked used or opened",
                "Juice bottle was half empty",
                "Soft drink bottle was flat",
                "Water bottle had dirt inside",
                "Damaged product not fit for use",
                "I got a defective product",
                "Kitchen item arrived broken",
                "Utensil chipped on delivery",
                "Glassware arrived cracked",
                "Electronics item was damaged",
                "Hygiene product seal missing",
                "Medicine box was damaged",
                "Medicine packaging opened",
                "Received near-expiry product",
                "Expiry date not visible on product",
                "Product date says best before last month",
                "Fruit was half rotten inside",
                "Tomatoes were completely squashed",
            ],
            "general_inquiry": [
                "How do I contact customer service?",
                "What are your operating hours?",
                "Do you deliver in my area?",
                "What payment methods do you accept?",
                "How do I create an account?",
                "Can I change my delivery address?",
                "How does Blinkit work?",
                "What is Blinkit Plus?",
                "Tell me about your loyalty program",
                "How do I apply a coupon?",
                "Where is the nearest Blinkit store?",
                "Do you have organic products?",
                "What categories do you offer?",
                "Are your products genuine?",
                "Can I schedule a delivery?",
                "Do you offer express delivery?",
                "What is the minimum order value?",
                "Is there a delivery fee?",
                "How do I delete my account?",
                "How do I change my phone number?",
                "Can I order from multiple stores?",
                "Is there a monthly subscription?",
                "What is Blinkit Pass?",
                "How do I earn and redeem coins?",
                "Can I send a gift order?",
                "How do I track my past orders?",
                "Where can I see my invoices?",
                "Do you offer bulk orders?",
                "Is Blinkit available 24/7?",
                "What is your return policy?",
                "Can I add items after placing an order?",
                "How do I cancel an order?",
                "Do you have vegetarian filters?",
                "Are there gluten-free options?",
                "Which brands are available on Blinkit?",
                "Do you sell electronics?",
                "What's new on Blinkit this week?",
                "How do I refer a friend?",
                "Referral code not working",
                "How to use Blinkit on web browser?",
                "Is there a desktop app?",
                "How do I rate the delivery agent?",
                "Can I leave feedback for a product?",
                "How do I report a safety concern?",
                "Is my data secure on Blinkit?",
                "What is your privacy policy?",
                "How do I opt out of notifications?",
                "App is not loading",
                "Blinkit website is down",
                "Login not working",
                "Can't sign in to my account",
                "Password reset not received",
                "OTP for login not coming",
                "Profile photo not updating",
                "How to use saved addresses?",
                "Which cities does Blinkit serve?",
                "Is Blinkit available in Tier-2 cities?",
                "Can I order prescription medicines?",
                "Do you have baby products?",
                "Pet food on Blinkit?",
                "How to contact Blinkit on social media?",
            ],
        }

        texts, labels = [], []
        for intent, examples in data.items():
            for text in examples:
                texts.append(text)
                labels.append(INTENT_LABELS.index(intent))

        return texts, labels

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train_with_sample_data(self, epochs: int = 50) -> dict:
        """
        Train the MLP on the curated sample corpus.
        Returns a dict with training history.
        """
        logger.info("Training intent MLP on sample data...")
        texts, labels = self._get_training_data()

        # Encode all texts
        embeddings = self._encode(texts)
        input_dim = embeddings.shape[1]

        # Convert to tensors
        X = torch.tensor(embeddings, dtype=torch.float32).to(self.device)
        y = torch.tensor(labels, dtype=torch.long).to(self.device)

        # Build model
        self.model = IntentMLP(input_dim=input_dim).to(self.device)

        # Class-weighted loss (in case of imbalance)
        criterion = nn.CrossEntropyLoss()
        optimizer = optim.Adam(self.model.parameters(), lr=1e-3, weight_decay=1e-4)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)

        history = {"loss": [], "accuracy": []}
        best_loss = float("inf")

        self.model.train()
        for epoch in range(epochs):
            optimizer.zero_grad()
            logits = self.model(X)
            loss = criterion(logits, y)
            loss.backward()
            optimizer.step()

            # Metrics
            with torch.no_grad():
                preds = torch.argmax(logits, dim=1)
                acc = (preds == y).float().mean().item()

            loss_val = loss.item()
            scheduler.step(loss_val)
            history["loss"].append(loss_val)
            history["accuracy"].append(acc)

            if epoch % 10 == 0:
                logger.info(f"  Epoch {epoch:3d}/{epochs}  loss={loss_val:.4f}  acc={acc:.4f}")

            # Save best
            if loss_val < best_loss:
                best_loss = loss_val
                self._save_model(input_dim)

        self.model.eval()
        self.is_trained = True
        logger.info(f"Training complete. Best loss: {best_loss:.4f}")
        return history

    def _save_model(self, input_dim: int) -> None:
        """Save model weights to disk."""
        try:
            os.makedirs(os.path.dirname(SAVED_MODEL_PATH), exist_ok=True)
            torch.save(
                {
                    "model_state_dict": self.model.state_dict(),
                    "input_dim": input_dim,
                    "labels": INTENT_LABELS,
                },
                SAVED_MODEL_PATH,
            )
        except Exception as exc:
            logger.warning(f"Could not save intent model: {exc}")

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def predict(self, text: str) -> dict:
        """
        Predict intent for a single customer message.
        Returns dict with 'intent', 'confidence', 'all_probs'.
        """
        # Train on first call if no saved model
        if not self.is_trained:
            try:
                self.train_with_sample_data(epochs=30)
            except Exception as exc:
                logger.warning(f"Training failed, using rule-based fallback: {exc}")
                return self._rule_based_predict(text)

        if self.model is None:
            return self._rule_based_predict(text)

        try:
            embedding = self._encode([text])  # (1, dim)
            x = torch.tensor(embedding, dtype=torch.float32).to(self.device)

            self.model.eval()
            with torch.no_grad():
                logits = self.model(x)
                probs = torch.softmax(logits, dim=1).cpu().numpy()[0]

            pred_idx = int(np.argmax(probs))
            all_probs = {label: float(p) for label, p in zip(INTENT_LABELS, probs)}

            return {
                "intent": INTENT_LABELS[pred_idx],
                "confidence": float(probs[pred_idx]),
                "all_probs": all_probs,
            }
        except Exception as exc:
            logger.error(f"MLP inference failed: {exc}")
            return self._rule_based_predict(text)

    def _rule_based_predict(self, text: str) -> dict:
        """Keyword-based fallback intent classifier."""
        text_lower = text.lower()

        rules = [
            ("refund_request",   ["refund", "money back", "return", "reimburse", "credit back"]),
            ("payment_issue",    ["payment", "pay", "transaction", "upi", "card", "coupon", "promo", "wallet", "charged"]),
            ("damage_complaint", ["damage", "broken", "crushed", "expired", "rotten", "leaking", "spoiled", "mold"]),
            ("delivery_problem", ["delivery", "rider", "agent", "driver", "wrong address", "late delivery", "rude"]),
            ("order_status",     ["order", "track", "status", "arrive", "dispatch", "when", "where", "eta"]),
            ("general_inquiry",  ["how", "what", "why", "policy", "account", "help", "support", "contact"]),
        ]

        scores = {label: 0 for label, _ in rules}
        for label, keywords in rules:
            for kw in keywords:
                if kw in text_lower:
                    scores[label] += 1

        best = max(scores, key=lambda k: scores[k])
        total = sum(scores.values()) or 1
        confidence = scores[best] / total if total > 0 else 1.0 / len(INTENT_LABELS)
        if scores[best] == 0:
            best = "general_inquiry"
            confidence = 1.0 / len(INTENT_LABELS)

        all_probs = {k: v / total for k, v in scores.items()}
        return {"intent": best, "confidence": float(confidence), "all_probs": all_probs}
