import { terser } from 'rollup-plugin-terser';
import alias from '@rollup/plugin-alias';

export default {
    input: 'src/main.js',
    treeshake: true,
    output: [
        {
            file: 'dist/three-csg.js',
            format: 'es',
        },
        {
            file: 'dist/three-csg.min.js',
            format: 'es',
            plugins: [terser()],
        },
    ],
    plugins: [
        alias({
            entries: [
                { find: 'api', replacement: './src/api/index.js' },
                { find: 'core', replacement: './src/core/index.js' },
                { find: 'math', replacement: './src/math/index.js' },
                { find: 'utils', replacement: './src/utils/index.js' },
            ],
        }),
    ],
};
