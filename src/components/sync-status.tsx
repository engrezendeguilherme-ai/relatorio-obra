import { useEffect, useSyncExternalStore } from 'react';
import { CloudCheck, CloudUpload, HardDrive, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSyncState, startSync, subscribeSync, syncPending } from '@/lib/cloud-store';

export function SyncStatus() {
  const state = useSyncExternalStore(subscribeSync, getSyncState, () => 'synced' as const);
  useEffect(startSync, []);
  return <div className="sync-status" role="status">
    {state === 'synced' ? <CloudCheck size={17} /> : state === 'syncing' ? <CloudUpload size={17} /> : <HardDrive size={17} />}
    <span>{state === 'synced' ? 'Registros sincronizados' : state === 'syncing' ? 'Salvo no aparelho · enviando para sua conta' : 'Salvo no aparelho · aguardando sincronização'}</span>
    {state !== 'synced' && <Button variant="ghost" size="icon" title="Tentar sincronizar" aria-label="Tentar sincronizar" onClick={() => void syncPending()}><RefreshCw size={17} /></Button>}
  </div>;
}