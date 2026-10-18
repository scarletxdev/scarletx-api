export type ProviderEntityType = 'movie' | 'scene' | 'performer' | 'studio';
export type ProviderName = 'tmdb' | 'tpdb' | 'stashdb';

export interface ProviderIdentity { provider: ProviderName; externalId: string; }

export interface NormalizedCatalogRecord {
  entityType: ProviderEntityType;
  title: string;
  normalizedTitle: string;
  identities: ProviderIdentity[];
  aliases: string[];
  genres: string[];
  studios: Array<{ name: string; identity?: ProviderIdentity }>;
  credits: Array<{ personName: string; identity?: ProviderIdentity; role: string; character?: string; billingOrder: number }>;
  images: Array<{ url: string; type?: string }>;
  rawPayload: unknown;
}

export interface SearchCandidate { title: string; entityType: ProviderEntityType; identity: ProviderIdentity; }
