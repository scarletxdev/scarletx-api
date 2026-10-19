import type { MetadataProviderClient } from '../provider/client.js';
import type { CatalogRepository, ImportedRecord } from '../catalog/repository.js';
import type { ProviderEntityType, ProviderIdentity, SearchCandidate } from '../catalog/types.js';

export class IngestionService {
  constructor(private readonly provider: MetadataProviderClient, private readonly repository: CatalogRepository) {}
  async search(entityType: ProviderEntityType, query: string): Promise<SearchCandidate[]> { return this.provider.search(entityType, query); }
  async importById(request: { entityType: ProviderEntityType; identity: ProviderIdentity }): Promise<ImportedRecord> { return this.repository.upsert(await this.provider.fetchById(request.identity, request.entityType)); }
}
