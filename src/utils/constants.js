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

export default CONSTANTS;
