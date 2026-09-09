ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);