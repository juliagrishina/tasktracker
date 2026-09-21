-- Epic 11 / Task 9: the public profile is the canonical application copy of
-- the display name.  Auth remains canonical for email and confirmation state.

create or replace function public.sync_profile_display_name_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set display_name = nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '')
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists auth_user_profile_display_name_sync on auth.users;
create trigger auth_user_profile_display_name_sync
  after update of raw_user_meta_data on auth.users
  for each row
  when (old.raw_user_meta_data ->> 'display_name' is distinct from new.raw_user_meta_data ->> 'display_name')
  execute function public.sync_profile_display_name_from_auth();
