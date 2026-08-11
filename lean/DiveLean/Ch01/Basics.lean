/-
Глава 1. Доказательство как объект.

Файл собирается вместе со всем курсом: `lake build`. Если хоть одно
доказательство здесь перестанет проходить, упадёт сборка — значит, на
страницах курса не может оказаться примера, который не работает.

Mathlib этой главе не нужен: всё держится на ядре Lean.
-/

-- НАЧАЛО: check-prop
-- `Prop` — тип утверждений. Само утверждение — ещё не доказательство.
#check (2 + 2 = 4 : Prop)
#check (2 + 2 = 5 : Prop)
-- КОНЕЦ: check-prop

-- НАЧАЛО: first-proof
-- Доказательство — это значение, тип которого и есть доказываемое утверждение.
theorem two_plus_two : 2 + 2 = 4 := rfl
-- КОНЕЦ: first-proof

-- НАЧАЛО: check-proof
-- Проверим: `two_plus_two` действительно имеет тип «2 + 2 = 4».
#check two_plus_two
-- КОНЕЦ: check-proof

-- НАЧАЛО: rfl-fails
-- А вот неверное утверждение доказать нечем: `rfl` требует, чтобы обе
-- стороны вычислялись в одно и то же. Раскомментируй — увидишь ошибку.
-- theorem two_plus_two_wrong : 2 + 2 = 5 := rfl
-- КОНЕЦ: rfl-fails

-- НАЧАЛО: implication
-- Импликация — это функция: из доказательства A делаем доказательство B.
theorem id_impl (A : Prop) : A → A := fun hA => hA
-- КОНЕЦ: implication

-- НАЧАЛО: implication-tactic
-- То же самое на языке тактик. `intro` заносит посылку в контекст,
-- `exact` предъявляет готовое доказательство цели.
theorem id_impl' (A : Prop) : A → A := by
  intro hA
  exact hA
-- КОНЕЦ: implication-tactic

-- НАЧАЛО: transitivity
-- Из «A влечёт B» и «B влечёт C» следует «A влечёт C».
theorem impl_trans (A B C : Prop) (hAB : A → B) (hBC : B → C) : A → C := by
  intro hA
  exact hBC (hAB hA)
-- КОНЕЦ: transitivity

-- НАЧАЛО: exercise-swap
-- Упражнение: докажи, что порядок посылок неважен.
theorem swap_args (A B C : Prop) (h : A → B → C) : B → A → C := by
  intro hB hA
  exact h hA hB
-- КОНЕЦ: exercise-swap
