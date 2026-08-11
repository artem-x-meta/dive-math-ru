/-
Глава 7. Неравенства.

linarith берёт линейные задачи, nlinarith — часть нелинейных.
-/
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.Positivity
import Mathlib.Data.Real.Basic

-- НАЧАЛО: linarith-basic
-- `linarith` собирает цель из гипотез линейными комбинациями.
example (x : ℝ) (h : x > 3) : x + 1 > 4 := by linarith

example (a b : ℝ) (h1 : a ≤ b) (h2 : b ≤ 5) : a ≤ 5 := by linarith
-- КОНЕЦ: linarith-basic

-- НАЧАЛО: linarith-combination
-- Гипотезы можно складывать с коэффициентами — это и делает тактика.
example (x y : ℝ) (h1 : 2 * x + y = 7) (h2 : x - y = 2) : x = 3 := by linarith
-- КОНЕЦ: linarith-combination

-- НАЧАЛО: linarith-fails
-- Граница: квадрат переменной делает задачу нелинейной.
-- Это НЕ работает: example (x : ℝ) : x ^ 2 ≥ 0 := by linarith
example (x : ℝ) : x ^ 2 ≥ 0 := by positivity
-- КОНЕЦ: linarith-fails

-- НАЧАЛО: nlinarith
-- `nlinarith` умеет часть нелинейного: он сам добавляет произведения
-- гипотез и квадраты, а дальше зовёт linarith.
theorem sq_sum_ge_two_mul (a b : ℝ) : a ^ 2 + b ^ 2 ≥ 2 * a * b := by
  nlinarith [sq_nonneg (a - b)]
-- КОНЕЦ: nlinarith

-- НАЧАЛО: nlinarith-hint
-- Подсказка в квадратных скобках — ключевой приём: мы сообщаем факт,
-- из которого всё следует. Здесь это (a − b)² ≥ 0.
-- Условие неотрицательности не нужно: неравенство верно для всех вещественных.
theorem am_gm_two (a b : ℝ) : a * b ≤ (a ^ 2 + b ^ 2) / 2 := by
  nlinarith [sq_nonneg (a - b)]
-- КОНЕЦ: nlinarith-hint

-- НАЧАЛО: transitivity-chain
-- Выделение полного квадрата: x² − 4x + 5 = (x − 2)² + 1.
theorem chain_of_bounds (x : ℝ) : x ^ 2 - 4 * x + 5 ≥ 1 := by
  nlinarith [sq_nonneg (x - 2)]
-- КОНЕЦ: transitivity-chain

-- НАЧАЛО: exercise-square-nonneg
-- Упражнение: сумма квадратов неотрицательна.
theorem sum_of_squares_nonneg (a b : ℝ) : a ^ 2 + b ^ 2 ≥ 0 := by positivity
-- КОНЕЦ: exercise-square-nonneg
