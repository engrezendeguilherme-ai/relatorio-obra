import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database } from '@/integrations/supabase/types';
import { hashShareToken, photoReference } from './share-model';
import { normalizeReport, type Report } from './report-model';

const reportInput = z.object({ reportId: z.string().uuid() });
export const createReportShare = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => reportInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error: readError } = await context.supabase.from('user_data').select('value').eq('user_id', context.userId).eq('key', 'saved-reports-v1').maybeSingle();
    if (readError || !Array.isArray(row?.value) || !row.value.some(r => r && typeof r === 'object' && !Array.isArray(r) && r['id'] === data.reportId)) throw new Error('Salve e sincronize o relatório antes de compartilhar.');
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    const { error } = await context.supabase.from('report_shares').upsert({ user_id: context.userId, report_id: data.reportId, token_hash: await hashShareToken(token) }, { onConflict: 'user_id,report_id' });
    if (error) throw new Error('Não foi possível criar o link.');
    return { token };
  });
export const revokeReportShare = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => reportInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from('report_shares').delete().eq('user_id', context.userId).eq('report_id', data.reportId);
    if (error) throw new Error('Não foi possível desativar o link.');
    return { ok: true };
  });

export const readSharedReport = createServerFn({ method: 'GET' })
  .inputValidator(input => z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(input))
  .handler(async ({ data }): Promise<Report | null> => {
    setResponseHeader('Cache-Control', 'no-store');
    setResponseHeader('Referrer-Policy', 'no-referrer');
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['SUPABASE_ANON_KEY'];
    if (!url || !key) throw new Error('Consulta indisponível.');
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization'); h.set('apikey', key); return fetch(input, { ...init, headers: h }); } },
    });
    const { data: result, error } = await client.rpc('read_shared_report', { _hash: await hashShareToken(data.token) });
    if (error) throw new Error('Não foi possível consultar o relatório.');
    if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
    const owner = z.string().uuid().safeParse(result['owner']);
    const raw = result['report'];
    if (!owner.success || !raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    // The database capability check above authorizes only this report. Sign only photo hashes within that payload.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const photoUrls = new Map<string, Promise<string>>();
    async function resolve(value: unknown): Promise<unknown> {
      if (typeof value === 'string') {
        const hash = photoReference(value); if (!hash) return value;
        let pending = photoUrls.get(hash);
        if (!pending) {
          pending = (async () => {
            const { data: signed, error: signError } = await supabaseAdmin.storage.from('photos').createSignedUrl(`${owner.data}/${hash}.jpg`, 300);
            if (signError || !signed) throw new Error('Não foi possível carregar as fotos.');
            const path = new URL(signed.signedUrl);
            return `${import.meta.env.VITE_SUPABASE_URL}${path.pathname}${path.search}`;
          })();
          photoUrls.set(hash, pending);
        }
        return pending;
      }
      if (Array.isArray(value)) return Promise.all(value.map(resolve));
      if (value && typeof value === 'object') { const out: Record<string, unknown> = {}; for (const [k, v] of Object.entries(value)) out[k] = await resolve(v); return out; }
      return value;
    }
    return normalizeReport(await resolve(raw) as Report);
  });