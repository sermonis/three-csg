import { Vector, Vertex, Polygon } from 'math';

// FIXME : redundant code with Polygon.createFromPoints , but unuseable due to circular dependencies
/** Create a polygon from the given points.
 *
 * @param {Array[]} points - list of points
 * @param {Polygon.Shared} [shared=defaultShared] - shared property to apply
 * @param {Plane} [plane] - plane of the polygon
 *
 * @example
 * const points = [
 *   [0,  0, 0],
 *   [0, 10, 0],
 *   [0, 10, 10]
 * ]
 * let polygon = CSG.Polygon.createFromPoints(points)
 */
const polygonFromPoints = function (points, shared, plane) {
    let vertices = [];
    points.map(function (p) {
        let vec = new Vector(p);
        let vertex = new Vertex(vec);
        vertices.push(vertex);
    });

    let polygon;
    if (arguments.length < 3) {
        polygon = new Polygon(vertices, shared);
    } else {
        polygon = new Polygon(vertices, shared, plane);
    }
    return polygon;
};

export default polygonFromPoints;
