import { useEffect, useState } from 'react';
import { get, set } from '@/lib/cloud-store';
import { DEFAULT_DECISIONS, validateDecisions, type InspectionSettings } from '@/lib/inspection-settings';

const KEY = 'inspection-settings-v1';
export function useInspectionSettings() {
  const [settings, setSettings] = useState<InspectionSettings>({ decisions: [...DEFAULT_DECISIONS] });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void get<InspectionSettings>(KEY).then(stored => {
      if (!active) return;
      if (stored && !validateDecisions(stored.decisions)) setSettings(stored);
      setReady(true);
    }).catch(() => { if (active) setError('Não foi possível abrir as configurações. Recarregue a página.'); });
    return () => { active = false; };
  }, []);
  async function save(decisions: string[]) {
    const message = validateDecisions(decisions);
    if (message) throw new Error(message);
    const next = { decisions: decisions.map(value => value.trim()) };
    await set(KEY, next);
    setSettings(next);
  }
  return { settings, ready, error, save };
}