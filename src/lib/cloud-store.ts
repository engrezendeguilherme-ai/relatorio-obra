import { get as idbGet, set as idbSet, keys, update } from 'idb-keyval';
import { supabase } from '@/integrations/supabase/client';

const LEGACY_KEYS = ['peca-a-peca-report-v1', 'saved-reports-v1', 'corrections-v1', 'example-report-initialized-v1'];
const migrations = new Map<string, Promise<void>>();
type LocalRecord = { value: unknown; revision: string; pending: boolean; updatedAt: string };
export type SyncState = 'synced' | 'pending' | 'syncing';
let syncState: SyncState = 'synced';
const subscribers = new Set<() => void>();
let running: Promise<void> | undefined;
let rerun = false;
const localKey = (user: string, key: string) => `offline-record:${user}:${key}`;
function publish(state: SyncState) { syncState = state; subscribers.forEach(fn => fn()); }
export const getSyncState = () => syncState;
export function subscribeSync(fn: () => void) { subscribers.add(fn); return () => { subscribers.delete(fn); }; }
function online() { return typeof navigator === 'undefined' || navigator.onLine; }
async function uid() { const { data } = await supabase.auth.getSession(); const id = data.session?.user.id; if (!id) throw new Error('Sem sessão'); return id; }

/** Each edit is durable before any network request; revisions protect edits made during upload. */
async function flush() {
  const user_id = await uid();
  const prefix = `offline-record:${user_id}:`;
  const storedKeys = (await keys()).filter((k): k is string => typeof k === 'string' && k.startsWith(prefix));
  let pending = false;
  for (const k of storedKeys) {
    const record = await idbGet<LocalRecord>(k);
    if (!record?.pending) continue;
    if (!online()) { pending = true; continue; }
    publish('syncing');
    try {
      const { error } = await supabase.from('user_data').upsert({ user_id, key: k.slice(prefix.length), value: record.value as never, updated_at: record.updatedAt }).abortSignal(AbortSignal.timeout(10000));
      if (error) throw error;
      await update<LocalRecord | undefined>(k, current => current?.revision === record.revision ? { ...current, pending: false } : current);
    } catch { pending = true; }
    if ((await idbGet<LocalRecord>(k))?.pending) pending = true;
  }
  publish(pending ? 'pending' : 'synced');
}
export function syncPending(): Promise<void> {
  if (running) { rerun = true; return running; }
  running = (async () => {
    do { rerun = false; await flush(); } while (rerun && online());
  })().catch(() => publish('pending')).finally(() => { running = undefined; });
  return running;
}
export function startSync() {
  const retry = () => { void syncPending(); };
  window.addEventListener('online', retry);
  window.addEventListener('focus', retry);
  const timer = window.setInterval(retry, 15000);
  retry();
  void navigator.storage?.persist?.().catch(() => {});
  return () => { window.removeEventListener('online', retry); window.removeEventListener('focus', retry); window.clearInterval(timer); };
}

/** Import legacy browser data only for its first account, never replacing online data. */
async function migrate(user_id: string) {
  if (await idbGet(`cloud-migrated:${user_id}`)) return;
  const owner = await idbGet<string>('cloud-legacy-owner-v1');
  if (owner && owner !== user_id) return;
  await idbSet('cloud-legacy-owner-v1', user_id);
  for (const key of LEGACY_KEYS) {
    const value = await idbGet(key);
    if (value === undefined) continue;
    const { error } = await supabase.from('user_data').upsert(
      { user_id, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key', ignoreDuplicates: true },
    );
    if (error) throw error;
  }
  await idbSet(`cloud-migrated:${user_id}`, true);
}
async function ensureMigration(user_id: string) {
  let pending = migrations.get(user_id);
  if (!pending) {
    pending = migrate(user_id).catch(error => { migrations.delete(user_id); throw error; });
    migrations.set(user_id, pending);
  }
  await pending;
}
export async function get<T>(key: string): Promise<T | undefined> {
  const user_id = await uid();
  const k = localKey(user_id, key);
  const local = await idbGet<LocalRecord>(k);
  if (local?.pending) { publish('pending'); void syncPending(); return local.value as T; }
  let cached = local?.value ?? await idbGet(`cloud-cache:${user_id}:${key}`);
  const owner = await idbGet<string>('cloud-legacy-owner-v1');
  if (cached === undefined && (!owner || owner === user_id)) cached = await idbGet(key);
  try {
    if (!online()) throw new Error('Sem conexão');
    await ensureMigration(user_id);
    const { data, error } = await supabase.from('user_data').select('value').eq('user_id', user_id).eq('key', key).abortSignal(AbortSignal.timeout(10000)).maybeSingle();
    if (error) throw error;
    const value = data ? data.value : cached;
    await update<LocalRecord>(k, current => current?.pending ? current : { value, revision: crypto.randomUUID(), pending: false, updatedAt: new Date().toISOString() });
    return (await idbGet<LocalRecord>(k))?.value as T;
  } catch (error) {
    if (local || cached !== undefined) return cached as T;
    throw error; // Never initialize an empty report when the online read failed.
  }
}
export async function set(key: string, value: unknown): Promise<void> {
  const user_id = await uid();
  await idbSet(localKey(user_id, key), { value, revision: crypto.randomUUID(), pending: true, updatedAt: new Date().toISOString() } satisfies LocalRecord);
  publish('pending');
  void syncPending();
}
