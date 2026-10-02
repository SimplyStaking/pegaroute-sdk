/**
 * Strict-shape check for e2e responses: flags any key the API returns that our types don't declare (type drift).
 *
 * Types are erased at runtime, so each type gets a hand-written key manifest checked by tsc:
 * `const x = { … } satisfies Shape<T>` fails to compile when the manifest misses one of T's keys or lists an extra one.
 */

/**
 * What to expect for one field:
 * - `true`: any value; don't look inside (scalars, and loosely typed records such as `metadata`).
 * - an object: check the value's keys against it, recursively.
 * - `[shape]`: an array; check every element against `shape`.
 * - a function: picks the shape from the value itself, for unions (e.g. `execution`, by `family` + `mode`).
 */
export type FieldShape = true | ObjectShape | readonly [FieldShape] | ((value: never) => FieldShape);

/** The expected keys of an object. */
export interface ObjectShape {
  readonly [key: string]: FieldShape;
}

/** Exactly the keys of `T`, optional ones included, each with the shape of its value. */
export type Shape<T> = { readonly [K in keyof Required<T>]: FieldShape };

/**
 * Throws if `value` has keys that `shape` doesn't declare, listing every one with its path.
 * Missing keys are not reported: optional fields are often absent.
 *
 * @example
 * assertShape(await pr.chains.list(), chainsResponseShape);
 */
export function assertShape(value: unknown, shape: FieldShape, path = "response"): void {
  const unknownKeys = collectUnknownKeys(value, shape, path);

  if (unknownKeys.length > 0) {
    throw new Error(`Keys not declared in the SDK types:\n${unknownKeys.map((key) => `  - ${key}`).join("\n")}`);
  }
}

/** Walks `value` alongside `shape` and returns the path of every undeclared key. */
function collectUnknownKeys(value: unknown, shape: FieldShape, path: string): string[] {
  // Nothing to look inside: a leaf, or an absent/null value.
  if (shape === true || value === null || value === undefined) return [];

  // A union: let the value pick its shape.
  if (typeof shape === "function") return collectUnknownKeys(value, shape(value as never), path);

  // An array: every element has the same shape.
  if (Array.isArray(shape)) {
    if (!Array.isArray(value)) return [];

    return value.flatMap((item, index) => collectUnknownKeys(item, shape[0] as FieldShape, `${path}[${index}]`));
  }

  // An object: report keys the shape doesn't know, and check the ones it does.
  if (typeof value !== "object") return [];

  const objectShape = shape as ObjectShape;
  return Object.entries(value).flatMap(([key, child]) => {
    const childShape = objectShape[key];

    return childShape === undefined ? [`${path}.${key}`] : collectUnknownKeys(child, childShape, `${path}.${key}`);
  });
}
