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
let box = union([
    cube({ radius: 50 }),
    translate([0, 25, 0], sphere({ radius: 10, resolution: 16 })),
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
let box = intersect([
    cube({ radius: 50 }),
    translate([0, 25, 0], sphere({ radius: 10, resolution: 16 })),
]);
```
