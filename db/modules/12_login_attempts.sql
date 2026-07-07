-- โมดูล: กันยิงรหัสผ่านรัว (login rate-limit)
create table if not exists login_attempts (
  email text primary key,
  fails int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
