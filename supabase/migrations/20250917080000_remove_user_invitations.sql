-- Drop invitation artifacts now that onboarding relies solely on Google sign-in

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'user_invitations'
    ) THEN
        DROP TABLE public.user_invitations;
    END IF;
END $$;

DROP TYPE IF EXISTS public.invite_status;
