import { get as idbGet, set as idbSet } from 'idb-keyval';
import { supabase } from '@/integrations/supabase/client';

/** Same shape as idb-keyval get/set, but stored in the signed-in user's account. Local data is uploaded on first read. */
async function uid() { const { data } = await supabase.auth.getSession(); const id = data.session?.user.id; if (!id) throw new Error('Sem sessão'); return id; }
export async function get<T>(key: string): Promise<T | undefined> {
  const user_id = await uid();
  const { data, error } = await supabase.from('user_data').select('value').eq('user_id', user_id).eq('key', key).maybeSingle();
  if (error) throw error;
  if (data) return data.value as T;
  const local = await idbGet<T>(key).catch(() => undefined);
  if (local !== undefined) await set(key, local);
  return local;
}
export async function set(key: string, value: unknown): Promise<void> {
  const user_id = await uid();
  const { error } = await supabase.from('user_data').upsert({ user_id, key, value: value as never, updated_at: new Date().toISOString() });
  if (error) throw error;
  void idbSet(key, value).catch(() => {});
}
