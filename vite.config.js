import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [svelte(), tailwindcss()],

  base: './',

  build: {

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }

          // Separate chunk for Forms.svelte
          if (id.includes('src/lib/components/EmployeeForms.svelte')) {
            return 'employee-forms';
          }
        },
      },
    },
  },
});
