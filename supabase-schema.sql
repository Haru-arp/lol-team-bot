-- 1. 유저 연동 (글로벌)
create table users (
  discord_id text primary key,
  riot_id text not null,
  puuid text not null unique,
  summoner_name text,
  created_at timestamptz default now()
);

-- 2. 라인 선호도
create table lane_preferences (
  discord_id text primary key references users(discord_id),
  primary_lane text not null,
  secondary_lane text,
  updated_at timestamptz default now()
);

-- 3. 내전 기록 (서버별)
create table matches (
  id uuid default gen_random_uuid() primary key,
  guild_id text not null,
  team1 jsonb not null,
  team2 jsonb not null,
  winner text,
  played_at timestamptz default now()
);

create index idx_matches_guild on matches(guild_id);

-- 4. 서버별 유저 통계
create table server_stats (
  discord_id text not null,
  guild_id text not null,
  wins int default 0,
  losses int default 0,
  primary key (discord_id, guild_id)
);

-- 5. RPC 함수: 승리 기록
create or replace function increment_wins(p_discord_id text, p_guild_id text)
returns void as $$
begin
  insert into server_stats (discord_id, guild_id, wins, losses)
  values (p_discord_id, p_guild_id, 1, 0)
  on conflict (discord_id, guild_id)
  do update set wins = server_stats.wins + 1;
end;
$$ language plpgsql;

-- 6. RPC 함수: 패배 기록
create or replace function increment_losses(p_discord_id text, p_guild_id text)
returns void as $$
begin
  insert into server_stats (discord_id, guild_id, wins, losses)
  values (p_discord_id, p_guild_id, 0, 1)
  on conflict (discord_id, guild_id)
  do update set losses = server_stats.losses + 1;
end;
$$ language plpgsql;
