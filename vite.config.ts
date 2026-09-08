import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages เสิร์ฟที่ /spirit-parade/ ไม่ใช่ราก — ต้องตรงกับชื่อ repo
  base: process.env.GITHUB_ACTIONS ? '/spirit-parade/' : '/',
  plugins: [react()],
})
