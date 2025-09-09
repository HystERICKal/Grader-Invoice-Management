// Import defineConfig helper from Vite.
import { defineConfig } from 'vite';
// Import React plugin for JSX support.
import react from '@vitejs/plugin-react';

// Export config object.
export default defineConfig({
  // Use React plugin.
  plugins: [react()],
  // Server config: Proxy API calls to backend to avoid CORS.
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // Backend URL.
        changeOrigin: true, // Change host header.
        secure: false // For local dev.
      }
    }
  }
});