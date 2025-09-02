import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === 'library') {
    return {
      plugins: [react()],
      build: {
        lib: {
          entry: resolve(__dirname, 'src/index.js'),
          name: 'ChessAnalysisBoard',
          formats: ['es', 'cjs'],
          fileName: (format) => `index.${format === 'es' ? 'es.js' : 'js'}`
        },
        rollupOptions: {
          external: ['react', 'react-dom'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM'
            }
          }
        }
      }
    }
  }

  // Default development config
  return {
    plugins: [react()],
  }
})
