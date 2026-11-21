import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ContinuousCamera({ onPhoto, onClose, onFallback }: { onPhoto: (file: File) => Promise<void>; onClose: () => void; onFallback: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let stream: MediaStream | undefined;
    void navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(s => {
      if (!active) { s.getTracks().forEach(t => t.stop()); return; }
      stream = s;
      if (video.current) { video.current.srcObject = s; void video.current.play().catch(() => setError('Não foi possível iniciar a câmera.')); }
    }).catch(() => setError('Câmera indisponível. Permita o acesso à câmera ou use a câmera do aparelho.'));
    if (!navigator.mediaDevices?.getUserMedia) setError('Este navegador não oferece câmera contínua.');
    return () => { active = false; stream?.getTracks().forEach(t => t.stop()); };
  }, []);
  async function capture() {
    const v = video.current;
    if (!v?.videoWidth || busy) return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1280 / v.videoWidth);
      canvas.width = Math.round(v.videoWidth * scale); canvas.height = Math.round(v.videoHeight * scale);
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error();
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error()), 'image/jpeg', 0.8));
      await onPhoto(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      setCount(n => n + 1);
    } catch { setError('Não foi possível anexar esta foto. Tente novamente.'); }
    finally { setBusy(false); }
  }
  return <section className="continuous-camera">
    <video ref={video} muted playsInline onLoadedMetadata={() => setReady(true)} aria-label="Câmera ao vivo" />
    {error && <p role="alert">{error}</p>}
    <div className="flex flex-wrap items-center justify-center gap-3 p-3">
      <span className="text-sm">{count} fotos anexadas</span>
      {!error ? <Button type="button" disabled={!ready || busy} onClick={() => void capture()}><Camera />{busy ? 'Anexando...' : 'Tirar foto'}</Button> : <Button type="button" variant="outline" onClick={onFallback}><Camera />Câmera do aparelho</Button>}
      <Button type="button" variant="outline" disabled={busy} onClick={onClose}><X />Concluir fotos</Button>
    </div>
  </section>;
}