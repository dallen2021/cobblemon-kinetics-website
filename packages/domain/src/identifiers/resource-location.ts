const resourceLocationPattern = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;

export function isResourceLocation(value: string): boolean {
  return resourceLocationPattern.test(value) && value.length <= 255;
}

export function assertResourceLocation(value: string, label = "resource location"): void {
  if (!isResourceLocation(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

export function pokemonPublicId(slug: string): string {
  return `cobblemon_kinetics:pokemon/${slug}`;
}

export function pokemonFormPublicId(slug: string): string {
  return `cobblemon_kinetics:pokemon/${slug}/default`;
}
