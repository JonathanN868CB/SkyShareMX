-- ============================================================
-- Projects Module — Phase 1
-- Board → Group → Task → Subtask
-- ============================================================

-- ─── Storage bucket ─────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'projects-attachments',
  'projects-attachments',
  false,
  52428800, -- 50 MB
  ARRAY[
    'image/jpeg','image/png','image/gif','image/webp','image/bmp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ─── pm_boards ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_boards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#466481',
  description TEXT,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

ALTER TABLE public.pm_boards ENABLE ROW LEVEL SECURITY;

-- ─── pm_board_members ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_board_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID NOT NULL REFERENCES public.pm_boards(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (board_id, profile_id)
);

ALTER TABLE public.pm_board_members ENABLE ROW LEVEL SECURITY;

-- ─── pm_statuses ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_statuses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID NOT NULL REFERENCES public.pm_boards(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#466481',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_statuses ENABLE ROW LEVEL SECURITY;

-- ─── pm_groups ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES public.pm_boards(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#466481',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_groups ENABLE ROW LEVEL SECURITY;

-- ─── pm_tasks ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         UUID NOT NULL REFERENCES public.pm_groups(id) ON DELETE CASCADE,
  parent_task_id   UUID REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  champion_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status_id        UUID REFERENCES public.pm_statuses(id) ON DELETE SET NULL,
  due_date         DATE,
  completion_note  TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at      TIMESTAMPTZ
);

ALTER TABLE public.pm_tasks ENABLE ROW LEVEL SECURITY;

-- ─── pm_task_contributors ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_task_contributors (
  task_id    UUID NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, profile_id)
);

ALTER TABLE public.pm_task_contributors ENABLE ROW LEVEL SECURITY;

-- ─── pm_task_comments ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_task_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_task_comments ENABLE ROW LEVEL SECURITY;

-- ─── pm_task_attachments ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_task_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  file_size    BIGINT,
  storage_path TEXT NOT NULL,
  uploaded_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_task_attachments ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Helper: is the current user a member of this board?
-- (Super Admin always counts as a member)
CREATE OR REPLACE FUNCTION public.pm_is_board_member(board_uuid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    is_admin_or_super(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pm_board_members
      WHERE board_id   = board_uuid
        AND profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
$$;

-- Helper: get board_id for a task (traverses group)
CREATE OR REPLACE FUNCTION public.pm_task_board_id(task_uuid UUID)
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT g.board_id
  FROM public.pm_tasks t
  JOIN public.pm_groups g ON g.id = t.group_id
  WHERE t.id = task_uuid
  LIMIT 1
$$;

-- ─── pm_boards policies ──────────────────────────────────────
CREATE POLICY "pm_boards_select"
  ON public.pm_boards FOR SELECT TO authenticated
  USING (pm_is_board_member(id));

CREATE POLICY "pm_boards_insert"
  ON public.pm_boards FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "pm_boards_update"
  ON public.pm_boards FOR UPDATE TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    OR created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "pm_boards_delete"
  ON public.pm_boards FOR DELETE TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    OR created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- ─── pm_board_members policies ───────────────────────────────
CREATE POLICY "pm_board_members_select"
  ON public.pm_board_members FOR SELECT TO authenticated
  USING (pm_is_board_member(board_id));

CREATE POLICY "pm_board_members_insert"
  ON public.pm_board_members FOR INSERT TO authenticated
  WITH CHECK (
    is_admin_or_super(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pm_boards
      WHERE id = board_id
        AND created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "pm_board_members_delete"
  ON public.pm_board_members FOR DELETE TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pm_boards
      WHERE id = board_id
        AND created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
    -- a member can remove themselves
    OR profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- ─── pm_statuses policies ────────────────────────────────────
CREATE POLICY "pm_statuses_select"
  ON public.pm_statuses FOR SELECT TO authenticated
  USING (pm_is_board_member(board_id));

CREATE POLICY "pm_statuses_insert"
  ON public.pm_statuses FOR INSERT TO authenticated
  WITH CHECK (pm_is_board_member(board_id));

CREATE POLICY "pm_statuses_update"
  ON public.pm_statuses FOR UPDATE TO authenticated
  USING (pm_is_board_member(board_id));

CREATE POLICY "pm_statuses_delete"
  ON public.pm_statuses FOR DELETE TO authenticated
  USING (pm_is_board_member(board_id));

-- ─── pm_groups policies ──────────────────────────────────────
CREATE POLICY "pm_groups_select"
  ON public.pm_groups FOR SELECT TO authenticated
  USING (pm_is_board_member(board_id));

CREATE POLICY "pm_groups_insert"
  ON public.pm_groups FOR INSERT TO authenticated
  WITH CHECK (pm_is_board_member(board_id));

CREATE POLICY "pm_groups_update"
  ON public.pm_groups FOR UPDATE TO authenticated
  USING (pm_is_board_member(board_id));

CREATE POLICY "pm_groups_delete"
  ON public.pm_groups FOR DELETE TO authenticated
  USING (pm_is_board_member(board_id));

-- ─── pm_tasks policies ───────────────────────────────────────
CREATE POLICY "pm_tasks_select"
  ON public.pm_tasks FOR SELECT TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pm_board_members bm
      JOIN public.pm_groups g ON g.board_id = bm.board_id
      WHERE g.id = pm_tasks.group_id
        AND bm.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "pm_tasks_insert"
  ON public.pm_tasks FOR INSERT TO authenticated
  WITH CHECK (
    is_admin_or_super(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pm_board_members bm
      JOIN public.pm_groups g ON g.board_id = bm.board_id
      WHERE g.id = group_id
        AND bm.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "pm_tasks_update"
  ON public.pm_tasks FOR UPDATE TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pm_board_members bm
      JOIN public.pm_groups g ON g.board_id = bm.board_id
      WHERE g.id = pm_tasks.group_id
        AND bm.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "pm_tasks_delete"
  ON public.pm_tasks FOR DELETE TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    OR created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR champion_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- ─── pm_task_contributors policies ───────────────────────────
CREATE POLICY "pm_task_contributors_select"
  ON public.pm_task_contributors FOR SELECT TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pm_board_members bm
      JOIN public.pm_groups g ON g.board_id = bm.board_id
      JOIN public.pm_tasks t ON t.group_id = g.id
      WHERE t.id = pm_task_contributors.task_id
        AND bm.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "pm_task_contributors_insert"
  ON public.pm_task_contributors FOR INSERT TO authenticated
  WITH CHECK (
    is_admin_or_super(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pm_board_members bm
      JOIN public.pm_groups g ON g.board_id = bm.board_id
      JOIN public.pm_tasks t ON t.group_id = g.id
      WHERE t.id = task_id
        AND bm.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "pm_task_contributors_delete"
  ON public.pm_task_contributors FOR DELETE TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    OR profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pm_board_members bm
      JOIN public.pm_groups g ON g.board_id = bm.board_id
      JOIN public.pm_tasks t ON t.group_id = g.id
      WHERE t.id = pm_task_contributors.task_id
        AND bm.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- ─── pm_task_comments policies ───────────────────────────────
CREATE POLICY "pm_task_comments_select"
  ON public.pm_task_comments FOR SELECT TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pm_board_members bm
      JOIN public.pm_groups g ON g.board_id = bm.board_id
      JOIN public.pm_tasks t ON t.group_id = g.id
      WHERE t.id = pm_task_comments.task_id
        AND bm.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "pm_task_comments_insert"
  ON public.pm_task_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND (
      is_admin_or_super(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.pm_board_members bm
        JOIN public.pm_groups g ON g.board_id = bm.board_id
        JOIN public.pm_tasks t ON t.group_id = g.id
        WHERE t.id = task_id
          AND bm.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      )
    )
  );

CREATE POLICY "pm_task_comments_update"
  ON public.pm_task_comments FOR UPDATE TO authenticated
  USING (author_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "pm_task_comments_delete"
  ON public.pm_task_comments FOR DELETE TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    OR author_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- ─── pm_task_attachments policies ────────────────────────────
CREATE POLICY "pm_task_attachments_select"
  ON public.pm_task_attachments FOR SELECT TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pm_board_members bm
      JOIN public.pm_groups g ON g.board_id = bm.board_id
      JOIN public.pm_tasks t ON t.group_id = g.id
      WHERE t.id = pm_task_attachments.task_id
        AND bm.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "pm_task_attachments_insert"
  ON public.pm_task_attachments FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND (
      is_admin_or_super(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.pm_board_members bm
        JOIN public.pm_groups g ON g.board_id = bm.board_id
        JOIN public.pm_tasks t ON t.group_id = g.id
        WHERE t.id = task_id
          AND bm.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      )
    )
  );

CREATE POLICY "pm_task_attachments_delete"
  ON public.pm_task_attachments FOR DELETE TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    OR uploaded_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Storage policies for projects-attachments bucket
CREATE POLICY "projects_attachments_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'projects-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "projects_attachments_download"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'projects-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "projects_attachments_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'projects-attachments' AND auth.uid() IS NOT NULL);

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS pm_board_members_board_id_idx ON public.pm_board_members(board_id);
CREATE INDEX IF NOT EXISTS pm_board_members_profile_id_idx ON public.pm_board_members(profile_id);
CREATE INDEX IF NOT EXISTS pm_statuses_board_id_idx ON public.pm_statuses(board_id);
CREATE INDEX IF NOT EXISTS pm_groups_board_id_idx ON public.pm_groups(board_id);
CREATE INDEX IF NOT EXISTS pm_tasks_group_id_idx ON public.pm_tasks(group_id);
CREATE INDEX IF NOT EXISTS pm_tasks_parent_task_id_idx ON public.pm_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS pm_task_contributors_task_id_idx ON public.pm_task_contributors(task_id);
CREATE INDEX IF NOT EXISTS pm_task_comments_task_id_idx ON public.pm_task_comments(task_id);
CREATE INDEX IF NOT EXISTS pm_task_attachments_task_id_idx ON public.pm_task_attachments(task_id);
