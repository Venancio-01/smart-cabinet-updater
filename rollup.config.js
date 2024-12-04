import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/bundle.js',
    format: 'cjs',
    exports: 'auto'
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json'
    }),
    resolve({
      preferBuiltins: true
    }),
    commonjs()
  ],
  external: ['node:fs', 'node:path', 'node:url', 'ssh2', 'ssh2-sftp-client']
};
