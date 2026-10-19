import type { ProviderEntityType, ProviderName } from '../catalog/types.js';

export interface ImportTarget { entityType: ProviderEntityType; provider: ProviderName; feed: string; }
export const importTargets: ImportTarget[] = [
  { entityType: 'movie', provider: 'tmdb', feed: 'movie' },
  { entityType: 'scene', provider: 'stashdb', feed: 'scene' },
  { entityType: 'performer', provider: 'stashdb', feed: 'performer' },
  { entityType: 'studio', provider: 'stashdb', feed: 'site' },
];
export function advanceCursor(cursors: Record<string, number>, feed: string, completed: number): Record<string, number> {
  return { ...cursors, [feed]: (cursors[feed] ?? 0) + completed };
}
export function chunk<T>(values: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(values.length / size) }, (_value, index) => values.slice(index * size, (index + 1) * size));
}
