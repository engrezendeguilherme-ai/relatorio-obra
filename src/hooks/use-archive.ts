import { useCallback, useEffect, useRef, useState } from 'react';
import { get, set } from '@/lib/cloud-store';
import { toast } from 'sonner';
import type { Correction, SavedReport } from '@/lib/correction-model';
import { updateArchive } from '@/lib/archive-model';

const REPORTS_KEY = 'saved-reports-v1', CORRECTIONS_KEY = 'corrections-v1';
export function useArchive() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [corrections, setCorrections] = useState<Record<string, Correction>>({});
  const [ready, setReady] = useState(false);
  const ref = useRef<Record<string, Correction>>({});
  const queue = useRef(Promise.resolve());
  const write = async (next: Record<string, Correction>) => {
    ref.current = next; setCorrections(next);
    const pending = queue.current.catch(() => {}).then(() => set(CORRECTIONS_KEY, next));
    queue.current = pending;
    try { await pending; } catch (error) { toast.error('Não foi possível salvar no aparelho. Não feche a página e verifique o espaço disponível.'); throw error; }
  };
  useEffect(() => {
    Promise.all([get<SavedReport[]>(REPORTS_KEY), get<Record<string, Correction>>(CORRECTIONS_KEY)])
      .then(([r, c]) => { setReports(r ?? []); ref.current = c ?? {}; setCorrections(c ?? {}); setReady(true); })
      .catch(() => toast.error('Não foi possível abrir os relatórios salvos.'));
  }, []);
  const saveReports = useCallback(async (next: SavedReport[]) => {
    setReports(next);
    try { await set(REPORTS_KEY, next); } catch (error) { toast.error('Não foi possível salvar no aparelho. Verifique o espaço disponível.'); throw error; }
  }, []);
  const saveCorrection = useCallback((c: Correction) => write({ ...ref.current, [c.reportId]: c }), []);
  const removeCorrection = useCallback((id: string) => { const next = { ...ref.current }; delete next[id]; return write(next); }, []);
  return { reports, corrections, ready, saveReports, saveCorrection, removeCorrection };
}
/** Adds a copy of the current report to the saved list (used from the workspace). */
export async function archiveReport(saved: SavedReport) {
  const list = (await get<SavedReport[]>(REPORTS_KEY)) ?? [];
  const result = updateArchive(list, saved);
  if (result.previous && JSON.stringify(result.previous.report) !== JSON.stringify(result.saved.report)) {
    const key = `report-backups:${result.saved.id}`;
    const backups = await get<SavedReport[]>(key) ?? [];
    await set(key, [result.previous, ...backups].slice(0, 5));
  }
  await set(REPORTS_KEY, result.reports);
  return result;
}
