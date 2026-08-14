export interface ParsedArgs {
  positional: string[];
  flags: Map<string, string | true>;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) continue;
    // Package-manager script forwarding may retain its conventional `--` separator.
    if (token === "--") continue;
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const equalsAt = token.indexOf("=");
    if (equalsAt >= 0) {
      const name = token.slice(2, equalsAt);
      if (!name) throw new Error("An option name cannot be empty.");
      if (flags.has(name)) throw new Error(`Duplicate option: --${name}`);
      flags.set(name, token.slice(equalsAt + 1));
      continue;
    }

    const name = token.slice(2);
    if (!name) throw new Error("An option name cannot be empty.");
    if (flags.has(name)) throw new Error(`Duplicate option: --${name}`);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      flags.set(name, next);
      index += 1;
    } else {
      flags.set(name, true);
    }
  }

  return { positional, flags };
}

export function requiredFlag(args: ParsedArgs, name: string): string {
  const value = args.flags.get(name);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required --${name} value.`);
  }
  return value;
}

export function optionalFlag(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

export function booleanFlag(args: ParsedArgs, name: string): boolean {
  const value = args.flags.get(name);
  if (value === undefined) return false;
  if (value !== true) throw new Error(`--${name} does not accept a value.`);
  return true;
}

export function assertAllowedArgs(
  args: ParsedArgs,
  options: { flags: readonly string[]; maxPositionals?: number },
): void {
  const allowed = new Set(options.flags);
  const unknown = [...args.flags.keys()].filter((flag) => !allowed.has(flag));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown option${unknown.length === 1 ? "" : "s"}: ${unknown.map((flag) => `--${flag}`).join(", ")}`,
    );
  }
  const maximum = options.maxPositionals ?? 0;
  if (args.positional.length > maximum) {
    throw new Error(`Expected at most ${maximum} positional argument${maximum === 1 ? "" : "s"}.`);
  }
}
