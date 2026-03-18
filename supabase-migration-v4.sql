-- 패치노트 공지 채널 설정 (서버별)
create table bot_settings (
  guild_id text not null,
  key text not null,
  value text not null,
  primary key (guild_id, key)
);

-- 마지막 공지 버전 추적 (서버별)
create table patch_history (
  guild_id text primary key,
  last_version text not null,
  notified_at timestamptz default now()
);
