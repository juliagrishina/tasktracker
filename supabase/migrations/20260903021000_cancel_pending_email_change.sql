-- Auth does not expose a public endpoint for withdrawing an email-change OTP.
-- This function is deliberately user-scoped: the authenticated JWT supplies
-- auth.uid(), so a caller cannot cancel another user's pending change.
create or replace function public.cancel_pending_email_change()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid := auth.uid();
begin
  if target_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  update auth.users
  set
    email_change = '',
    email_change_token_current = '',
    email_change_token_new = '',
    email_change_sent_at = null,
    email_change_confirm_status = 0
  where id = target_user_id
    and nullif(email_change, '') is not null;

  if not found then
    return false;
  end if;

  delete from auth.one_time_tokens
  where user_id = target_user_id
    and token_type = 'email_change_token_new'::auth.one_time_token_type;

  return true;
end;
$$;

revoke all on function public.cancel_pending_email_change() from public;
grant execute on function public.cancel_pending_email_change() to authenticated;
