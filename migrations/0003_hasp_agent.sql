create table if not exists hasp_agent (
  account_id text primary key,
  phase text not null default 'open' check (phase in ('open', 'awaiting', 'settled')),
  deposit_address text,
  amount_in text,
  amount_out text,
  amount_out_usd text,
  deadline timestamptz,
  notice text,
  updated_at timestamptz not null default now()
);
