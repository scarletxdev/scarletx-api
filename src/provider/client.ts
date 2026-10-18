import { normalizeProviderRecord } from '../catalog/normalize.js';
import type { NormalizedCatalogRecord, ProviderEntityType, ProviderIdentity, SearchCandidate } from '../catalog/types.js';
import { idPath, searchPath } from './routes.js';

export class MetadataProviderClient {
  constructor(private readonly options: { baseUrl: string; fetch?: typeof fetch }) {}
  private get fetcher(): typeof fetch { return this.options.fetch ?? fetch; }
  private url(path: string): string { return new URL(path, this.options.baseUrl).toString(); }
  async fetchById(identity: ProviderIdentity, entityType: ProviderEntityType): Promise<NormalizedCatalogRecord> {
    const response = await this.fetcher(this.url(idPath(identity, entityType)), { signal: AbortSignal.timeout(10_000) });
    if (response.status === 404) throw new Error('Provider record not found');
    if (!response.ok) throw new Error(`Provider request failed with ${response.status}`);
    return normalizeProviderRecord(await response.json(), entityType);
  }
  async search(entityType: ProviderEntityType, query: string): Promise<SearchCandidate[]> {
    const url = new URL(this.url(searchPath(entityType))); url.searchParams.set('q', query);
    const response = await this.fetcher(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Provider request failed with ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Provider search payload must be an array');
    return data.map(item => normalizeProviderRecord(item, entityType)).flatMap(record => record.identities.map(identity => ({ title: record.title, entityType, identity })));
  }
}
