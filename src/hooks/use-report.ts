import { useEffect, useRef, useState } from 'react';
import { get, set } from 'idb-keyval';
import { toast } from 'sonner';
import { emptyReport, normalizeReport, shouldInitializeExample, type Report } from '@/lib/report-model';
import { makeExampleReport } from '@/lib/example-report';

const STORAGE_KEY = 'peca-a-peca-report-v1';
export function useReport() {
  const [report, setReport] = useState<Report>(emptyReport);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading');
  const lastSaved = useRef('');
  const queue = useRef(Promise.resolve());
  const notified = useRef(false);
  useEffect(() => {
    let active = true;
    Promise.all([get<Report>(STORAGE_KEY), get<boolean>('example-report-initialized-v1')]).then(async ([stored, initialized]) => {
      const useExample = shouldInitializeExample(stored, initialized);
      const initial = useExample ? await makeExampleReport() : stored ? normalizeReport(stored) : { ...emptyReport(), date: new Date().toLocaleDateString('sv-SE') };
      if (!active) return;
      if (!initialized) { if (useExample) await set(STORAGE_KEY, initial); await set('example-report-initialized-v1', true); }
      lastSaved.current = JSON.stringify(initial); setReport(initial); setReady(true); setStatus('saved');
    }).catch(() => { if (active) { setStatus('error'); toast.error('Não foi possível abrir os dados salvos. Recarregue a página.'); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const serialized = JSON.stringify(report);
    if (serialized === lastSaved.current) return;
    setStatus('saving');
    queue.current = queue.current.catch(() => {}).then(async () => {
      try {
        await set(STORAGE_KEY, report); lastSaved.current = serialized; setStatus('saved');
        if (!notified.current) { toast.success('Alterações salvas neste navegador'); notified.current = true; }
      } catch { setStatus('error'); toast.error('Não foi possível salvar. Libere espaço no dispositivo e tente novamente.'); }
    });
  }, [report, ready]);
  return { report, setReport, ready, status };
}