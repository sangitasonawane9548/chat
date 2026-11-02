import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isHttps = mode === 'https' || process.env.HTTPS === 'true' || process.env.VITE_HTTPS === 'true';

  return {
    plugins: [
      react(),
      isHttps ? basicSsl() : null
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: true,
      allowedHosts: true,
      cors: {
        origin: (origin, cb) => cb(null, true),
        credentials: true,
      },
      https: isHttps,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: 'http://localhost:5000',
          ws: true,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        }
      }
    },
  };
});

