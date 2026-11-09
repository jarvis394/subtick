import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'

// The api and the web app share the repo-root .env (see @subtick/config), so the proxy follows its
// API_PORT instead of assuming 3000 is free.
export default defineConfig(({ mode }) => {
  const { API_PORT = '3000' } = loadEnv(mode, new URL('../..', import.meta.url).pathname, '')

  return {
    resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
    server: {
      port: 5173,
      strictPort: true,
      host: true,
      // Same origin for the browser: cookies are first-party and Steam's return URL works.
      proxy: { '/api': { target: `http://localhost:${API_PORT}`, changeOrigin: false } },
    },
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      babel({ presets: [reactCompilerPreset({ panicThreshold: 'all_errors' })] }),
    ],
  }
})
