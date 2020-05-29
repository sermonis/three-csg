# API Description - Boolean Operations

-   [union](#union)
-   [subtract](#subtract)
-   [intersect](#intersect)

## union

Creates a new object that represents the union of multiple objects

```text
┌──────┐         ┌──────┐
│  i1  │         │      │
│   ┌──┼───┐     │      └───┐
│   │  │   │  =  │    o1    │
└───┼──┘   │     └───┐      │
    │  i2  │         │      │
    └──────┘         └──────┘
```

### Description

```js
let output1 = input1.union([input2, input3, ...]);
```

### Example

<!-- prettier-ignore -->
```js
let box = union([
    cube({ radius: 50 }),
    translate([0, 25, 0], sphere({ radius: 10, resolution: 16 })),
]);
```

## subtract

Creates a new object that represents the subtraction of one or multiple objects from an object

```text
┌──────┐         ┌──────┐
│  i1  │         │  o1  │
│   ┌──┼───┐     │   ┌──┘
│   │  │   │  =  │   │
└───┼──┘   │     └───┘
    │  i2  │
    └──────┘
```

### Description

```js
let output1 = input1.subtract([input2, input3, ...]);
```

### Example

<!-- prettier-ignore -->
```js
let box = subtract([
    cube({ radius: 50 }),
    translate([0, 25, 0], sphere({ radius: 10, resolution: 16 })),
]);
```

## intersect

Creates a new object that represents the intersection of multiple objects

```text
┌──────┐
│  i1  │
│   ┌──┼───┐         ┌──┐
│   │  │   │  =      │o1│
└───┼──┘   │         └──┘
    │  i2  │
    └──────┘
```

### Description

```js
let output1 = input2.intersect([input2, input3, ...]);
```

### Example

<!-- prettier-ignore -->
```js
let box = intersect([
    cube({ radius: 50 }),
    translate([0, 25, 0], sphere({ radius: 10, resolution: 16 })),
]);
