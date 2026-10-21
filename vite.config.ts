/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 3000,
    open: false
  },
  test: {
    globals: true,
    environment: 'node'
  }
});
