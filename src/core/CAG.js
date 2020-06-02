/**
 * Class CAG
 * Holds a solid area geometry like CSG but 2D.
 * Each area consists of a number of sides.
 * Each side is a line between 2 points.
 * @constructor
 */
let CAG = function () {
    this.sides = [];
    this.isCanonicalized = false;
};

CAG.prototype = {};

export default CAG;
