/*
 * See the LICENSE file for license.
 */

import { exportThreeGeometry, runOperation } from 'utils';

// TODO: FIXME: KILL THIS!!!! Tag factory: we can request a unique tag through _CSG.getTag()
window.staticTag = 1;
window.getTag = () => window.staticTag++;

// create user interface
const CSG = {
    BufferGeometry: exportThreeGeometry,
    union: runOperation.bind(undefined, 'union'),
    subtract: runOperation.bind(undefined, 'subtract'),
    intersect: runOperation.bind(undefined, 'intersect'),
};
window.CSG = CSG;

export default CSG;
