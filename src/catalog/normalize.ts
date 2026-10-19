import type { NormalizedCatalogRecord, ProviderEntityType, ProviderIdentity } from './types.js';

type Payload = Record<string, unknown>;
const asRecord = (value: unknown): Payload | undefined => value && typeof value === 'object' ? value as Payload : undefined;
const asStrings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function identities(ids: unknown): ProviderIdentity[] {
  const source = asRecord(ids);
  if (!source) return [];
  const values: ProviderIdentity[] = [];
  const tmdbId = source.tmdbId ?? source.TmdbId;
  const tpdbId = source.tpdbId ?? source.TpdbId;
  const stashId = source.stashId ?? source.StashId;
  if (typeof tmdbId === 'number' && tmdbId > 0) values.push({ provider: 'tmdb', externalId: String(tmdbId) });
  if (typeof tpdbId === 'string' && tpdbId) values.push({ provider: 'tpdb', externalId: tpdbId });
  if (typeof stashId === 'string' && stashId) values.push({ provider: 'stashdb', externalId: stashId });
  return values;
}

export function normalizeProviderRecord(payload: unknown, entityType: ProviderEntityType): NormalizedCatalogRecord {
  const raw = asRecord(payload);
  const source = raw && {
    ...raw,
    title: raw.title ?? raw.Title, foreignIds: raw.foreignIds ?? raw.ForeignIds,
    aliases: raw.aliases ?? raw.Aliases ?? (Array.isArray(raw.AlternativeTitles) ? raw.AlternativeTitles.map((x: any) => x.Title) : []), genres: raw.genres ?? raw.Genres,
    studio: raw.studio ?? raw.Studio, credits: raw.credits ?? raw.Credits, images: raw.images ?? raw.Images,
  };
  if (!source || typeof source.title !== 'string' || !source.title.trim()) throw new Error('Provider payload requires a title');
  const recordIdentities = identities(source.foreignIds);
  if (!recordIdentities.length) throw new Error('Provider payload requires an external identity');
  const studio = asRecord(source.studio);
  const credits = Array.isArray(source.credits) ? source.credits.flatMap((credit, index) => {
    const item = asRecord(credit);
    if (!item || typeof item.personName !== 'string') return [];
    return [{ personName: item.personName, identity: identities({ stashId: item.performerForeignId })[0], role: item.type === 'cast' ? 'performer' : typeof item.type === 'string' ? item.type : 'contributor', character: typeof item.character === 'string' ? item.character : undefined, billingOrder: typeof item.order === 'number' ? item.order : index }];
  }) : [];
  return {
    entityType, title: source.title, normalizedTitle: source.title.trim().toLocaleLowerCase(), identities: recordIdentities,
    aliases: asStrings(source.aliases), genres: asStrings(source.genres),
    studios: studio && typeof studio.title === 'string' ? [{ name: studio.title, identity: identities(studio.foreignIds)[0] }] : [],
    credits,
    images: Array.isArray(source.images)
      ? source.images.flatMap((image) => {
        const item = asRecord(image);
        if (!item || typeof item.url !== 'string') return [];
        return [{ url: item.url, type: typeof item.coverType === 'string' ? item.coverType : undefined }];
      })
      : [],
    rawPayload: payload,
  };
}
