import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import { defineConfig } from 'rollup';

export default defineConfig({
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/tracker.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    {
      file: 'dist/tracker.umd.js',
      format: 'umd',
      name: 'EventGadget',
      sourcemap: true,
      globals: { zod: 'zod' },
    },
  ],
  external: [],
  plugins: [
    resolve(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: './dist',
    }),
  ],
});
