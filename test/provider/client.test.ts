import { describe, expect, it } from 'vitest';
import { MetadataProviderClient } from '../../src/provider/client.js';

const moviePayload = {
  title: 'Fixture Movie',
  itemType: 'movie',
  foreignIds: { tmdbId: 123 },
  studio: { title: 'Fixture Studio', foreignIds: { stashId: 'studio-1' } },
  credits: [{ personName: 'Fixture Performer', performerForeignId: 'performer-1', type: 'cast', order: 0 }],
  aliases: ['Fixture Alt'],
  genres: ['Drama'],
  images: [],
};

describe('MetadataProviderClient', () => {
  it('builds the TMDB movie ID URL and normalizes relationships', async () => {
    let requestedPath = '';
    const client = new MetadataProviderClient({
      baseUrl: 'https://metadata.example',
      fetch: async (input) => {
        requestedPath = new URL(String(input)).pathname;
        return new Response(JSON.stringify(moviePayload), { status: 200 });
      },
    });

    const record = await client.fetchById({ provider: 'tmdb', externalId: '123' }, 'movie');

    expect(requestedPath).toBe('/v4/movie/123');
    expect(record.studios).toHaveLength(1);
    expect(record.credits[0]).toMatchObject({ personName: 'Fixture Performer', role: 'performer' });
  });

  it('normalizes missing optional collections to empty arrays', async () => {
    const client = new MetadataProviderClient({
      baseUrl: 'https://metadata.example',
      fetch: async () => new Response(JSON.stringify({
        title: 'Sparse Scene', itemType: 'scene', foreignIds: { stashId: 'scene-1' },
      }), { status: 200 }),
    });

    const record = await client.fetchById({ provider: 'stashdb', externalId: 'scene-1' }, 'scene');

    expect(record.credits).toEqual([]);
    expect(record.aliases).toEqual([]);
    expect(record.genres).toEqual([]);
  });

  it('rejects malformed provider payloads', async () => {
    const client = new MetadataProviderClient({
      baseUrl: 'https://metadata.example',
      fetch: async () => new Response(JSON.stringify({ foreignIds: { tmdbId: 123 } }), { status: 200 }),
    });

    await expect(client.fetchById({ provider: 'tmdb', externalId: '123' }, 'movie'))
      .rejects.toThrow(/title/i);
  });
});
