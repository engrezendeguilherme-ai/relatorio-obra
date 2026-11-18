import { useCallback, useEffect, useRef, useState } from 'react';
import { get, set } from '@/lib/cloud-store';
import { toast } from 'sonner';
import type { Correction, SavedReport } from '@/lib/correction-model';

const REPORTS_KEY = 'saved-reports-v1', CORRECTIONS_KEY = 'corrections-v1';
export function useArchive() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [corrections, setCorrections] = useState<Record<string, Correction>>({});
  const [ready, setReady] = useState(false);
  const ref = useRef<Record<string, Correction>>({});
  const write = async (next: Record<string, Correction>) => { ref.current = next; setCorrections(next); try { await set(CORRECTIONS_KEY, next); } catch { toast.error('Não foi possível salvar. Libere espaço no dispositivo.'); } };
  useEffect(() => {
    Promise.all([get<SavedReport[]>(REPORTS_KEY), get<Record<string, Correction>>(CORRECTIONS_KEY)])
      .then(([r, c]) => { setReports(r ?? []); ref.current = c ?? {}; setCorrections(c ?? {}); setReady(true); })
      .catch(() => toast.error('Não foi possível abrir os relatórios salvos.'));
  }, []);
  const saveReports = useCallback(async (next: SavedReport[]) => {
    setReports(next);
    try { await set(REPORTS_KEY, next); } catch { toast.error('Não foi possível salvar. Libere espaço no dispositivo.'); }
  }, []);
  const saveCorrection = useCallback((c: Correction) => write({ ...ref.current, [c.reportId]: c }), []);
  const removeCorrection = useCallback((id: string) => { const next = { ...ref.current }; delete next[id]; return write(next); }, []);
  return { reports, corrections, ready, saveReports, saveCorrection, removeCorrection };
}
/** Adds a copy of the current report to the saved list (used from the workspace). */
export async function archiveReport(saved: SavedReport) {
  const list = (await get<SavedReport[]>(REPORTS_KEY)) ?? [];
  await set(REPORTS_KEY, [saved, ...list]);
}
