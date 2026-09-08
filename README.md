# Spirit Parade

God-sim ในโลกนิยาย Spirit Parade — ผู้เล่นเป็นผีปู่ตา มองลงมาที่เมืองที่คนกับผีอยู่ร่วมกัน
สั่งตรงไม่ได้ ทำได้แค่ **ดลใจ · ปกปัก · ให้ลาง** แล้วนั่งดูว่าเมืองจะไปทางไหน

**ความกลัวมีสองด้าน** — กลัวขึ้น คนเซ่นไหว้มากขึ้น ศรัทธาเพิ่ม · กลัวเกินเพดาน คนหนีออกเมือง ศรัทธาแห้งตาย

- 📄 `context.md` — **อ่านก่อนแก้โค้ด** (domain, business rules, scope)
- 📄 `LORE.md` — โลก/ตัวละคร/สถานที่จากนิยาย
- 📄 `src/sim.ts` — simulation core + `selfCheck()` (รันเองตอน `npm run dev` ดู console)

```bash
npm install
npm run dev
```

Save อยู่ใน localStorage · เมืองเดินต่อตอนปิดเครื่อง (สูงสุด 3 วัน)

## Status — v0.1 (Phase 1)
เมืองเดินเอง · 12 ชาวเมือง · 3 พลัง · event log ภาษาไทย · offline progress
**Phase 2 (ยังไม่ทำ):** ร่างทรง · หมอผีปลอม · PvP · PvW
