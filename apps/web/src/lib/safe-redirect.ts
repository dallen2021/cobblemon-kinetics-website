const inspectionRounds = 12;
const unsafeCharacterPattern = /[\\\u0000-\u001f\u007f]/u;

function resolvesLocally(value: string, baseUrl: URL): string | null {
  if (!value.startsWith("/") || value.startsWith("//")) return null;

  let inspected = value;
  for (let round = 0; round < inspectionRounds; round += 1) {
    if (unsafeCharacterPattern.test(inspected) || inspected.startsWith("//")) return null;
    try {
      const decoded = decodeURIComponent(inspected);
      if (decoded === inspected) break;
      if (round === inspectionRounds - 1) return null;
      inspected = decoded;
    } catch {
      return null;
    }
  }
  if (unsafeCharacterPattern.test(inspected) || inspected.startsWith("//")) return null;

  try {
    const resolved = new URL(value, baseUrl);
    if (resolved.origin !== baseUrl.origin) return null;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}

export function safeRelativeRedirect(
  value: string | null | undefined,
  fallback = "/",
  baseUrl = new URL("https://local.invalid"),
): string {
  if (!value) return fallback;
  return resolvesLocally(value, baseUrl) ?? fallback;
}
