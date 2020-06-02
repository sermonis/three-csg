# API Description - Primitives

-   [cube](#cube)
-   [sphere](#sphere)
-   [torus](torus)

## cube

Creates a cube with the center at the zero point [0, 0, 0]

### Description

```js
/* @param {number or Array} radius
 *   Radius of the cube, from center point to the walls
 *   Number for a general cuboid, Array for an rectangular cuboid
 */
let output = cube(xyz | [x, y, z]);
```

### Example

```js
let myCube = cube(10);
let myCube = cube([30, 20, 10]);
```

## sphere

Creates a sphere with the center at the zero point [0, 0, 0]

### Description

```js
/* @param {number or Array} radius
 *   Radius of the sphere, from center point to the wall
 * @param {number} resolution
 *   The number of faces for a full 360°
 */
let output = sphere({
    radius: r,
    resolution: res,
});
```

### Example

```js
let mySphere = sphere({
    radius: 10,
    resolution: 16,
});
```

<a name="cylinder"></a>

## cylinder([options]) ⇒ [<code>CSG</code>](#CSG)

Construct a cylinder

**Kind**: global function
**Returns**: [<code>CSG</code>](#CSG) - new cylinder

| Param        | Type                 | Default         | Description                                             |
| ------------ | -------------------- | --------------- | ------------------------------------------------------- |
| [options]    | <code>Object</code>  |                 | options for construction                                |
| [options.r]  | <code>Float</code>   | <code>1</code>  | radius of the cylinder                                  |
| [options.r1] | <code>Float</code>   | <code>1</code>  | radius of the top of the cylinder                       |
| [options.r2] | <code>Float</code>   | <code>1</code>  | radius of the bottom of the cylinder                    |
| [options.d]  | <code>Float</code>   | <code>1</code>  | diameter of the cylinder                                |
| [options.d1] | <code>Float</code>   | <code>1</code>  | diameter of the top of the cylinder                     |
| [options.d2] | <code>Float</code>   | <code>1</code>  | diameter of the bottom of the cylinder                  |
| [options.fn] | <code>Integer</code> | <code>32</code> | number of sides of the cylinder (ie quality/resolution) |

**Example**

```js
let cylinder = cylinder({
    d: 10,
    fn: 20,
});
```

## torus

Construct a torus

**Kind**: global function
**Returns**: [<code>CSG</code>](#CSG) - new torus

| Param          | Type                 | Default         | Description                          |
| -------------- | -------------------- | --------------- | ------------------------------------ |
| [options]      | <code>Object</code>  |                 | options for construction             |
| [options.ri]   | <code>Float</code>   | <code>1</code>  | radius of base circle                |
| [options.ro]   | <code>Float</code>   | <code>4</code>  | radius offset                        |
| [options.fni]  | <code>Integer</code> | <code>16</code> | segments of base circle (ie quality) |
| [options.fno]  | <code>Integer</code> | <code>32</code> | segments of extrusion (ie quality)   |
| [options.roti] | <code>Integer</code> | <code>0</code>  | rotation angle of base circle        |

**Example**

```js
let torus1 = torus({
    ri: 10,
});
```

<a name="cylinder"></a>

## cylinder([options]) ⇒ [<code>CSG</code>](#CSG)

Construct a solid cylinder.

**Kind**: global function
**Returns**: [<code>CSG</code>](#CSG) - new 3D solid

| Param                | Type                | Default                          | Description                                  |
| -------------------- | ------------------- | -------------------------------- | -------------------------------------------- |
| [options]            | <code>Object</code> |                                  | options for construction                     |
| [options.start]      | <code>Vector</code> | <code>[0,-1,0]</code>            | start point of cylinder                      |
| [options.end]        | <code>Vector</code> | <code>[0,1,0]</code>             | end point of cylinder                        |
| [options.radius]     | <code>Number</code> | <code>1</code>                   | radius of cylinder, must be scalar           |
| [options.resolution] | <code>Number</code> | <code>defaultResolution3D</code> | number of polygons per 360 degree revolution |

**Example**

```js
let cylinder = CSG.cylinder({
    start: [0, -10, 0],
    end: [0, 10, 0],
    radius: 10,
    resolution: 16,
});
```

<a name="roundedCylinder"></a>

## roundedCylinder([options]) ⇒ [<code>CSG</code>](#CSG)

Construct a cylinder with rounded ends.

**Kind**: global function
**Returns**: [<code>CSG</code>](#CSG) - new 3D solid

| Param                | Type                 | Default                          | Description                                                                                       |
| -------------------- | -------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------- |
| [options]            | <code>Object</code>  |                                  | options for construction                                                                          |
| [options.start]      | <code>Vector3</code> | <code>[0,-1,0]</code>            | start point of cylinder                                                                           |
| [options.end]        | <code>Vector3</code> | <code>[0,1,0]</code>             | end point of cylinder                                                                             |
| [options.radius]     | <code>Number</code>  | <code>1</code>                   | radius of rounded ends, must be scalar                                                            |
| [options.normal]     | <code>Vector3</code> |                                  | vector determining the starting angle for tesselation. Should be non-parallel to start.minus(end) |
| [options.resolution] | <code>Number</code>  | <code>defaultResolution3D</code> | number of polygons per 360 degree revolution                                                      |

**Example**

```js
let cylinder = CSG.roundedCylinder({
    start: [0, -10, 0],
    end: [0, 10, 0],
    radius: 2,
    resolution: 16,
});
```

<a name="cylinderElliptic"></a>

## cylinderElliptic([options]) ⇒ [<code>CSG</code>](#CSG)

Construct an elliptic cylinder.

**Kind**: global function
**Returns**: [<code>CSG</code>](#CSG) - new 3D solid

| Param                 | Type                  | Default                          | Description                                                     |
| --------------------- | --------------------- | -------------------------------- | --------------------------------------------------------------- |
| [options]             | <code>Object</code>   |                                  | options for construction                                        |
| [options.start]       | <code>Vector3</code>  | <code>[0,-1,0]</code>            | start point of cylinder                                         |
| [options.end]         | <code>Vector3</code>  | <code>[0,1,0]</code>             | end point of cylinder                                           |
| [options.radius]      | <code>Vector2D</code> | <code>[1,1]</code>               | radius of rounded ends, must be two dimensional array           |
| [options.radiusStart] | <code>Vector2D</code> | <code>[1,1]</code>               | OPTIONAL radius of rounded start, must be two dimensional array |
| [options.radiusEnd]   | <code>Vector2D</code> | <code>[1,1]</code>               | OPTIONAL radius of rounded end, must be two dimensional array   |
| [options.resolution]  | <code>Number</code>   | <code>defaultResolution2D</code> | number of polygons per 360 degree revolution                    |

**Example**

```js
let cylinder = CSG.cylinderElliptic({
    start: [0, -10, 0],
    end: [0, 10, 0],
    radiusStart: [10, 5],
    radiusEnd: [8, 3],
    resolution: 16,
});
```

<a name="roundedCube"></a>

## roundedCube([options]) ⇒ [<code>CSG</code>](#CSG)

Construct an axis-aligned solid rounded cuboid.

**Kind**: global function
**Returns**: [<code>CSG</code>](#CSG) - new 3D solid

| Param                 | Type                 | Default                          | Description                                       |
| --------------------- | -------------------- | -------------------------------- | ------------------------------------------------- |
| [options]             | <code>Object</code>  |                                  | options for construction                          |
| [options.center]      | <code>Vector3</code> | <code>[0,0,0]</code>             | center of rounded cube                            |
| [options.radius]      | <code>Vector3</code> | <code>[1,1,1]</code>             | radius of rounded cube, single scalar is possible |
| [options.roundradius] | <code>Number</code>  | <code>0.2</code>                 | radius of rounded edges                           |
| [options.resolution]  | <code>Number</code>  | <code>defaultResolution3D</code> | number of polygons per 360 degree revolution      |

**Example**

```js
let cube = CSG.roundedCube({
    center: [2, 0, 2],
    radius: 15,
    roundradius: 2,
    resolution: 36,
});
```
