import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ local: new Map<string, unknown>(), online: new Map<string, unknown>(), user: 'owner', writes: [] as string[], fail: false }));
vi.mock('idb-keyval', () => ({ get: async (k: string) => state.local.get(k), set: async (k: string, v: unknown) => { state.local.set(k, v); }, keys: async () => [...state.local.keys()], update: async (k: string, fn: (v: unknown) => unknown) => { state.local.set(k, fn(state.local.get(k))); } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: state.user ? { user: { id: state.user } } : null } }) },
  from: () => {
    let user = '', key = '';
    const query = {
      select: () => query,
      abortSignal: () => query,
      eq: (k: string, v: string) => { if (k === 'user_id') user = v; else key = v; return query; },
      maybeSingle: async () => ({ data: state.online.has(`${user}:${key}`) ? { value: state.online.get(`${user}:${key}`) } : null, error: state.fail ? new Error('Network failed') : null }),
      upsert: (row: { user_id: string; key: string; value: unknown }, options?: { ignoreDuplicates?: boolean }) => {
        const k = `${row.user_id}:${row.key}`;
        state.writes.push(k);
        if (!state.fail && (!options?.ignoreDuplicates || !state.online.has(k))) state.online.set(k, row.value);
        const result = Promise.resolve({ error: state.fail ? new Error('Network failed') : null });
        return Object.assign(result, { abortSignal: () => result });
      },
    };
    return query;
  },
} }));

describe('Private online report storage', () => {
  beforeEach(() => { vi.resetModules(); state.local.clear(); state.online.clear(); state.writes = []; state.user = 'owner'; state.fail = false; });
  it('migrates report, saved reports and corrections together without deleting local originals', async () => {
    state.local.set('peca-a-peca-report-v1', { title: 'Vistoria' });
    state.local.set('saved-reports-v1', [{ id: 'saved-1' }]);
    state.local.set('corrections-v1', { 'saved-1': { note: 'Base corrigida' } });
    const { get } = await import('@/lib/cloud-store');
    await get('peca-a-peca-report-v1');
    expect(state.online.get('owner:saved-reports-v1')).toEqual([{ id: 'saved-1' }]);
    expect(state.online.get('owner:corrections-v1')).toEqual({ 'saved-1': { note: 'Base corrigida' } });
    expect(state.local.get('peca-a-peca-report-v1')).toEqual({ title: 'Vistoria' });
  });
  it('does not replace an existing online document with an older browser copy', async () => {
    state.local.set('peca-a-peca-report-v1', { title: 'Antigo' });
    state.online.set('owner:peca-a-peca-report-v1', { title: 'Atual' });
    const { get } = await import('@/lib/cloud-store');
    expect(await get('peca-a-peca-report-v1')).toEqual({ title: 'Atual' });
  });
  it('never imports the first account’s browser data into a different account', async () => {
    state.local.set('peca-a-peca-report-v1', { title: 'Privado' });
    const { get } = await import('@/lib/cloud-store');
    await get('peca-a-peca-report-v1');
    state.user = 'other';
    expect(await get('peca-a-peca-report-v1')).toBeUndefined();
    expect(state.online.has('other:peca-a-peca-report-v1')).toBe(false);
  });
  it('requires login before reading or writing reports', async () => {
    state.user = '';
    const { get, set } = await import('@/lib/cloud-store');
    await expect(get('saved-reports-v1')).rejects.toThrow('Sem sessão');
    await expect(set('saved-reports-v1', [])).rejects.toThrow('Sem sessão');
    expect(state.writes).toEqual([]);
  });
  it('preserves offline edits across reload and synchronizes the latest revision after recovery', async () => {
    state.fail = true;
    let store = await import('@/lib/cloud-store');
    await store.set('peca-a-peca-report-v1', { title: 'Inspeção offline', photos: ['foto-1'] });
    await store.syncPending();
    expect(state.local.get('offline-record:owner:peca-a-peca-report-v1')).toMatchObject({ pending: true, value: { title: 'Inspeção offline', photos: ['foto-1'] } });
    vi.resetModules(); store = await import('@/lib/cloud-store');
    expect(await store.get('peca-a-peca-report-v1')).toEqual({ title: 'Inspeção offline', photos: ['foto-1'] });
    await store.set('peca-a-peca-report-v1', { title: 'Última edição', photos: ['foto-1', 'foto-2'] });
    await store.syncPending();
    state.fail = false;
    await store.syncPending();
    expect(state.online.get('owner:peca-a-peca-report-v1')).toEqual({ title: 'Última edição', photos: ['foto-1', 'foto-2'] });
    expect(state.local.get('offline-record:owner:peca-a-peca-report-v1')).toMatchObject({ pending: false });
  });
  it('reads cached reports during a failed network read rather than initializing an empty document', async () => {
    state.local.set('cloud-cache:owner:saved-reports-v1', [{ id: 'protected' }]);
    state.fail = true;
    const { get } = await import('@/lib/cloud-store');
    expect(await get('saved-reports-v1')).toEqual([{ id: 'protected' }]);
    await expect(get('unknown-key')).rejects.toThrow('Network failed');
  });
  it('remembers an empty archive so it can accept its first report offline', async () => {
    const store = await import('@/lib/cloud-store');
    expect(await store.get('saved-reports-v1')).toBeUndefined();
    state.fail = true;
    expect(await store.get('saved-reports-v1')).toBeUndefined();
    await store.set('saved-reports-v1', [{ id: 'first-offline-report' }]);
    await store.syncPending();
    expect(await store.get('saved-reports-v1')).toEqual([{ id: 'first-offline-report' }]);
  });
});