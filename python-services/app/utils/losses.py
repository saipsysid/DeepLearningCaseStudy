"""
losses.py — Unit I: Loss Functions
====================================

Loss functions measure how far the model's predictions are from the true labels.
Training = minimising the loss via gradient descent.

All functions accept plain Python lists or NumPy arrays and return a scalar float.
"""

import numpy as np
from typing import Union

Array = Union[np.ndarray, list]


def _to_array(*args) -> tuple:
    """Convert all arguments to float64 NumPy arrays."""
    return tuple(np.array(a, dtype=np.float64) for a in args)


# ---------------------------------------------------------------------------
# Multi-class Classification
# ---------------------------------------------------------------------------

def cross_entropy_loss(y_true: Array, y_pred: Array, eps: float = 1e-12) -> float:
    """
    Categorical Cross-Entropy Loss (also called Log Loss for multi-class).

    Formula:  L = −(1/N) · Σ_i Σ_c y_true[i,c] · log(y_pred[i,c] + ε)

    Where:
        y_true — one-hot encoded ground truth  shape (N, C)
        y_pred — softmax probabilities          shape (N, C)
        ε      — small constant to avoid log(0)

    Why cross-entropy?
        It is the negative log-likelihood under a categorical distribution.
        Minimising CE ↔ maximising likelihood ↔ matching the predicted
        distribution to the true distribution.

    Gradient w.r.t. logits (before softmax):  ∂L/∂z_c = p_c − y_c
        This elegant result is why softmax + CE is the standard pairing.
    """
    y_true, y_pred = _to_array(y_true, y_pred)
    # Clip predictions to prevent log(0)
    y_pred = np.clip(y_pred, eps, 1.0 - eps)
    # Support both 1-D (single sample) and 2-D (batch) inputs
    if y_true.ndim == 1:
        return float(-np.sum(y_true * np.log(y_pred)))
    return float(-np.mean(np.sum(y_true * np.log(y_pred), axis=1)))


def sparse_cross_entropy_loss(y_true_indices: Array, y_pred: Array, eps: float = 1e-12) -> float:
    """
    Sparse version of cross-entropy — y_true is class indices, not one-hot.

    Formula: L = −(1/N) · Σ_i log(y_pred[i, y_true[i]] + ε)
    More memory-efficient than one-hot encoding for large class counts.
    """
    y_pred = np.clip(np.array(y_pred, dtype=np.float64), eps, 1.0)
    y_idx = np.array(y_true_indices, dtype=int)
    if y_pred.ndim == 1:
        return float(-np.log(y_pred[y_idx]))
    return float(-np.mean(np.log(y_pred[np.arange(len(y_idx)), y_idx])))


# ---------------------------------------------------------------------------
# Regression
# ---------------------------------------------------------------------------

def mean_squared_error(y_true: Array, y_pred: Array) -> float:
    """
    Mean Squared Error (MSE) — standard regression loss.

    Formula:  MSE = (1/N) · Σ_i (y_true_i − y_pred_i)²

    Properties:
        • Penalises large errors quadratically (sensitive to outliers)
        • Always non-negative; 0 only when prediction is perfect
        • Gradient: ∂MSE/∂ŷ = (2/N)(ŷ − y)  ← pushes prediction toward truth
    """
    y_true, y_pred = _to_array(y_true, y_pred)
    return float(np.mean((y_true - y_pred) ** 2))


def mean_absolute_error(y_true: Array, y_pred: Array) -> float:
    """
    Mean Absolute Error (MAE) — robust regression loss.

    Formula:  MAE = (1/N) · Σ_i |y_true_i − y_pred_i|

    Vs MSE:
        • Less sensitive to outliers (linear, not quadratic)
        • Non-differentiable at 0 → use Huber loss as a smooth variant
    """
    y_true, y_pred = _to_array(y_true, y_pred)
    return float(np.mean(np.abs(y_true - y_pred)))


def huber_loss(y_true: Array, y_pred: Array, delta: float = 1.0) -> float:
    """
    Huber Loss — smooth combination of MSE (small errors) and MAE (large errors).

    Formula:  L(δ) = (1/N) · Σ_i  0.5·e²          if |e| ≤ δ
                                   δ·(|e| − δ/2)   if |e| > δ
              where e = y_true_i − y_pred_i
    """
    y_true, y_pred = _to_array(y_true, y_pred)
    err = y_true - y_pred
    abs_err = np.abs(err)
    loss = np.where(abs_err <= delta,
                    0.5 * err ** 2,
                    delta * (abs_err - 0.5 * delta))
    return float(np.mean(loss))


# ---------------------------------------------------------------------------
# Binary Classification
# ---------------------------------------------------------------------------

def binary_cross_entropy(y_true: Array, y_pred: Array, eps: float = 1e-12) -> float:
    """
    Binary Cross-Entropy Loss (BCE / Log Loss for 2-class problems).

    Formula:  BCE = −(1/N) · Σ_i [y_i · log(ŷ_i) + (1−y_i) · log(1−ŷ_i)]

    Where:
        y_true  — ground truth binary labels (0 or 1)
        y_pred  — sigmoid probabilities in (0, 1)

    Use with sigmoid output layer.
    Equivalent to cross_entropy_loss when C=2 with one-hot encoding.

    Gradient w.r.t. logit z (before sigmoid):  ∂BCE/∂z = ŷ − y
        Same clean form as softmax+CE.
    """
    y_true, y_pred = _to_array(y_true, y_pred)
    y_pred = np.clip(y_pred, eps, 1.0 - eps)
    return float(-np.mean(y_true * np.log(y_pred) + (1 - y_true) * np.log(1 - y_pred)))


# ---------------------------------------------------------------------------
# Regularisation losses (added to the main loss during training)
# ---------------------------------------------------------------------------

def l1_regularization(weights: Array, lambda_: float = 1e-4) -> float:
    """
    L1 (Lasso) regularisation penalty.

    Formula:  λ · Σ |w_i|

    Effect: Encourages sparsity — many weights become exactly 0.
    Useful for feature selection.
    """
    w = np.array(weights, dtype=np.float64)
    return float(lambda_ * np.sum(np.abs(w)))


def l2_regularization(weights: Array, lambda_: float = 1e-4) -> float:
    """
    L2 (Ridge / weight decay) regularisation penalty.

    Formula:  (λ/2) · Σ w_i²

    Effect: Penalises large weights; keeps all weights small but non-zero.
    Most common regulariser; equivalent to a Gaussian prior on weights.
    """
    w = np.array(weights, dtype=np.float64)
    return float(0.5 * lambda_ * np.sum(w ** 2))


# ---------------------------------------------------------------------------
# Quick demo
# ---------------------------------------------------------------------------

def _demo() -> None:
    """Print loss values for a small example batch."""
    # Binary example
    y_true_bin = [1, 0, 1, 1]
    y_pred_bin = [0.9, 0.2, 0.8, 0.4]
    print(f"Binary CE:  {binary_cross_entropy(y_true_bin, y_pred_bin):.4f}")

    # Multi-class example (one-hot, softmax outputs)
    y_true_mc = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    y_pred_mc = [[0.8, 0.1, 0.1], [0.2, 0.7, 0.1], [0.1, 0.2, 0.7]]
    print(f"Categorical CE: {cross_entropy_loss(y_true_mc, y_pred_mc):.4f}")

    # Regression
    y_true_reg = [1.0, 2.0, 3.0, 4.0]
    y_pred_reg = [1.1, 2.2, 2.9, 4.5]
    print(f"MSE:  {mean_squared_error(y_true_reg, y_pred_reg):.4f}")
    print(f"MAE:  {mean_absolute_error(y_true_reg, y_pred_reg):.4f}")
    print(f"Huber:{huber_loss(y_true_reg, y_pred_reg):.4f}")


if __name__ == "__main__":
    _demo()
