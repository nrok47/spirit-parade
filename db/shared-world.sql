-- Spirit Parade — โลกร่วม (รันใน Supabase Dashboard → SQL Editor ครั้งเดียว)
-- ไม่มี game server: server เก็บแค่ "รายการของที่คนใส่" แบบ append-only
-- แล้ว client ทุกเครื่อง replay ทับ deterministic sim เอง

create table if not exists public.actions (
  id             bigserial primary key,
  season         int  not null,
  tick           int  not null check (tick >= 0 and tick < 720),
  player         text not null check (char_length(player) between 2 and 24),
  avatar         text not null check (avatar in ('pootah','ghost','shaman','police')),
  power          text not null check (char_length(power) <= 24),
  target_citizen int,
  target_zone    text check (target_zone is null or char_length(target_zone) <= 24),
  px             real not null check (px >= 0 and px <= 100),
  py             real not null check (py >= 0 and py <= 100),
  created_at     timestamptz not null default now()
);

create index if not exists actions_season_tick on public.actions (season, tick, id);

alter table public.actions enable row level security;

-- ใครก็อ่านได้ (เมืองเป็นของทุกคน) และใส่ของได้ แต่แก้/ลบของที่ใส่ไปแล้วไม่ได้
drop policy if exists actions_read on public.actions;
create policy actions_read on public.actions for select to anon using (true);

drop policy if exists actions_insert on public.actions;
create policy actions_insert on public.actions for insert to anon with check (true);
-- ไม่มี policy update/delete = ทำไม่ได้เลย ประวัติเมืองลบไม่ได้

-- ล้างฤดูเก่าทิ้ง (เรียกเองเป็นครั้งคราว ไม่ได้ตั้ง cron)
-- delete from public.actions where season < (select max(season) from public.actions) - 2;
