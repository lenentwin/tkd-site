import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const address = loadEnv(mode, process.cwd(), "VITE_").VITE_API_BASE_URL;
  if (address?.trim()) {
    const url = new URL(address.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      throw new Error("Invalid public VITE_API_BASE_URL; use HTTPS without credentials/query/fragment");
    }
  }
  return {
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { sourcemap: false },
  };
});
