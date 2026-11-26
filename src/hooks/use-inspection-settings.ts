import { useEffect, useState } from 'react';
import { get, set } from '@/lib/cloud-store';
import { upgradeInspectionSettings, INSPECTION_SETTINGS_VERSION, validateDecisions, type InspectionSettings } from '@/lib/inspection-settings';

const KEY = 'inspection-settings-v1';
export function useInspectionSettings() {
  const [settings, setSettings] = useState<InspectionSettings>(() => upgradeInspectionSettings());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void get<InspectionSettings>(KEY).then(async stored => {
      if (!active) return;
      const next = upgradeInspectionSettings(stored && !validateDecisions(stored.decisions) ? stored : undefined);
      if (next !== stored) await set(KEY, next);
      if (!active) return;
      setSettings(next);
      setReady(true);
    }).catch(() => { if (active) setError('Não foi possível abrir as configurações. Recarregue a página.'); });
    return () => { active = false; };
  }, []);
  async function save(decisions: string[]) {
    const message = validateDecisions(decisions);
    if (message) throw new Error(message);
    const next = { decisions: decisions.map(value => value.trim()), version: INSPECTION_SETTINGS_VERSION };
    await set(KEY, next);
    setSettings(next);
  }
  return { settings, ready, error, save };
}