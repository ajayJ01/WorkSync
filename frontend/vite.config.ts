const { defineConfig } = require('vite');
const vue = require('@vitejs/plugin-vue');
const path = require('path');

module.exports = defineConfig({
  base: '/WorkSync/',
  plugins: [vue()],
    server: {
    host: 'localhost',
    port: 5173,
    open: '/login',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
