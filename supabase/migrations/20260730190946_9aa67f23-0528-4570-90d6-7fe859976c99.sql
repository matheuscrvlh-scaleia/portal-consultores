-- Política: usuários veem apenas seus próprios papéis; admins veem todos.
create policy "Users can read own roles, admins can read all"
on public.user_roles
for select
using (
  auth.uid() = user_id
  or public.has_role(auth.uid(), 'admin')
);

-- Revogar EXECUTE público da função security definer e restringir a roles autenticadas.
revoke execute on function public.has_role(uuid, public.app_role) from public;
revoke execute on function public.has_role(uuid, public.app_role) from anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;
