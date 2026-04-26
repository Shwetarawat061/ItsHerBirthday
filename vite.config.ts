import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(() => {
  // GitHub Pages serves sites from /<repo>/, so Vite needs the right base.
  const repo = process.env.GITHUB_REPOSITORY?.split('/')?.[1]
  const isPages = process.env.GITHUB_PAGES === 'true'
  const base = isPages && repo ? `/${repo}/` : '/'

  return {
    base,
    plugins: [react(), tailwindcss()],
  }
})
