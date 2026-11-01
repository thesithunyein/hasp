create table if not exists hasp_clasp (
  id smallint primary key default 1 check (id = 1),
  phase text not null default 'open' check (phase in ('open', 'awaiting', 'settled')),
  deposit_address text,
  amount_in text,
  amount_out text,
  amount_out_usd text,
  account_id text,
  deadline timestamptz,
  notice text,
  updated_at timestamptz not null default now()
);

insert into hasp_clasp (id) values (1) on conflict do nothing;
