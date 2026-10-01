/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Vendor chunks: cached across deploys and keeps every chunk under the 500 kB warning. */
const vendorChunk = (id: string): string | null => {
  if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react';
  if (/node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion';
  return null;
};

/** Vercel production builds without Supabase vars silently become the fake-data demo; say so in the build log. */
const demoWarning = (): Plugin => ({
  name: 'demo-mode-warning',
  buildStart() {
    if (process.env.VERCEL_ENV === 'production' && !(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY)) {
      this.warn('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set: this PRODUCTION build runs in DEMO mode (in-browser fake data, nothing saved to a server).');
    }
  },
});

export default defineConfig({
  plugins: [react(), demoWarning()],
  build: {
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: vendorChunk }] } },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
