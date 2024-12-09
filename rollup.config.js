import typescript from '@rollup/plugin-typescript';
import resolve, { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/bundle.cjs',
    format: 'cjs',
    exports: 'auto'
  },
  plugins: [
    nodeResolve({
      preferBuiltins: true,
      exportConditions: ['node']
    }),
    typescript({
      tsconfig: './tsconfig.json',
      target: 'ES2019'
    }),
    resolve({
      preferBuiltins: true
    }),
    commonjs({
      ignoreDynamicRequires: true
    }),
  ],
  external: ['fs', 'path', 'url', 'ssh2', 'ssh2-sftp-client', 'process']
};
