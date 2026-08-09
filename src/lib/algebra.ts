import {
  ExactRationalError,
  addExact,
  compareExact,
  divideExact,
  formatExactRussian,
  isExactZero,
  multiplyExact,
  negateExact,
  parseExact,
  subtractExact,
  type ExactInput,
  type ExactRational,
} from './exactRational';

export type BinaryOperator = 'add' | 'subtract' | 'multiply' | 'divide';

export interface LiteralExpression {
  readonly kind: 'literal';
  readonly value: ExactRational;
  readonly id: string;
}

export interface VariableExpression {
  readonly kind: 'variable';
  readonly name: string;
  readonly id: string;
}

export interface NegateExpression {
  readonly kind: 'negate';
  readonly operand: ExpressionNode;
  readonly id: string;
}

export interface BinaryExpression {
  readonly kind: 'binary';
  readonly operator: BinaryOperator;
  readonly left: ExpressionNode;
  readonly right: ExpressionNode;
  readonly id: string;
}

export type ExpressionNode =
  | LiteralExpression
  | VariableExpression
  | NegateExpression
  | BinaryExpression;

export type EvaluationReason =
  | 'substitute'
  | 'parentheses'
  | 'multiply-divide'
  | 'add-subtract';

export interface EvaluationStep {
  readonly nodeId: string;
  readonly reason: EvaluationReason;
  readonly before: string;
  readonly after: string;
}

export interface LinearForm {
  readonly coefficients: ReadonlyMap<string, ExactRational>;
  readonly constant: ExactRational;
}

export type AlgebraErrorCode =
  | 'missing-variable'
  | 'division-by-zero'
  | 'invalid-expression'
  | 'non-linear'
  | 'limit-exceeded';

export class AlgebraError extends Error {
  readonly code: AlgebraErrorCode;
  readonly position?: number;

  constructor(code: AlgebraErrorCode, message: string, position?: number) {
    super(message);
    this.name = 'AlgebraError';
    this.code = code;
    this.position = position;
  }
}

export type DeclaredVariables = readonly string[] | ReadonlySet<string>;
export type ExpressionEnvironment =
  | Readonly<Record<string, ExactInput>>
  | ReadonlyMap<string, ExactInput>;
export type ExpressionSource = string | ExpressionNode;

export const ALGEBRA_LIMITS = Object.freeze({
  maxSourceLength: 512,
  maxTokens: 256,
  maxNodes: 128,
  maxDepth: 32,
  maxNumericDigits: 96,
  maxIdentifierLength: 32,
  maxNodeIdLength: 64,
  maxDeclaredVariables: 64,
});

type TokenKind =
  | 'number'
  | 'identifier'
  | 'plus'
  | 'minus'
  | 'star'
  | 'slash'
  | 'left-parenthesis'
  | 'right-parenthesis'
  | 'end';

interface Token {
  readonly kind: TokenKind;
  readonly source: string;
  readonly position: number;
}

const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const groupedExpressions = new WeakMap<ExpressionNode, number>();

function expressionError(message: string, position?: number): never {
  throw new AlgebraError('invalid-expression', message, position);
}

function limitError(message: string, position?: number): never {
  throw new AlgebraError('limit-exceeded', message, position);
}

function exactErrorToAlgebra(error: unknown, fallbackMessage: string): never {
  if (error instanceof ExactRationalError) {
    if (error.code === 'division-by-zero') {
      throw new AlgebraError('division-by-zero', error.message);
    }
    if (error.code === 'limit-exceeded') {
      throw new AlgebraError('limit-exceeded', error.message);
    }
    throw new AlgebraError('invalid-expression', error.message);
  }
  throw error instanceof Error ? error : new AlgebraError('invalid-expression', fallbackMessage);
}

function tokenize(source: string): readonly Token[] {
  const tokens: Token[] = [];
  let position = 0;

  const push = (kind: TokenKind, tokenSource: string, tokenPosition: number): void => {
    tokens.push(Object.freeze({ kind, source: tokenSource, position: tokenPosition }));
    if (tokens.length > ALGEBRA_LIMITS.maxTokens) {
      limitError(`An expression may contain at most ${ALGEBRA_LIMITS.maxTokens} tokens.`, tokenPosition);
    }
  };

  while (position < source.length) {
    const character = source[position]!;
    if (/\s/.test(character)) {
      position += 1;
      continue;
    }

    const singleCharacterTokens: Partial<Record<string, TokenKind>> = {
      '+': 'plus',
      '-': 'minus',
      '*': 'star',
      '/': 'slash',
      '(': 'left-parenthesis',
      ')': 'right-parenthesis',
    };
    const singleKind = singleCharacterTokens[character];
    if (singleKind !== undefined) {
      push(singleKind, character, position);
      position += 1;
      continue;
    }

    if (/\d/.test(character) || character === '.' || character === ',') {
      const start = position;
      let digits = 0;

      while (position < source.length && /\d/.test(source[position]!)) {
        position += 1;
        digits += 1;
      }
      if (position < source.length && (source[position] === '.' || source[position] === ',')) {
        position += 1;
        while (position < source.length && /\d/.test(source[position]!)) {
          position += 1;
          digits += 1;
        }
      }

      if (digits === 0) {
        expressionError('A decimal separator must be followed by digits.', start);
      }
      if (digits > ALGEBRA_LIMITS.maxNumericDigits) {
        limitError(
          `A numeric literal may contain at most ${ALGEBRA_LIMITS.maxNumericDigits} digits.`,
          start,
        );
      }
      push('number', source.slice(start, position), start);
      continue;
    }

    if (/[A-Za-z]/.test(character)) {
      const start = position;
      position += 1;
      while (position < source.length && /[A-Za-z0-9_]/.test(source[position]!)) {
        position += 1;
      }
      const identifier = source.slice(start, position);
      if (identifier.length > ALGEBRA_LIMITS.maxIdentifierLength) {
        limitError(
          `A variable name may contain at most ${ALGEBRA_LIMITS.maxIdentifierLength} characters.`,
          start,
        );
      }
      push('identifier', identifier, start);
      continue;
    }

    expressionError(`Unexpected character "${character}".`, position);
  }

  tokens.push(Object.freeze({ kind: 'end', source: '', position: source.length }));
  return Object.freeze(tokens);
}

function normalizeDeclaredVariables(declaredVariables?: DeclaredVariables): ReadonlySet<string> | undefined {
  if (declaredVariables === undefined) {
    return undefined;
  }

  const names: string[] = [];
  for (const name of declaredVariables) {
    names.push(name);
    if (names.length > ALGEBRA_LIMITS.maxDeclaredVariables) {
      limitError(`At most ${ALGEBRA_LIMITS.maxDeclaredVariables} variables may be declared.`);
    }
  }

  for (const name of names) {
    if (!IDENTIFIER_PATTERN.test(name) || name.length > ALGEBRA_LIMITS.maxIdentifierLength) {
      expressionError(`Invalid declared variable name "${name}".`);
    }
  }

  return new Set(names);
}

class Parser {
  private index = 0;
  private nodeCount = 0;
  private nextNodeNumber = 1;
  private parenthesisDepth = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly declaredVariables: ReadonlySet<string> | undefined,
  ) {}

  parse(): ExpressionNode {
    if (this.current().kind === 'end') {
      expressionError('An expression cannot be empty.', this.current().position);
    }

    const expression = this.parseAddSubtract();
    const trailing = this.current();
    if (trailing.kind !== 'end') {
      expressionError(
        trailing.kind === 'identifier' || trailing.kind === 'number' || trailing.kind === 'left-parenthesis'
          ? 'Multiplication must be written explicitly with "*".'
          : `Unexpected token "${trailing.source}".`,
        trailing.position,
      );
    }
    return expression;
  }

  private current(): Token {
    return this.tokens[this.index]!;
  }

  private consume(kind: TokenKind): Token | null {
    const token = this.current();
    if (token.kind !== kind) {
      return null;
    }
    this.index += 1;
    return token;
  }

  private id(): string {
    this.nodeCount += 1;
    if (this.nodeCount > ALGEBRA_LIMITS.maxNodes) {
      limitError(`An expression may contain at most ${ALGEBRA_LIMITS.maxNodes} nodes.`);
    }
    const id = `n${this.nextNodeNumber}`;
    this.nextNodeNumber += 1;
    return id;
  }

  private parseAddSubtract(): ExpressionNode {
    let left = this.parseMultiplyDivide();
    while (this.current().kind === 'plus' || this.current().kind === 'minus') {
      const operator = this.current().kind === 'plus' ? 'add' : 'subtract';
      this.index += 1;
      const right = this.parseMultiplyDivide();
      left = Object.freeze({ kind: 'binary', operator, left, right, id: this.id() });
    }
    return left;
  }

  private parseMultiplyDivide(): ExpressionNode {
    let left = this.parseUnary();
    while (this.current().kind === 'star' || this.current().kind === 'slash') {
      const operator = this.current().kind === 'star' ? 'multiply' : 'divide';
      this.index += 1;
      const right = this.parseUnary();
      left = Object.freeze({ kind: 'binary', operator, left, right, id: this.id() });
    }
    return left;
  }

  private parseUnary(): ExpressionNode {
    if (this.consume('plus') !== null) {
      return this.parseUnary();
    }
    if (this.consume('minus') !== null) {
      const operand = this.parseUnary();
      return Object.freeze({ kind: 'negate', operand, id: this.id() });
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const token = this.current();
    if (this.consume('number') !== null) {
      try {
        return Object.freeze({ kind: 'literal', value: parseExact(token.source), id: this.id() });
      } catch (error) {
        return exactErrorToAlgebra(error, `Invalid numeric literal "${token.source}".`);
      }
    }

    if (this.consume('identifier') !== null) {
      if (this.declaredVariables !== undefined && !this.declaredVariables.has(token.source)) {
        expressionError(`Variable "${token.source}" was not declared.`, token.position);
      }
      return Object.freeze({ kind: 'variable', name: token.source, id: this.id() });
    }

    if (this.consume('left-parenthesis') !== null) {
      this.parenthesisDepth += 1;
      if (this.parenthesisDepth > ALGEBRA_LIMITS.maxDepth) {
        limitError(`Parentheses may be nested at most ${ALGEBRA_LIMITS.maxDepth} levels.`, token.position);
      }

      const expression = this.parseAddSubtract();
      if (this.consume('right-parenthesis') === null) {
        expressionError('A closing parenthesis is missing.', this.current().position);
      }
      this.parenthesisDepth -= 1;
      groupedExpressions.set(expression, (groupedExpressions.get(expression) ?? 0) + 1);
      return expression;
    }

    expressionError(
      token.kind === 'end' ? 'An operand is missing at the end of the expression.' : `Expected a number, variable, or "(" before "${token.source}".`,
      token.position,
    );
  }
}

export function parseExpression(source: string, declaredVariables?: DeclaredVariables): ExpressionNode {
  if (typeof source !== 'string') {
    expressionError('Expression source must be a string.');
  }
  if (source.length > ALGEBRA_LIMITS.maxSourceLength) {
    limitError(`An expression may contain at most ${ALGEBRA_LIMITS.maxSourceLength} characters.`);
  }

  const parser = new Parser(tokenize(source), normalizeDeclaredVariables(declaredVariables));
  const ast = parser.parse();
  assertValidAst(ast);
  return ast;
}

function assertValidAst(root: ExpressionNode): void {
  const active = new Set<object>();
  const nodeIds = new Set<string>();
  let nodes = 0;

  const visit = (node: ExpressionNode, depth: number): void => {
    if (typeof node !== 'object' || node === null) {
      expressionError('The expression tree contains an invalid node.');
    }
    if (depth > ALGEBRA_LIMITS.maxDepth) {
      limitError(`An expression tree may be at most ${ALGEBRA_LIMITS.maxDepth} levels deep.`);
    }
    nodes += 1;
    if (nodes > ALGEBRA_LIMITS.maxNodes) {
      limitError(`An expression tree may contain at most ${ALGEBRA_LIMITS.maxNodes} nodes.`);
    }
    if (active.has(node)) {
      expressionError('An expression tree cannot contain a cycle.');
    }
    if (
      typeof node.id !== 'string' ||
      node.id.length === 0 ||
      node.id.length > ALGEBRA_LIMITS.maxNodeIdLength
    ) {
      expressionError(
        `Every expression node must have an id between 1 and ${ALGEBRA_LIMITS.maxNodeIdLength} characters.`,
      );
    }
    if (nodeIds.has(node.id)) {
      expressionError(`Expression node id "${node.id}" is duplicated.`);
    }
    nodeIds.add(node.id);

    active.add(node);
    switch (node.kind) {
      case 'literal':
        try {
          parseExact(node.value);
        } catch (error) {
          exactErrorToAlgebra(error, 'The expression contains an invalid literal.');
        }
        break;
      case 'variable':
        if (!IDENTIFIER_PATTERN.test(node.name) || node.name.length > ALGEBRA_LIMITS.maxIdentifierLength) {
          expressionError(`Invalid variable name "${node.name}".`);
        }
        break;
      case 'negate':
        visit(node.operand, depth + 1);
        break;
      case 'binary':
        if (!(['add', 'subtract', 'multiply', 'divide'] as const).includes(node.operator)) {
          expressionError('The expression contains an unsupported binary operator.');
        }
        visit(node.left, depth + 1);
        visit(node.right, depth + 1);
        break;
      default:
        expressionError('The expression contains an unknown node kind.');
    }
    active.delete(node);
  };

  visit(root, 1);
}

function environmentValue(environment: ExpressionEnvironment, name: string): ExactRational {
  let input: ExactInput | undefined;
  let present = false;

  if (environment instanceof Map) {
    present = environment.has(name);
    input = environment.get(name);
  } else {
    const record = environment as Readonly<Record<string, ExactInput>>;
    present = Object.prototype.hasOwnProperty.call(record, name);
    input = present ? record[name] : undefined;
  }

  if (!present || input === undefined) {
    throw new AlgebraError('missing-variable', `A value for variable "${name}" is required.`);
  }

  try {
    return parseExact(input);
  } catch (error) {
    return exactErrorToAlgebra(error, `Invalid value for variable "${name}".`);
  }
}

function applyBinary(operator: BinaryOperator, left: ExactRational, right: ExactRational): ExactRational {
  try {
    switch (operator) {
      case 'add':
        return addExact(left, right);
      case 'subtract':
        return subtractExact(left, right);
      case 'multiply':
        return multiplyExact(left, right);
      case 'divide':
        return divideExact(left, right);
    }
  } catch (error) {
    return exactErrorToAlgebra(error, 'The expression could not be evaluated.');
  }
}

export function evaluateExpression(ast: ExpressionNode, environment: ExpressionEnvironment = {}): ExactRational {
  assertValidAst(ast);

  const evaluate = (node: ExpressionNode): ExactRational => {
    switch (node.kind) {
      case 'literal':
        return parseExact(node.value);
      case 'variable':
        return environmentValue(environment, node.name);
      case 'negate':
        return negateExact(evaluate(node.operand));
      case 'binary':
        return applyBinary(node.operator, evaluate(node.left), evaluate(node.right));
    }
  };

  return evaluate(ast);
}

function plainOperator(operator: BinaryOperator): string {
  switch (operator) {
    case 'add':
      return '+';
    case 'subtract':
      return '−';
    case 'multiply':
      return '·';
    case 'divide':
      return '÷';
  }
}

function tracedOperand(
  operand: TracedValue,
  operator: BinaryOperator,
  side: 'left' | 'right',
): string {
  const isNegative = operand.value.numerator < 0n;
  const needsParentheses =
    isNegative &&
    (side === 'right' || operator === 'multiply' || operator === 'divide');
  return needsParentheses ? `(${operand.text})` : operand.text;
}

interface TracedValue {
  readonly value: ExactRational;
  readonly text: string;
}

export function traceEvaluation(
  ast: ExpressionNode,
  environment: ExpressionEnvironment = {},
): readonly EvaluationStep[] {
  assertValidAst(ast);
  const steps: EvaluationStep[] = [];

  const trace = (node: ExpressionNode): TracedValue => {
    let result: TracedValue;

    switch (node.kind) {
      case 'literal': {
        const value = parseExact(node.value);
        result = { value, text: formatExactRussian(value) };
        break;
      }
      case 'variable': {
        const value = environmentValue(environment, node.name);
        const after = formatExactRussian(value);
        steps.push(Object.freeze({ nodeId: node.id, reason: 'substitute', before: node.name, after }));
        result = { value, text: after };
        break;
      }
      case 'negate': {
        const operand = trace(node.operand);
        const value = negateExact(operand.value);
        const before = `−(${operand.text})`;
        const after = formatExactRussian(value);
        steps.push(Object.freeze({ nodeId: node.id, reason: 'add-subtract', before, after }));
        result = { value, text: after };
        break;
      }
      case 'binary': {
        const left = trace(node.left);
        const right = trace(node.right);
        const value = applyBinary(node.operator, left.value, right.value);
        const before = `${tracedOperand(left, node.operator, 'left')} ${plainOperator(node.operator)} ${tracedOperand(right, node.operator, 'right')}`;
        const after = formatExactRussian(value);
        const reason: EvaluationReason =
          node.operator === 'multiply' || node.operator === 'divide'
            ? 'multiply-divide'
            : 'add-subtract';
        steps.push(Object.freeze({ nodeId: node.id, reason, before, after }));
        result = { value, text: after };
        break;
      }
    }

    const groupCount = groupedExpressions.get(node) ?? 0;
    for (let index = 0; index < groupCount; index += 1) {
      steps.push(
        Object.freeze({
          nodeId: node.id,
          reason: 'parentheses',
          before: `(${result.text})`,
          after: result.text,
        }),
      );
    }
    return result;
  };

  trace(ast);
  return Object.freeze(steps);
}

function exactLatex(value: ExactRational): string {
  const exact = parseExact(value);
  if (exact.denominator === 1n) {
    return exact.numerator.toString();
  }
  if (exact.numerator < 0n) {
    return `-\\frac{${(-exact.numerator).toString()}}{${exact.denominator.toString()}}`;
  }
  return `\\frac{${exact.numerator.toString()}}{${exact.denominator.toString()}}`;
}

function variableLatex(name: string): string {
  const letterWithIndex = /^([A-Za-z])(\d+)$/.exec(name);
  if (letterWithIndex) {
    return `${letterWithIndex[1]}_{${letterWithIndex[2]}}`;
  }
  if (/^[A-Za-z]$/.test(name)) {
    return name;
  }
  return `\\mathrm{${name.replace(/_/g, '\\_')}}`;
}

function precedence(node: ExpressionNode): number {
  if (node.kind === 'literal' || node.kind === 'variable') return 4;
  if (node.kind === 'negate') return 3;
  return node.operator === 'add' || node.operator === 'subtract' ? 1 : 2;
}

function wrapLatex(value: string, count = 1): string {
  let wrapped = value;
  for (let index = 0; index < count; index += 1) {
    wrapped = `\\left(${wrapped}\\right)`;
  }
  return wrapped;
}

function usesSchoolbookJuxtaposition(left: ExpressionNode, right: ExpressionNode): boolean {
  return (
    left.kind === 'literal' &&
    (right.kind === 'variable' || (groupedExpressions.get(right) ?? 0) > 0)
  );
}

function renderLatex(node: ExpressionNode, parent?: BinaryOperator | 'negate', side?: 'left' | 'right'): string {
  let rendered: string;

  switch (node.kind) {
    case 'literal':
      rendered = exactLatex(node.value);
      break;
    case 'variable':
      rendered = variableLatex(node.name);
      break;
    case 'negate':
      rendered = `-${renderLatex(node.operand, 'negate', 'right')}`;
      break;
    case 'binary':
      if (node.operator === 'divide') {
        rendered = `\\frac{${renderLatex(node.left)}}{${renderLatex(node.right)}}`;
      } else {
        const operator =
          node.operator === 'multiply'
            ? usesSchoolbookJuxtaposition(node.left, node.right)
              ? ''
              : '\\cdot'
            : node.operator === 'add'
              ? '+'
              : '-';
        const separator = operator === '' ? '' : ` ${operator} `;
        rendered = `${renderLatex(node.left, node.operator, 'left')}${separator}${renderLatex(node.right, node.operator, 'right')}`;
      }
      break;
  }

  const explicitGroups = groupedExpressions.get(node) ?? 0;
  if (explicitGroups > 0) {
    return wrapLatex(rendered, explicitGroups);
  }

  if (parent === undefined) {
    return rendered;
  }

  const nodePrecedence = precedence(node);
  const parentPrecedence = parent === 'negate' ? 3 : parent === 'add' || parent === 'subtract' ? 1 : 2;
  const requiresForPrecedence = nodePrecedence < parentPrecedence;
  const requiresOnRight =
    side === 'right' &&
    node.kind === 'binary' &&
    ((parent === 'subtract' && nodePrecedence === 1) ||
      (parent === 'multiply' && node.operator === 'divide'));
  const requiresAfterNegate = parent === 'negate' && nodePrecedence <= 3;
  const isWrittenNegative =
    node.kind === 'negate' || (node.kind === 'literal' && node.value.numerator < 0n);
  const requiresForSignedOperand =
    isWrittenNegative &&
    parent !== 'negate' &&
    parent !== 'divide' &&
    (side === 'right' || parent === 'multiply');
  return requiresForPrecedence || requiresOnRight || requiresAfterNegate || requiresForSignedOperand
    ? wrapLatex(rendered)
    : rendered;
}

export function formatExpressionLatex(ast: ExpressionNode): string {
  assertValidAst(ast);
  return renderLatex(ast);
}

function zeroLinearForm(): LinearForm {
  return Object.freeze({ coefficients: new Map<string, ExactRational>(), constant: parseExact(0) });
}

function normalizedLinearForm(
  coefficients: ReadonlyMap<string, ExactRational>,
  constant: ExactInput,
): LinearForm {
  const normalizedEntries = Array.from(coefficients.entries())
    .filter(([, coefficient]) => !isExactZero(coefficient))
    .sort(([left], [right]) => left.localeCompare(right));
  return Object.freeze({
    coefficients: new Map(normalizedEntries),
    constant: parseExact(constant),
  });
}

function combineLinearForms(left: LinearForm, right: LinearForm, subtract: boolean): LinearForm {
  const coefficients = new Map(left.coefficients);
  for (const [name, rightCoefficient] of right.coefficients) {
    const current = coefficients.get(name) ?? parseExact(0);
    coefficients.set(
      name,
      subtract ? subtractExact(current, rightCoefficient) : addExact(current, rightCoefficient),
    );
  }
  return normalizedLinearForm(
    coefficients,
    subtract ? subtractExact(left.constant, right.constant) : addExact(left.constant, right.constant),
  );
}

function scaleLinearForm(form: LinearForm, scalar: ExactRational): LinearForm {
  const coefficients = new Map<string, ExactRational>();
  for (const [name, coefficient] of form.coefficients) {
    coefficients.set(name, multiplyExact(coefficient, scalar));
  }
  return normalizedLinearForm(coefficients, multiplyExact(form.constant, scalar));
}

function nonLinear(message: string): never {
  throw new AlgebraError('non-linear', message);
}

export function linearizeExpression(ast: ExpressionNode): LinearForm {
  assertValidAst(ast);

  const linearize = (node: ExpressionNode): LinearForm => {
    switch (node.kind) {
      case 'literal':
        return normalizedLinearForm(new Map(), node.value);
      case 'variable':
        return normalizedLinearForm(new Map([[node.name, parseExact(1)]]), 0);
      case 'negate':
        return scaleLinearForm(linearize(node.operand), parseExact(-1));
      case 'binary': {
        const left = linearize(node.left);
        const right = linearize(node.right);
        if (node.operator === 'add') return combineLinearForms(left, right, false);
        if (node.operator === 'subtract') return combineLinearForms(left, right, true);

        if (node.operator === 'multiply') {
          const leftIsConstant = left.coefficients.size === 0;
          const rightIsConstant = right.coefficients.size === 0;
          if (!leftIsConstant && !rightIsConstant) {
            return nonLinear('A product of two variable expressions is not linear.');
          }
          return leftIsConstant
            ? scaleLinearForm(right, left.constant)
            : scaleLinearForm(left, right.constant);
        }

        if (right.coefficients.size !== 0) {
          return nonLinear('Division by an expression containing a variable is not linear.');
        }
        if (isExactZero(right.constant)) {
          throw new AlgebraError('division-by-zero', 'Division by zero is undefined.');
        }
        return scaleLinearForm(left, divideExact(1, right.constant));
      }
    }
  };

  try {
    return linearize(ast);
  } catch (error) {
    if (error instanceof AlgebraError) throw error;
    return exactErrorToAlgebra(error, 'The expression could not be linearized.');
  }
}

export function equivalentLinearExpressions(
  left: ExpressionSource,
  right: ExpressionSource,
  declaredVariables?: DeclaredVariables,
): boolean {
  const leftAst = typeof left === 'string' ? parseExpression(left, declaredVariables) : left;
  const rightAst = typeof right === 'string' ? parseExpression(right, declaredVariables) : right;
  const leftForm = linearizeExpression(leftAst);
  const rightForm = linearizeExpression(rightAst);

  if (compareExact(leftForm.constant, rightForm.constant) !== 0) return false;
  const names = new Set([...leftForm.coefficients.keys(), ...rightForm.coefficients.keys()]);
  for (const name of names) {
    const leftCoefficient = leftForm.coefficients.get(name) ?? parseExact(0);
    const rightCoefficient = rightForm.coefficients.get(name) ?? parseExact(0);
    if (compareExact(leftCoefficient, rightCoefficient) !== 0) return false;
  }
  return true;
}

export function collectExpressionVariables(ast: ExpressionNode): readonly string[] {
  assertValidAst(ast);
  const names = new Set<string>();
  const collect = (node: ExpressionNode): void => {
    if (node.kind === 'variable') names.add(node.name);
    else if (node.kind === 'negate') collect(node.operand);
    else if (node.kind === 'binary') {
      collect(node.left);
      collect(node.right);
    }
  };
  collect(ast);
  return Object.freeze(Array.from(names).sort());
}

export function emptyLinearForm(): LinearForm {
  return zeroLinearForm();
}
