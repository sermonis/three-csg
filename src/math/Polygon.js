import { Vector, Vertex, Matrix4x4, Plane } from 'math';
import { CONSTANTS } from 'utils';

/** Class Polygon
 * Represents a convex polygon. The vertices used to initialize a polygon must
 *   be coplanar and form a convex loop. They do not have to be `Vertex`
 *   instances but they must behave similarly (duck typing can be used for
 *   customization).
 * <br>
 * Each convex polygon has a `shared` property, which is shared between all
 *   polygons that are clones of each other or were split from the same polygon.
 *   This can be used to define per-polygon properties (such as surface color).
 * <br>
 * The plane of the polygon is calculated from the vertex coordinates if not provided.
 *   The plane can alternatively be passed as the third argument to avoid calculations.
 *
 * @constructor
 * @param {Vertex[]} vertices - list of vertices
 * @param {Polygon.Shared} [shared=defaultShared] - shared property to apply
 * @param {Plane} [plane] - plane of the polygon
 *
 * @example
 * const vertices = [
 *   new CSG.Vertex(new CSG.Vector([0, 0, 0])),
 *   new CSG.Vertex(new CSG.Vector([0, 10, 0])),
 *   new CSG.Vertex(new CSG.Vector([0, 10, 10]))
 * ]
 * let observed = new Polygon(vertices)
 */
let Polygon = function (vertices, shared, plane) {
    this.vertices = vertices;
    this.shared = {
        color: shared ? shared.color : null,
        getHash: function () {
            if (!this.color) return this.color;
            return this.color.join('/');
        },
        getTag: function () {
            let result = this.tag;
            if (!result) {
                result = getTag();
                this.tag = result;
            }
            return result;
        },
    };
    // let numvertices = vertices.length;

    if (arguments.length >= 3) {
        this.plane = plane;
    } else {
        this.plane = Plane.fromVector3Ds(vertices[0].pos, vertices[1].pos, vertices[2].pos);
    }

    if (CONSTANTS._CSGDEBUG) {
        if (!this.checkIfConvex()) {
            throw new Error('Not convex!');
        }
    }
};

Polygon.prototype = {
    translate: function (offset) {
        return this.transform(Matrix4x4.translation(offset));
    },

    // returns an array with a Vector3D (center point) and a radius
    boundingSphere: function () {
        if (!this.cachedBoundingSphere) {
            let box = this.boundingBox();
            let middle = box[0].plus(box[1]).times(0.5);
            let radius3 = box[1].minus(middle);
            let radius = radius3.length();
            this.cachedBoundingSphere = [middle, radius];
        }
        return this.cachedBoundingSphere;
    },

    // returns an array of two Vector3Ds (minimum coordinates and maximum coordinates)
    boundingBox: function () {
        if (!this.cachedBoundingBox) {
            let minpoint, maxpoint;
            let vertices = this.vertices;
            let numvertices = vertices.length;
            if (numvertices === 0) {
                minpoint = new Vector(0, 0, 0);
            } else {
                minpoint = vertices[0].pos;
            }
            maxpoint = minpoint;
            for (let i = 1; i < numvertices; i++) {
                let point = vertices[i].pos;
                minpoint = minpoint.min(point);
                maxpoint = maxpoint.max(point);
            }
            this.cachedBoundingBox = [minpoint, maxpoint];
        }
        return this.cachedBoundingBox;
    },

    flipped: function () {
        let newvertices = this.vertices.map(function (v) {
            return v.flipped();
        });
        newvertices.reverse();
        let newplane = this.plane.flipped();
        return new Polygon(newvertices, this.shared, newplane);
    },
};

export default Polygon;
