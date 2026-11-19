import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const Route = createFileRoute('/auth')({
  head: () => ({ meta: [{ title: 'Entrar — Relatórios da estrutura metálica' }, { name: 'description', content: 'Entre para acessar seus relatórios em qualquer aparelho.' }, { property: 'og:title', content: 'Entrar — Relatórios da estrutura metálica' }, { property: 'og:description', content: 'Entre para acessar seus relatórios em qualquer aparelho.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => { if (data.user) void navigate({ to: '/', replace: true }); }); }, [navigate]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      if (mode === 'in') { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; await navigate({ to: '/', replace: true }); }
      else { const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } }); if (error) throw error; toast.success('Conta criada. Confirme pelo link enviado ao seu e-mail.'); setMode('in'); }
    } catch (err) { toast.error(err instanceof Error && /Invalid login/i.test(err.message) ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Verifique os dados.'); }
    finally { setBusy(false); }
  }
  async function social(provider: 'google' | 'lovable') {
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (r.error) { toast.error('Não foi possível entrar com Google.'); return; }
    if (!r.redirected) await navigate({ to: '/', replace: true });
  }
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
    <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Relatórios da estrutura metálica</h1>
      <p className="mt-1 text-sm text-muted-foreground">{mode === 'in' ? 'Entre para ver seus relatórios em qualquer aparelho.' : 'Crie sua conta.'}</p>
      <Button type="button" variant="outline" className="mt-5 h-11 w-full" onClick={() => void social('google')}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
        Continuar com Google
      </Button>
      <Button type="button" variant="outline" className="mt-2 h-11 w-full" onClick={() => void social('lovable')}>Continuar com Lovable</Button>
      <div className="my-4 text-center text-xs text-muted-foreground">ou</div>
      <form className="space-y-3" onSubmit={e => void submit(e)}>
        <div><Label htmlFor="email">E-mail</Label><Input id="email" type="email" required autoComplete="email" className="h-11" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><Label htmlFor="password">Senha</Label><Input id="password" type="password" required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} className="h-11" value={password} onChange={e => setPassword(e.target.value)} /></div>
        <Button type="submit" className="h-11 w-full" disabled={busy}>{mode === 'in' ? 'Entrar' : 'Criar conta'}</Button>
      </form>
      <Button type="button" variant="link" className="mt-4 h-11 w-full" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>{mode === 'in' ? 'Não tem conta? Criar conta' : 'Já tem conta? Entrar'}</Button>
    </div>
  </main>;
}
