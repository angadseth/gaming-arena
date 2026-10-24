import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Production-only Content-Security-Policy. GitHub Pages cannot send
// headers, so it goes in a <meta> tag; dev skips it because Vite injects
// inline scripts.
function csp(supabaseUrl: string): Plugin {
  const host = supabaseUrl ? new URL(supabaseUrl).host : ''
  const policy = [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    `img-src 'self' data: blob:${host ? ` https://${host}` : ''}`,
    `connect-src 'self'${host ? ` https://${host} wss://${host}` : ''}`,
    'frame-src https://challenges.cloudflare.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ')
  return {
    name: 'pugmark-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    // Relative base works for a project page (user.github.io/repo/) and a custom domain.
    base: './',
    plugins: [react(), csp(env.VITE_SUPABASE_URL ?? '')],
    optimizeDeps: { exclude: ['@electric-sql/pglite'] },
    server: { fs: { allow: ['..'] } },
    build: { target: 'es2022', sourcemap: false },
  }
})
