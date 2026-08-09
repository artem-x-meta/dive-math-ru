import {
  addExact,
  compareExact,
  divideExact,
  formatExactRussian,
  isExactZero,
  multiplyExact,
  negateExact,
  parseExact,
  subtractExact,
  toExactNumber,
  type ExactInput,
  type ExactRational,
} from './exactRational';

export type LinearErrorCode = 'invalid-input' | 'degenerate';

export class LinearError extends Error {
  readonly code: LinearErrorCode;

  constructor(code: LinearErrorCode, message: string) {
    super(message);
    this.name = 'LinearError';
    this.code = code;
  }
}

const ZERO = parseExact(0);
const ONE = parseExact(1);
const MINUS_ONE = parseExact(-1);

function absExact(value: ExactRational): ExactRational {
  return compareExact(value, ZERO) < 0 ? negateExact(value) : value;
}

function gcdBigInt(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const rest = a % b;
    a = b;
    b = rest;
  }
  return a;
}

/**
 * Наибольший общий делитель двух рациональных чисел: НОД числителей, делённый
 * на НОК знаменателей. Для целых совпадает с обычным НОД, а gcd(0, a) = |a|.
 */
export function exactGcd(left: ExactInput, right: ExactInput): ExactRational {
  const a = parseExact(left);
  const b = parseExact(right);
  const numerator = gcdBigInt(a.numerator, b.numerator);
  if (numerator === 0n) return ZERO;
  const denominator = (a.denominator / gcdBigInt(a.denominator, b.denominator)) * b.denominator;
  return parseExact({ numerator, denominator });
}

// ───────────────────────────── Линейное выражение kx + b ─────────────────────

/** Линейное выражение одной переменной: slope · x + intercept. */
export interface LinearExpression {
  readonly slope: ExactRational;
  readonly intercept: ExactRational;
}

/** Уравнение вида «левое линейное выражение = правое линейное выражение». */
export interface LinearEquation {
  readonly left: LinearExpression;
  readonly right: LinearExpression;
}

export type LinearSolution =
  | { readonly kind: 'unique'; readonly value: ExactRational }
  | { readonly kind: 'none' }
  | { readonly kind: 'identity' };

export function linearExpression(slope: ExactInput, intercept: ExactInput): LinearExpression {
  return Object.freeze({ slope: parseExact(slope), intercept: parseExact(intercept) });
}

export function linearEquation(left: LinearExpression, right: LinearExpression): LinearEquation {
  return Object.freeze({ left, right });
}

/** Значение выражения kx + b в точке x. */
export function evaluateLinear(expression: LinearExpression, x: ExactInput): ExactRational {
  return addExact(multiplyExact(expression.slope, parseExact(x)), expression.intercept);
}

/** Проверяет, обращает ли число уравнение в верное числовое равенство. */
export function satisfiesEquation(equation: LinearEquation, x: ExactInput): boolean {
  return compareExact(evaluateLinear(equation.left, x), evaluateLinear(equation.right, x)) === 0;
}

/** Приводит уравнение к виду ax = b и возвращает пару (a; b). */
export function normalizedEquation(equation: LinearEquation): LinearExpression {
  return Object.freeze({
    slope: subtractExact(equation.left.slope, equation.right.slope),
    intercept: subtractExact(equation.right.intercept, equation.left.intercept),
  });
}

/** Решает линейное уравнение с одной переменной. */
export function solveLinearEquation(equation: LinearEquation): LinearSolution {
  const { slope, intercept } = normalizedEquation(equation);
  if (!isExactZero(slope)) {
    return Object.freeze({ kind: 'unique' as const, value: divideExact(intercept, slope) });
  }
  return isExactZero(intercept)
    ? Object.freeze({ kind: 'identity' as const })
    : Object.freeze({ kind: 'none' as const });
}

/** Равносильны ли уравнения, то есть совпадают ли их множества корней. */
export function equivalentEquations(first: LinearEquation, second: LinearEquation): boolean {
  const left = solveLinearEquation(first);
  const right = solveLinearEquation(second);
  if (left.kind !== right.kind) return false;
  if (left.kind === 'unique' && right.kind === 'unique') {
    return compareExact(left.value, right.value) === 0;
  }
  return true;
}

// ───────────────────────────── Запись формул ─────────────────────────────────

/** Точная запись числа для KaTeX: целое или обыкновенная дробь. */
export function formatExactLatex(input: ExactInput): string {
  const value = parseExact(input);
  if (value.denominator === 1n) return value.numerator.toString();
  const negative = value.numerator < 0n;
  const numerator = negative ? -value.numerator : value.numerator;
  return `${negative ? '-' : ''}\\frac{${numerator.toString()}}{${value.denominator.toString()}}`;
}

/** Читаемая запись числа для текста интерфейса: с запятой и минусом «−». */
export function formatExactText(input: ExactInput): string {
  return formatExactRussian(input);
}

function termLatex(coefficient: ExactRational, variable: string): string {
  if (isExactZero(coefficient)) return '';
  if (compareExact(coefficient, ONE) === 0) return variable;
  if (compareExact(coefficient, MINUS_ONE) === 0) return `-${variable}`;
  return `${formatExactLatex(coefficient)}${variable}`;
}

/** Запись выражения kx + b без лишних единиц, нулей и плюсов перед минусом. */
export function formatLinearLatex(expression: LinearExpression, variable = 'x'): string {
  if (isExactZero(expression.slope)) return formatExactLatex(expression.intercept);
  const head = termLatex(expression.slope, variable);
  if (isExactZero(expression.intercept)) return head;
  const negative = compareExact(expression.intercept, ZERO) < 0;
  const magnitude = negative ? negateExact(expression.intercept) : expression.intercept;
  return `${head} ${negative ? '-' : '+'} ${formatExactLatex(magnitude)}`;
}

function termText(coefficient: ExactRational, variable: string): string {
  if (isExactZero(coefficient)) return '';
  if (compareExact(coefficient, ONE) === 0) return variable;
  if (compareExact(coefficient, MINUS_ONE) === 0) return `−${variable}`;
  return `${formatExactRussian(coefficient)}${variable}`;
}

/** Запись выражения kx + b обычным текстом (для интерфейса лабораторий). */
export function formatLinearText(expression: LinearExpression, variable = 'x'): string {
  if (isExactZero(expression.slope)) return formatExactRussian(expression.intercept);
  const head = termText(expression.slope, variable);
  if (isExactZero(expression.intercept)) return head;
  const negative = compareExact(expression.intercept, ZERO) < 0;
  const magnitude = negative ? negateExact(expression.intercept) : expression.intercept;
  return `${head} ${negative ? '−' : '+'} ${formatExactRussian(magnitude)}`;
}

export function formatEquationText(equation: LinearEquation, variable = 'x'): string {
  return `${formatLinearText(equation.left, variable)} = ${formatLinearText(equation.right, variable)}`;
}

export function formatTwoVariableText(equation: TwoVariableEquation, xName = 'x', yName = 'y'): string {
  const parts: string[] = [];
  if (!isExactZero(equation.a)) parts.push(termText(equation.a, xName));
  if (!isExactZero(equation.b)) {
    const negative = compareExact(equation.b, ZERO) < 0;
    const magnitude = negative ? negateExact(equation.b) : equation.b;
    const term = termText(magnitude, yName);
    parts.push(parts.length === 0 ? (negative ? `−${term}` : term) : `${negative ? '−' : '+'} ${term}`);
  }
  const left = parts.length === 0 ? '0' : parts.join(' ');
  return `${left} = ${formatExactRussian(equation.c)}`;
}

/** Человекочитаемый ответ системы. */
export function describeSystemSolution(solution: SystemSolution): string {
  if (solution.kind === 'unique') {
    return `(${formatExactRussian(solution.x)}; ${formatExactRussian(solution.y)})`;
  }
  return solution.kind === 'none' ? 'решений нет' : 'бесконечно много решений';
}

export function formatEquationLatex(equation: LinearEquation, variable = 'x'): string {
  return `${formatLinearLatex(equation.left, variable)} = ${formatLinearLatex(equation.right, variable)}`;
}

/** Запись линейной функции: y = kx + b. */
export function formatFunctionLatex(expression: LinearExpression, variable = 'x', name = 'y'): string {
  return `${name} = ${formatLinearLatex(expression, variable)}`;
}

// ───────────────────────────── Равносильные шаги ─────────────────────────────

export type EquationStepKind =
  | 'start'
  | 'collect-variable'
  | 'collect-constant'
  | 'divide'
  | 'conclusion';

export interface EquationStep {
  readonly kind: EquationStepKind;
  readonly rule: string;
  readonly latex: string;
  readonly equation: LinearEquation | null;
}

/**
 * Цепочка равносильных преобразований: перенос слагаемых с переменной,
 * перенос чисел, деление на коэффициент и вывод о числе корней.
 */
export function solveLinearEquationSteps(equation: LinearEquation, variable = 'x'): readonly EquationStep[] {
  const steps: EquationStep[] = [];
  const push = (kind: EquationStepKind, rule: string, latex: string, next: LinearEquation | null = null) => {
    steps.push(Object.freeze({ kind, rule, latex, equation: next }));
  };

  push('start', 'Исходное уравнение', formatEquationLatex(equation, variable), equation);

  const { slope, intercept } = normalizedEquation(equation);

  if (!isExactZero(equation.right.slope)) {
    const moved = linearEquation(
      linearExpression(slope, equation.left.intercept),
      linearExpression(0, equation.right.intercept),
    );
    push(
      'collect-variable',
      `Переносим слагаемые с ${variable} влево и меняем у них знак`,
      formatEquationLatex(moved, variable),
      moved,
    );
  }

  if (!isExactZero(equation.left.intercept)) {
    const moved = linearEquation(linearExpression(slope, 0), linearExpression(0, intercept));
    push(
      'collect-constant',
      'Переносим числа вправо и меняем у них знак',
      formatEquationLatex(moved, variable),
      moved,
    );
  }

  if (!isExactZero(slope)) {
    const root = divideExact(intercept, slope);
    push(
      'divide',
      `Делим обе части на коэффициент ${formatExactLatex(slope)}`,
      `${variable} = ${formatExactLatex(root)}`,
      linearEquation(linearExpression(1, 0), linearExpression(0, root)),
    );
    push('conclusion', 'Единственный корень', `${variable} = ${formatExactLatex(root)}`);
    return Object.freeze(steps);
  }

  if (isExactZero(intercept)) {
    push('conclusion', 'Верно при любом значении переменной', `0 \\cdot ${variable} = 0`);
  } else {
    push('conclusion', 'Корней нет', `0 \\cdot ${variable} = ${formatExactLatex(intercept)}`);
  }
  return Object.freeze(steps);
}

/** Человекочитаемый ответ уравнения. */
export function describeSolution(solution: LinearSolution, variable = 'x'): string {
  if (solution.kind === 'unique') return `${variable} = ${formatExactText(solution.value)}`;
  if (solution.kind === 'identity') return 'корень — любое число';
  return 'корней нет';
}

// ───────────────────────────── Линейная функция ──────────────────────────────

export type SlopeBehaviour = 'increasing' | 'decreasing' | 'constant';

export function slopeBehaviour(expression: LinearExpression): SlopeBehaviour {
  const sign = compareExact(expression.slope, ZERO);
  return sign > 0 ? 'increasing' : sign < 0 ? 'decreasing' : 'constant';
}

/** Абсцисса точки пересечения графика с осью x, если она существует. */
export function xIntercept(expression: LinearExpression): ExactRational | null {
  if (isExactZero(expression.slope)) return null;
  return divideExact(negateExact(expression.intercept), expression.slope);
}

export interface LinearTableRow {
  readonly x: ExactRational;
  readonly y: ExactRational;
}

export function linearTable(expression: LinearExpression, xs: readonly ExactInput[]): readonly LinearTableRow[] {
  return Object.freeze(xs.map((x) => {
    const exactX = parseExact(x);
    return Object.freeze({ x: exactX, y: evaluateLinear(expression, exactX) });
  }));
}

/** Прямая через две точки в виде y = kx + b; для вертикальной прямой — null. */
export function lineThroughPoints(
  x1: ExactInput,
  y1: ExactInput,
  x2: ExactInput,
  y2: ExactInput,
): LinearExpression | null {
  const ax = parseExact(x1);
  const ay = parseExact(y1);
  const bx = parseExact(x2);
  const by = parseExact(y2);
  if (compareExact(ax, bx) === 0) {
    if (compareExact(ay, by) === 0) {
      throw new LinearError('degenerate', 'Через одну точку проходит бесконечно много прямых');
    }
    return null;
  }
  const slope = divideExact(subtractExact(by, ay), subtractExact(bx, ax));
  return linearExpression(slope, subtractExact(ay, multiplyExact(slope, ax)));
}

export type LinesRelation =
  | { readonly kind: 'point'; readonly x: ExactRational; readonly y: ExactRational }
  | { readonly kind: 'parallel' }
  | { readonly kind: 'same' };

/** Пересечение двух прямых, заданных в виде y = kx + b. */
export function intersectLines(first: LinearExpression, second: LinearExpression): LinesRelation {
  if (compareExact(first.slope, second.slope) === 0) {
    return compareExact(first.intercept, second.intercept) === 0
      ? Object.freeze({ kind: 'same' as const })
      : Object.freeze({ kind: 'parallel' as const });
  }
  const x = divideExact(
    subtractExact(second.intercept, first.intercept),
    subtractExact(first.slope, second.slope),
  );
  return Object.freeze({ kind: 'point' as const, x, y: evaluateLinear(first, x) });
}

// ───────────────────────── Системы двух уравнений ────────────────────────────

/** Уравнение с двумя переменными в виде ax + by = c. */
export interface TwoVariableEquation {
  readonly a: ExactRational;
  readonly b: ExactRational;
  readonly c: ExactRational;
}

export type SystemSolution =
  | { readonly kind: 'unique'; readonly x: ExactRational; readonly y: ExactRational }
  | { readonly kind: 'none' }
  | { readonly kind: 'infinite' };

export function twoVariableEquation(a: ExactInput, b: ExactInput, c: ExactInput): TwoVariableEquation {
  return Object.freeze({ a: parseExact(a), b: parseExact(b), c: parseExact(c) });
}

function isImpossible(equation: TwoVariableEquation): boolean {
  return isExactZero(equation.a) && isExactZero(equation.b) && !isExactZero(equation.c);
}

/** Проверяет, обращается ли уравнение в верное равенство в точке (x; y). */
export function satisfiesTwoVariable(equation: TwoVariableEquation, x: ExactInput, y: ExactInput): boolean {
  const left = addExact(multiplyExact(equation.a, parseExact(x)), multiplyExact(equation.b, parseExact(y)));
  return compareExact(left, equation.c) === 0;
}

/** Решает систему методом определителей; результат тот же, что у подстановки. */
export function solveSystem(first: TwoVariableEquation, second: TwoVariableEquation): SystemSolution {
  if (isImpossible(first) || isImpossible(second)) return Object.freeze({ kind: 'none' as const });

  const determinant = subtractExact(
    multiplyExact(first.a, second.b),
    multiplyExact(second.a, first.b),
  );
  const determinantX = subtractExact(
    multiplyExact(first.c, second.b),
    multiplyExact(second.c, first.b),
  );
  const determinantY = subtractExact(
    multiplyExact(first.a, second.c),
    multiplyExact(second.a, first.c),
  );

  if (!isExactZero(determinant)) {
    return Object.freeze({
      kind: 'unique' as const,
      x: divideExact(determinantX, determinant),
      y: divideExact(determinantY, determinant),
    });
  }
  return isExactZero(determinantX) && isExactZero(determinantY)
    ? Object.freeze({ kind: 'infinite' as const })
    : Object.freeze({ kind: 'none' as const });
}

export function isVerticalLine(equation: TwoVariableEquation): boolean {
  return isExactZero(equation.b) && !isExactZero(equation.a);
}

/** Переводит ax + by = c в вид y = kx + b; для вертикальной прямой — null. */
export function toSlopeIntercept(equation: TwoVariableEquation): LinearExpression | null {
  if (isExactZero(equation.b)) return null;
  return linearExpression(
    divideExact(negateExact(equation.a), equation.b),
    divideExact(equation.c, equation.b),
  );
}

export function formatTwoVariableLatex(equation: TwoVariableEquation, xName = 'x', yName = 'y'): string {
  const parts: string[] = [];
  if (!isExactZero(equation.a)) parts.push(termLatex(equation.a, xName));
  if (!isExactZero(equation.b)) {
    const negative = compareExact(equation.b, ZERO) < 0;
    const magnitude = negative ? negateExact(equation.b) : equation.b;
    const term = termLatex(magnitude, yName);
    parts.push(parts.length === 0 ? (negative ? `-${term}` : term) : `${negative ? '-' : '+'} ${term}`);
  }
  const left = parts.length === 0 ? '0' : parts.join(' ');
  return `${left} = ${formatExactLatex(equation.c)}`;
}

export type EliminationVariable = 'x' | 'y';

export interface EliminationPlan {
  readonly variable: EliminationVariable;
  readonly firstFactor: ExactRational;
  readonly secondFactor: ExactRational;
  readonly scaledFirst: TwoVariableEquation;
  readonly scaledSecond: TwoVariableEquation;
  readonly combined: TwoVariableEquation;
}

function scaleEquation(equation: TwoVariableEquation, factor: ExactRational): TwoVariableEquation {
  return Object.freeze({
    a: multiplyExact(equation.a, factor),
    b: multiplyExact(equation.b, factor),
    c: multiplyExact(equation.c, factor),
  });
}

function addEquations(first: TwoVariableEquation, second: TwoVariableEquation): TwoVariableEquation {
  return Object.freeze({
    a: addExact(first.a, second.a),
    b: addExact(first.b, second.b),
    c: addExact(first.c, second.c),
  });
}

/**
 * Множители для способа сложения: наименьшие по модулю, при которых выбранная
 * переменная исчезает после почленного сложения уравнений.
 */
export function eliminationPlan(
  first: TwoVariableEquation,
  second: TwoVariableEquation,
  variable: EliminationVariable = 'x',
): EliminationPlan {
  const firstCoefficient = variable === 'x' ? first.a : first.b;
  const secondCoefficient = variable === 'x' ? second.a : second.b;

  let firstFactor = ONE;
  let secondFactor = ZERO;

  if (isExactZero(firstCoefficient)) {
    // Переменной уже нет в первом уравнении — складывать не нужно.
    firstFactor = ONE;
    secondFactor = ZERO;
  } else if (isExactZero(secondCoefficient)) {
    // Переменной нет во втором уравнении: берём именно его.
    firstFactor = ZERO;
    secondFactor = ONE;
  } else {
    const divisor = exactGcd(firstCoefficient, secondCoefficient);
    const positive = compareExact(secondCoefficient, ZERO) > 0;
    firstFactor = divideExact(absExact(secondCoefficient), divisor);
    const scaled = divideExact(firstCoefficient, divisor);
    secondFactor = positive ? negateExact(scaled) : scaled;
  }

  const scaledFirst = scaleEquation(first, firstFactor);
  const scaledSecond = scaleEquation(second, secondFactor);
  return Object.freeze({
    variable,
    firstFactor,
    secondFactor,
    scaledFirst,
    scaledSecond,
    combined: addEquations(scaledFirst, scaledSecond),
  });
}

export interface SubstitutionPlan {
  /** Из какого уравнения выражали переменную. */
  readonly source: 1 | 2;
  /** Какую переменную выразили. */
  readonly expressed: EliminationVariable;
  /** Выражение через вторую переменную. */
  readonly expression: LinearExpression;
  /** Уравнение с одной оставшейся переменной. */
  readonly reduced: LinearEquation;
  /** Оставшаяся переменная в сокращённом уравнении. */
  readonly reducedVariable: EliminationVariable;
  readonly solution: SystemSolution;
}

interface SubstitutionCandidate {
  readonly source: 1 | 2;
  readonly expressed: EliminationVariable;
  readonly coefficient: ExactRational;
}

/**
 * План решения способом подстановки: выражаем переменную с самым простым
 * коэффициентом и подставляем во второе уравнение.
 */
export function substitutionPlan(
  first: TwoVariableEquation,
  second: TwoVariableEquation,
): SubstitutionPlan {
  const candidates: readonly SubstitutionCandidate[] = [
    { source: 1, expressed: 'y', coefficient: first.b },
    { source: 2, expressed: 'y', coefficient: second.b },
    { source: 1, expressed: 'x', coefficient: first.a },
    { source: 2, expressed: 'x', coefficient: second.a },
  ];
  const usable = candidates.filter((candidate) => !isExactZero(candidate.coefficient));
  if (usable.length === 0) {
    throw new LinearError('degenerate', 'В системе нет ни одной переменной с ненулевым коэффициентом');
  }
  const chosen = usable.find((candidate) => compareExact(absExact(candidate.coefficient), ONE) === 0) ?? usable[0]!;

  const sourceEquation = chosen.source === 1 ? first : second;
  const otherEquation = chosen.source === 1 ? second : first;
  const reducedVariable: EliminationVariable = chosen.expressed === 'y' ? 'x' : 'y';

  // Выражаем: expressed = slope · reducedVariable + intercept.
  const otherCoefficient = chosen.expressed === 'y' ? sourceEquation.a : sourceEquation.b;
  const expression = linearExpression(
    divideExact(negateExact(otherCoefficient), chosen.coefficient),
    divideExact(sourceEquation.c, chosen.coefficient),
  );

  // Подставляем во второе уравнение.
  const keptCoefficient = reducedVariable === 'x' ? otherEquation.a : otherEquation.b;
  const replacedCoefficient = chosen.expressed === 'y' ? otherEquation.b : otherEquation.a;
  const reduced = linearEquation(
    linearExpression(
      addExact(keptCoefficient, multiplyExact(replacedCoefficient, expression.slope)),
      multiplyExact(replacedCoefficient, expression.intercept),
    ),
    linearExpression(0, otherEquation.c),
  );

  return Object.freeze({
    source: chosen.source,
    expressed: chosen.expressed,
    expression,
    reduced,
    reducedVariable,
    solution: solveSystem(first, second),
  });
}

// ───────────────────────── Геометрия рисунка ─────────────────────────────────

export interface Segment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/**
 * Отсекает прямую y = kx + b по квадрату [-extent; extent] по обеим осям.
 * Возвращает null, если внутри квадрата прямой не видно.
 */
export function clipLineToBox(slope: number, intercept: number, extent: number): Segment | null {
  if (!Number.isFinite(slope) || !Number.isFinite(intercept) || !(extent > 0)) return null;

  if (slope === 0) {
    if (Math.abs(intercept) > extent) return null;
    return Object.freeze({ x1: -extent, y1: intercept, x2: extent, y2: intercept });
  }

  const boundaryLow = (-extent - intercept) / slope;
  const boundaryHigh = (extent - intercept) / slope;
  const from = Math.max(-extent, Math.min(boundaryLow, boundaryHigh));
  const to = Math.min(extent, Math.max(boundaryLow, boundaryHigh));
  if (from > to) return null;
  return Object.freeze({
    x1: from,
    y1: slope * from + intercept,
    x2: to,
    y2: slope * to + intercept,
  });
}

/** Отсекает вертикальную прямую x = value по тому же квадрату. */
export function clipVerticalToBox(value: number, extent: number): Segment | null {
  if (!Number.isFinite(value) || !(extent > 0) || Math.abs(value) > extent) return null;
  return Object.freeze({ x1: value, y1: -extent, x2: value, y2: extent });
}

/** Приближённое числовое значение точной дроби — только для координат рисунка. */
export function approximate(value: ExactInput): number {
  return toExactNumber(value);
}
