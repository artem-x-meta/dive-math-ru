/-
Глава 5. Числа и решатели.

Тактики, которые доказывают утверждения о конкретных числах сами:
decide, norm_num, omega.
-/
-- omega живёт в ядре Lean, импорт ему не нужен.
import Mathlib.Tactic.NormNum
import Mathlib.Tactic.NormNum.Prime
import Mathlib.Data.Rat.Defs

-- НАЧАЛО: decide-basic
-- `decide` доказывает утверждение вычислением — если оно разрешимо
-- и достаточно маленькое.
example : (7 : Nat) % 2 = 1 := by decide
example : ¬((5 : Nat) ∣ 12) := by decide
-- КОНЕЦ: decide-basic

-- НАЧАЛО: decide-limits
-- Разрешимость обязательна: про произвольное n `decide` бессилен,
-- потому что перебирать пришлось бы бесконечно.
-- Это НЕ работает: example (n : Nat) : n + 0 = n := by decide
example : (2 : Nat) ^ 10 = 1024 := by decide
-- КОНЕЦ: decide-limits

-- НАЧАЛО: norm-num
-- `norm_num` считает арифметику, включая дроби и сравнения.
example : (2 : ℚ) / 4 + 1 / 4 = 3 / 4 := by norm_num
example : (17 : ℤ) * 3 - 20 > 30 := by norm_num
-- КОНЕЦ: norm-num

-- НАЧАЛО: norm-num-prime
-- Умеет и то, чего не осилит простое вычисление.
example : Nat.Prime 97 := by norm_num
-- КОНЕЦ: norm-num-prime

-- НАЧАЛО: omega
-- `omega` решает линейные задачи о целых и натуральных числах,
-- причём с переменными и гипотезами — в отличие от decide.
example (n : Nat) (h : n + 3 = 10) : n = 7 := by omega
example (a b : Int) (h1 : a ≤ b) (h2 : b ≤ a) : a = b := by omega
-- КОНЕЦ: omega

-- НАЧАЛО: omega-parity
-- Чётность и остатки тоже линейны, поэтому omega с ними справляется.
theorem even_plus_even (a b : Nat) (ha : a % 2 = 0) (hb : b % 2 = 0) :
    (a + b) % 2 = 0 := by
  omega
-- КОНЕЦ: omega-parity

-- НАЧАЛО: divides
-- Делимость: `a ∣ b` означает «существует c, что b = a * c».
-- Значок вводится как \dvd, это не вертикальная черта с клавиатуры.
theorem three_divides_twelve : (3 : Nat) ∣ 12 := ⟨4, rfl⟩
-- КОНЕЦ: divides

-- НАЧАЛО: divides-trans
-- Транзитивность делимости — просто подстановка свидетелей.
theorem divides_trans (a b c : Nat) (hab : a ∣ b) (hbc : b ∣ c) : a ∣ c := by
  cases hab with
  | intro x hx =>
    cases hbc with
    | intro y hy =>
      exact ⟨x * y, by rw [hy, hx, Nat.mul_assoc]⟩
-- КОНЕЦ: divides-trans

-- НАЧАЛО: exercise-odd
-- Упражнение: сумма двух нечётных чётна.
theorem odd_plus_odd (a b : Nat) (ha : a % 2 = 1) (hb : b % 2 = 1) :
    (a + b) % 2 = 0 := by
  omega
-- КОНЕЦ: exercise-odd
