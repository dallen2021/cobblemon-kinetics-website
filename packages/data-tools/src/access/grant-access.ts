export type ApplicationRole = "maintainer" | "editor" | "viewer";

export interface GrantAccessOptions {
  githubUser: string;
  role: ApplicationRole;
  supabaseUrl: string;
  supabaseSecretKey: string;
  githubToken?: string;
  fetchImplementation?: typeof fetch;
}

export interface AllowlistEntry {
  github_user_id: number;
  github_login: string;
  display_name: string | null;
  role: ApplicationRole;
  is_active: true;
}

function validateLogin(login: string): string {
  const normalized = login.trim();
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u.test(normalized)) {
    throw new Error(`Invalid GitHub login: ${login}`);
  }
  return normalized;
}

function validateSupabaseUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  }

  const isLocal =
    url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use HTTPS outside local development.");
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must contain only the Supabase origin.");
  }
  return url.origin;
}

export async function grantAccess(options: GrantAccessOptions): Promise<AllowlistEntry> {
  const request = options.fetchImplementation ?? fetch;
  const githubUser = validateLogin(options.githubUser);
  const supabaseUrl = validateSupabaseUrl(options.supabaseUrl);
  const githubHeaders: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "cobblemon-kinetics-access-tool",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (options.githubToken) githubHeaders.Authorization = `Bearer ${options.githubToken}`;

  const githubResponse = await request(
    `https://api.github.com/users/${encodeURIComponent(githubUser)}`,
    {
      headers: githubHeaders,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!githubResponse.ok) {
    throw new Error(`GitHub user lookup failed with HTTP ${githubResponse.status}.`);
  }
  const github = (await githubResponse.json()) as { id?: unknown; login?: unknown; name?: unknown };
  if (
    typeof github.id !== "number" ||
    !Number.isSafeInteger(github.id) ||
    github.id <= 0 ||
    typeof github.login !== "string"
  ) {
    throw new Error("GitHub returned an invalid or unsafe user identifier.");
  }

  const entry: AllowlistEntry = {
    github_user_id: github.id,
    github_login: github.login,
    display_name: typeof github.name === "string" && github.name.trim() ? github.name.trim() : null,
    role: options.role,
    is_active: true,
  };
  const upsertResponse = await request(
    `${supabaseUrl}/rest/v1/editor_allowlist?on_conflict=github_user_id`,
    {
      method: "POST",
      headers: {
        apikey: options.supabaseSecretKey,
        Authorization: `Bearer ${options.supabaseSecretKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(entry),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!upsertResponse.ok) {
    const requestId = upsertResponse.headers.get("x-request-id");
    throw new Error(
      `Supabase allowlist upsert failed with HTTP ${upsertResponse.status}${requestId ? ` (request ${requestId})` : ""}.`,
    );
  }
  return entry;
}
