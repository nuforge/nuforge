export type JsonValue =
  | null
  | string
  | number
  | boolean
  | JsonValue[]
  | { readonly [key: string]: JsonValue };

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return value.every(item => isJsonValue(item));
  if (!isPlainData(value)) return false;
  return Object.keys(value).every(key => isJsonValue(Reflect.get(value, key)));
}

export function cloneJsonValue(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(item => cloneJsonValue(item));
  const copy: { [key: string]: JsonValue } = {};
  for (const key of Object.keys(value)) {
    const child = value[key];
    if (child !== undefined) copy[key] = cloneJsonValue(child);
  }
  return copy;
}

export function freezeDeep<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) {
    const child: unknown = Reflect.get(value, key);
    if (typeof child === "object" && child !== null) freezeDeep(child);
  }
  return Object.freeze(value);
}

function isPlainData(value: object): boolean {
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
