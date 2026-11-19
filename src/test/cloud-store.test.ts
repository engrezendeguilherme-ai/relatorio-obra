import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ local: new Map<string, unknown>(), online: new Map<string, unknown>(), user: 'owner', writes: [] as string[] }));
vi.mock('idb-keyval', () => ({ get: async (k: string) => state.local.get(k), set: async (k: string, v: unknown) => { state.local.set(k, v); } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: state.user ? { user: { id: state.user } } : null } }) },
  from: () => {
    let user = '', key = '';
    const query = {
      select: () => query,
      eq: (k: string, v: string) => { if (k === 'user_id') user = v; else key = v; return query; },
      maybeSingle: async () => ({ data: state.online.has(`${user}:${key}`) ? { value: state.online.get(`${user}:${key}`) } : null, error: null }),
      upsert: async (row: { user_id: string; key: string; value: unknown }, options?: { ignoreDuplicates?: boolean }) => {
        const k = `${row.user_id}:${row.key}`;
        state.writes.push(k);
        if (!options?.ignoreDuplicates || !state.online.has(k)) state.online.set(k, row.value);
        return { error: null };
      },
    };
    return query;
  },
} }));

describe('Private online report storage', () => {
  beforeEach(() => { vi.resetModules(); state.local.clear(); state.online.clear(); state.writes = []; state.user = 'owner'; });
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
});