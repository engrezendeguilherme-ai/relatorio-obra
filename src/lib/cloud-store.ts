import { get as idbGet, set as idbSet, keys, update } from 'idb-keyval';
import { supabase } from '@/integrations/supabase/client';

const LEGACY_KEYS = ['peca-a-peca-report-v1', 'saved-reports-v1', 'corrections-v1', 'example-report-initialized-v1'];
const migrations = new Map<string, Promise<void>>();
type LocalRecord = { value: unknown; revision: string; pending: boolean; updatedAt: string };
export type SyncState = 'synced' | 'pending' | 'syncing';
let syncState: SyncState = 'synced';
let photosLeft = 0;
export const getPhotosLeft = () => photosLeft;
const subscribers = new Set<() => void>();
let running: Promise<void> | undefined;
let rerun = false;
const localKey = (user: string, key: string) => `offline-record:${user}:${key}`;
function publish(state: SyncState) { syncState = state; subscribers.forEach(fn => fn()); }
export const getSyncState = () => syncState;
export function subscribeSync(fn: () => void) { subscribers.add(fn); return () => { subscribers.delete(fn); }; }
function online() { return typeof navigator === 'undefined' || navigator.onLine; }
// Photos travel separately: one upload each, by content hash, so the record stays small and a failure only delays that photo.
const REF = 'photo-ref:';
const hashes = new Map<string, string>();
const isImage = (v: unknown): v is string => typeof v === 'string' && v.startsWith('data:image/') && v.length > 1000;
async function hashOf(data: string) {
  let h = hashes.get(data);
  if (!h) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)); h = [...new Uint8Array(d)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join(''); hashes.set(data, h); }
  return h;
}
async function mapDeep(v: unknown, fn: (s: string) => Promise<string> | string): Promise<unknown> {
  if (typeof v === 'string') return fn(v);
  if (Array.isArray(v)) return Promise.all(v.map(x => mapDeep(x, fn)));
  if (v && typeof v === 'object') { const out: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v)) out[k] = await mapDeep(x, fn); return out; }
  return v;
}
function hasInline(v: unknown): boolean {
  if (isImage(v)) return true;
  if (Array.isArray(v)) return v.some(hasInline);
  return !!v && typeof v === 'object' && Object.values(v).some(hasInline);
}
const withTimeout = <T,>(p: PromiseLike<T>, ms: number) => Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error('Tempo esgotado')), ms))]);
async function uploadPhoto(user: string, hash: string, data: string) {
  const flag = `photo-up:${user}:${hash}`;
  if (await idbGet(flag)) return;
  const blob = await (await fetch(data)).blob();
  const { error } = await withTimeout(supabase.storage.from('photos').upload(`${user}/${hash}.jpg`, blob, { upsert: true, contentType: blob.type || 'image/jpeg' }), 60000);
  if (error) throw error;
  await idbSet(flag, true);
}
async function strip(user: string, value: unknown) {
  const images = new Map<string, string>();
  const stripped = await mapDeep(value, async s => { if (!isImage(s)) return s; const h = await hashOf(s); images.set(h, s); return REF + h; });
  return { stripped, images };
}
async function hydrate(user: string, value: unknown) {
  return mapDeep(value, async s => {
    if (!s.startsWith(REF)) return s;
    const h = s.slice(REF.length), cacheKey = `photo-cache:${user}:${h}`;
    const cached = await idbGet<string>(cacheKey);
    if (cached) return cached;
    const { data, error } = await withTimeout(supabase.storage.from('photos').download(`${user}/${h}.jpg`), 60000);
    if (error || !data) throw error ?? new Error('Foto indisponível');
    const url = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(data); });
    await idbSet(cacheKey, url); await idbSet(`photo-up:${user}:${h}`, true); hashes.set(url, h);
    return url;
  });
}
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
      const { stripped, images } = await strip(user_id, record.value);
      const waiting: [string, string][] = [];
      for (const [h, d] of images) if (!(await idbGet(`photo-up:${user_id}:${h}`))) waiting.push([h, d]);
      photosLeft = waiting.length; publish('syncing');
      for (const [h, d] of waiting) { await uploadPhoto(user_id, h, d); photosLeft--; publish('syncing'); }
      const { error } = await supabase.from('user_data').upsert({ user_id, key: k.slice(prefix.length), value: stripped as never, updated_at: record.updatedAt }).abortSignal(AbortSignal.timeout(10000));
      if (error) throw error;
      await update<LocalRecord | undefined>(k, current => current?.revision === record.revision ? { ...current, pending: false } : current);
    } catch { pending = true; }
    if ((await idbGet<LocalRecord>(k))?.pending) pending = true;
  }
  if (!pending) photosLeft = 0;
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
  const leave = (e: BeforeUnloadEvent) => { if (syncState !== 'synced') { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', leave);
  retry();
  void navigator.storage?.persist?.().catch(() => {});
  return () => { window.removeEventListener('online', retry); window.removeEventListener('focus', retry); window.clearInterval(timer); window.removeEventListener('beforeunload', leave); };
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
    const { data, error } = await supabase.from('user_data').select('value').eq('user_id', user_id).eq('key', key).abortSignal(AbortSignal.timeout(90000)).maybeSingle();
    if (error) throw error;
    const value = data ? await hydrate(user_id, data.value) : cached;
    // Records saved before photos were split out are re-sent once in the light format.
    const resend = !!data && hasInline(data.value);
    await update<LocalRecord>(k, current => current?.pending ? current : { value, revision: crypto.randomUUID(), pending: resend, updatedAt: new Date().toISOString() });
    if (resend) void syncPending();
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
