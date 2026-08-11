/-
Глава 6. Индукция.

Функции определяются рекурсивно, теоремы о них доказываются индукцией —
и это одна и та же форма рассуждения, записанная с двух сторон.
-/
import Mathlib.Tactic.Ring

-- НАЧАЛО: recursive-def
-- Сумма чисел от 1 до n. Определение рекурсивное: база и шаг.
def sumTo : Nat → Nat
  | 0 => 0
  | n + 1 => (n + 1) + sumTo n
-- КОНЕЦ: recursive-def

-- НАЧАЛО: compute-sum
-- Значения считаются вычислением, доказывать нечего.
example : sumTo 5 = 15 := rfl
example : sumTo 10 = 55 := rfl
-- КОНЕЦ: compute-sum

-- НАЧАЛО: induction-shape
-- Индукция даёт ровно две цели: база и шаг. В шаге доступна
-- гипотеза индукции — утверждение для предыдущего значения.
theorem sum_formula (n : Nat) : 2 * sumTo n = n * (n + 1) := by
  induction n with
  | zero => rfl
  | succ k ih =>
    change 2 * ((k + 1) + sumTo k) = (k + 1) * (k + 2)
    calc 2 * ((k + 1) + sumTo k) = 2 * (k + 1) + 2 * sumTo k := by ring
      _ = 2 * (k + 1) + k * (k + 1) := by rw [ih]
      _ = (k + 1) * (k + 2) := by ring
-- КОНЕЦ: induction-shape

-- НАЧАЛО: induction-simple
-- Не всякая индукция требует выкладок: часто шаг закрывается
-- гипотезой почти сразу.
theorem sum_double (n : Nat) : sumTo n + sumTo n = n * (n + 1) := by
  induction n with
  | zero => rfl
  | succ k ih =>
    change ((k + 1) + sumTo k) + ((k + 1) + sumTo k) = (k + 1) * (k + 2)
    calc ((k + 1) + sumTo k) + ((k + 1) + sumTo k)
        = 2 * (k + 1) + (sumTo k + sumTo k) := by ring
      _ = 2 * (k + 1) + k * (k + 1) := by rw [ih]
      _ = (k + 1) * (k + 2) := by ring
-- КОНЕЦ: induction-simple

-- НАЧАЛО: power-def
-- Ещё одна рекурсия: удвоение n раз.
def doubled : Nat → Nat
  | 0 => 1
  | n + 1 => 2 * doubled n
-- КОНЕЦ: power-def

-- НАЧАЛО: power-grows
-- Показательный рост обгоняет линейный. Доказывается индукцией,
-- причём база берётся не с нуля, а с четырёх.
theorem doubled_gt (n : Nat) : n + 1 ≤ doubled n := by
  induction n with
  | zero => decide
  | succ k ih =>
    change k + 2 ≤ 2 * doubled k
    omega
-- КОНЕЦ: power-grows

-- НАЧАЛО: exercise-odd-sum
-- Упражнение: сумма первых n нечётных чисел равна n².
def sumOdd : Nat → Nat
  | 0 => 0
  | n + 1 => (2 * n + 1) + sumOdd n

theorem sum_odd_is_square (n : Nat) : sumOdd n = n * n := by
  induction n with
  | zero => rfl
  | succ k ih =>
    change (2 * k + 1) + sumOdd k = (k + 1) * (k + 1)
    rw [ih]
    ring
-- КОНЕЦ: exercise-odd-sum
