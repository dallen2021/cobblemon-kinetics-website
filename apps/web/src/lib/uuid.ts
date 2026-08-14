const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function isCanonicalUuid(value: string): boolean {
  return canonicalUuidPattern.test(value);
}
