import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { advanceCursor, importTargets } from '../src/ingestion/backfill-state.js';

type State = { cursors: Record<string, number>; imported: number; failed: number };
const args = new Map(process.argv.slice(2).map(value => { const [key, entry = 'true'] = value.split('='); return [key, entry]; }));
const statePath = resolve(args.get('--state') ?? '.scarletx-backfill.json');
const apiUrl = args.get('--api') ?? 'http://127.0.0.1:3000';
const providerUrl = args.get('--provider') ?? 'https://api.whisparr.com';
const concurrency = Math.max(1, Number(args.get('--concurrency') ?? '4'));
const maximum = Math.max(0, Number(args.get('--max') ?? '0'));

async function loadState(): Promise<State> { try { return JSON.parse(await readFile(statePath, 'utf8')) as State; } catch { return { cursors: {}, imported: 0, failed: 0 }; } }
async function saveState(state: State) { await mkdir(dirname(statePath), { recursive: true }); await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`); }

const state = await loadState();
let remaining = maximum || Number.POSITIVE_INFINITY;
for (const target of importTargets) {
  if (!remaining) break;
  const ids = await (await fetch(`${providerUrl}/v4/${target.feed}/changed`)).json() as unknown[];
  const start = state.cursors[target.feed] ?? 0;
  const selected = ids.slice(start, start + remaining);
  let next = 0; let imported = 0; let failed = 0;
  const worker = async () => { while (next < selected.length) { const id = selected[next++]; try {
    const response = await fetch(`${apiUrl}/api/v1/ingestions/by-id`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entityType: target.entityType, identity: { provider: target.provider, externalId: String(id) } }) });
    if (response.ok) imported++; else failed++;
  } catch { failed++; } } };
  await Promise.all(Array.from({ length: concurrency }, worker));
  state.cursors = advanceCursor(state.cursors, target.feed, selected.length); state.imported += imported; state.failed += failed; remaining -= selected.length;
  await saveState(state); console.log(JSON.stringify({ feed: target.feed, attempted: selected.length, imported, failed, cursor: state.cursors[target.feed] }));
}
console.log(JSON.stringify({ complete: true, state }));
