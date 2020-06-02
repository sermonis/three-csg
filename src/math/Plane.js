// # class Plane
// Represents a plane in 3D space.
const Plane = function (normal, w) {
    this.normal = normal;
    this.w = w;
};

Plane.fromVector3Ds = function (a, b, c) {
    let n = b.minus(a).cross(c.minus(a)).unit();
    return new Plane(n, n.dot(a));
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

    signedDistanceToPoint: function (point) {
        let t = this.normal.dot(point) - this.w;
        return t;
    },

    mirrorPoint: function (point3d) {
        let distance = this.signedDistanceToPoint(point3d);
        let mirrored = point3d.minus(this.normal.times(distance * 2.0));
        return mirrored;
    },
};

export default Plane;
