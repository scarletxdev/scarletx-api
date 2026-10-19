import type { ProviderEntityType, ProviderIdentity } from '../catalog/types.js';

export function idPath(identity: ProviderIdentity, entityType: ProviderEntityType): string {
  if (entityType === 'movie' && identity.provider === 'tmdb') return `/v4/movie/${identity.externalId}`;
  if (entityType === 'movie' && identity.provider === 'tpdb') return `/v4/tpdb/movie/${identity.externalId}`;
  if (entityType === 'scene' && identity.provider === 'stashdb') return `/v4/scene/${identity.externalId}`;
  if (entityType === 'performer' && identity.provider === 'stashdb') return `/v4/performer/${identity.externalId}`;
  if (entityType === 'studio' && identity.provider === 'stashdb') return `/v4/site/${identity.externalId}`;
  throw new Error(`Unsupported identity ${identity.provider} for ${entityType}`);
}

export function supportsIdentity(identity: ProviderIdentity, entityType: ProviderEntityType): boolean {
  return (entityType === 'movie' && (identity.provider === 'tmdb' || identity.provider === 'tpdb')) ||
    ((entityType === 'scene' || entityType === 'performer' || entityType === 'studio') && identity.provider === 'stashdb');
}

export function searchPath(entityType: ProviderEntityType): string {
  return { movie: '/v4/movie/search', scene: '/v4/scene/search', performer: '/v4/performer/search', studio: '/v4/site/search' }[entityType];
}
