import { Tree, Properties } from 'core';
import { Vector } from 'math';

/** Class CSG
 * Holds a binary space partition tree representing a 3D solid. Two solids can
 * be combined using the `union()`, `subtract()`, and `intersect()` methods.
 * @constructor
 */
let CSG = function () {
    this.polygons = [];
    this.properties = new Properties();
};

CSG.prototype = {
    /**
     * Return a new CSG solid representing the space in either this solid or
     * in the given solids. Neither this solid nor the given solids are modified.
     * @param {CSG[]} csg - list of CSG objects
     * @returns {CSG} new CSG object
     * @example
     * let C = A.union(B)
     * @example
     * +-------+            +-------+
     * |       |            |       |
     * |   A   |            |       |
     * |    +--+----+   =   |       +----+
     * +----+--+    |       +----+       |
     *      |   B   |            |       |
     *      |       |            |       |
     *      +-------+            +-------+
     */
    union: function (csg) {
        let csgs;
        if (csg instanceof Array) {
            csgs = csg.slice(0);
            csgs.push(this);
        } else {
            csgs = [this, csg];
        }

        let i;
        // combine csg pairs in a way that forms a balanced binary tree pattern
        for (i = 1; i < csgs.length; i += 2) {
            csgs.push(csgs[i - 1].unionSub(csgs[i]));
        }
        return csgs[i - 1];
    },

    unionSub: function (csg) {
        if (!this.mayOverlap(csg)) {
            let newpolygons = this.polygons.concat(csg.polygons);
            let result = this.fromPolygons(newpolygons);
            result.properties = this.properties._merge(csg.properties);
            return result;
        } else {
            let a = new Tree(this.polygons);
            let b = new Tree(csg.polygons);
            a.clipTo(b, false);

            // b.clipTo(a, true); // ERROR: this doesn't work
            b.clipTo(a);
            b.invert();
            b.clipTo(a);
            b.invert();

            let newpolygons = a.allPolygons().concat(b.allPolygons());
            let result = this.fromPolygons(newpolygons);
            result.properties = this.properties._merge(csg.properties);
            return result;
        }
    },

    /**
     * Return a new CSG solid representing space in this solid but
     * not in the given solids. Neither this solid nor the given solids are modified.
     * @param {CSG[]} csg - list of CSG objects
     * @returns {CSG} new CSG object
     * @example
     * let C = A.subtract(B)
     * @example
     * +-------+            +-------+
     * |       |            |       |
     * |   A   |            |       |
     * |    +--+----+   =   |    +--+
     * +----+--+    |       +----+
     *      |   B   |
     *      |       |
     *      +-------+
     */
    subtract: function (csg) {
        let csgs;
        if (csg instanceof Array) {
            csgs = csg;
        } else {
            csgs = [csg];
        }
        let result = this;
        for (let i = 0; i < csgs.length; i++) {
            let islast = i === csgs.length - 1;
            result = result.subtractSub(csgs[i], islast, islast);
        }
        return result;
    },

    subtractSub: function (csg) {
        let a = new Tree(this.polygons);
        let b = new Tree(csg.polygons);
        a.invert();
        a.clipTo(b);
        b.clipTo(a, true);
        a.addPolygons(b.allPolygons());
        a.invert();
        let result = this.fromPolygons(a.allPolygons());
        result.properties = this.properties._merge(csg.properties);
        return result;
    },

    /**
     * Return a new CSG solid representing space in both this solid and
     * in the given solids. Neither this solid nor the given solids are modified.
     * @param {CSG[]} csg - list of CSG objects
     * @returns {CSG} new CSG object
     * @example
     * let C = A.intersect(B)
     * @example
     * +-------+
     * |       |
     * |   A   |
     * |    +--+----+   =   +--+
     * +----+--+    |       +--+
     *      |   B   |
     *      |       |
     *      +-------+
     */
    intersect: function (csg) {
        let csgs;
        if (csg instanceof Array) {
            csgs = csg;
        } else {
            csgs = [csg];
        }
        let result = this;
        for (let i = 0; i < csgs.length; i++) {
            let islast = i === csgs.length - 1;
            result = result.intersectSub(csgs[i], islast, islast);
        }
        return result;
    },

    intersectSub: function (csg) {
        let a = new Tree(this.polygons);
        let b = new Tree(csg.polygons);
        a.invert();
        b.clipTo(a);
        b.invert();
        a.clipTo(b);
        b.clipTo(a);
        a.addPolygons(b.allPolygons());
        a.invert();
        let result = this.fromPolygons(a.allPolygons());
        result.properties = this.properties._merge(csg.properties);
        return result;
    },

    fromPolygons: function (polygons) {
        let csg = new CSG();
        csg.polygons = polygons;
        return csg;
    },

    bounds: function (csg = this) {
        if (!csg.cachedBoundingBox) {
            let minpoint = new Vector(0, 0, 0);
            let maxpoint = new Vector(0, 0, 0);
            let polygons = csg.polygons;
            let numpolygons = polygons.length;
            for (let i = 0; i < numpolygons; i++) {
                let polygon = polygons[i];
                let myBounds = polygon.boundingBox();
                if (i === 0) {
                    minpoint = myBounds[0];
                    maxpoint = myBounds[1];
                } else {
                    minpoint = minpoint.min(myBounds[0]);
                    maxpoint = maxpoint.max(myBounds[1]);
                }
            }
            // FIXME: not ideal, we are mutating the input, we need to move some of it out
            csg.cachedBoundingBox = [minpoint, maxpoint];
        }
        return csg.cachedBoundingBox;
    },

    // ALIAS !
    getBounds: function () {
        return this.bounds();
    },

    /** returns true if there is a possibility that the two solids overlap
     * returns false if we can be sure that they do not overlap
     * NOTE: this is critical as it is used in UNIONs
     * @param  {CSG} csg
     */
    mayOverlap: function (csg) {
        if (this.polygons.length === 0 || csg.polygons.length === 0) {
            return false;
        } else {
            let mybounds = this.bounds();
            let otherbounds = this.bounds(csg);
            if (mybounds[1].x < otherbounds[0].x) return false;
            if (mybounds[0].x > otherbounds[1].x) return false;
            if (mybounds[1].y < otherbounds[0].y) return false;
            if (mybounds[0].y > otherbounds[1].y) return false;
            if (mybounds[1].z < otherbounds[0].z) return false;
            if (mybounds[0].z > otherbounds[1].z) return false;
            return true;
        }
    },

    setColor: function (args) {
        this.polygons.forEach((polygon) => {
            polygon.shared.color = args;
        });
    },
};

export default CSG;
