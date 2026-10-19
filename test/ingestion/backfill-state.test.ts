import { describe, expect, it } from 'vitest';
import { advanceCursor, chunk, importTargets, selectTargets } from '../../src/ingestion/backfill-state.js';

describe('backfill state', () => {
  it('maps every provider feed to its API entity and resumes from its cursor', () => {
    expect(importTargets).toEqual([
      { entityType: 'movie', provider: 'tmdb', feed: 'movie' },
      { entityType: 'scene', provider: 'stashdb', feed: 'scene' },
      { entityType: 'performer', provider: 'stashdb', feed: 'performer' },
      { entityType: 'studio', provider: 'stashdb', feed: 'site' },
    ]);
    expect(advanceCursor({ movie: 12 }, 'movie', 8)).toEqual({ movie: 20 });
  });

  it('splits a feed into restart-safe checkpoint batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('selects only requested feeds for priority backfills', () => {
    expect(selectTargets(importTargets, 'performer')).toEqual([{ entityType: 'performer', provider: 'stashdb', feed: 'performer' }]);
  });
});
