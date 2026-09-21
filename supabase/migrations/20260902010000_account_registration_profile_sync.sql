-- Epic 11 / Task 6: when an existing anonymous identity receives an email
-- identity, keep its UUID and copy the supplied display name to its profile.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (id) do update
  set display_name = excluded.display_name
  where excluded.display_name is not null
    and public.profiles.display_name is distinct from excluded.display_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.handle_new_auth_user();
