/-
Глава 3. Кванторы: «для любого» и «существует».

Держится на ядре Lean. Утверждения про числа берутся конкретные,
чтобы `rfl` справлялся сам и внимание оставалось на кванторах.
-/

-- НАЧАЛО: forall-is-function
-- «Для любого n верно P n» — снова функция: дай число, получи доказательство.
theorem every_number_equals_itself : ∀ n : Nat, n = n := fun n => Eq.refl n
-- КОНЕЦ: forall-is-function

-- НАЧАЛО: forall-tactic
-- Тот же `intro`, что и для импликации: он заносит произвольное n в контекст.
theorem every_number_equals_itself' : ∀ n : Nat, n = n := by
  intro n
  rfl
-- КОНЕЦ: forall-tactic

-- НАЧАЛО: forall-apply
-- Пользоваться «для любого» просто: применяем к нужному значению.
theorem apply_universal (P : Nat → Prop) (h : ∀ n, P n) : P 7 := h 7
-- КОНЕЦ: forall-apply

-- НАЧАЛО: exists-intro
-- «Существует» доказывается предъявлением: сначала свидетель, потом
-- доказательство, что он подходит.
theorem some_number_adds_to_five : ∃ n : Nat, n + 2 = 5 := ⟨3, rfl⟩
-- КОНЕЦ: exists-intro

-- НАЧАЛО: exists-tactic
-- Тактика `exists` делает то же самое и сама пробует закрыть остаток.
theorem some_number_adds_to_five' : ∃ n : Nat, n + 2 = 5 := by
  exists 3
-- КОНЕЦ: exists-tactic

-- НАЧАЛО: exists-elim
-- Пользоваться «существует» труднее: свидетель есть, но какой именно —
-- неизвестно, поэтому его вводят в контекст под именем.
theorem shift_witness (P : Nat → Prop) (h : ∃ n, P n) : ∃ m, P m := by
  cases h with
  | intro n hn => exact ⟨n, hn⟩
-- КОНЕЦ: exists-elim

-- НАЧАЛО: quantifier-symmetry
-- Симметрия та же, что у связок: ∀ похож на «и», ∃ — на «или».
-- Из «для любого» получаем частный случай, а из существования —
-- только имя для неизвестного объекта.
theorem universal_gives_example (P : Nat → Prop) (h : ∀ n, P n) : ∃ n, P n :=
  ⟨0, h 0⟩
-- КОНЕЦ: quantifier-symmetry

-- НАЧАЛО: counterexample
-- Опровержение «для любого» — это предъявление контрпримера.
-- Достаточно одного числа, на котором утверждение ломается.
theorem not_all_are_even : ¬(∀ n : Nat, n % 2 = 0) := by
  intro h
  have h3 : (3 : Nat) % 2 = 0 := h 3
  exact absurd h3 (by decide)
-- КОНЕЦ: counterexample

-- НАЧАЛО: exists-not-to-not-forall
-- Одно направление связи кванторов доказывается без всякой классики.
theorem exists_not_gives_not_forall (P : Nat → Prop) (h : ∃ n, ¬P n) :
    ¬(∀ n, P n) := by
  intro hall
  cases h with
  | intro n hn => exact hn (hall n)
-- КОНЕЦ: exists-not-to-not-forall

-- НАЧАЛО: exercise-swap-forall
-- Упражнение: два «для любого» подряд можно менять местами.
theorem swap_foralls (P : Nat → Nat → Prop) (h : ∀ a b, P a b) : ∀ b a, P a b := by
  intro b a
  exact h a b
-- КОНЕЦ: exercise-swap-forall
