import Mathlib.Data.Nat.Prime.Basic
import Mathlib.Analysis.SpecialFunctions.Sqrt
import Mathlib.NumberTheory.Real.Irrational

/-!
# Иррациональность √2

Капстоун курса: доказательство от противного целиком, со всеми шагами,
которые на бумаге проговаривают словами.

Приём, который стоит заметить: `ring` берёт на себя всё нелинейное,
а `omega` работает с `m ^ 2` и `k ^ 2` как с обычными неизвестными.
Разделение труда позволяет обойтись без ручных выкладок.
-/

-- НАЧАЛО: parity-lemma
-- Ключевая лемма школьного доказательства: если квадрат чётный,
-- то и само число чётно. Доказывается разбором случаев.
theorem even_of_even_sq (m : Nat) (h : m ^ 2 % 2 = 0) : m % 2 = 0 := by
  rcases Nat.even_or_odd m with he | ho
  · exact Nat.even_iff.mp he
  · exfalso
    obtain ⟨k, hk⟩ := ho
    subst hk
    -- у нечётного числа квадрат нечётен, и это видно после раскрытия скобок
    have hsq : (2 * k + 1) ^ 2 = 2 * (2 * k ^ 2 + 2 * k) + 1 := by ring
    rw [hsq] at h
    omega
-- КОНЕЦ: parity-lemma

-- НАЧАЛО: no-fraction
-- Утверждение, которое доказывают в школе: нет несократимой дроби,
-- квадрат которой равен двум.
-- Условие «знаменатель не ноль» не нужно: взаимная простота с нулём
-- возможна только для единицы, и тот случай проходит сам собой.
theorem no_coprime_sqrt_two (m n : Nat)
    (hcop : Nat.Coprime m n) : m ^ 2 ≠ 2 * n ^ 2 := by
  intro heq
  -- m² чётно, значит чётно и m
  have hm_even : m % 2 = 0 := even_of_even_sq m (by omega)
  obtain ⟨k, hk⟩ : ∃ k, m = 2 * k := ⟨m / 2, by omega⟩
  -- подставляем m = 2k и сокращаем на два: теперь чётно уже n²
  have h4 : m ^ 2 = 4 * k ^ 2 := by rw [hk]; ring
  have hn_sq : n ^ 2 = 2 * k ^ 2 := by omega
  have hn_even : n % 2 = 0 := even_of_even_sq n (by omega)
  -- оба числа чётны, значит двойка делит их наибольший общий делитель
  have h2m : 2 ∣ m := Nat.dvd_of_mod_eq_zero hm_even
  have h2n : 2 ∣ n := Nat.dvd_of_mod_eq_zero hn_even
  have hg : (2 : Nat) ∣ Nat.gcd m n := Nat.dvd_gcd h2m h2n
  -- но у несократимой дроби этот делитель равен единице
  have hcop' : Nat.gcd m n = 1 := hcop
  rw [hcop'] at hg
  omega
-- КОНЕЦ: no-fraction

-- НАЧАЛО: mathlib-version
-- В Mathlib этот факт уже есть — вместе с общим утверждением
-- о корне из любого простого числа.
example : Irrational (Real.sqrt 2) := irrational_sqrt_two

example : Irrational (Real.sqrt 3) := (Nat.prime_three).irrational_sqrt
-- КОНЕЦ: mathlib-version

-- НАЧАЛО: sqrt-two-squared
-- Полезная проверка: квадрат корня действительно равен двум.
example : Real.sqrt 2 ^ 2 = 2 := Real.sq_sqrt (by norm_num)
-- КОНЕЦ: sqrt-two-squared
