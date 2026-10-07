import { defineConfig } from 'vite';

// base: './' keeps asset URLs relative so the built app can be wrapped for
// Android (Capacitor) later without any rework.
export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
    outDir: 'dist',
  },
});
