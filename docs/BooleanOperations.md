# API Description - Boolean Operations

## [union](#union)

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
let box = cube({ radius: 50 }).union([
    translate([0, 25, 0], sphere({ radius: 10, resolution: 16 })),
]);
```

## [subtract](#subtract)

Creates a new object that represents the subtraction of multiple objects from an object

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
let box = cube({ radius: 50 }).subtract([
    translate([0, 25, 0], sphere({ radius: 10, resolution: 16 })),
]);
```

## [intersect](#intersect)

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
let box = cube({ radius: 50 }).intersect([
    translate([0, 25, 0], sphere({ radius: 10, resolution: 16 })),
]);
