import { defineConfig } from 'vite'
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';

const VITE_PORT = 3000;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), vuetify( { autoImport: true })],
  resolve: {
    alias: {
      '/@': resolve(__dirname, './src'),
    },
  },
  base: './',

})
