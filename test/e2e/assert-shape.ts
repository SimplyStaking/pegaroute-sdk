/**
 * Strict-shape check for e2e responses: flags keys the API returns that our types don't declare, required keys it
 * leaves out, and `null`s where the type says never-null (type drift).
 *
 * Types are erased at runtime, so each type gets a hand-written key manifest checked by tsc:
 * `const x = { … } satisfies Shape<T>` fails to compile when the manifest misses one of T's keys, lists an extra one,
 * or doesn't mark a field `optional(…)` / `nullable(…)` exactly as T declares it.
 */

/**
 * What to expect for a present, non-null value:
 * - `true`: any value; don't look inside (scalars, and loosely typed records such as `metadata`).
 * - an object: check the value's keys against it, recursively.
 * - `[shape]`: an array; check every element against `shape`.
 * - a function: picks the shape from the value itself, for unions (e.g. `execution`, by `family` + `mode`).
 */
export type ValueShape = true | ObjectShape | readonly [FieldShape] | ((value: never) => FieldShape);

/**
 * A field declared `field?: T`: it may be absent. Made by {@link optional}.
 * `S` records whether it wraps `nullable(…)`, so `Shape<T>` can check that too.
 */
export interface OptionalShape<S extends ValueShape | NullableShape = ValueShape | NullableShape> {
  readonly marker: "optional";

  /** The shape when present. */
  readonly shape: S;
}

/** A field declared `T | null`: it may be `null`. Made by {@link nullable}. */
export interface NullableShape {
  readonly marker: "nullable";

  /** The shape when not `null`. */
  readonly shape: ValueShape;
}

/** What to expect for one field: a value shape, or one wrapped in `optional(…)` and/or `nullable(…)`. */
export type FieldShape = ValueShape | OptionalShape | NullableShape;

/** The expected keys of an object. */
export interface ObjectShape {
  readonly [key: string]: FieldShape;
}

/**
 * Marks a field declared `field?: T`. Wrap `nullable(…)` inside it for `field?: T | null`.
 * Overloads, not a default type argument: TypeScript would infer `S` from where the result goes and accept anything.
 */
export function optional(): OptionalShape<true>;
export function optional<S extends ValueShape | NullableShape>(shape: S): OptionalShape<S>;
export function optional(shape: ValueShape | NullableShape = true): OptionalShape {
  return { marker: "optional", shape };
}

/** Marks a field declared `T | null`. */
export function nullable(shape: ValueShape = true): NullableShape {
  return { marker: "nullable", shape };
}

/** The marker a value type needs: `nullable(…)` when it includes `null`, otherwise a plain value shape. */
type NullMarker<V> = null extends V ? NullableShape : ValueShape;

/**
 * Exactly the keys of `T`, optional ones included, each with the marker its declaration needs:
 * `field?: T` → `optional(…)`, `T | null` → `nullable(…)`, `field?: T | null` → `optional(nullable(…))`.
 */
export type Shape<T> = {
  readonly [K in keyof Required<T>]: Partial<Pick<T, K>> extends Pick<T, K>
    ? OptionalShape<NullMarker<Exclude<T[K], undefined>>>
    : NullMarker<T[K]>;
};

/**
 * Throws if `value` doesn't match `shape`, listing every problem with its path: undeclared keys, missing required
 * keys, and unexpected `null`s.
 *
 * @example
 * assertShape(await pr.chains.list(), chainsResponseShape);
 */
export function assertShape(value: unknown, shape: FieldShape, path = "response"): void {
  const problems = collectProblems(value, shape, path);

  if (problems.length > 0) {
    throw new Error(`Response doesn't match the SDK types:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
  }
}

/** Walks `value` alongside `shape` and returns every mismatch, each prefixed with its path. */
function collectProblems(value: unknown, shape: FieldShape, path: string): string[] {
  // Absent: only allowed for `optional(…)` fields. (JSON has no `undefined`, so this means the key is missing.)
  if (isMarker(shape, "optional")) return value === undefined ? [] : collectProblems(value, shape.shape, path);
  if (value === undefined) return [`${path}: missing, but the type says it's required`];

  // `null`: only allowed for `nullable(…)` fields.
  if (isMarker(shape, "nullable")) return value === null ? [] : collectProblems(value, shape.shape, path);
  if (value === null) return [`${path}: null, but the type says it's never null`];

  // Nothing to look inside.
  if (shape === true) return [];

  // A union: let the value pick its shape.
  if (typeof shape === "function") return collectProblems(value, shape(value as never), path);

  // An array: every element has the same shape.
  if (Array.isArray(shape)) {
    if (!Array.isArray(value)) return [];

    return value.flatMap((item, index) => collectProblems(item, shape[0] as FieldShape, `${path}[${index}]`));
  }

  // An object: report keys the shape doesn't know, then check every key it declares (present or not).
  if (typeof value !== "object") return [];

  const objectShape = shape as ObjectShape;
  const record = value as Record<string, unknown>;

  const undeclared = Object.keys(record)
    .filter((key) => objectShape[key] === undefined)
    .map((key) => `${path}.${key}: not declared in the SDK types`);

  const declared = Object.entries(objectShape).flatMap(([key, childShape]) =>
    collectProblems(record[key], childShape, `${path}.${key}`),
  );

  return [...undeclared, ...declared];
}

/** Whether `shape` is an `optional(…)` or `nullable(…)` marker. */
function isMarker<M extends "optional" | "nullable">(
  shape: FieldShape,
  marker: M,
): shape is Extract<OptionalShape | NullableShape, { marker: M }> {
  return typeof shape === "object" && "marker" in shape && shape.marker === marker;
}
