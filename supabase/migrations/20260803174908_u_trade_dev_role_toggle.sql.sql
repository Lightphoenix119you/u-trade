-- Dev-only: SECURITY DEFINER function to toggle current user's role between 'student' and 'admin'
-- This is temporary for development purposes and should be removed before production.
CREATE OR REPLACE FUNCTION public.dev_toggle_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_role text;
  new_role text;
BEGIN
  SELECT role INTO current_role FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil introuvable';
  END IF;

  new_role := CASE WHEN current_role = 'admin' THEN 'student' ELSE 'admin' END;

  UPDATE public.profiles SET role = new_role, updated_at = now() WHERE id = auth.uid();

  RETURN new_role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dev_toggle_role() TO authenticated;
