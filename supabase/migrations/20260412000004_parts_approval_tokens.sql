-- Parts request approval tokens
-- Stores single-use tokenized links emailed to approvers.
-- Each token is scoped to a request + action (approve | deny) + recipient email.

CREATE TABLE public.parts_approval_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  request_id  uuid NOT NULL REFERENCES public.parts_requests(id) ON DELETE CASCADE,
  action      text NOT NULL CHECK (action IN ('approve', 'deny')),
  sent_to     text NOT NULL,
  sent_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  used        boolean NOT NULL DEFAULT false,
  used_at     timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_parts_approval_tokens_token   ON public.parts_approval_tokens(token);
CREATE INDEX idx_parts_approval_tokens_request ON public.parts_approval_tokens(request_id);
CREATE INDEX idx_parts_approval_tokens_sent_by ON public.parts_approval_tokens(sent_by);

ALTER TABLE public.parts_approval_tokens ENABLE ROW LEVEL SECURITY;

-- Managers/admins can view tokens they created
CREATE POLICY "parts_approval_tokens_select"
  ON public.parts_approval_tokens FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid())
    IN ('Manager', 'Admin', 'Super Admin')
  );
