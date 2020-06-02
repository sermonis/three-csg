# API Description - Boolean Operations

-   [union](#union)
-   [subtract](#subtract)
-   [intersect](#intersect)

## union

Creates a new object that represents the union of multiple objects

```text
┌──────┐        ┌──────┐
│  i1  │        │      │
│  ┌───┼──┐     │      └──┐
│  │   │  │  =  │    o    │
└──┼───┘  │     └──┐      │
   │  i2  │        │      │
   └──────┘        └──────┘
```

### Description

```js
let output = union([input1, input2, ...]);
```

### Example

<!-- prettier-ignore -->
```js
let box = CSG.union([
    new THREE.BoxBufferGeometry(100, 100, 100),
    new THREE.SphereBufferGeometry(50, 32, 16).translate(50, 50, 0),
]);
```

## subtract

Creates a new object that represents the subtraction of one or multiple objects from an object

```text
┌──────┐        ┌──────┐
│  i1  │        │   o  │
│  ┌───┼──┐     │  ┌───┘
│  │   │  │  =  │  │
└──┼───┘  │     └──┘
   │  i2  │
   └──────┘
```

### Description

```js
let output = subtract([input1, input2, ...]);
```

### Example

<!-- prettier-ignore -->
```js
let box = CSG.subtract([
    new THREE.BoxBufferGeometry(100, 100, 100),
    new THREE.SphereBufferGeometry(50, 32, 16).translate(50, 50, 0),
]);
```

## intersect

Creates a new object that represents the intersection of multiple objects

```text
┌──────┐
│  i1  │
│  ┌───┼──┐        ┌───┐
│  │   │  │  =     │ o │
└──┼───┘  │        └───┘
   │  i2  │
   └──────┘
```

### Description

```js
let output = intersect([input1, input2, ...]);
```

### Example

<!-- prettier-ignore -->
```js
let box = CSG.intersect([
    new THREE.BoxBufferGeometry(100, 100, 100),
    new THREE.SphereBufferGeometry(50, 32, 16).translate(50, 50, 0),
]);
```
