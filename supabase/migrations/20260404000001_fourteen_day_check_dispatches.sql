-- fourteen_day_check_dispatches — tracks every email dispatch of the check link

CREATE TABLE public.fourteen_day_check_dispatches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id      uuid NOT NULL REFERENCES public.fourteen_day_check_tokens(id) ON DELETE CASCADE,
  aircraft_id   uuid NOT NULL REFERENCES public.aircraft(id),
  sent_to_name  text NOT NULL,
  sent_to_email text NOT NULL,
  sent_by       uuid NOT NULL REFERENCES public.profiles(id),
  sent_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fdcd_token   ON public.fourteen_day_check_dispatches(token_id);
CREATE INDEX idx_fdcd_sent_at ON public.fourteen_day_check_dispatches(sent_at DESC);

ALTER TABLE public.fourteen_day_check_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fdcd_select" ON public.fourteen_day_check_dispatches
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "fdcd_insert" ON public.fourteen_day_check_dispatches
  FOR INSERT WITH CHECK (is_admin_or_super(auth.uid()));
