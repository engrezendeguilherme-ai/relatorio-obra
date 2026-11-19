import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { SyncStatus } from '@/components/sync-status';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!navigator.onLine && session.session) return;
    const { data, error } = await supabase.auth.getUser();
    if (error && session.session && /fetch|network|timeout|retryable/i.test(`${error.name} ${error.message}`)) return;
    if (!data.user) throw redirect({ to: '/auth' });
  },
  component: () => <><SyncStatus /><Outlet /></>,
});
