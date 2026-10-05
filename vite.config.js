import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { githubAuthApi } from './server/githubAuth.js';

export default defineConfig(({ mode }) => {
  const serverEnv = {
    ...loadEnv(mode, process.cwd(), ''),
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || (mode === 'production' ? 'production' : 'development'),
  };

  return {
    plugins: [react(), githubAuthApi(serverEnv)],
  };
});
