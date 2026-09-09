-- Spirit Parade — แก้หลังตัดระบบฤดูทิ้ง (รันใน Supabase → SQL Editor ครั้งเดียว)
-- เดิม tick ถูกจำกัดไว้ < 720 เพราะ 1 ฤดู = 720 tick
-- ตอนนี้เมืองเดินไปเรื่อยๆ ไม่มีฤดู tick จึงนับสะสมจาก EPOCH ตลอดไป
-- อาการถ้าไม่รัน: กดปุ่มจ้างแล้วได้ HTTP 400 (actions_tick_check)

alter table public.actions drop constraint if exists actions_tick_check;
alter table public.actions add  constraint actions_tick_check check (tick >= 0);

-- ล้างแถวทดสอบที่ค้างจากตอนตั้งระบบ (ฤดู 0 กับ probe) ถ้ามี
delete from public.actions where season = 0;
