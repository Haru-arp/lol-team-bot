create table if not exists tier_overrides (
  puuid text primary key,
  tier text not null,
  rank text not null,
  lp int not null default 0,
  updated_at timestamptz default now()
);
