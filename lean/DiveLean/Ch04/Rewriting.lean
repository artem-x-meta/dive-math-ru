/-
Глава 4. Переписывание равенств.

Первая глава, где нужен Mathlib: `ring` и `linarith` живут там.
-/
import Mathlib.Tactic.Ring
import Mathlib.Tactic.Linarith

-- НАЧАЛО: rw-basic
-- `rw` подставляет равенство в цель: где было левое, станет правое.
theorem substitute_once (a b : Nat) (h : a = b) : a + 1 = b + 1 := by
  rw [h]
-- КОНЕЦ: rw-basic

-- НАЧАЛО: rw-closes
-- После подстановки цель часто становится тождеством, и `rw` закрывает её сам.
theorem substitute_twice (x y z : Nat) (h1 : x = y) (h2 : y = z) : x = z := by
  rw [h1, h2]
-- КОНЕЦ: rw-closes

-- НАЧАЛО: rw-direction
-- Стрелка влево переписывает в обратную сторону: правое заменяется левым.
theorem substitute_back (a b : Nat) (h : a = b) : b + 1 = a + 1 := by
  rw [← h]
-- КОНЕЦ: rw-direction

-- НАЧАЛО: calc-chain
-- `calc` записывает цепочку равенств так, как её пишут на бумаге,
-- и требует обосновать каждый переход.
theorem chain_example (a b c : Nat) (h1 : a = b) (h2 : b = c) : a + 0 = c := by
  calc a + 0 = a := by rw [Nat.add_zero]
    _ = b := by rw [h1]
    _ = c := by rw [h2]
-- КОНЕЦ: calc-chain

-- НАЧАЛО: ring-square
-- Квадрат суммы: `ring` раскрывает скобки и приводит подобные сам.
theorem square_of_sum (a b : ℤ) : (a + b) ^ 2 = a ^ 2 + 2 * a * b + b ^ 2 := by
  ring
-- КОНЕЦ: ring-square

-- НАЧАЛО: ring-difference
-- Разность квадратов — тем же одним словом.
theorem difference_of_squares (a b : ℤ) : (a + b) * (a - b) = a ^ 2 - b ^ 2 := by
  ring
-- КОНЕЦ: ring-difference

-- НАЧАЛО: calc-by-hand
-- Тот же квадрат суммы, но вручную: видно, из каких шагов состоит `ring`.
theorem square_of_sum_by_hand (a b : ℤ) :
    (a + b) ^ 2 = a ^ 2 + 2 * a * b + b ^ 2 := by
  calc (a + b) ^ 2 = (a + b) * (a + b) := by ring
    _ = a * a + a * b + b * a + b * b := by ring
    _ = a ^ 2 + 2 * a * b + b ^ 2 := by ring
-- КОНЕЦ: calc-by-hand

-- НАЧАЛО: ring-limits
-- Важная граница: `ring` доказывает тождества, но не уравнения.
-- Здесь дано равенство как гипотеза, и нужен `linarith`, а не `ring`.
theorem uses_hypothesis (x : ℤ) (h : x + 3 = 10) : x = 7 := by
  linarith
-- КОНЕЦ: ring-limits

-- НАЧАЛО: exercise-cube
-- Упражнение: куб суммы.
theorem cube_of_sum (a b : ℤ) :
    (a + b) ^ 3 = a ^ 3 + 3 * a ^ 2 * b + 3 * a * b ^ 2 + b ^ 3 := by
  ring
-- КОНЕЦ: exercise-cube
