/*
 * See the LICENSE file for license.
 */

import { Vector, Vertex, Polygon } from 'math';
import { CSG as _CSG } from 'core';
import { union, difference, intersection } from 'api';

// TODO: FIXME: KILL THIS!!!! Tag factory: we can request a unique tag through _CSG.getTag()
window.staticTag = 1;
window.getTag = () => window.staticTag++;

/*
 * interface converters
 */
const importThreeGeometry = (geometry) => {
    if (geometry instanceof _CSG) return geometry;

    const csg = new _CSG();
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
    if (!geometry instanceof _CSG) return geometry;

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
const CSG = { BufferGeometry: exportThreeGeometry };
CSG.union = runOperation.bind(undefined, union);
CSG.difference = runOperation.bind(undefined, difference);
CSG.intersection = runOperation.bind(undefined, intersection);

window.CSG = CSG;

export default CSG;
