"""
regularization.py — Unit II: Regularization Techniques
=========================================================

Regularization prevents overfitting by constraining the model's capacity.
Overfitting: model memorises training data but generalises poorly to new data.

Techniques covered:
  1. L1 Regularization (Lasso)   — sparsity via weight penalty
  2. L2 Regularization (Ridge)   — weight decay via squared penalty
  3. Dropout                     — stochastic neuron deactivation
  4. Batch Normalization         — normalises layer inputs (reduces internal covariate shift)
  5. Early Stopping              — halt training when validation loss stops improving
  6. Data Augmentation           — conceptual explanation
"""

import numpy as np
import torch
import torch.nn as nn
from typing import Optional, List


# ---------------------------------------------------------------------------
# 1 & 2. L1 and L2 Regularization
# ---------------------------------------------------------------------------

class WeightRegularizer:
    """
    Compute L1 and L2 regularization penalties for a set of weight tensors.

    In practice, PyTorch's optimizer `weight_decay` parameter implements L2.
    This class provides a standalone implementation for learning purposes.

    L1 (Lasso):
        • Penalty: λ · Σ |w|
        • Gradient: λ · sign(w)
        • Effect: pushes weights toward exactly 0 → sparse solutions
        • Use: feature selection, when you believe many features are irrelevant

    L2 (Ridge / weight decay):
        • Penalty: (λ/2) · Σ w²
        • Gradient: λ · w
        • Effect: shrinks all weights uniformly → small but non-zero weights
        • Use: default regularizer; equivalent to a Gaussian prior on weights
    """

    def __init__(self, lambda_l1: float = 0.0, lambda_l2: float = 1e-4):
        self.lambda_l1 = lambda_l1
        self.lambda_l2 = lambda_l2

    def l1_penalty(self, weights: torch.Tensor) -> torch.Tensor:
        """Compute L1 penalty for a single weight tensor."""
        return self.lambda_l1 * torch.sum(torch.abs(weights))

    def l2_penalty(self, weights: torch.Tensor) -> torch.Tensor:
        """Compute L2 penalty for a single weight tensor."""
        return 0.5 * self.lambda_l2 * torch.sum(weights ** 2)

    def total_penalty(self, model: nn.Module) -> torch.Tensor:
        """
        Sum L1 + L2 penalties across all named weight parameters in a model.
        Biases are conventionally excluded from regularization.
        """
        penalty = torch.tensor(0.0)
        for name, param in model.named_parameters():
            if "weight" in name:  # skip biases
                penalty = penalty + self.l1_penalty(param) + self.l2_penalty(param)
        return penalty


# ---------------------------------------------------------------------------
# 3. Dropout
# ---------------------------------------------------------------------------

class ManualDropout:
    """
    Dropout (Srivastava et al., 2014).

    During training: each neuron is independently set to 0 with probability p.
    Remaining activations are scaled by 1/(1−p) to maintain expected value.
    During inference: all neurons are active (no scaling needed if inverted dropout was used).

    Intuition:
        Prevents co-adaptation of neurons — each neuron cannot rely on specific
        others always being present, so it must learn robust, independent features.
        Equivalent to training an ensemble of 2^n different network architectures.

    PyTorch equivalent: nn.Dropout(p=dropout_rate)

    Note: In PyTorch, model.train() enables dropout; model.eval() disables it.
    """

    def __init__(self, dropout_rate: float = 0.5):
        assert 0.0 <= dropout_rate < 1.0, "Dropout rate must be in [0, 1)"
        self.p = dropout_rate

    def forward(self, x: np.ndarray, training: bool = True) -> np.ndarray:
        """Apply dropout to a numpy array of activations."""
        if not training or self.p == 0.0:
            return x  # no dropout at inference time

        # Inverted dropout: scale at training time so inference needs no change
        mask = (np.random.rand(*x.shape) > self.p).astype(np.float32)
        return x * mask / (1.0 - self.p)


# ---------------------------------------------------------------------------
# 4. Batch Normalization (conceptual)
# ---------------------------------------------------------------------------

class ManualBatchNorm:
    """
    Batch Normalization (Ioffe & Szegedy, 2015).

    Problem it solves: "Internal Covariate Shift" — as layers update, the
    distribution of inputs to subsequent layers changes, slowing training.

    Algorithm (for a mini-batch of size N):
        1. Compute batch mean:  μ_B = (1/N) Σ x_i
        2. Compute batch var:   σ²_B = (1/N) Σ (x_i − μ_B)²
        3. Normalize:           x̂_i = (x_i − μ_B) / √(σ²_B + ε)
        4. Scale & shift:       y_i = γ · x̂_i + β
           γ (scale) and β (shift) are learnable parameters.

    Benefits:
        • Allows higher learning rates → faster training
        • Acts as a mild regularizer (adds noise via batch statistics)
        • Reduces sensitivity to weight initialization

    PyTorch equivalent: nn.BatchNorm1d(num_features)
    """

    def __init__(self, num_features: int, eps: float = 1e-5, momentum: float = 0.1):
        self.eps = eps
        self.momentum = momentum
        # Learnable parameters
        self.gamma = np.ones(num_features)   # scale
        self.beta = np.zeros(num_features)   # shift
        # Running statistics (used at inference)
        self.running_mean = np.zeros(num_features)
        self.running_var = np.ones(num_features)

    def forward(self, x: np.ndarray, training: bool = True) -> np.ndarray:
        """Normalize a batch of activations. x shape: (batch_size, num_features)"""
        if training:
            mu = x.mean(axis=0)
            var = x.var(axis=0)
            # Update running stats with exponential moving average
            self.running_mean = (1 - self.momentum) * self.running_mean + self.momentum * mu
            self.running_var = (1 - self.momentum) * self.running_var + self.momentum * var
        else:
            mu = self.running_mean
            var = self.running_var

        x_norm = (x - mu) / np.sqrt(var + self.eps)
        return self.gamma * x_norm + self.beta


# ---------------------------------------------------------------------------
# 5. Early Stopping
# ---------------------------------------------------------------------------

class EarlyStopping:
    """
    Early Stopping — halt training when the monitored metric stops improving.

    Prevents overfitting by stopping before the model memorises training data.
    The best model checkpoint is typically restored at the end.

    Parameters:
        patience  — number of epochs to wait after last improvement
        min_delta — minimum change to qualify as improvement
        mode      — 'min' for loss, 'max' for accuracy/F1
        restore_best_weights — if True, reload best model at end of training
    """

    def __init__(
        self,
        patience: int = 5,
        min_delta: float = 1e-4,
        mode: str = "min",
    ):
        assert mode in ("min", "max"), "mode must be 'min' or 'max'"
        self.patience = patience
        self.min_delta = min_delta
        self.mode = mode
        self.best_value: Optional[float] = None
        self.counter: int = 0
        self.should_stop: bool = False

    def _is_improvement(self, current: float) -> bool:
        if self.best_value is None:
            return True
        if self.mode == "min":
            return current < self.best_value - self.min_delta
        else:
            return current > self.best_value + self.min_delta

    def step(self, current_value: float) -> bool:
        """
        Call after each epoch with the validation metric.
        Returns True if training should stop.
        """
        if self._is_improvement(current_value):
            self.best_value = current_value
            self.counter = 0
        else:
            self.counter += 1
            if self.counter >= self.patience:
                self.should_stop = True

        return self.should_stop

    def reset(self) -> None:
        """Reset state for a new training run."""
        self.best_value = None
        self.counter = 0
        self.should_stop = False


# ---------------------------------------------------------------------------
# 6. Data Augmentation (conceptual description)
# ---------------------------------------------------------------------------

class DataAugmentationInfo:
    """
    Data Augmentation — artificially expand the training set by applying
    label-preserving transformations to existing samples.

    For Images (torchvision.transforms):
        • RandomHorizontalFlip   — mirror left/right
        • RandomRotation         — rotate ±N degrees
        • ColorJitter            — vary brightness, contrast, saturation
        • RandomCrop             — crop to a random region
        • GaussianBlur           — add Gaussian noise

    For Text (NLP):
        • Synonym replacement    — swap words with WordNet synonyms
        • Back-translation       — translate EN→DE→EN for paraphrases
        • Random insertion/deletion of words

    For Audio:
        • Time stretching, pitch shifting, noise injection

    Goal: Model sees a wider variety of inputs → generalises better.
    Especially useful when training data is limited.
    """

    @staticmethod
    def describe() -> str:
        return DataAugmentationInfo.__doc__ or ""


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

def regularization_demo() -> None:
    """Demonstrate dropout and batch norm on a random activation matrix."""
    np.random.seed(42)
    activations = np.random.randn(8, 4)  # batch of 8 samples, 4 features

    print("=" * 50)
    print("Original activations (8x4):")
    print(np.round(activations, 3))

    # Dropout
    dropout = ManualDropout(dropout_rate=0.5)
    dropped = dropout.forward(activations, training=True)
    print("\nAfter Dropout (p=0.5):")
    print(np.round(dropped, 3))

    # Batch norm
    bn = ManualBatchNorm(num_features=4)
    normed = bn.forward(activations, training=True)
    print("\nAfter BatchNorm:")
    print(np.round(normed, 3))
    print(f"Post-BN mean per feature: {normed.mean(axis=0).round(4)}")
    print(f"Post-BN std  per feature: {normed.std(axis=0).round(4)}")

    # Early stopping simulation
    print("\nEarly Stopping Simulation:")
    es = EarlyStopping(patience=3, mode="min")
    val_losses = [0.9, 0.7, 0.6, 0.65, 0.67, 0.70, 0.72, 0.71]
    for epoch, loss in enumerate(val_losses, 1):
        stop = es.step(loss)
        print(f"  Epoch {epoch}: val_loss={loss:.3f}  counter={es.counter}  stop={stop}")
        if stop:
            break


if __name__ == "__main__":
    regularization_demo()
