/**
 * Returns an array of Vector, providing minimum coordinates and maximum coordinates
 * of this solid.
 * @returns {Vector[]}
 * @example
 * let bounds = A.getBounds()
 * let minX = bounds[0].x
 */
const bounds = function (csg) {
    if (!csg.cachedBoundingBox) {
        let minpoint = new Vector(0, 0, 0);
        let maxpoint = new Vector(0, 0, 0);
        let polygons = csg.polygons;
        let numpolygons = polygons.length;
        for (let i = 0; i < numpolygons; i++) {
            let polygon = polygons[i];
            let bounds = polygon.boundingBox();
            if (i === 0) {
                minpoint = bounds[0];
                maxpoint = bounds[1];
            } else {
                minpoint = minpoint.min(bounds[0]);
                maxpoint = maxpoint.max(bounds[1]);
            }
        }
        // FIXME: not ideal, we are mutating the input, we need to move some of it out
        csg.cachedBoundingBox = [minpoint, maxpoint];
    }
    return csg.cachedBoundingBox;
};

const CONSTANTS = Object.freeze({
    _CSGDEBUG: false,
    defaultResolution2D: 32, // Number of polygons per 360 degree revolution for 2D objects.
    defaultResolution3D: 12, //Number of polygons per 360 degree revolution for 3D objects.
    EPS: 0.00001, // Epsilon used during determination of near zero distances.
    angleEPS: 0.1, // Epsilon used during determination of near zero areas.
    areaEPS: 4.9916708323414084e-12, // Epsilon used during determination of near zero areas. This is the minimal area of a minimal polygon.
    all: 0,
    top: 1,
    bottom: 2,
    left: 3,
    right: 4,
    front: 5,
    back: 6,
});

/** Class CSG
 * Holds a binary space partition tree representing a 3D solid. Two solids can
 * be combined using the `union()`, `subtract()`, and `intersect()` methods.
 * @constructor
 */
let CSG = function () {
    this.polygons = [];
    this.properties = new Properties();
    this.isCanonicalized = true;
    this.isRetesselated = true;
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
        return csgs[i - 1].reTesselated().canonicalized();
    },

    unionSub: function (csg, retesselate, canonicalize) {
        if (!this.mayOverlap(csg)) {
            let newpolygons = this.polygons.concat(csg.polygons);
            let result = fromPolygons(newpolygons);
            result.properties = this.properties._merge(csg.properties);
            result.isCanonicalized = this.isCanonicalized && csg.isCanonicalized;
            result.isRetesselated = this.isRetesselated && csg.isRetesselated;
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
            let result = fromPolygons(newpolygons);
            result.properties = this.properties._merge(csg.properties);
            if (retesselate) result = result.reTesselated();
            if (canonicalize) result = result.canonicalized();
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

    subtractSub: function (csg, retesselate, canonicalize) {
        let a = new Tree(this.polygons);
        let b = new Tree(csg.polygons);
        a.invert();
        a.clipTo(b);
        b.clipTo(a, true);
        a.addPolygons(b.allPolygons());
        a.invert();
        let result = fromPolygons(a.allPolygons());
        result.properties = this.properties._merge(csg.properties);
        if (retesselate) result = result.reTesselated();
        if (canonicalize) result = result.canonicalized();
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

    intersectSub: function (csg, retesselate, canonicalize) {
        let a = new Tree(this.polygons);
        let b = new Tree(csg.polygons);
        a.invert();
        b.clipTo(a);
        b.invert();
        a.clipTo(b);
        b.clipTo(a);
        a.addPolygons(b.allPolygons());
        a.invert();
        let result = fromPolygons(a.allPolygons());
        result.properties = this.properties._merge(csg.properties);
        if (retesselate) result = result.reTesselated();
        if (canonicalize) result = result.canonicalized();
        return result;
    },

    // ALIAS !
    canonicalized: function () {
        return canonicalize(this);
    },

    // ALIAS !
    reTesselated: function () {
        return reTessellate(this);
    },

    // ALIAS !
    getBounds: function () {
        return bounds(this);
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
            let mybounds = bounds(this);
            let otherbounds = bounds(csg);
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

// ////////////////////////////////////
const FuzzyCSGFactory = function () {
    this.vertexfactory = new FuzzyFactory(3, CONSTANTS.EPS);
    this.planefactory = new FuzzyFactory(4, CONSTANTS.EPS);
    this.polygonsharedfactory = {};
};

FuzzyCSGFactory.prototype = {
    getPolygonShared: function (sourceshared) {
        let hash = sourceshared.getHash();
        if (hash in this.polygonsharedfactory) {
            return this.polygonsharedfactory[hash];
        } else {
            this.polygonsharedfactory[hash] = sourceshared;
            return sourceshared;
        }
    },

    getVertex: function (sourcevertex) {
        let elements = [sourcevertex.pos._x, sourcevertex.pos._y, sourcevertex.pos._z];
        let result = this.vertexfactory.lookupOrCreate(elements, function (els) {
            return sourcevertex;
        });
        return result;
    },

    getPlane: function (sourceplane) {
        let elements = [sourceplane.normal._x, sourceplane.normal._y, sourceplane.normal._z, sourceplane.w];
        let result = this.planefactory.lookupOrCreate(elements, function (els) {
            return sourceplane;
        });
        return result;
    },

    getPolygon: function (sourcepolygon) {
        let newplane = this.getPlane(sourcepolygon.plane);
        let newshared = this.getPolygonShared(sourcepolygon.shared);
        let _this = this;
        let newvertices = sourcepolygon.vertices.map(function (vertex) {
            return _this.getVertex(vertex);
        });
        // two vertices that were originally very close may now have become
        // truly identical (referring to the same Vertex object).
        // Remove duplicate vertices:
        let newverticesDedup = [];
        if (newvertices.length > 0) {
            let prevvertextag = newvertices[newvertices.length - 1].getTag();
            newvertices.forEach(function (vertex) {
                let vertextag = vertex.getTag();
                if (vertextag !== prevvertextag) {
                    newverticesDedup.push(vertex);
                }
                prevvertextag = vertextag;
            });
        }
        // If it's degenerate, remove all vertices:
        if (newverticesDedup.length < 3) {
            newverticesDedup = [];
        }
        return new Polygon(newverticesDedup, newshared, newplane);
    },
};

// //////////////////////////////
// ## class fuzzyFactory
// This class acts as a factory for objects. We can search for an object with approximately
// the desired properties (say a rectangle with width 2 and height 1)
// The lookupOrCreate() method looks for an existing object (for example it may find an existing rectangle
// with width 2.0001 and height 0.999. If no object is found, the user supplied callback is
// called, which should generate a new object. The new object is inserted into the database
// so it can be found by future lookupOrCreate() calls.
// Constructor:
//   numdimensions: the number of parameters for each object
//     for example for a 2D rectangle this would be 2
//   tolerance: The maximum difference for each parameter allowed to be considered a match
const FuzzyFactory = function (numdimensions, tolerance) {
    this.lookuptable = {};
    this.multiplier = 1.0 / tolerance;
};

FuzzyFactory.prototype = {
    // let obj = f.lookupOrCreate([el1, el2, el3], function(elements) {/* create the new object */});
    // Performs a fuzzy lookup of the object with the specified elements.
    // If found, returns the existing object
    // If not found, calls the supplied callback function which should create a new object with
    // the specified properties. This object is inserted in the lookup database.
    lookupOrCreate: function (els, creatorCallback) {
        let hash = '';
        let multiplier = this.multiplier;
        els.forEach(function (el) {
            let valueQuantized = Math.round(el * multiplier);
            hash += valueQuantized + '/';
        });
        if (hash in this.lookuptable) {
            return this.lookuptable[hash];
        } else {
            let object = creatorCallback(els);
            let hashparts = els.map(function (el) {
                let q0 = Math.floor(el * multiplier);
                let q1 = q0 + 1;
                return ['' + q0 + '/', '' + q1 + '/'];
            });
            let numelements = els.length;
            let numhashes = 1 << numelements;
            for (let hashmask = 0; hashmask < numhashes; ++hashmask) {
                let hashmaskShifted = hashmask;
                hash = '';
                hashparts.forEach(function (hashpart) {
                    hash += hashpart[hashmaskShifted & 1];
                    hashmaskShifted >>= 1;
                });
                this.lookuptable[hash] = object;
            }
            return object;
        }
    },
};

// ////////////////////////////////////
// # Class Properties
// This class is used to store properties of a solid
// A property can for example be a Vertex, a Plane or a Line3D
// Whenever an affine transform is applied to the CSG solid, all its properties are
// transformed as well.
// The properties can be stored in a complex nested structure (using arrays and objects)
const Properties = function () {};

Properties.prototype = {
    _transform: function (matrix4x4) {
        let result = new Properties();
        Properties.transformObj(this, result, matrix4x4);
        return result;
    },
    _merge: function (otherproperties) {
        let result = new Properties();
        Properties.cloneObj(this, result);
        Properties.addFrom(result, otherproperties);
        return result;
    },
};

Properties.transformObj = function (source, result, matrix4x4) {
    for (let propertyname in source) {
        if (propertyname === '_transform') continue;
        if (propertyname === '_merge') continue;
        let propertyvalue = source[propertyname];
        let transformed = propertyvalue;
        if (typeof propertyvalue === 'object') {
            if ('transform' in propertyvalue && typeof propertyvalue.transform === 'function') {
                transformed = propertyvalue.transform(matrix4x4);
            } else if (propertyvalue instanceof Array) {
                transformed = [];
                Properties.transformObj(propertyvalue, transformed, matrix4x4);
            } else if (propertyvalue instanceof Properties) {
                transformed = new Properties();
                Properties.transformObj(propertyvalue, transformed, matrix4x4);
            }
        }
        result[propertyname] = transformed;
    }
};

Properties.cloneObj = function (source, result) {
    for (let propertyname in source) {
        if (propertyname === '_transform') continue;
        if (propertyname === '_merge') continue;
        let propertyvalue = source[propertyname];
        let cloned = propertyvalue;
        if (typeof propertyvalue === 'object') {
            if (propertyvalue instanceof Array) {
                cloned = [];
                for (let i = 0; i < propertyvalue.length; i++) {
                    cloned.push(propertyvalue[i]);
                }
            } else if (propertyvalue instanceof Properties) {
                cloned = new Properties();
                Properties.cloneObj(propertyvalue, cloned);
            }
        }
        result[propertyname] = cloned;
    }
};

Properties.addFrom = function (result, otherproperties) {
    for (let propertyname in otherproperties) {
        if (propertyname === '_transform') continue;
        if (propertyname === '_merge') continue;
        if (
            propertyname in result &&
            typeof result[propertyname] === 'object' &&
            result[propertyname] instanceof Properties &&
            typeof otherproperties[propertyname] === 'object' &&
            otherproperties[propertyname] instanceof Properties
        ) {
            Properties.addFrom(result[propertyname], otherproperties[propertyname]);
        } else if (!(propertyname in result)) {
            result[propertyname] = otherproperties[propertyname];
        }
    }
};

// Returns object:
// .type:
//   0: coplanar-front
//   1: coplanar-back
//   2: front
//   3: back
//   4: spanning
// In case the polygon is spanning, returns:
// .front: a Polygon of the front part
// .back: a Polygon of the back part
function splitPolygonByPlane(plane, polygon) {
    let result = {
        type: null,
        front: null,
        back: null,
    };
    // cache in local lets (speedup):
    let planenormal = plane.normal;
    let vertices = polygon.vertices;
    let numvertices = vertices.length;
    if (polygon.plane.equals(plane)) {
        result.type = 0;
    } else {
        let thisw = plane.w;
        let hasfront = false;
        let hasback = false;
        let vertexIsBack = [];
        let MINEPS = -CONSTANTS.EPS;
        for (let i = 0; i < numvertices; i++) {
            let t = planenormal.dot(vertices[i].pos) - thisw;
            let isback = t < 0;
            vertexIsBack.push(isback);
            if (t > CONSTANTS.EPS) hasfront = true;
            if (t < MINEPS) hasback = true;
        }
        if (!hasfront && !hasback) {
            // all points coplanar
            let t = planenormal.dot(polygon.plane.normal);
            result.type = t >= 0 ? 0 : 1;
        } else if (!hasback) {
            result.type = 2;
        } else if (!hasfront) {
            result.type = 3;
        } else {
            // spanning
            result.type = 4;
            let frontvertices = [];
            let backvertices = [];
            let isback = vertexIsBack[0];
            for (let vertexindex = 0; vertexindex < numvertices; vertexindex++) {
                let vertex = vertices[vertexindex];
                let nextvertexindex = vertexindex + 1;
                if (nextvertexindex >= numvertices) nextvertexindex = 0;
                let nextisback = vertexIsBack[nextvertexindex];
                if (isback === nextisback) {
                    // line segment is on one side of the plane:
                    if (isback) {
                        backvertices.push(vertex);
                    } else {
                        frontvertices.push(vertex);
                    }
                } else {
                    // line segment intersects plane:
                    let point = vertex.pos;
                    let nextpoint = vertices[nextvertexindex].pos;
                    let intersectionpoint = plane.splitLineBetweenPoints(point, nextpoint);
                    let intersectionvertex = new Vertex(intersectionpoint);
                    if (isback) {
                        backvertices.push(vertex);
                        backvertices.push(intersectionvertex);
                        frontvertices.push(intersectionvertex);
                    } else {
                        frontvertices.push(vertex);
                        frontvertices.push(intersectionvertex);
                        backvertices.push(intersectionvertex);
                    }
                }
                isback = nextisback;
            } // for vertexindex
            // remove duplicate vertices:
            let EPS_SQUARED = CONSTANTS.EPS * CONSTANTS.EPS;
            if (backvertices.length >= 3) {
                let prevvertex = backvertices[backvertices.length - 1];
                for (let vertexindex = 0; vertexindex < backvertices.length; vertexindex++) {
                    let vertex = backvertices[vertexindex];
                    if (vertex.pos.distanceToSquared(prevvertex.pos) < EPS_SQUARED) {
                        backvertices.splice(vertexindex, 1);
                        vertexindex--;
                    }
                    prevvertex = vertex;
                }
            }
            if (frontvertices.length >= 3) {
                let prevvertex = frontvertices[frontvertices.length - 1];
                for (let vertexindex = 0; vertexindex < frontvertices.length; vertexindex++) {
                    let vertex = frontvertices[vertexindex];
                    if (vertex.pos.distanceToSquared(prevvertex.pos) < EPS_SQUARED) {
                        frontvertices.splice(vertexindex, 1);
                        vertexindex--;
                    }
                    prevvertex = vertex;
                }
            }
            if (frontvertices.length >= 3) {
                result.front = new Polygon(frontvertices, polygon.shared, polygon.plane);
            }
            if (backvertices.length >= 3) {
                result.back = new Polygon(backvertices, polygon.shared, polygon.plane);
            }
        }
    }
    return result;
}

// # class PolygonTreeNode
// This class manages hierarchical splits of polygons
// At the top is a root node which doesn hold a polygon, only child PolygonTreeNodes
// Below that are zero or more 'top' nodes; each holds a polygon. The polygons can be in different planes
// splitByPlane() splits a node by a plane. If the plane intersects the polygon, two new child nodes
// are created holding the splitted polygon.
// getPolygons() retrieves the polygon from the tree. If for PolygonTreeNode the polygon is split but
// the two split parts (child nodes) are still intact, then the unsplit polygon is returned.
// This ensures that we can safely split a polygon into many fragments. If the fragments are untouched,
//  getPolygons() will return the original unsplit polygon instead of the fragments.
// remove() removes a polygon from the tree. Once a polygon is removed, the parent polygons are invalidated
// since they are no longer intact.
// constructor creates the root node:
const PolygonTreeNode = function () {
    this.parent = null;
    this.children = [];
    this.polygon = null;
    this.removed = false;
};

PolygonTreeNode.prototype = {
    // fill the tree with polygons. Should be called on the root node only; child nodes must
    // always be a derivate (split) of the parent node.
    addPolygons: function (polygons) {
        // new polygons can only be added to root node; children can only be splitted polygons
        if (!this.isRootNode()) {
            throw new Error('Assertion failed');
        }
        let _this = this;
        polygons.map(function (polygon) {
            _this.addChild(polygon);
        });
    },

    // remove a node
    // - the siblings become toplevel nodes
    // - the parent is removed recursively
    remove: function () {
        if (!this.removed) {
            this.removed = true;

            if (CONSTANTS._CSGDEBUG) {
                if (this.isRootNode()) throw new Error('Assertion failed'); // can't remove root node
                if (this.children.length) throw new Error('Assertion failed'); // we shouldn't remove nodes with children
            }

            // remove ourselves from the parent's children list:
            let parentschildren = this.parent.children;
            let i = parentschildren.indexOf(this);
            if (i < 0) throw new Error('Assertion failed');
            parentschildren.splice(i, 1);

            // invalidate the parent's polygon, and of all parents above it:
            this.parent.recursivelyInvalidatePolygon();
        }
    },

    isRemoved: function () {
        return this.removed;
    },

    isRootNode: function () {
        return !this.parent;
    },

    // invert all polygons in the tree. Call on the root node
    invert: function () {
        if (!this.isRootNode()) throw new Error('Assertion failed'); // can only call this on the root node
        this.invertSub();
    },

    getPolygon: function () {
        if (!this.polygon) throw new Error('Assertion failed'); // doesn't have a polygon, which means that it has been broken down
        return this.polygon;
    },

    getPolygons: function (result) {
        let children = [this];
        let queue = [children];
        let i, j, l, node;
        for (i = 0; i < queue.length; ++i) {
            // queue size can change in loop, don't cache length
            children = queue[i];
            for (j = 0, l = children.length; j < l; j++) {
                // ok to cache length
                node = children[j];
                if (node.polygon) {
                    // the polygon hasn't been broken yet. We can ignore the children and return our polygon:
                    result.push(node.polygon);
                } else {
                    // our polygon has been split up and broken, so gather all subpolygons from the children
                    queue.push(node.children);
                }
            }
        }
    },

    // split the node by a plane; add the resulting nodes to the frontnodes and backnodes array
    // If the plane doesn't intersect the polygon, the 'this' object is added to one of the arrays
    // If the plane does intersect the polygon, two new child nodes are created for the front and back fragments,
    //  and added to both arrays.
    splitByPlane: function (plane, coplanarfrontnodes, coplanarbacknodes, frontnodes, backnodes) {
        if (this.children.length) {
            let queue = [this.children];
            let i;
            let j;
            let l;
            let node;
            let nodes;
            for (i = 0; i < queue.length; i++) {
                // queue.length can increase, do not cache
                nodes = queue[i];
                for (j = 0, l = nodes.length; j < l; j++) {
                    // ok to cache length
                    node = nodes[j];
                    if (node.children.length) {
                        queue.push(node.children);
                    } else {
                        // no children. Split the polygon:
                        node._splitByPlane(plane, coplanarfrontnodes, coplanarbacknodes, frontnodes, backnodes);
                    }
                }
            }
        } else {
            this._splitByPlane(plane, coplanarfrontnodes, coplanarbacknodes, frontnodes, backnodes);
        }
    },

    // only to be called for nodes with no children
    _splitByPlane: function (plane, coplanarfrontnodes, coplanarbacknodes, frontnodes, backnodes) {
        let polygon = this.polygon;
        if (polygon) {
            let bound = polygon.boundingSphere();
            let sphereradius = bound[1] + CONSTANTS.EPS; // FIXME Why add imprecision?
            let planenormal = plane.normal;
            let spherecenter = bound[0];
            let d = planenormal.dot(spherecenter) - plane.w;
            if (d > sphereradius) {
                frontnodes.push(this);
            } else if (d < -sphereradius) {
                backnodes.push(this);
            } else {
                let splitresult = splitPolygonByPlane(plane, polygon);
                switch (splitresult.type) {
                    case 0:
                        // coplanar front:
                        coplanarfrontnodes.push(this);
                        break;

                    case 1:
                        // coplanar back:
                        coplanarbacknodes.push(this);
                        break;

                    case 2:
                        // front:
                        frontnodes.push(this);
                        break;

                    case 3:
                        // back:
                        backnodes.push(this);
                        break;

                    case 4:
                        // spanning:
                        if (splitresult.front) {
                            let frontnode = this.addChild(splitresult.front);
                            frontnodes.push(frontnode);
                        }
                        if (splitresult.back) {
                            let backnode = this.addChild(splitresult.back);
                            backnodes.push(backnode);
                        }
                        break;
                }
            }
        }
    },

    // PRIVATE methods from here:
    // add child to a node
    // this should be called whenever the polygon is split
    // a child should be created for every fragment of the split polygon
    // returns the newly created child
    addChild: function (polygon) {
        let newchild = new PolygonTreeNode();
        newchild.parent = this;
        newchild.polygon = polygon;
        this.children.push(newchild);
        return newchild;
    },

    invertSub: function () {
        let children = [this];
        let queue = [children];
        let i, j, l, node;
        for (i = 0; i < queue.length; i++) {
            children = queue[i];
            for (j = 0, l = children.length; j < l; j++) {
                node = children[j];
                if (node.polygon) {
                    node.polygon = node.polygon.flipped();
                }
                queue.push(node.children);
            }
        }
    },

    recursivelyInvalidatePolygon: function () {
        let node = this;
        while (node.polygon) {
            node.polygon = null;
            if (node.parent) {
                node = node.parent;
            }
        }
    },
};

// # class Tree
// This is the root of a BSP tree
// We are using this separate class for the root of the tree, to hold the PolygonTreeNode root
// The actual tree is kept in this.rootnode
const Tree = function (polygons) {
    this.polygonTree = new PolygonTreeNode();
    this.rootnode = new Node(null);
    if (polygons) this.addPolygons(polygons);
};

Tree.prototype = {
    invert: function () {
        this.polygonTree.invert();
        this.rootnode.invert();
    },

    // Remove all polygons in this BSP tree that are inside the other BSP tree
    // `tree`.
    clipTo: function (tree, alsoRemovecoplanarFront) {
        alsoRemovecoplanarFront = !!alsoRemovecoplanarFront;
        this.rootnode.clipTo(tree, alsoRemovecoplanarFront);
    },

    allPolygons: function () {
        let result = [];
        this.polygonTree.getPolygons(result);
        return result;
    },

    addPolygons: function (polygons) {
        let _this = this;
        let polygontreenodes = polygons.map(function (p) {
            return _this.polygonTree.addChild(p);
        });
        this.rootnode.addPolygonTreeNodes(polygontreenodes);
    },
};

// # class Node
// Holds a node in a BSP tree. A BSP tree is built from a collection of polygons
// by picking a polygon to split along.
// Polygons are not stored directly in the tree, but in PolygonTreeNodes, stored in
// this.polygontreenodes. Those PolygonTreeNodes are children of the owning
// Tree.polygonTree
// This is not a leafy BSP tree since there is
// no distinction between internal and leaf nodes.
const Node = function (parent) {
    this.plane = null;
    this.front = null;
    this.back = null;
    this.polygontreenodes = [];
    this.parent = parent;
};

Node.prototype = {
    // Convert solid space to empty space and empty space to solid space.
    invert: function () {
        let queue = [this];
        let node;
        for (let i = 0; i < queue.length; i++) {
            node = queue[i];
            if (node.plane) node.plane = node.plane.flipped();
            if (node.front) queue.push(node.front);
            if (node.back) queue.push(node.back);
            let temp = node.front;
            node.front = node.back;
            node.back = temp;
        }
    },

    // clip polygontreenodes to our plane
    // calls remove() for all clipped PolygonTreeNodes
    clipPolygons: function (polygontreenodes, alsoRemovecoplanarFront) {
        let args = { node: this, polygontreenodes: polygontreenodes };
        let node;
        let stack = [];

        do {
            node = args.node;
            polygontreenodes = args.polygontreenodes;

            // begin "function"
            if (node.plane) {
                let backnodes = [];
                let frontnodes = [];
                let coplanarfrontnodes = alsoRemovecoplanarFront ? backnodes : frontnodes;
                let plane = node.plane;
                let numpolygontreenodes = polygontreenodes.length;
                for (let i = 0; i < numpolygontreenodes; i++) {
                    let node1 = polygontreenodes[i];
                    if (!node1.isRemoved()) {
                        node1.splitByPlane(plane, coplanarfrontnodes, backnodes, frontnodes, backnodes);
                    }
                }

                if (node.front && frontnodes.length > 0) {
                    stack.push({ node: node.front, polygontreenodes: frontnodes });
                }
                let numbacknodes = backnodes.length;
                if (node.back && numbacknodes > 0) {
                    stack.push({ node: node.back, polygontreenodes: backnodes });
                } else {
                    // there's nothing behind this plane. Delete the nodes behind this plane:
                    for (let i = 0; i < numbacknodes; i++) {
                        backnodes[i].remove();
                    }
                }
            }
            args = stack.pop();
        } while (typeof args !== 'undefined');
    },

    // Remove all polygons in this BSP tree that are inside the other BSP tree
    // `tree`.
    clipTo: function (tree, alsoRemovecoplanarFront) {
        let node = this;
        let stack = [];
        do {
            if (node.polygontreenodes.length > 0) {
                tree.rootnode.clipPolygons(node.polygontreenodes, alsoRemovecoplanarFront);
            }
            if (node.front) stack.push(node.front);
            if (node.back) stack.push(node.back);
            node = stack.pop();
        } while (typeof node !== 'undefined');
    },

    addPolygonTreeNodes: function (polygontreenodes) {
        let args = { node: this, polygontreenodes: polygontreenodes };
        let node;
        let stack = [];
        do {
            node = args.node;
            polygontreenodes = args.polygontreenodes;

            if (polygontreenodes.length === 0) {
                args = stack.pop();
                continue;
            }
            let _this = node;
            if (!node.plane) {
                let bestplane = polygontreenodes[0].getPolygon().plane;
                node.plane = bestplane;
            }
            let frontnodes = [];
            let backnodes = [];

            for (let i = 0, n = polygontreenodes.length; i < n; ++i) {
                polygontreenodes[i].splitByPlane(_this.plane, _this.polygontreenodes, backnodes, frontnodes, backnodes);
            }

            if (frontnodes.length > 0) {
                if (!node.front) node.front = new Node(node);
                stack.push({ node: node.front, polygontreenodes: frontnodes });
            }
            if (backnodes.length > 0) {
                if (!node.back) node.back = new Node(node);
                stack.push({ node: node.back, polygontreenodes: backnodes });
            }

            args = stack.pop();
        } while (typeof args !== 'undefined');
    },

    getParentPlaneNormals: function (normals, maxdepth) {
        if (maxdepth > 0) {
            if (this.parent) {
                normals.push(this.parent.plane.normal);
                this.parent.getParentPlaneNormals(normals, maxdepth - 1);
            }
        }
    },
};

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

// boolean operations

// FIXME should this be lazy ? in which case, how do we deal with 2D/3D combined
// TODO we should have an option to set behaviour as first parameter
/** union/ combine the given shapes
 * @param {Object(s)|Array} objects - objects to combine : can be given
 * - one by one: union(a,b,c) or
 * - as an array: union([a,b,c])
 * @returns {CSG} new CSG object, the union of all input shapes
 *
 * @example
 * let unionOfSpherAndCube = union(sphere(), cube())
 */
function union() {
    let options = {};
    const defaults = {
        extrude2d: false,
    };
    let o;
    let i = 0;
    let a = arguments;
    if (a[0].length) a = a[0];
    if ('extrude2d' in a[0]) {
        // first parameter is options
        options = Object.assign({}, defaults, a[0]);
        o = a[i++];
    }

    o = a[i++];

    // TODO: add option to be able to set this?
    for (; i < a.length; i++) {
        o = o.union(a[i]);
    }
    return o;
}

/** difference/ subtraction of the given shapes ie:
 * cut out C From B From A ie : a - b - c etc
 * @param {Object(s)|Array} objects - objects to subtract
 * can be given
 * - one by one: difference(a,b,c) or
 * - as an array: difference([a,b,c])
 * @returns {CSG} new CSG object, the difference of all input shapes
 *
 * @example
 * let differenceOfSpherAndCube = difference(sphere(), cube())
 */
function difference() {
    let object;
    let i = 0;
    let a = arguments;
    if (a[0].length) a = a[0];
    for (object = a[i++]; i < a.length; i++) {
        object = object.subtract(a[i]); // -- color the cuts
    }
    return object;
}

/** intersection of the given shapes: ie keep only the common parts between the given shapes
 * @param {Object(s)|Array} objects - objects to intersect
 * can be given
 * - one by one: intersection(a,b,c) or
 * - as an array: intersection([a,b,c])
 * @returns {CSG} new CSG object, the intersection of all input shapes
 *
 * @example
 * let intersectionOfSpherAndCube = intersection(sphere(), cube())
 */
function intersection() {
    let object;
    let i = 0;
    let a = arguments;
    if (a[0].length) a = a[0];
    for (object = a[i++]; i < a.length; i++) {
        object = object.intersect(a[i]); // -- color the cuts
    }
    return object;
}

/**
 * Returns a cannoicalized version of the input csg/cag : ie every very close
 * points get deduplicated
 * @returns {CSG|CAG}
 * @example
 * let rawInput = someCSGORCAGMakingFunction()
 * let canonicalized= canonicalize(rawInput)
 */
const canonicalize = function (csgOrCAG, options) {
    if (csgOrCAG.isCanonicalized) {
        return csgOrCAG;
    } else {
        return canonicalizeCSG(csgOrCAG);
    }
};

/**
 * Returns a cannoicalized version of the input csg : ie every very close
 * points get deduplicated
 * @returns {CSG}
 * @example
 * let rawCSG = someCSGMakingFunction()
 * let canonicalizedCSG = canonicalize(rawCSG)
 */
const canonicalizeCSG = function (csg, options) {
    if (csg.isCanonicalized) {
        return csg;
    } else {
        const factory = new FuzzyCSGFactory();
        let result = CSGFromCSGFuzzyFactory(factory, csg);
        result.isCanonicalized = true;
        result.isRetesselated = csg.isRetesselated;
        result.properties = csg.properties; // keep original properties
        return result;
    }
};

const CSGFromCSGFuzzyFactory = function (factory, sourcecsg) {
    let _this = factory;
    let newpolygons = [];
    sourcecsg.polygons.forEach(function (polygon) {
        let newpolygon = _this.getPolygon(polygon);
        // see getPolygon above: we may get a polygon with no vertices, discard it:
        if (newpolygon.vertices.length >= 3) {
            newpolygons.push(newpolygon);
        }
    });
    return fromPolygons(newpolygons);
};

const reTessellate = function (csg) {
    if (csg.isRetesselated) {
        return csg;
    } else {
        let polygonsPerPlane = {};
        let isCanonicalized = csg.isCanonicalized;
        let fuzzyfactory = new FuzzyCSGFactory();
        csg.polygons.map(function (polygon) {
            let plane = polygon.plane;
            let shared = polygon.shared;
            if (!isCanonicalized) {
                // in order to identify polygons having the same plane, we need to canonicalize the planes
                // We don't have to do a full canonizalization (including vertices), to save time only do the planes and the shared data:
                plane = fuzzyfactory.getPlane(plane);
                shared = fuzzyfactory.getPolygonShared(shared);
            }
            let tag = plane.getTag() + '/' + shared.getTag();
            if (!(tag in polygonsPerPlane)) {
                polygonsPerPlane[tag] = [polygon];
            } else {
                polygonsPerPlane[tag].push(polygon);
            }
        });
        let destpolygons = [];
        for (let planetag in polygonsPerPlane) {
            let sourcepolygons = polygonsPerPlane[planetag];
            if (sourcepolygons.length < 2) {
                destpolygons = destpolygons.concat(sourcepolygons);
            } else {
                let retesselayedpolygons = [];
                reTesselateCoplanarPolygons(sourcepolygons, retesselayedpolygons);
                destpolygons = destpolygons.concat(retesselayedpolygons);
            }
        }
        let result = fromPolygons(destpolygons);
        result.isRetesselated = true;
        // result = result.canonicalized();
        result.properties = csg.properties; // keep original properties
        return result;
    }
};

function fnNumberSort(a, b) {
    return a - b;
}

const IsFloat = function (n) {
    return !isNaN(n) || n === Infinity || n === -Infinity;
};

const solve2Linear = function (a, b, c, d, u, v) {
    let det = a * d - b * c;
    let invdet = 1.0 / det;
    let x = u * d - b * v;
    let y = -u * c + a * v;
    x *= invdet;
    y *= invdet;
    return [x, y];
};

function insertSorted(array, element, comparefunc) {
    let leftbound = 0;
    let rightbound = array.length;
    while (rightbound > leftbound) {
        let testindex = Math.floor((leftbound + rightbound) / 2);
        let testelement = array[testindex];
        let compareresult = comparefunc(element, testelement);
        if (compareresult > 0) {
            // element > testelement
            leftbound = testindex + 1;
        } else {
            rightbound = testindex;
        }
    }
    array.splice(leftbound, 0, element);
}

// Get the x coordinate of a point with a certain y coordinate, interpolated between two
// points (CSG.Vector2D).
// Interpolation is robust even if the points have the same y coordinate
const interpolateBetween2DPointsForY = function (point1, point2, y) {
    let f1 = y - point1.y;
    let f2 = point2.y - point1.y;
    if (f2 < 0) {
        f1 = -f1;
        f2 = -f2;
    }
    let t;
    if (f1 <= 0) {
        t = 0.0;
    } else if (f1 >= f2) {
        t = 1.0;
    } else if (f2 < 1e-10) {
        // FIXME Should this be CSG.EPS?
        t = 0.5;
    } else {
        t = f1 / f2;
    }
    let result = point1.x + t * (point2.x - point1.x);
    return result;
};

/**  class Line2D
 * Represents a directional line in 2D space
 * A line is parametrized by its normal vector (perpendicular to the line, rotated 90 degrees counter clockwise)
 * and w. The line passes through the point <normal>.times(w).
 * Equation: p is on line if normal.dot(p)==w
 * @param {Vector2D} normal normal must be a unit vector!
 * @returns {Line2D}
 */
const Line2D = function (normal, w) {
    normal = new Vector2D(normal);
    w = parseFloat(w);
    let l = normal.length();
    // normalize:
    w *= l;
    normal = normal.times(1.0 / l);
    this.normal = normal;
    this.w = w;
};

Line2D.fromPoints = function (p1, p2) {
    p1 = new Vector2D(p1);
    p2 = new Vector2D(p2);
    let direction = p2.minus(p1);
    let normal = direction.normal().negated().unit();
    let w = p1.dot(normal);
    return new Line2D(normal, w);
};

Line2D.prototype = {
    // same line but opposite direction:
    reverse: function () {
        return new Line2D(this.normal.negated(), -this.w);
    },

    equals: function (l) {
        return l.normal.equals(this.normal) && l.w === this.w;
    },

    origin: function () {
        return this.normal.times(this.w);
    },

    direction: function () {
        return this.normal.normal();
    },

    xAtY: function (y) {
        // (py == y) && (normal * p == w)
        // -> px = (w - normal._y * y) / normal.x
        let x = (this.w - this.normal._y * y) / this.normal.x;
        return x;
    },

    absDistanceToPoint: function (point) {
        point = new Vector2D(point);
        let pointProjected = point.dot(this.normal);
        let distance = Math.abs(pointProjected - this.w);
        return distance;
    },
    /* FIXME: has error - origin is not defined, the method is never used
     closestPoint: function(point) {
         point = new Vector2D(point);
         let vector = point.dot(this.direction());
         return origin.plus(vector);
     },
     */

    // intersection between two lines, returns point as Vector2D
    intersectWithLine: function (line2d) {
        let point = solve2Linear(this.normal.x, this.normal.y, line2d.normal.x, line2d.normal.y, this.w, line2d.w);
        point = new Vector2D(point); // make  vector2d
        return point;
    },

    transform: function (matrix4x4) {
        let origin = new Vector2D(0, 0);
        let pointOnPlane = this.normal.times(this.w);
        let neworigin = origin.multiply4x4(matrix4x4);
        let neworiginPlusNormal = this.normal.multiply4x4(matrix4x4);
        let newnormal = neworiginPlusNormal.minus(neworigin);
        let newpointOnPlane = pointOnPlane.multiply4x4(matrix4x4);
        let neww = newnormal.dot(newpointOnPlane);
        return new Line2D(newnormal, neww);
    },
};

// # class Line3D
// Represents a line in 3D space
// direction must be a unit vector
// point is a random point on the line
const Line3D = function (point, direction) {
    point = new Vector(point);
    direction = new Vector(direction);
    this.point = point;
    this.direction = direction.unit();
};

Line3D.fromPoints = function (p1, p2) {
    p1 = new Vector(p1);
    p2 = new Vector(p2);
    let direction = p2.minus(p1);
    return new Line3D(p1, direction);
};

Line3D.fromPlanes = function (p1, p2) {
    let direction = p1.normal.cross(p2.normal);
    let l = direction.length();
    if (l < CONSTANTS.EPS) {
        throw new Error('Parallel planes');
    }
    direction = direction.times(1.0 / l);

    let mabsx = Math.abs(direction.x);
    let mabsy = Math.abs(direction.y);
    let mabsz = Math.abs(direction.z);
    let origin;
    if (mabsx >= mabsy && mabsx >= mabsz) {
        // direction vector is mostly pointing towards x
        // find a point p for which x is zero:
        let r = solve2Linear(p1.normal.y, p1.normal.z, p2.normal.y, p2.normal.z, p1.w, p2.w);
        origin = new Vector(0, r[0], r[1]);
    } else if (mabsy >= mabsx && mabsy >= mabsz) {
        // find a point p for which y is zero:
        let r = solve2Linear(p1.normal.x, p1.normal.z, p2.normal.x, p2.normal.z, p1.w, p2.w);
        origin = new Vector(r[0], 0, r[1]);
    } else {
        // find a point p for which z is zero:
        let r = solve2Linear(p1.normal.x, p1.normal.y, p2.normal.x, p2.normal.y, p1.w, p2.w);
        origin = new Vector(r[0], r[1], 0);
    }
    return new Line3D(origin, direction);
};

Line3D.prototype = {
    intersectWithPlane: function (plane) {
        // plane: plane.normal * p = plane.w
        // line: p=line.point + labda * line.direction
        let labda = (plane.w - plane.normal.dot(this.point)) / plane.normal.dot(this.direction);
        let point = this.point.plus(this.direction.times(labda));
        return point;
    },

    clone: function (line) {
        return new Line3D(this.point.clone(), this.direction.clone());
    },

    reverse: function () {
        return new Line3D(this.point.clone(), this.direction.negated());
    },

    transform: function (matrix4x4) {
        let newpoint = this.point.multiply4x4(matrix4x4);
        let pointPlusDirection = this.point.plus(this.direction);
        let newPointPlusDirection = pointPlusDirection.multiply4x4(matrix4x4);
        let newdirection = newPointPlusDirection.minus(newpoint);
        return new Line3D(newpoint, newdirection);
    },

    closestPointOnLine: function (point) {
        point = new Vector(point);
        let t = point.minus(this.point).dot(this.direction) / this.direction.dot(this.direction);
        let closestpoint = this.point.plus(this.direction.times(t));
        return closestpoint;
    },

    distanceToPoint: function (point) {
        point = new Vector(point);
        let closestpoint = this.closestPointOnLine(point);
        let distancevector = point.minus(closestpoint);
        let distance = distancevector.length();
        return distance;
    },

    equals: function (line3d) {
        if (!this.direction.equals(line3d.direction)) return false;
        let distance = this.distanceToPoint(line3d.point);
        if (distance > CONSTANTS.EPS) return false;
        return true;
    },
};

// # class Matrix4x4:
// Represents a 4x4 matrix. Elements are specified in row order
const Matrix4x4 = function (elements) {
    if (arguments.length >= 1) {
        this.elements = elements;
    } else {
        // if no arguments passed: create unity matrix
        this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    }
};

Matrix4x4.prototype = {
    plus: function (m) {
        var r = [];
        for (var i = 0; i < 16; i++) {
            r[i] = this.elements[i] + m.elements[i];
        }
        return new Matrix4x4(r);
    },

    minus: function (m) {
        var r = [];
        for (var i = 0; i < 16; i++) {
            r[i] = this.elements[i] - m.elements[i];
        }
        return new Matrix4x4(r);
    },

    // right multiply by another 4x4 matrix:
    multiply: function (m) {
        // cache elements in local variables, for speedup:
        var this0 = this.elements[0];
        var this1 = this.elements[1];
        var this2 = this.elements[2];
        var this3 = this.elements[3];
        var this4 = this.elements[4];
        var this5 = this.elements[5];
        var this6 = this.elements[6];
        var this7 = this.elements[7];
        var this8 = this.elements[8];
        var this9 = this.elements[9];
        var this10 = this.elements[10];
        var this11 = this.elements[11];
        var this12 = this.elements[12];
        var this13 = this.elements[13];
        var this14 = this.elements[14];
        var this15 = this.elements[15];
        var m0 = m.elements[0];
        var m1 = m.elements[1];
        var m2 = m.elements[2];
        var m3 = m.elements[3];
        var m4 = m.elements[4];
        var m5 = m.elements[5];
        var m6 = m.elements[6];
        var m7 = m.elements[7];
        var m8 = m.elements[8];
        var m9 = m.elements[9];
        var m10 = m.elements[10];
        var m11 = m.elements[11];
        var m12 = m.elements[12];
        var m13 = m.elements[13];
        var m14 = m.elements[14];
        var m15 = m.elements[15];

        var result = [];
        result[0] = this0 * m0 + this1 * m4 + this2 * m8 + this3 * m12;
        result[1] = this0 * m1 + this1 * m5 + this2 * m9 + this3 * m13;
        result[2] = this0 * m2 + this1 * m6 + this2 * m10 + this3 * m14;
        result[3] = this0 * m3 + this1 * m7 + this2 * m11 + this3 * m15;
        result[4] = this4 * m0 + this5 * m4 + this6 * m8 + this7 * m12;
        result[5] = this4 * m1 + this5 * m5 + this6 * m9 + this7 * m13;
        result[6] = this4 * m2 + this5 * m6 + this6 * m10 + this7 * m14;
        result[7] = this4 * m3 + this5 * m7 + this6 * m11 + this7 * m15;
        result[8] = this8 * m0 + this9 * m4 + this10 * m8 + this11 * m12;
        result[9] = this8 * m1 + this9 * m5 + this10 * m9 + this11 * m13;
        result[10] = this8 * m2 + this9 * m6 + this10 * m10 + this11 * m14;
        result[11] = this8 * m3 + this9 * m7 + this10 * m11 + this11 * m15;
        result[12] = this12 * m0 + this13 * m4 + this14 * m8 + this15 * m12;
        result[13] = this12 * m1 + this13 * m5 + this14 * m9 + this15 * m13;
        result[14] = this12 * m2 + this13 * m6 + this14 * m10 + this15 * m14;
        result[15] = this12 * m3 + this13 * m7 + this14 * m11 + this15 * m15;
        return new Matrix4x4(result);
    },

    clone: function () {
        var elements = this.elements.map(function (p) {
            return p;
        });
        return new Matrix4x4(elements);
    },

    // Right multiply the matrix by a Vector (interpreted as 3 row, 1 column)
    // (result = M*v)
    // Fourth element is taken as 1
    rightMultiply1x3Vector: function (v) {
        var v0 = v._x;
        var v1 = v._y;
        var v2 = v._z;
        var v3 = 1;
        var x = v0 * this.elements[0] + v1 * this.elements[1] + v2 * this.elements[2] + v3 * this.elements[3];
        var y = v0 * this.elements[4] + v1 * this.elements[5] + v2 * this.elements[6] + v3 * this.elements[7];
        var z = v0 * this.elements[8] + v1 * this.elements[9] + v2 * this.elements[10] + v3 * this.elements[11];
        var w = v0 * this.elements[12] + v1 * this.elements[13] + v2 * this.elements[14] + v3 * this.elements[15];
        // scale such that fourth element becomes 1:
        if (w !== 1) {
            var invw = 1.0 / w;
            x *= invw;
            y *= invw;
            z *= invw;
        }
        return new Vector(x, y, z);
    },

    // Multiply a Vector (interpreted as 3 column, 1 row) by this matrix
    // (result = v*M)
    // Fourth element is taken as 1
    leftMultiply1x3Vector: function (v) {
        var v0 = v._x;
        var v1 = v._y;
        var v2 = v._z;
        var v3 = 1;
        var x = v0 * this.elements[0] + v1 * this.elements[4] + v2 * this.elements[8] + v3 * this.elements[12];
        var y = v0 * this.elements[1] + v1 * this.elements[5] + v2 * this.elements[9] + v3 * this.elements[13];
        var z = v0 * this.elements[2] + v1 * this.elements[6] + v2 * this.elements[10] + v3 * this.elements[14];
        var w = v0 * this.elements[3] + v1 * this.elements[7] + v2 * this.elements[11] + v3 * this.elements[15];
        // scale such that fourth element becomes 1:
        if (w !== 1) {
            var invw = 1.0 / w;
            x *= invw;
            y *= invw;
            z *= invw;
        }
        return new Vector(x, y, z);
    },

    // Right multiply the matrix by a Vector2D (interpreted as 2 row, 1 column)
    // (result = M*v)
    // Fourth element is taken as 1
    rightMultiply1x2Vector: function (v) {
        var v0 = v.x;
        var v1 = v.y;
        var v2 = 0;
        var v3 = 1;
        var x = v0 * this.elements[0] + v1 * this.elements[1] + v2 * this.elements[2] + v3 * this.elements[3];
        var y = v0 * this.elements[4] + v1 * this.elements[5] + v2 * this.elements[6] + v3 * this.elements[7];
        var z = v0 * this.elements[8] + v1 * this.elements[9] + v2 * this.elements[10] + v3 * this.elements[11];
        var w = v0 * this.elements[12] + v1 * this.elements[13] + v2 * this.elements[14] + v3 * this.elements[15];
        // scale such that fourth element becomes 1:
        if (w !== 1) {
            var invw = 1.0 / w;
            x *= invw;
            y *= invw;
            z *= invw;
        }
        return new Vector2D(x, y);
    },

    // Multiply a Vector2D (interpreted as 2 column, 1 row) by this matrix
    // (result = v*M)
    // Fourth element is taken as 1
    leftMultiply1x2Vector: function (v) {
        var v0 = v.x;
        var v1 = v.y;
        var v2 = 0;
        var v3 = 1;
        var x = v0 * this.elements[0] + v1 * this.elements[4] + v2 * this.elements[8] + v3 * this.elements[12];
        var y = v0 * this.elements[1] + v1 * this.elements[5] + v2 * this.elements[9] + v3 * this.elements[13];
        var z = v0 * this.elements[2] + v1 * this.elements[6] + v2 * this.elements[10] + v3 * this.elements[14];
        var w = v0 * this.elements[3] + v1 * this.elements[7] + v2 * this.elements[11] + v3 * this.elements[15];
        // scale such that fourth element becomes 1:
        if (w !== 1) {
            var invw = 1.0 / w;
            x *= invw;
            y *= invw;
            z *= invw;
        }
        return new Vector2D(x, y);
    },

    // determine whether this matrix is a mirroring transformation
    isMirroring: function () {
        var u = new Vector(this.elements[0], this.elements[4], this.elements[8]);
        var v = new Vector(this.elements[1], this.elements[5], this.elements[9]);
        var w = new Vector(this.elements[2], this.elements[6], this.elements[10]);

        // for a true orthogonal, non-mirrored base, u.cross(v) == w
        // If they have an opposite direction then we are mirroring
        var mirrorvalue = u.cross(v).dot(w);
        var ismirror = mirrorvalue < 0;
        return ismirror;
    },
};

// return the unity matrix
Matrix4x4.unity = function () {
    return new Matrix4x4();
};

// Create a rotation matrix for rotating around the x axis
Matrix4x4.rotationX = function (degrees) {
    var radians = degrees * Math.PI * (1.0 / 180.0);
    var cos = Math.cos(radians);
    var sin = Math.sin(radians);
    var els = [1, 0, 0, 0, 0, cos, sin, 0, 0, -sin, cos, 0, 0, 0, 0, 1];
    return new Matrix4x4(els);
};

// Create a rotation matrix for rotating around the y axis
Matrix4x4.rotationY = function (degrees) {
    var radians = degrees * Math.PI * (1.0 / 180.0);
    var cos = Math.cos(radians);
    var sin = Math.sin(radians);
    var els = [cos, 0, -sin, 0, 0, 1, 0, 0, sin, 0, cos, 0, 0, 0, 0, 1];
    return new Matrix4x4(els);
};

// Create a rotation matrix for rotating around the z axis
Matrix4x4.rotationZ = function (degrees) {
    var radians = degrees * Math.PI * (1.0 / 180.0);
    var cos = Math.cos(radians);
    var sin = Math.sin(radians);
    var els = [cos, sin, 0, 0, -sin, cos, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    return new Matrix4x4(els);
};

// Matrix for rotation about arbitrary point and axis
Matrix4x4.rotation = function (rotationCenter, rotationAxis, degrees) {
    rotationCenter = new Vector(rotationCenter);
    rotationAxis = new Vector(rotationAxis);
    var rotationPlane = Plane.fromNormalAndPoint(rotationAxis, rotationCenter);
    var orthobasis = new OrthoNormalBasis(rotationPlane);
    var transformation = Matrix4x4.translation(rotationCenter.negated());
    transformation = transformation.multiply(orthobasis.getProjectionMatrix());
    transformation = transformation.multiply(Matrix4x4.rotationZ(degrees));
    transformation = transformation.multiply(orthobasis.getInverseProjectionMatrix());
    transformation = transformation.multiply(Matrix4x4.translation(rotationCenter));
    return transformation;
};

// Create an affine matrix for translation:
Matrix4x4.translation = function (v) {
    // parse as Vector, so we can pass an array or a Vector
    var vec = new Vector(v);
    var els = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, vec.x, vec.y, vec.z, 1];
    return new Matrix4x4(els);
};

// Create an affine matrix for mirroring into an arbitrary plane:
Matrix4x4.mirroring = function (plane) {
    var nx = plane.normal.x;
    var ny = plane.normal.y;
    var nz = plane.normal.z;
    var w = plane.w;
    var els = [
        1.0 - 2.0 * nx * nx,
        -2.0 * ny * nx,
        -2.0 * nz * nx,
        0,
        -2.0 * nx * ny,
        1.0 - 2.0 * ny * ny,
        -2.0 * nz * ny,
        0,
        -2.0 * nx * nz,
        -2.0 * ny * nz,
        1.0 - 2.0 * nz * nz,
        0,
        2.0 * nx * w,
        2.0 * ny * w,
        2.0 * nz * w,
        1,
    ];
    return new Matrix4x4(els);
};

// Create an affine matrix for scaling:
Matrix4x4.scaling = function (v) {
    // parse as Vector, so we can pass an array or a Vector
    var vec = new Vector(v);
    var els = [vec.x, 0, 0, 0, 0, vec.y, 0, 0, 0, 0, vec.z, 0, 0, 0, 0, 1];
    return new Matrix4x4(els);
};

/** class OrthoNormalBasis
 * Reprojects points on a 3D plane onto a 2D plane
 * or from a 2D plane back onto the 3D plane
 * @param  {Plane} plane
 * @param  {Vector|Vector2D} rightvector
 */
const OrthoNormalBasis = function (plane, rightvector) {
    if (arguments.length < 2) {
        // choose an arbitrary right hand vector, making sure it is somewhat orthogonal to the plane normal:
        rightvector = plane.normal.randomNonParallelVector();
    } else {
        rightvector = new Vector(rightvector);
    }
    this.v = plane.normal.cross(rightvector).unit();
    this.u = this.v.cross(plane.normal);
    this.plane = plane;
    this.planeorigin = plane.normal.times(plane.w);
};

// Get an orthonormal basis for the standard XYZ planes.
// Parameters: the names of two 3D axes. The 2d x axis will map to the first given 3D axis, the 2d y
// axis will map to the second.
// Prepend the axis with a "-" to invert the direction of this axis.
// For example: OrthoNormalBasis.GetCartesian("-Y","Z")
//   will return an orthonormal basis where the 2d X axis maps to the 3D inverted Y axis, and
//   the 2d Y axis maps to the 3D Z axis.
OrthoNormalBasis.GetCartesian = function (xaxisid, yaxisid) {
    let axisid = xaxisid + '/' + yaxisid;
    let planenormal, rightvector;
    if (axisid === 'X/Y') {
        planenormal = [0, 0, 1];
        rightvector = [1, 0, 0];
    } else if (axisid === 'Y/-X') {
        planenormal = [0, 0, 1];
        rightvector = [0, 1, 0];
    } else if (axisid === '-X/-Y') {
        planenormal = [0, 0, 1];
        rightvector = [-1, 0, 0];
    } else if (axisid === '-Y/X') {
        planenormal = [0, 0, 1];
        rightvector = [0, -1, 0];
    } else if (axisid === '-X/Y') {
        planenormal = [0, 0, -1];
        rightvector = [-1, 0, 0];
    } else if (axisid === '-Y/-X') {
        planenormal = [0, 0, -1];
        rightvector = [0, -1, 0];
    } else if (axisid === 'X/-Y') {
        planenormal = [0, 0, -1];
        rightvector = [1, 0, 0];
    } else if (axisid === 'Y/X') {
        planenormal = [0, 0, -1];
        rightvector = [0, 1, 0];
    } else if (axisid === 'X/Z') {
        planenormal = [0, -1, 0];
        rightvector = [1, 0, 0];
    } else if (axisid === 'Z/-X') {
        planenormal = [0, -1, 0];
        rightvector = [0, 0, 1];
    } else if (axisid === '-X/-Z') {
        planenormal = [0, -1, 0];
        rightvector = [-1, 0, 0];
    } else if (axisid === '-Z/X') {
        planenormal = [0, -1, 0];
        rightvector = [0, 0, -1];
    } else if (axisid === '-X/Z') {
        planenormal = [0, 1, 0];
        rightvector = [-1, 0, 0];
    } else if (axisid === '-Z/-X') {
        planenormal = [0, 1, 0];
        rightvector = [0, 0, -1];
    } else if (axisid === 'X/-Z') {
        planenormal = [0, 1, 0];
        rightvector = [1, 0, 0];
    } else if (axisid === 'Z/X') {
        planenormal = [0, 1, 0];
        rightvector = [0, 0, 1];
    } else if (axisid === 'Y/Z') {
        planenormal = [1, 0, 0];
        rightvector = [0, 1, 0];
    } else if (axisid === 'Z/-Y') {
        planenormal = [1, 0, 0];
        rightvector = [0, 0, 1];
    } else if (axisid === '-Y/-Z') {
        planenormal = [1, 0, 0];
        rightvector = [0, -1, 0];
    } else if (axisid === '-Z/Y') {
        planenormal = [1, 0, 0];
        rightvector = [0, 0, -1];
    } else if (axisid === '-Y/Z') {
        planenormal = [-1, 0, 0];
        rightvector = [0, -1, 0];
    } else if (axisid === '-Z/-Y') {
        planenormal = [-1, 0, 0];
        rightvector = [0, 0, -1];
    } else if (axisid === 'Y/-Z') {
        planenormal = [-1, 0, 0];
        rightvector = [0, 1, 0];
    } else if (axisid === 'Z/Y') {
        planenormal = [-1, 0, 0];
        rightvector = [0, 0, 1];
    } else {
        throw new Error(
            'OrthoNormalBasis.GetCartesian: invalid combination of axis identifiers. Should pass two string arguments from [X,Y,Z,-X,-Y,-Z], being two different axes.'
        );
    }
    return new OrthoNormalBasis(new Plane(new Vector(planenormal), 0), new Vector(rightvector));
};

/*
// test code for OrthoNormalBasis.GetCartesian()
OrthoNormalBasis.GetCartesian_Test=function() {
  let axisnames=["X","Y","Z","-X","-Y","-Z"];
  let axisvectors=[[1,0,0], [0,1,0], [0,0,1], [-1,0,0], [0,-1,0], [0,0,-1]];
  for(let axis1=0; axis1 < 3; axis1++) {
    for(let axis1inverted=0; axis1inverted < 2; axis1inverted++) {
      let axis1name=axisnames[axis1+3*axis1inverted];
      let axis1vector=axisvectors[axis1+3*axis1inverted];
      for(let axis2=0; axis2 < 3; axis2++) {
        if(axis2 != axis1) {
          for(let axis2inverted=0; axis2inverted < 2; axis2inverted++) {
            let axis2name=axisnames[axis2+3*axis2inverted];
            let axis2vector=axisvectors[axis2+3*axis2inverted];
            let orthobasis=OrthoNormalBasis.GetCartesian(axis1name, axis2name);
            let test1=orthobasis.to3D(new Vector2D([1,0]));
            let test2=orthobasis.to3D(new Vector2D([0,1]));
            let expected1=new Vector(axis1vector);
            let expected2=new Vector(axis2vector);
            let d1=test1.distanceTo(expected1);
            let d2=test2.distanceTo(expected2);
            if( (d1 > 0.01) || (d2 > 0.01) ) {
              throw new Error("Wrong!");
  }}}}}}
  throw new Error("OK");
};
*/

// The z=0 plane, with the 3D x and y vectors mapped to the 2D x and y vector
OrthoNormalBasis.Z0Plane = function () {
    let plane = new Plane(new Vector([0, 0, 1]), 0);
    return new OrthoNormalBasis(plane, new Vector([1, 0, 0]));
};

OrthoNormalBasis.prototype = {
    getProjectionMatrix: function () {
        return new Matrix4x4([
            this.u.x,
            this.v.x,
            this.plane.normal.x,
            0,
            this.u.y,
            this.v.y,
            this.plane.normal.y,
            0,
            this.u.z,
            this.v.z,
            this.plane.normal.z,
            0,
            0,
            0,
            -this.plane.w,
            1,
        ]);
    },

    getInverseProjectionMatrix: function () {
        let p = this.plane.normal.times(this.plane.w);
        return new Matrix4x4([
            this.u.x,
            this.u.y,
            this.u.z,
            0,
            this.v.x,
            this.v.y,
            this.v.z,
            0,
            this.plane.normal.x,
            this.plane.normal.y,
            this.plane.normal.z,
            0,
            p.x,
            p.y,
            p.z,
            1,
        ]);
    },

    to2D: function (vec3) {
        return new Vector2D(vec3.dot(this.u), vec3.dot(this.v));
    },

    to3D: function (vec2) {
        return this.planeorigin.plus(this.u.times(vec2.x)).plus(this.v.times(vec2.y));
    },

    line3Dto2D: function (line3d) {
        let a = line3d.point;
        let b = line3d.direction.plus(a);
        let a2d = this.to2D(a);
        let b2d = this.to2D(b);
        return Line2D.fromPoints(a2d, b2d);
    },

    line2Dto3D: function (line2d) {
        let a = line2d.origin();
        let b = line2d.direction().plus(a);
        let a3d = this.to3D(a);
        let b3d = this.to3D(b);
        return Line3D.fromPoints(a3d, b3d);
    },

    transform: function (matrix4x4) {
        // todo: this may not work properly in case of mirroring
        let newplane = this.plane.transform(matrix4x4);
        let rightpointTransformed = this.u.transform(matrix4x4);
        let originTransformed = new Vector(0, 0, 0).transform(matrix4x4);
        let newrighthandvector = rightpointTransformed.minus(originTransformed);
        let newbasis = new OrthoNormalBasis(newplane, newrighthandvector);
        return newbasis;
    },
};

// # class Plane
// Represents a plane in 3D space.
const Plane = function (normal, w) {
    this.normal = normal;
    this.w = w;
};

// create from an untyped object with identical property names:
Plane.fromObject = function (obj) {
    let normal = new Vector(obj.normal);
    let w = parseFloat(obj.w);
    return new Plane(normal, w);
};

Plane.fromVector3Ds = function (a, b, c) {
    let n = b.minus(a).cross(c.minus(a)).unit();
    return new Plane(n, n.dot(a));
};

// like fromVector3Ds, but allow the vectors to be on one point or one line
// in such a case a random plane through the given points is constructed
Plane.anyPlaneFromVector3Ds = function (a, b, c) {
    let v1 = b.minus(a);
    let v2 = c.minus(a);
    if (v1.length() < CONSTANTS.EPS) {
        v1 = v2.randomNonParallelVector();
    }
    if (v2.length() < CONSTANTS.EPS) {
        v2 = v1.randomNonParallelVector();
    }
    let normal = v1.cross(v2);
    if (normal.length() < CONSTANTS.EPS) {
        // this would mean that v1 == v2.negated()
        v2 = v1.randomNonParallelVector();
        normal = v1.cross(v2);
    }
    normal = normal.unit();
    return new Plane(normal, normal.dot(a));
};

Plane.fromPoints = function (a, b, c) {
    a = new Vector(a);
    b = new Vector(b);
    c = new Vector(c);
    return Plane.fromVector3Ds(a, b, c);
};

Plane.fromNormalAndPoint = function (normal, point) {
    normal = new Vector(normal);
    point = new Vector(point);
    normal = normal.unit();
    let w = point.dot(normal);
    return new Plane(normal, w);
};

Plane.prototype = {
    flipped: function () {
        return new Plane(this.normal.negated(), -this.w);
    },

    getTag: function () {
        let result = this.tag;
        if (!result) {
            result = window.getTag(); // TODO: KILL THIS!!!
            this.tag = result;
        }
        return result;
    },

    equals: function (n) {
        return this.normal.equals(n.normal) && this.w === n.w;
    },

    transform: function (matrix4x4) {
        let ismirror = matrix4x4.isMirroring();
        // get two vectors in the plane:
        let r = this.normal.randomNonParallelVector();
        let u = this.normal.cross(r);
        let v = this.normal.cross(u);
        // get 3 points in the plane:
        let point1 = this.normal.times(this.w);
        let point2 = point1.plus(u);
        let point3 = point1.plus(v);
        // transform the points:
        point1 = point1.multiply4x4(matrix4x4);
        point2 = point2.multiply4x4(matrix4x4);
        point3 = point3.multiply4x4(matrix4x4);
        // and create a new plane from the transformed points:
        let newplane = Plane.fromVector3Ds(point1, point2, point3);
        if (ismirror) {
            // the transform is mirroring
            // We should mirror the plane:
            newplane = newplane.flipped();
        }
        return newplane;
    },

    // robust splitting of a line by a plane
    // will work even if the line is parallel to the plane
    splitLineBetweenPoints: function (p1, p2) {
        let direction = p2.minus(p1);
        let labda = (this.w - this.normal.dot(p1)) / this.normal.dot(direction);
        if (isNaN(labda)) labda = 0;
        if (labda > 1) labda = 1;
        if (labda < 0) labda = 0;
        let result = p1.plus(direction.times(labda));
        return result;
    },

    // returns Vector3D
    intersectWithLine: function (line3d) {
        return line3d.intersectWithPlane(this);
    },

    // intersection of two planes
    intersectWithPlane: function (plane) {
        return Line3D.fromPlanes(this, plane);
    },

    signedDistanceToPoint: function (point) {
        let t = this.normal.dot(point) - this.w;
        return t;
    },

    toString: function () {
        return '[normal: ' + this.normal.toString() + ', w: ' + this.w + ']';
    },

    mirrorPoint: function (point3d) {
        let distance = this.signedDistanceToPoint(point3d);
        let mirrored = point3d.minus(this.normal.times(distance * 2.0));
        return mirrored;
    },
};

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

/** Class Vector
 * Represents a 3D vector with X, Y, Z coordinates.
 * @constructor
 *
 * @example
 * new CSG.Vector(1, 2, 3);
 * new CSG.Vector([1, 2, 3]);
 * new CSG.Vector({ x: 1, y: 2, z: 3 });
 * new CSG.Vector(1, 2); // assumes z=0
 * new CSG.Vector([1, 2]); // assumes z=0
 */
const Vector = function (x, y, z) {
    if (arguments.length === 3) {
        this._x = parseFloat(x);
        this._y = parseFloat(y);
        this._z = parseFloat(z);
    } else if (arguments.length === 2) {
        this._x = parseFloat(x);
        this._y = parseFloat(y);
        this._z = 0;
    } else {
        var ok = true;
        if (arguments.length === 1) {
            if (typeof x === 'object') {
                if (x instanceof Vector) {
                    this._x = x._x;
                    this._y = x._y;
                    this._z = x._z;
                } else if (x instanceof Vector2D) {
                    this._x = x._x;
                    this._y = x._y;
                    this._z = 0;
                } else if (x instanceof Array) {
                    if (x.length < 2 || x.length > 3) {
                        ok = false;
                    } else {
                        this._x = parseFloat(x[0]);
                        this._y = parseFloat(x[1]);
                        if (x.length === 3) {
                            this._z = parseFloat(x[2]);
                        } else {
                            this._z = 0;
                        }
                    }
                } else if ('x' in x && 'y' in x) {
                    this._x = parseFloat(x.x);
                    this._y = parseFloat(x.y);
                    if ('z' in x) {
                        this._z = parseFloat(x.z);
                    } else {
                        this._z = 0;
                    }
                } else if ('_x' in x && '_y' in x) {
                    this._x = parseFloat(x._x);
                    this._y = parseFloat(x._y);
                    if ('_z' in x) {
                        this._z = parseFloat(x._z);
                    } else {
                        this._z = 0;
                    }
                } else ok = false;
            } else {
                var v = parseFloat(x);
                this._x = v;
                this._y = v;
                this._z = v;
            }
        } else ok = false;
        if (ok) {
            if (!IsFloat(this._x) || !IsFloat(this._y) || !IsFloat(this._z)) ok = false;
        } else {
            throw new Error('wrong arguments');
        }
    }
};

// This does the same as new Vector(x,y,z) but it doesn't go through the constructor
// and the parameters are not validated. Is much faster.
Vector.Create = function (x, y, z) {
    var result = Object.create(Vector.prototype);
    result._x = x;
    result._y = y;
    result._z = z;
    return result;
};

Vector.prototype = {
    get x() {
        return this._x;
    },
    get y() {
        return this._y;
    },
    get z() {
        return this._z;
    },

    set x(v) {
        throw new Error('Vector is immutable');
    },
    set y(v) {
        throw new Error('Vector is immutable');
    },
    set z(v) {
        throw new Error('Vector is immutable');
    },

    clone: function () {
        return Vector.Create(this._x, this._y, this._z);
    },

    negated: function () {
        return Vector.Create(-this._x, -this._y, -this._z);
    },

    abs: function () {
        return Vector.Create(Math.abs(this._x), Math.abs(this._y), Math.abs(this._z));
    },

    plus: function (a) {
        return Vector.Create(this._x + a._x, this._y + a._y, this._z + a._z);
    },

    minus: function (a) {
        return Vector.Create(this._x - a._x, this._y - a._y, this._z - a._z);
    },

    times: function (a) {
        return Vector.Create(this._x * a, this._y * a, this._z * a);
    },

    dividedBy: function (a) {
        return Vector.Create(this._x / a, this._y / a, this._z / a);
    },

    dot: function (a) {
        return this._x * a._x + this._y * a._y + this._z * a._z;
    },

    lerp: function (a, t) {
        return this.plus(a.minus(this).times(t));
    },

    lengthSquared: function () {
        return this.dot(this);
    },

    length: function () {
        return Math.sqrt(this.lengthSquared());
    },

    unit: function () {
        return this.dividedBy(this.length());
    },

    cross: function (a) {
        return Vector.Create(this._y * a._z - this._z * a._y, this._z * a._x - this._x * a._z, this._x * a._y - this._y * a._x);
    },

    distanceTo: function (a) {
        return this.minus(a).length();
    },

    distanceToSquared: function (a) {
        return this.minus(a).lengthSquared();
    },

    equals: function (a) {
        return this._x === a._x && this._y === a._y && this._z === a._z;
    },

    // Right multiply by a 4x4 matrix (the vector is interpreted as a row vector)
    // Returns a new Vector
    multiply4x4: function (matrix4x4) {
        return matrix4x4.leftMultiply1x3Vector(this);
    },

    transform: function (matrix4x4) {
        return matrix4x4.leftMultiply1x3Vector(this);
    },

    toString: function () {
        return '(' + this._x.toFixed(5) + ', ' + this._y.toFixed(5) + ', ' + this._z.toFixed(5) + ')';
    },

    // find a vector that is somewhat perpendicular to this one
    randomNonParallelVector: function () {
        var abs = this.abs();
        if (abs._x <= abs._y && abs._x <= abs._z) {
            return Vector.Create(1, 0, 0);
        } else if (abs._y <= abs._x && abs._y <= abs._z) {
            return Vector.Create(0, 1, 0);
        } else {
            return Vector.Create(0, 0, 1);
        }
    },

    min: function (p) {
        return Vector.Create(Math.min(this._x, p._x), Math.min(this._y, p._y), Math.min(this._z, p._z));
    },

    max: function (p) {
        return Vector.Create(Math.max(this._x, p._x), Math.max(this._y, p._y), Math.max(this._z, p._z));
    },
};

/** Class Vector2D
 * Represents a 2D vector with X, Y coordinates
 * @constructor
 *
 * @example
 * new CSG.Vector2D(1, 2);
 * new CSG.Vector2D([1, 2]);
 * new CSG.Vector2D({ x: 1, y: 2});
 */
const Vector2D = function (x, y) {
    if (arguments.length === 2) {
        this._x = parseFloat(x);
        this._y = parseFloat(y);
    } else {
        var ok = true;
        if (arguments.length === 1) {
            if (typeof x === 'object') {
                if (x instanceof Vector2D) {
                    this._x = x._x;
                    this._y = x._y;
                } else if (x instanceof Array) {
                    this._x = parseFloat(x[0]);
                    this._y = parseFloat(x[1]);
                } else if ('x' in x && 'y' in x) {
                    this._x = parseFloat(x.x);
                    this._y = parseFloat(x.y);
                } else ok = false;
            } else {
                var v = parseFloat(x);
                this._x = v;
                this._y = v;
            }
        } else ok = false;
        if (ok) {
            if (!IsFloat(this._x) || !IsFloat(this._y)) ok = false;
        }
        if (!ok) {
            throw new Error('wrong arguments');
        }
    }
};

Vector2D.fromAngle = function (radians) {
    return Vector2D.fromAngleRadians(radians);
};

Vector2D.fromAngleDegrees = function (degrees) {
    var radians = (Math.PI * degrees) / 180;
    return Vector2D.fromAngleRadians(radians);
};

Vector2D.fromAngleRadians = function (radians) {
    return Vector2D.Create(Math.cos(radians), Math.sin(radians));
};

// This does the same as new Vector2D(x,y) but it doesn't go through the constructor
// and the parameters are not validated. Is much faster.
Vector2D.Create = function (x, y) {
    var result = Object.create(Vector2D.prototype);
    result._x = x;
    result._y = y;
    return result;
};

Vector2D.prototype = {
    get x() {
        return this._x;
    },
    get y() {
        return this._y;
    },

    set x(v) {
        throw new Error('Vector2D is immutable');
    },
    set y(v) {
        throw new Error('Vector2D is immutable');
    },

    // extend to a 3D vector by adding a z coordinate:
    toVector3D: function (z) {
        return new Vector(this._x, this._y, z);
    },

    equals: function (a) {
        return this._x === a._x && this._y === a._y;
    },

    clone: function () {
        return Vector2D.Create(this._x, this._y);
    },

    negated: function () {
        return Vector2D.Create(-this._x, -this._y);
    },

    plus: function (a) {
        return Vector2D.Create(this._x + a._x, this._y + a._y);
    },

    minus: function (a) {
        return Vector2D.Create(this._x - a._x, this._y - a._y);
    },

    times: function (a) {
        return Vector2D.Create(this._x * a, this._y * a);
    },

    dividedBy: function (a) {
        return Vector2D.Create(this._x / a, this._y / a);
    },

    dot: function (a) {
        return this._x * a._x + this._y * a._y;
    },

    lerp: function (a, t) {
        return this.plus(a.minus(this).times(t));
    },

    length: function () {
        return Math.sqrt(this.dot(this));
    },

    distanceTo: function (a) {
        return this.minus(a).length();
    },

    distanceToSquared: function (a) {
        return this.minus(a).lengthSquared();
    },

    lengthSquared: function () {
        return this.dot(this);
    },

    unit: function () {
        return this.dividedBy(this.length());
    },

    cross: function (a) {
        return this._x * a._y - this._y * a._x;
    },

    // returns the vector rotated by 90 degrees clockwise
    normal: function () {
        return Vector2D.Create(this._y, -this._x);
    },

    // Right multiply by a 4x4 matrix (the vector is interpreted as a row vector)
    // Returns a new Vector2D
    multiply4x4: function (matrix4x4) {
        return matrix4x4.leftMultiply1x2Vector(this);
    },

    transform: function (matrix4x4) {
        return matrix4x4.leftMultiply1x2Vector(this);
    },

    angle: function () {
        return this.angleRadians();
    },

    angleDegrees: function () {
        var radians = this.angleRadians();
        return (180 * radians) / Math.PI;
    },

    angleRadians: function () {
        // y=sin, x=cos
        return Math.atan2(this._y, this._x);
    },

    min: function (p) {
        return Vector2D.Create(Math.min(this._x, p._x), Math.min(this._y, p._y));
    },

    max: function (p) {
        return Vector2D.Create(Math.max(this._x, p._x), Math.max(this._y, p._y));
    },

    toString: function () {
        return '(' + this._x.toFixed(5) + ', ' + this._y.toFixed(5) + ')';
    },

    abs: function () {
        return Vector2D.Create(Math.abs(this._x), Math.abs(this._y));
    },
};

// # class Vertex
// Represents a vertex of a polygon. Use your own vertex class instead of this
// one to provide additional features like texture coordinates and vertex
// colors. Custom vertex classes need to provide a `pos` property
// `flipped()`, and `interpolate()` methods that behave analogous to the ones
// FIXME: And a lot MORE (see plane.fromVector3Ds for ex) ! This is fragile code
// defined by `Vertex`.
const Vertex = function (pos) {
    this.pos = pos;
};

// create from an untyped object with identical property names:
Vertex.fromObject = function (obj) {
    var pos = new Vector(obj.pos);
    return new Vertex(pos);
};

Vertex.prototype = {
    // Return a vertex with all orientation-specific data (e.g. vertex normal) flipped. Called when the
    // orientation of a polygon is flipped.
    flipped: function () {
        return this;
    },

    getTag: function () {
        var result = this.tag;
        if (!result) {
            result = window.getTag(); // TODO: KILL THIS!!!
            this.tag = result;
        }
        return result;
    },

    // Create a new vertex between this vertex and `other` by linearly
    // interpolating all properties using a parameter of `t`. Subclasses should
    // override this to interpolate additional properties.
    interpolate: function (other, t) {
        var newpos = this.pos.lerp(other.pos, t);
        return new Vertex(newpos);
    },

    // Affine transformation of vertex. Returns a new Vertex
    transform: function (matrix4x4) {
        var newpos = this.pos.multiply4x4(matrix4x4);
        return new Vertex(newpos);
    },

    toString: function () {
        return this.pos.toString();
    },
};

// Retesselation function for a set of coplanar polygons. See the introduction at the top of
// this file.
const reTesselateCoplanarPolygons = function (sourcepolygons, destpolygons) {
    let numpolygons = sourcepolygons.length;
    if (numpolygons > 0) {
        let plane = sourcepolygons[0].plane;
        let shared = sourcepolygons[0].shared;
        let orthobasis = new OrthoNormalBasis(plane);
        let polygonvertices2d = []; // array of array of Vector2D
        let polygontopvertexindexes = []; // array of indexes of topmost vertex per polygon
        let topy2polygonindexes = {};
        let ycoordinatetopolygonindexes = {};
        let ycoordinatebins = {};

        // convert all polygon vertices to 2D
        // Make a list of all encountered y coordinates
        // And build a map of all polygons that have a vertex at a certain y coordinate:
        let ycoordinateBinningFactor = (1.0 / CONSTANTS.EPS) * 10;
        for (let polygonindex = 0; polygonindex < numpolygons; polygonindex++) {
            let poly3d = sourcepolygons[polygonindex];
            let vertices2d = [];
            let numvertices = poly3d.vertices.length;
            let minindex = -1;
            if (numvertices > 0) {
                let miny, maxy;
                for (let i = 0; i < numvertices; i++) {
                    let pos2d = orthobasis.to2D(poly3d.vertices[i].pos);
                    // perform binning of y coordinates: If we have multiple vertices very
                    // close to each other, give them the same y coordinate:
                    let ycoordinatebin = Math.floor(pos2d.y * ycoordinateBinningFactor);
                    let newy;
                    if (ycoordinatebin in ycoordinatebins) {
                        newy = ycoordinatebins[ycoordinatebin];
                    } else if (ycoordinatebin + 1 in ycoordinatebins) {
                        newy = ycoordinatebins[ycoordinatebin + 1];
                    } else if (ycoordinatebin - 1 in ycoordinatebins) {
                        newy = ycoordinatebins[ycoordinatebin - 1];
                    } else {
                        newy = pos2d.y;
                        ycoordinatebins[ycoordinatebin] = pos2d.y;
                    }
                    pos2d = Vector2D.Create(pos2d.x, newy);
                    vertices2d.push(pos2d);
                    let y = pos2d.y;
                    if (i === 0 || y < miny) {
                        miny = y;
                        minindex = i;
                    }
                    if (i === 0 || y > maxy) {
                        maxy = y;
                    }
                    if (!(y in ycoordinatetopolygonindexes)) {
                        ycoordinatetopolygonindexes[y] = {};
                    }
                    ycoordinatetopolygonindexes[y][polygonindex] = true;
                }
                if (miny >= maxy) {
                    // degenerate polygon, all vertices have same y coordinate. Just ignore it from now:
                    vertices2d = [];
                    numvertices = 0;
                    minindex = -1;
                } else {
                    if (!(miny in topy2polygonindexes)) {
                        topy2polygonindexes[miny] = [];
                    }
                    topy2polygonindexes[miny].push(polygonindex);
                }
            } // if(numvertices > 0)
            // reverse the vertex order:
            vertices2d.reverse();
            minindex = numvertices - minindex - 1;
            polygonvertices2d.push(vertices2d);
            polygontopvertexindexes.push(minindex);
        }
        let ycoordinates = [];
        for (let ycoordinate in ycoordinatetopolygonindexes) ycoordinates.push(ycoordinate);
        ycoordinates.sort(fnNumberSort);

        // Now we will iterate over all y coordinates, from lowest to highest y coordinate
        // activepolygons: source polygons that are 'active', i.e. intersect with our y coordinate
        //   Is sorted so the polygons are in left to right order
        // Each element in activepolygons has these properties:
        //        polygonindex: the index of the source polygon (i.e. an index into the sourcepolygons
        //                      and polygonvertices2d arrays)
        //        leftvertexindex: the index of the vertex at the left side of the polygon (lowest x)
        //                         that is at or just above the current y coordinate
        //        rightvertexindex: dito at right hand side of polygon
        //        topleft, bottomleft: coordinates of the left side of the polygon crossing the current y coordinate
        //        topright, bottomright: coordinates of the right hand side of the polygon crossing the current y coordinate
        let activepolygons = [];
        let prevoutpolygonrow = [];
        for (let yindex = 0; yindex < ycoordinates.length; yindex++) {
            let newoutpolygonrow = [];
            let ycoordinate_as_string = ycoordinates[yindex];
            let ycoordinate = Number(ycoordinate_as_string);

            // update activepolygons for this y coordinate:
            // - Remove any polygons that end at this y coordinate
            // - update leftvertexindex and rightvertexindex (which point to the current vertex index
            //   at the the left and right side of the polygon
            // Iterate over all polygons that have a corner at this y coordinate:
            let polygonindexeswithcorner = ycoordinatetopolygonindexes[ycoordinate_as_string];
            for (let activepolygonindex = 0; activepolygonindex < activepolygons.length; ++activepolygonindex) {
                let activepolygon = activepolygons[activepolygonindex];
                let polygonindex = activepolygon.polygonindex;
                if (polygonindexeswithcorner[polygonindex]) {
                    // this active polygon has a corner at this y coordinate:
                    let vertices2d = polygonvertices2d[polygonindex];
                    let numvertices = vertices2d.length;
                    let newleftvertexindex = activepolygon.leftvertexindex;
                    let newrightvertexindex = activepolygon.rightvertexindex;
                    // See if we need to increase leftvertexindex or decrease rightvertexindex:
                    while (true) {
                        let nextleftvertexindex = newleftvertexindex + 1;
                        if (nextleftvertexindex >= numvertices) nextleftvertexindex = 0;
                        if (vertices2d[nextleftvertexindex].y !== ycoordinate) break;
                        newleftvertexindex = nextleftvertexindex;
                    }
                    let nextrightvertexindex = newrightvertexindex - 1;
                    if (nextrightvertexindex < 0) nextrightvertexindex = numvertices - 1;
                    if (vertices2d[nextrightvertexindex].y === ycoordinate) {
                        newrightvertexindex = nextrightvertexindex;
                    }
                    if (newleftvertexindex !== activepolygon.leftvertexindex && newleftvertexindex === newrightvertexindex) {
                        // We have increased leftvertexindex or decreased rightvertexindex, and now they point to the same vertex
                        // This means that this is the bottom point of the polygon. We'll remove it:
                        activepolygons.splice(activepolygonindex, 1);
                        --activepolygonindex;
                    } else {
                        activepolygon.leftvertexindex = newleftvertexindex;
                        activepolygon.rightvertexindex = newrightvertexindex;
                        activepolygon.topleft = vertices2d[newleftvertexindex];
                        activepolygon.topright = vertices2d[newrightvertexindex];
                        let nextleftvertexindex = newleftvertexindex + 1;
                        if (nextleftvertexindex >= numvertices) nextleftvertexindex = 0;
                        activepolygon.bottomleft = vertices2d[nextleftvertexindex];
                        let nextrightvertexindex = newrightvertexindex - 1;
                        if (nextrightvertexindex < 0) nextrightvertexindex = numvertices - 1;
                        activepolygon.bottomright = vertices2d[nextrightvertexindex];
                    }
                } // if polygon has corner here
            } // for activepolygonindex
            let nextycoordinate;
            if (yindex >= ycoordinates.length - 1) {
                // last row, all polygons must be finished here:
                activepolygons = [];
                nextycoordinate = null;
            } // yindex < ycoordinates.length-1
            else {
                nextycoordinate = Number(ycoordinates[yindex + 1]);
                let middleycoordinate = 0.5 * (ycoordinate + nextycoordinate);
                // update activepolygons by adding any polygons that start here:
                let startingpolygonindexes = topy2polygonindexes[ycoordinate_as_string];
                for (let polygonindex_key in startingpolygonindexes) {
                    let polygonindex = startingpolygonindexes[polygonindex_key];
                    let vertices2d = polygonvertices2d[polygonindex];
                    let numvertices = vertices2d.length;
                    let topvertexindex = polygontopvertexindexes[polygonindex];
                    // the top of the polygon may be a horizontal line. In that case topvertexindex can point to any point on this line.
                    // Find the left and right topmost vertices which have the current y coordinate:
                    let topleftvertexindex = topvertexindex;
                    while (true) {
                        let i = topleftvertexindex + 1;
                        if (i >= numvertices) i = 0;
                        if (vertices2d[i].y !== ycoordinate) break;
                        if (i === topvertexindex) break; // should not happen, but just to prevent endless loops
                        topleftvertexindex = i;
                    }
                    let toprightvertexindex = topvertexindex;
                    while (true) {
                        let i = toprightvertexindex - 1;
                        if (i < 0) i = numvertices - 1;
                        if (vertices2d[i].y !== ycoordinate) break;
                        if (i === topleftvertexindex) break; // should not happen, but just to prevent endless loops
                        toprightvertexindex = i;
                    }
                    let nextleftvertexindex = topleftvertexindex + 1;
                    if (nextleftvertexindex >= numvertices) nextleftvertexindex = 0;
                    let nextrightvertexindex = toprightvertexindex - 1;
                    if (nextrightvertexindex < 0) nextrightvertexindex = numvertices - 1;
                    let newactivepolygon = {
                        polygonindex: polygonindex,
                        leftvertexindex: topleftvertexindex,
                        rightvertexindex: toprightvertexindex,
                        topleft: vertices2d[topleftvertexindex],
                        topright: vertices2d[toprightvertexindex],
                        bottomleft: vertices2d[nextleftvertexindex],
                        bottomright: vertices2d[nextrightvertexindex],
                    };
                    insertSorted(activepolygons, newactivepolygon, function (el1, el2) {
                        let x1 = interpolateBetween2DPointsForY(el1.topleft, el1.bottomleft, middleycoordinate);
                        let x2 = interpolateBetween2DPointsForY(el2.topleft, el2.bottomleft, middleycoordinate);
                        if (x1 > x2) return 1;
                        if (x1 < x2) return -1;
                        return 0;
                    });
                } // for(let polygonindex in startingpolygonindexes)
            } //  yindex < ycoordinates.length-1
            // if( (yindex === ycoordinates.length-1) || (nextycoordinate - ycoordinate > EPS) )
            {
                // Now activepolygons is up to date
                // Build the output polygons for the next row in newoutpolygonrow:
                for (let activepolygonKey in activepolygons) {
                    let activepolygon = activepolygons[activepolygonKey];
                    let polygonindex = activepolygon.polygonindex;
                    let vertices2d = polygonvertices2d[polygonindex];
                    let numvertices = vertices2d.length;

                    let x = interpolateBetween2DPointsForY(activepolygon.topleft, activepolygon.bottomleft, ycoordinate);
                    let topleft = Vector2D.Create(x, ycoordinate);
                    x = interpolateBetween2DPointsForY(activepolygon.topright, activepolygon.bottomright, ycoordinate);
                    let topright = Vector2D.Create(x, ycoordinate);
                    x = interpolateBetween2DPointsForY(activepolygon.topleft, activepolygon.bottomleft, nextycoordinate);
                    let bottomleft = Vector2D.Create(x, nextycoordinate);
                    x = interpolateBetween2DPointsForY(activepolygon.topright, activepolygon.bottomright, nextycoordinate);
                    let bottomright = Vector2D.Create(x, nextycoordinate);
                    let outpolygon = {
                        topleft: topleft,
                        topright: topright,
                        bottomleft: bottomleft,
                        bottomright: bottomright,
                        leftline: Line2D.fromPoints(topleft, bottomleft),
                        rightline: Line2D.fromPoints(bottomright, topright),
                    };
                    if (newoutpolygonrow.length > 0) {
                        let prevoutpolygon = newoutpolygonrow[newoutpolygonrow.length - 1];
                        let d1 = outpolygon.topleft.distanceTo(prevoutpolygon.topright);
                        let d2 = outpolygon.bottomleft.distanceTo(prevoutpolygon.bottomright);
                        if (d1 < CONSTANTS.EPS && d2 < CONSTANTS.EPS) {
                            // we can join this polygon with the one to the left:
                            outpolygon.topleft = prevoutpolygon.topleft;
                            outpolygon.leftline = prevoutpolygon.leftline;
                            outpolygon.bottomleft = prevoutpolygon.bottomleft;
                            newoutpolygonrow.splice(newoutpolygonrow.length - 1, 1);
                        }
                    }
                    newoutpolygonrow.push(outpolygon);
                } // for(activepolygon in activepolygons)
                if (yindex > 0) {
                    // try to match the new polygons against the previous row:
                    let prevcontinuedindexes = {};
                    let matchedindexes = {};
                    for (let i = 0; i < newoutpolygonrow.length; i++) {
                        let thispolygon = newoutpolygonrow[i];
                        for (let ii = 0; ii < prevoutpolygonrow.length; ii++) {
                            if (!matchedindexes[ii]) {
                                // not already processed?
                                // We have a match if the sidelines are equal or if the top coordinates
                                // are on the sidelines of the previous polygon
                                let prevpolygon = prevoutpolygonrow[ii];
                                if (prevpolygon.bottomleft.distanceTo(thispolygon.topleft) < CONSTANTS.EPS) {
                                    if (prevpolygon.bottomright.distanceTo(thispolygon.topright) < CONSTANTS.EPS) {
                                        // Yes, the top of this polygon matches the bottom of the previous:
                                        matchedindexes[ii] = true;
                                        // Now check if the joined polygon would remain convex:
                                        let d1 = thispolygon.leftline.direction().x - prevpolygon.leftline.direction().x;
                                        let d2 = thispolygon.rightline.direction().x - prevpolygon.rightline.direction().x;
                                        let leftlinecontinues = Math.abs(d1) < CONSTANTS.EPS;
                                        let rightlinecontinues = Math.abs(d2) < CONSTANTS.EPS;
                                        let leftlineisconvex = leftlinecontinues || d1 >= 0;
                                        let rightlineisconvex = rightlinecontinues || d2 >= 0;
                                        if (leftlineisconvex && rightlineisconvex) {
                                            // yes, both sides have convex corners:
                                            // This polygon will continue the previous polygon
                                            thispolygon.outpolygon = prevpolygon.outpolygon;
                                            thispolygon.leftlinecontinues = leftlinecontinues;
                                            thispolygon.rightlinecontinues = rightlinecontinues;
                                            prevcontinuedindexes[ii] = true;
                                        }
                                        break;
                                    }
                                }
                            } // if(!prevcontinuedindexes[ii])
                        } // for ii
                    } // for i
                    for (let ii = 0; ii < prevoutpolygonrow.length; ii++) {
                        if (!prevcontinuedindexes[ii]) {
                            // polygon ends here
                            // Finish the polygon with the last point(s):
                            let prevpolygon = prevoutpolygonrow[ii];
                            prevpolygon.outpolygon.rightpoints.push(prevpolygon.bottomright);
                            if (prevpolygon.bottomright.distanceTo(prevpolygon.bottomleft) > CONSTANTS.EPS) {
                                // polygon ends with a horizontal line:
                                prevpolygon.outpolygon.leftpoints.push(prevpolygon.bottomleft);
                            }
                            // reverse the left half so we get a counterclockwise circle:
                            prevpolygon.outpolygon.leftpoints.reverse();
                            let points2d = prevpolygon.outpolygon.rightpoints.concat(prevpolygon.outpolygon.leftpoints);
                            let vertices3d = [];
                            points2d.map(function (point2d) {
                                let point3d = orthobasis.to3D(point2d);
                                let vertex3d = new Vertex(point3d);
                                vertices3d.push(vertex3d);
                            });
                            let polygon = new Polygon(vertices3d, shared, plane);
                            destpolygons.push(polygon);
                        }
                    }
                } // if(yindex > 0)
                for (let i = 0; i < newoutpolygonrow.length; i++) {
                    let thispolygon = newoutpolygonrow[i];
                    if (!thispolygon.outpolygon) {
                        // polygon starts here:
                        thispolygon.outpolygon = {
                            leftpoints: [],
                            rightpoints: [],
                        };
                        thispolygon.outpolygon.leftpoints.push(thispolygon.topleft);
                        if (thispolygon.topleft.distanceTo(thispolygon.topright) > CONSTANTS.EPS) {
                            // we have a horizontal line at the top:
                            thispolygon.outpolygon.rightpoints.push(thispolygon.topright);
                        }
                    } else {
                        // continuation of a previous row
                        if (!thispolygon.leftlinecontinues) {
                            thispolygon.outpolygon.leftpoints.push(thispolygon.topleft);
                        }
                        if (!thispolygon.rightlinecontinues) {
                            thispolygon.outpolygon.rightpoints.push(thispolygon.topright);
                        }
                    }
                }
                prevoutpolygonrow = newoutpolygonrow;
            }
        } // for yindex
    } // if(numpolygons > 0)
};

/*
 * See the LICENSE file for license.
 */

// TODO: FIXME: KILL THIS!!!! Tag factory: we can request a unique tag through _CSG.getTag()
window.staticTag = 1;
window.getTag = () => window.staticTag++;

/*
 * interface converters
 */
const importThreeGeometry = (geometry) => {
    if (geometry instanceof CSG) return geometry;

    const csg = new CSG();
    const vertices = geometry.index ? geometry.index.array : [];
    const vectors = geometry.attributes.position.array;
    const getVector = (x, y = 0) => vectors[vertices[x] * 3 + y];
    const getVertex = (x) => new Vertex(new Vector(getVector(x), getVector(x, 1), getVector(x, 2)));
    const getVertex2 = (x) => new Vertex(new Vector(vectors[x], vectors[x + 1], vectors[x + 2]));
    const getVertexes = (x) => [getVertex(x), getVertex(x + 1), getVertex(x + 2)];

    if (vertices.length) {
        for (let x = 0; x < vertices.length; x += 3) {
            csg.polygons.push(new Polygon(getVertexes(x)));
        }
    } else {
        for (let x = 0; x < vectors.length; x += 9) {
            csg.polygons.push(new Polygon([getVertex2(x), getVertex2(x + 3), getVertex2(x + 6)]));
        }
    }

    csg.isCanonicalized = false;
    csg.isRetesselated = false;
    return csg;
};

const exportThreeGeometry = (geometry) => {
    if (!geometry instanceof CSG) return geometry;

    const threeGeometry = new THREE.BufferGeometry();
    const vertices = [];
    const colors = [];
    let colorsUsed = false;
    let vertexColor;

    geometry.polygons.forEach((polygon) => {
        if (polygon.shared.color) {
            vertexColor = [polygon.shared.color[0], polygon.shared.color[1], polygon.shared.color[2]];
            colorsUsed = true;
        } else {
            vertexColor = [1, 1, 1];
        }

        for (let x = 0; x < polygon.vertices.length - 2; x++) {
            [0, x + 1, x + 2].forEach((vertice) => {
                ['x', 'y', 'z'].forEach((axis) => {
                    vertices.push(polygon.vertices[vertice].pos[axis]);
                });
            });

            for (let y = 0; y < 3; y++) {
                colors.push(...vertexColor);
            }
        }
    });

    threeGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    if (colorsUsed) threeGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    threeGeometry.computeVertexNormals();
    return threeGeometry;
};

/*
 * operations
 */
const runOperation = (operation, objects, colors = []) => {
    objects = objects.map((object, index) => {
        const convertedObject = importThreeGeometry(object);

        if (colors[index]) {
            convertedObject.setColor([colors[index].r, colors[index].g, colors[index].b, 1]);
        }

        return convertedObject;
    });

    return operation(...objects);
};

/*
 * export
 */
const CSG$1 = { BufferGeometry: exportThreeGeometry };
CSG$1.union = runOperation.bind(undefined, union);
CSG$1.difference = runOperation.bind(undefined, difference);
CSG$1.intersection = runOperation.bind(undefined, intersection);

window.CSG = CSG$1;

export default CSG$1;
