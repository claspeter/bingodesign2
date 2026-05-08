import { defineConfig } from 'vite'

export default defineConfig({
  base: '/bingodesign2/',
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
})
