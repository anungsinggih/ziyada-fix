insert into public.signup_whitelist (email, invited_role)
values
  ('admin1@ziyada.com', 'ADMIN'),
  ('admin2@ziyada.com', 'ADMIN'),
  ('admin3@ziyada.com', 'ADMIN')
on conflict (email) do update
set invited_role = excluded.invited_role,
    invited_at = now();
