/-
Глава 8. Равносильность против следствия.

Самая практическая глава курса: здесь становится видно, откуда берутся
посторонние корни. На бумаге это правило, которое просят запомнить,
здесь — разница между двумя типами.
-/
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.NormNum
import Mathlib.Data.Real.Basic
import Mathlib.Analysis.SpecialFunctions.Sqrt

-- НАЧАЛО: iff-intro
-- `↔` — это две импликации сразу. Доказывается двумя ветками.
theorem double_iff (x : ℝ) : 2 * x = 6 ↔ x = 3 := by
  constructor
  · intro h
    linarith
  · intro h
    rw [h]
    norm_num
-- КОНЕЦ: iff-intro

-- НАЧАЛО: iff-is-and
-- Внутри `↔` действительно лежит пара импликаций: их можно достать.
theorem forward_part (x : ℝ) (h : 2 * x = 6) : x = 3 := (double_iff x).mp h
theorem backward_part (x : ℝ) (h : x = 3) : 2 * x = 6 := (double_iff x).mpr h
-- КОНЕЦ: iff-is-and

-- НАЧАЛО: squaring-loses
-- А вот возведение в квадрат — только следствие, не равносильность.
-- Из равенства квадратов исходное равенство уже не восстановить.
theorem squaring_is_only_forward (x : ℝ) (h : x = 3) : x ^ 2 = 9 := by
  rw [h]; norm_num
-- КОНЕЦ: squaring-loses

-- НАЧАЛО: squaring-counterexample
-- Обратное неверно, и вот свидетель: −3 удовлетворяет квадрату,
-- но не исходному равенству.
theorem squaring_not_reversible : ¬(∀ x : ℝ, x ^ 2 = 9 → x = 3) := by
  intro h
  have h3 : (-3 : ℝ) = 3 := h (-3) (by norm_num)
  norm_num at h3
-- КОНЕЦ: squaring-counterexample

-- НАЧАЛО: honest-equivalence
-- Честная равносильность для квадрата выглядит так: корней два.
theorem square_iff (x : ℝ) : x ^ 2 = 9 ↔ (x = 3 ∨ x = -3) := by
  constructor
  · intro h
    have factored : (x - 3) * (x + 3) = 0 := by nlinarith [h]
    rcases mul_eq_zero.mp factored with h1 | h2
    · left; linarith
    · right; linarith
  · intro h
    rcases h with h1 | h2
    · rw [h1]; norm_num
    · rw [h2]; norm_num
-- КОНЕЦ: honest-equivalence

-- НАЧАЛО: extraneous-root
-- Разбор классической ловушки. Уравнение √(x+7) = x − 5 после
-- возведения в квадрат даёт x² − 11x + 18 = 0 с корнями 2 и 9.
-- Но 2 не подходит: правая часть исходного уравнения отрицательна.
theorem two_is_extraneous : ((2 : ℝ) - 5) < 0 := by norm_num

theorem nine_survives : Real.sqrt (9 + 7) = 9 - 5 := by
  rw [show (9 : ℝ) + 7 = 16 by norm_num]
  rw [show (16 : ℝ) = 4 ^ 2 by norm_num]
  rw [Real.sqrt_sq (by norm_num : (0 : ℝ) ≤ 4)]
  norm_num
-- КОНЕЦ: extraneous-root

-- НАЧАЛО: exercise-iff
-- Упражнение: равносильность линейного уравнения.
theorem shift_iff (x : ℝ) : x + 4 = 10 ↔ x = 6 := by
  constructor
  · intro h; linarith
  · intro h; linarith
-- КОНЕЦ: exercise-iff
