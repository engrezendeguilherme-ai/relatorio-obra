import { get as idbGet, set as idbSet } from 'idb-keyval';
import { supabase } from '@/integrations/supabase/client';

const LEGACY_KEYS = ['peca-a-peca-report-v1', 'saved-reports-v1', 'corrections-v1', 'example-report-initialized-v1'];
const migrations = new Map<string, Promise<void>>();
async function uid() { const { data } = await supabase.auth.getSession(); const id = data.session?.user.id; if (!id) throw new Error('Sem sessão'); return id; }

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
  await ensureMigration(user_id);
  const { data, error } = await supabase.from('user_data').select('value').eq('user_id', user_id).eq('key', key).maybeSingle();
  if (error) throw error;
  return data ? data.value as T : undefined;
}
export async function set(key: string, value: unknown): Promise<void> {
  const user_id = await uid();
  const { error } = await supabase.from('user_data').upsert({ user_id, key, value: value as never, updated_at: new Date().toISOString() });
  if (error) throw error;
  await idbSet(`cloud-cache:${user_id}:${key}`, value).catch(() => {});
}
