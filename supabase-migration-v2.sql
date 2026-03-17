create extension if not exists pgcrypto;

alter table lane_preferences drop constraint if exists lane_preferences_discord_id_fkey;

alter table users add column if not exists id uuid default gen_random_uuid();
update users set id = gen_random_uuid() where id is null;
alter table users alter column id set not null;

alter table users drop constraint if exists users_pkey;
alter table users add constraint users_pkey primary key (id);

alter table users add column if not exists is_primary boolean not null default false;
update users set is_primary = true where is_primary = false;

create unique index if not exists users_riot_id_key on users(riot_id);
create index if not exists idx_users_discord_id on users(discord_id);
create unique index if not exists idx_users_primary_per_discord on users(discord_id) where is_primary;
