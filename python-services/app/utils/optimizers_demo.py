"""
optimizers_demo.py — Unit II: Optimizer Comparison
=====================================================

Gradient descent variants, from vanilla GD to Adam.
Each class maintains its own state (momentum, accumulated gradients, etc.)
and exposes a `step(grad)` method that returns the parameter update.

All optimizers are demonstrated on a 1-D quadratic loss: f(θ) = θ²
whose gradient is simply 2θ.  The global minimum is at θ = 0.

Progression of ideas:
  1. Gradient Descent (GD)        — basic; slow convergence, oscillates in ravines
  2. Momentum                      — smooths oscillations by accumulating velocity
  3. AdaGrad                       — adaptive learning rate; good for sparse data
  4. RMSProp                       — fixes AdaGrad's diminishing lr over time
  5. Adam (Adaptive Moment Est.)   — combines Momentum + RMSProp; most popular

Reference: Kingma & Ba (2014) "Adam: A Method for Stochastic Optimization"
"""

import numpy as np
from typing import Optional


# ---------------------------------------------------------------------------
# Optimizer base class
# ---------------------------------------------------------------------------

class BaseOptimizer:
    """
    Common interface: each optimiser holds its state and returns
    a *parameter update* (not the new parameter value) from step().
    """
    def __init__(self, lr: float):
        self.lr = lr
        self.t = 0  # time step counter

    def step(self, grad: float) -> float:
        """Compute parameter update given current gradient."""
        raise NotImplementedError

    def reset(self) -> None:
        """Reset internal state (useful when re-running experiments)."""
        self.t = 0


# ---------------------------------------------------------------------------
# 1. Vanilla Gradient Descent
# ---------------------------------------------------------------------------

class GradientDescent(BaseOptimizer):
    """
    Stochastic / mini-batch Gradient Descent.

    Update rule:  θ ← θ − η · ∇L(θ)

    Problems:
        • Fixed learning rate — hard to tune
        • Same lr for all parameters
        • Slow through flat regions; oscillates in narrow ravines
    """
    def __init__(self, lr: float = 0.1):
        super().__init__(lr)

    def step(self, grad: float) -> float:
        self.t += 1
        return -self.lr * grad


# ---------------------------------------------------------------------------
# 2. Momentum
# ---------------------------------------------------------------------------

class MomentumGD(BaseOptimizer):
    """
    Gradient Descent with Momentum (Polyak, 1964).

    Update rule:
        v_t = β·v_{t-1} + (1−β)·∇L    (velocity / exponential moving average)
        θ ← θ − η·v_t

    Intuition: Like a ball rolling downhill — it accelerates in consistent
    directions and dampens oscillations in inconsistent directions.
    β ≈ 0.9 is the standard choice.
    """
    def __init__(self, lr: float = 0.1, beta: float = 0.9):
        super().__init__(lr)
        self.beta = beta
        self.v = 0.0  # velocity (1st moment)

    def step(self, grad: float) -> float:
        self.t += 1
        self.v = self.beta * self.v + (1 - self.beta) * grad
        return -self.lr * self.v

    def reset(self) -> None:
        super().reset()
        self.v = 0.0


# ---------------------------------------------------------------------------
# 3. AdaGrad
# ---------------------------------------------------------------------------

class AdaGrad(BaseOptimizer):
    """
    Adaptive Gradient Algorithm (Duchi et al., 2011).

    Update rule:
        G_t = G_{t-1} + (∇L)²           (accumulated squared gradients)
        θ ← θ − (η / √(G_t + ε)) · ∇L

    Key idea: Parameters with large historical gradients get a smaller
    effective learning rate, and vice versa.

    Advantage: Well-suited for sparse features (NLP word embeddings).
    Problem:   G_t is monotonically increasing → lr shrinks to near zero,
               causing training to stall in later iterations.
    """
    def __init__(self, lr: float = 0.1, eps: float = 1e-8):
        super().__init__(lr)
        self.eps = eps
        self.G = 0.0  # accumulated squared gradient

    def step(self, grad: float) -> float:
        self.t += 1
        self.G += grad ** 2
        adaptive_lr = self.lr / (np.sqrt(self.G) + self.eps)
        return -adaptive_lr * grad

    def reset(self) -> None:
        super().reset()
        self.G = 0.0


# ---------------------------------------------------------------------------
# 4. RMSProp
# ---------------------------------------------------------------------------

class RMSProp(BaseOptimizer):
    """
    Root Mean Square Propagation (Hinton, 2012 — unpublished lecture notes).

    Update rule:
        v_t = β·v_{t-1} + (1−β)·(∇L)²   (exponential moving avg of squared grads)
        θ ← θ − (η / √(v_t + ε)) · ∇L

    Fix for AdaGrad: uses an *exponential* moving average, so old gradients
    are forgotten over time — the effective lr doesn't collapse.
    β = 0.99 is common.
    """
    def __init__(self, lr: float = 0.01, beta: float = 0.99, eps: float = 1e-8):
        super().__init__(lr)
        self.beta = beta
        self.eps = eps
        self.v = 0.0  # exponential moving avg of squared gradients

    def step(self, grad: float) -> float:
        self.t += 1
        self.v = self.beta * self.v + (1 - self.beta) * grad ** 2
        adaptive_lr = self.lr / (np.sqrt(self.v) + self.eps)
        return -adaptive_lr * grad

    def reset(self) -> None:
        super().reset()
        self.v = 0.0


# ---------------------------------------------------------------------------
# 5. Adam
# ---------------------------------------------------------------------------

class AdamOptimizer(BaseOptimizer):
    """
    Adam — Adaptive Moment Estimation (Kingma & Ba, 2015).

    Combines Momentum (1st moment) + RMSProp (2nd moment):

        m_t = β₁·m_{t-1} + (1−β₁)·∇L          # 1st moment (mean)
        v_t = β₂·v_{t-1} + (1−β₂)·(∇L)²       # 2nd moment (uncentred variance)

    Bias-corrected estimates (compensate for zero initialisation):
        m̂_t = m_t / (1 − β₁^t)
        v̂_t = v_t / (1 − β₂^t)

    Update:
        θ ← θ − (η / (√v̂_t + ε)) · m̂_t

    Default hyperparameters: β₁=0.9, β₂=0.999, ε=1e-8, η=1e-3
    These work well across most problems (often used "out-of-the-box").
    """
    def __init__(
        self,
        lr: float = 0.001,
        beta1: float = 0.9,
        beta2: float = 0.999,
        eps: float = 1e-8,
    ):
        super().__init__(lr)
        self.beta1 = beta1
        self.beta2 = beta2
        self.eps = eps
        self.m = 0.0   # 1st moment (momentum)
        self.v = 0.0   # 2nd moment (RMSProp)

    def step(self, grad: float) -> float:
        self.t += 1
        # Update biased moment estimates
        self.m = self.beta1 * self.m + (1 - self.beta1) * grad
        self.v = self.beta2 * self.v + (1 - self.beta2) * grad ** 2
        # Bias correction
        m_hat = self.m / (1 - self.beta1 ** self.t)
        v_hat = self.v / (1 - self.beta2 ** self.t)
        return -(self.lr / (np.sqrt(v_hat) + self.eps)) * m_hat

    def reset(self) -> None:
        super().reset()
        self.m = 0.0
        self.v = 0.0


# ---------------------------------------------------------------------------
# Comparison experiment
# ---------------------------------------------------------------------------

def compare_optimizers(
    n_steps: int = 200,
    theta_init: float = 10.0,
) -> dict:
    """
    Run each optimizer on f(θ) = θ²  (grad = 2θ) for `n_steps` iterations.

    Returns a dict mapping optimizer name → list of (θ, loss) per step.
    This data can be plotted to visualise convergence speed.

    Usage:
        results = compare_optimizers()
        for name, history in results.items():
            print(name, "final θ:", history[-1][0])
    """
    optimizers = {
        "GradientDescent": GradientDescent(lr=0.05),
        "Momentum":        MomentumGD(lr=0.05, beta=0.9),
        "AdaGrad":         AdaGrad(lr=0.5),
        "RMSProp":         RMSProp(lr=0.1, beta=0.99),
        "Adam":            AdamOptimizer(lr=0.5),
    }

    results: dict = {}

    for name, opt in optimizers.items():
        opt.reset()
        theta = float(theta_init)
        history = []

        for _ in range(n_steps):
            loss = theta ** 2          # f(θ) = θ²
            grad = 2 * theta           # f'(θ) = 2θ
            update = opt.step(grad)
            theta += update            # parameter update
            history.append({"theta": theta, "loss": loss})

        results[name] = history

    return results


def print_comparison_table(n_steps: int = 50) -> None:
    """Print a table showing loss at milestones for each optimizer."""
    results = compare_optimizers(n_steps=n_steps)
    milestones = [0, 4, 9, 19, 49]
    milestones = [m for m in milestones if m < n_steps]

    print("\n" + "=" * 70)
    print("Optimizer Convergence Comparison  (loss = θ²,  θ_init = 10)")
    print("=" * 70)
    header = f"{'Step':>5} | " + " | ".join(f"{name:>16}" for name in results)
    print(header)
    print("-" * len(header))

    for step in milestones:
        row = f"{step+1:>5} | "
        row += " | ".join(
            f"{results[name][step]['loss']:>16.6f}" for name in results
        )
        print(row)
    print("=" * 70)


if __name__ == "__main__":
    print_comparison_table(n_steps=50)
