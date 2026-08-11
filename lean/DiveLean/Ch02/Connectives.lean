/-
Глава 2. Связки: «и», «или», «не».

Как и первая глава, держится на ядре Lean — Mathlib не нужен.
-/

-- НАЧАЛО: and-intro
-- Чтобы доказать «A и B», нужны оба доказательства.
-- Угловые скобки собирают пару.
theorem and_both (A B : Prop) (hA : A) (hB : B) : A ∧ B := ⟨hA, hB⟩
-- КОНЕЦ: and-intro

-- НАЧАЛО: and-tactic
-- То же тактиками: `constructor` разбивает цель на две.
theorem and_both' (A B : Prop) (hA : A) (hB : B) : A ∧ B := by
  constructor
  · exact hA
  · exact hB
-- КОНЕЦ: and-tactic

-- НАЧАЛО: and-elim
-- Обратный ход: из «A и B» достаём любую половину.
theorem and_left_part (A B : Prop) (h : A ∧ B) : A := h.1
theorem and_right_part (A B : Prop) (h : A ∧ B) : B := h.2
-- КОНЕЦ: and-elim

-- НАЧАЛО: and-comm
-- Порядок в конъюнкции неважен: разбираем пару и собираем обратно.
theorem and_swap (A B : Prop) (h : A ∧ B) : B ∧ A := ⟨h.2, h.1⟩
-- КОНЕЦ: and-comm

-- НАЧАЛО: or-intro
-- Чтобы доказать «A или B», достаточно одной стороны — но надо выбрать какой.
theorem or_from_left (A B : Prop) (hA : A) : A ∨ B := Or.inl hA
theorem or_from_right (A B : Prop) (hB : B) : A ∨ B := Or.inr hB
-- КОНЕЦ: or-intro

-- НАЧАЛО: or-tactic
-- Тактики `left` и `right` делают тот же выбор.
theorem or_from_left' (A B : Prop) (hA : A) : A ∨ B := by
  left
  exact hA
-- КОНЕЦ: or-tactic

-- НАЧАЛО: or-elim
-- Пользоваться дизъюнкцией сложнее: неизвестно, какая половина верна,
-- поэтому цель приходится доказывать в обоих случаях.
theorem or_swap (A B : Prop) (h : A ∨ B) : B ∨ A := by
  cases h with
  | inl hA => exact Or.inr hA
  | inr hB => exact Or.inl hB
-- КОНЕЦ: or-elim

-- НАЧАЛО: not-def
-- Отрицание — это не отдельная связка: `¬A` по определению есть `A → False`.
example (A : Prop) : ¬A ↔ (A → False) := Iff.rfl
-- КОНЕЦ: not-def

-- НАЧАЛО: not-use
-- Раз это функция, доказательство отрицания получает доказательство A
-- и обязано вывести противоречие.
theorem no_self_contradiction (A : Prop) : ¬(A ∧ ¬A) := by
  intro h
  exact h.2 h.1
-- КОНЕЦ: not-use

-- НАЧАЛО: contradiction
-- Из противоречия следует что угодно: `False.elim` закрывает любую цель.
theorem anything_from_false (A B : Prop) (hA : A) (hnA : ¬A) : B :=
  False.elim (hnA hA)
-- КОНЕЦ: contradiction

-- НАЧАЛО: de-morgan
-- Один закон де Моргана доказывается разбором случаев.
theorem not_or_gives_and (A B : Prop) (h : ¬(A ∨ B)) : ¬A ∧ ¬B := by
  constructor
  · intro hA
    exact h (Or.inl hA)
  · intro hB
    exact h (Or.inr hB)
-- КОНЕЦ: de-morgan

-- НАЧАЛО: exercise-distrib
-- Упражнение из практики: «и» распределяется над «или».
theorem and_or_distrib (A B C : Prop) (h : A ∧ (B ∨ C)) : (A ∧ B) ∨ (A ∧ C) := by
  cases h.2 with
  | inl hB => exact Or.inl ⟨h.1, hB⟩
  | inr hC => exact Or.inr ⟨h.1, hC⟩
-- КОНЕЦ: exercise-distrib
