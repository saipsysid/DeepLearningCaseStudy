"""
activations.py — Unit I: Activation Functions
==============================================

Activation functions introduce non-linearity into neural networks.
Without them, stacking linear layers is equivalent to a single linear layer
(because a composition of affine maps is still affine).

Each function is implemented in pure NumPy so it can be used as a reference
or for visualisation / testing outside of PyTorch.

Reference: Goodfellow et al., "Deep Learning", Chapter 6
"""

import numpy as np


# ---------------------------------------------------------------------------
# Individual activation functions
# ---------------------------------------------------------------------------

def sigmoid(x: np.ndarray) -> np.ndarray:
    """
    Sigmoid (logistic) function.

    Formula:  σ(x) = 1 / (1 + e^(-x))
    Range:    (0, 1)
    Use case: Binary classification output layer, gates inside LSTM cells.
    Problem:  Vanishing gradient for |x| >> 1  (saturates at 0 and 1).

    Derivative: σ'(x) = σ(x) · (1 − σ(x))
    """
    # Clip to avoid overflow in exp
    x = np.clip(x, -500, 500)
    return 1.0 / (1.0 + np.exp(-x))


def tanh(x: np.ndarray) -> np.ndarray:
    """
    Hyperbolic tangent.

    Formula:  tanh(x) = (e^x − e^(−x)) / (e^x + e^(−x))
    Range:    (−1, 1)  — zero-centred, unlike sigmoid
    Use case: Hidden layers (historically), RNN hidden states, LSTM gates.
    Problem:  Still saturates, but gradient is stronger than sigmoid near 0.

    Relation to sigmoid: tanh(x) = 2·σ(2x) − 1
    """
    return np.tanh(x)


def relu(x: np.ndarray) -> np.ndarray:
    """
    Rectified Linear Unit.

    Formula:  ReLU(x) = max(0, x)
    Range:    [0, +∞)
    Use case: Default choice for hidden layers in CNNs, MLPs.
    Advantages:
        • Sparse activation (dead neurons set to 0) — efficient
        • No vanishing gradient for positive inputs
        • Simple, fast to compute
    Problem:  "Dying ReLU" — once a neuron outputs 0 (weight update makes
              pre-activation always negative), it never recovers.
    """
    return np.maximum(0.0, x)


def leaky_relu(x: np.ndarray, alpha: float = 0.01) -> np.ndarray:
    """
    Leaky ReLU — fixes the dying-neuron problem.

    Formula:  f(x) = x       if x > 0
                   = α·x     if x ≤ 0      (α ≈ 0.01)
    Range:    (−∞, +∞)
    Advantage: Neurons can still receive gradients in the negative region.
    Parametric variant (PReLU): α is a learnable parameter.
    """
    return np.where(x > 0, x, alpha * x)


def elu(x: np.ndarray, alpha: float = 1.0) -> np.ndarray:
    """
    Exponential Linear Unit.

    Formula:  f(x) = x             if x > 0
                   = α(e^x − 1)   if x ≤ 0
    Advantage: Smooth at 0, pushes mean activations closer to 0 (like BN).
    """
    return np.where(x > 0, x, alpha * (np.exp(np.clip(x, -500, 500)) - 1.0))


def softmax(x: np.ndarray) -> np.ndarray:
    """
    Softmax — converts a vector of logits into a probability distribution.

    Formula:  softmax(x_i) = e^(x_i) / Σ_j e^(x_j)
    Range:    (0, 1) per element; elements sum to 1
    Use case: Multi-class classification output layer.
    Note:     Numerically stable version: subtract max(x) before exp
              to prevent overflow without changing the result.

    Derivative (Jacobian): ∂s_i/∂x_j = s_i(δ_ij − s_j)
    """
    # Numerically stable trick: shift by max
    x_shifted = x - np.max(x, axis=-1, keepdims=True)
    exp_x = np.exp(x_shifted)
    return exp_x / np.sum(exp_x, axis=-1, keepdims=True)


def gelu(x: np.ndarray) -> np.ndarray:
    """
    Gaussian Error Linear Unit (used in BERT, GPT, Transformers).

    Formula:  GELU(x) = x · Φ(x)
              where Φ(x) is the CDF of the standard normal distribution.
    Approximation: 0.5 · x · (1 + tanh(√(2/π) · (x + 0.044715·x³)))
    """
    return 0.5 * x * (1.0 + np.tanh(np.sqrt(2.0 / np.pi) * (x + 0.044715 * x ** 3)))


# ---------------------------------------------------------------------------
# Demo / comparison
# ---------------------------------------------------------------------------

def activation_demo() -> None:
    """
    Print a comparison table of all activation functions on [-3, -1, 0, 1, 3].
    Useful for verifying behaviour at key points.
    """
    test_inputs = np.array([-3.0, -1.0, 0.0, 1.0, 3.0])
    functions = {
        "sigmoid":     sigmoid,
        "tanh":        tanh,
        "relu":        relu,
        "leaky_relu":  leaky_relu,
        "elu":         elu,
        "gelu":        gelu,
    }

    header = f"{'Input':>8} | " + " | ".join(f"{name:>12}" for name in functions)
    print("=" * len(header))
    print("Activation Function Comparison")
    print("=" * len(header))
    print(header)
    print("-" * len(header))

    for x_val in test_inputs:
        x = np.array([x_val])
        row = f"{x_val:>8.1f} | "
        row += " | ".join(f"{fn(x)[0]:>12.6f}" for fn in functions.values())
        print(row)

    print("=" * len(header))

    # Softmax example
    logits = np.array([2.0, 1.0, 0.1])
    probs = softmax(logits)
    print(f"\nSoftmax([2.0, 1.0, 0.1]) = {probs}  (sum={probs.sum():.6f})")


if __name__ == "__main__":
    activation_demo()
