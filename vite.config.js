import { defineConfig, loadEnv } from 'vite';

// GitHub Pages project URL: https://learnwithbin.github.io/oasis/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (command === 'build' && (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY)) {
    throw new Error('Set both public Supabase connection settings before building the live Oasis.');
  }
  return { base: '/oasis/' };
});
