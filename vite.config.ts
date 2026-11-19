import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base = nome del repository, perché GitHub Pages pubblica su /sci-carving-app/
export default defineConfig({
  base: '/sci-carving-app/',
  plugins: [react()],
});
