/-
Корень библиотеки курса.

Каждая глава обязана быть здесь: `lake build` собирает именно этот
модуль, и только перечисленное тут проверяется в CI. Забудешь импорт —
файл главы останется непроверенным, а страницы курса будут ссылаться
на код, который никто не компилировал.
-/
import DiveLean.Basic
import DiveLean.Ch01.Basics
import DiveLean.Ch01.MathlibSmoke
import DiveLean.Ch02.Connectives
import DiveLean.Ch03.Quantifiers
import DiveLean.Ch04.Rewriting
import DiveLean.Ch05.Numbers
import DiveLean.Ch06.Induction
