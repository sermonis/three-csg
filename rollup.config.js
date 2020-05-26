import { terser } from 'rollup-plugin-terser';

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
};
