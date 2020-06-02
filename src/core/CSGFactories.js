import { Polygon } from 'math';
import { CSG } from 'core';

/** Construct a CSG solid from a list of `Polygon` instances.
 * @param {Polygon[]} polygons - list of polygons
 * @returns {CSG} new CSG object
 */
const fromPolygons = function (polygons) {
    let csg = new CSG();
    csg.polygons = polygons;
    csg.isCanonicalized = false;
    csg.isRetesselated = false;
    return csg;
};

/** Reconstruct a CSG solid from an object with identical property names.
 * @param {Object} obj - anonymous object, typically from JSON
 * @returns {CSG} new CSG object
 */
function fromObject(obj) {
    let polygons = obj.polygons.map(function (p) {
        return Polygon.fromObject(p);
    });
    let csg = fromPolygons(polygons);
    csg.isCanonicalized = obj.isCanonicalized;
    csg.isRetesselated = obj.isRetesselated;
    return csg;
}

export { fromPolygons };
