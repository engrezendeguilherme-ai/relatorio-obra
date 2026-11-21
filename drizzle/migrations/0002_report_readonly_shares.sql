CREATE TABLE public.report_shares (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 report_id uuid NOT NULL,
 token_hash text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, report_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_shares TO authenticated;
GRANT ALL ON public.report_shares TO service_role;
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages report links" ON public.report_shares FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE FUNCTION public.read_shared_report(_hash text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT jsonb_build_object('owner', s.user_id, 'report', r->'report')
 FROM public.report_shares s
 JOIN public.user_data d ON d.user_id = s.user_id AND d.key = 'saved-reports-v1'
 CROSS JOIN LATERAL jsonb_array_elements(d.value) r
 WHERE s.token_hash = _hash AND length(_hash) = 64 AND r->>'id' = s.report_id::text
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.read_shared_report(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_shared_report(text) TO anon, authenticated, service_role;