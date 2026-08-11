/-
Проверка, что Mathlib подключён и собирается.

Файл не используется страницами курса — он нужен только затем, чтобы
поломка зависимости обнаружилась сразу, а не в главе, где Mathlib
понадобится по-настоящему.
-/
import Mathlib.Data.Real.Basic
import Mathlib.Tactic.Ring
import Mathlib.Tactic.Linarith

-- Тактика `ring` из Mathlib: тождество раскрывается автоматически.
example (a b : ℤ) : (a + b) ^ 2 = a ^ 2 + 2 * a * b + b ^ 2 := by ring

-- Тактика `linarith`: линейные неравенства.
example (x : ℝ) (h : x > 3) : x + 1 > 4 := by linarith
