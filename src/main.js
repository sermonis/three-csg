/*
 * See LICENSE file for license.
 */

import { sphere, cube, roundedCube, cylinder, roundedCylinder, cylinderElliptic, polyhedron, color } from 'api';
import { Matrix4x4, Side, Vector } from 'math';
import { CAG, CSG, addTransformationMethodsToPrototype } from 'core';

// TODO: FIXME: KILL THIS!!!! Tag factory: we can request a unique tag through CSG.getTag()
window.staticTag = 1;
window.getTag = () => window.staticTag++;

// TODO: FIXME: KILL THIS TOO!!!!
addTransformationMethodsToPrototype(CSG.prototype);
// addTransformationMethodsToPrototype(CSG.Vector2D.prototype);
addTransformationMethodsToPrototype(Vector.prototype);
// addTransformationMethodsToPrototype(CSG.Vertex.prototype);
// addTransformationMethodsToPrototype(CSG.Plane.prototype);
// addTransformationMethodsToPrototype(CSG.Polygon.prototype);
// addTransformationMethodsToPrototype(CSG.Line2D.prototype);
// addTransformationMethodsToPrototype(CSG.Line3D.prototype);
// addTransformationMethodsToPrototype(CSG.Path2D.prototype);
// addTransformationMethodsToPrototype(CSG.OrthoNormalBasis.prototype);
// addTransformationMethodsToPrototype(CSG.Connector.prototype);
addTransformationMethodsToPrototype(CAG.prototype);
// addTransformationMethodsToPrototype(CAG.Side.prototype);
// addTransformationMethodsToPrototype(CAG.Vertex.prototype);

export { color, sphere, cube, roundedCube, cylinder, roundedCylinder, cylinderElliptic, polyhedron, Matrix4x4 };
