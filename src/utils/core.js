const IsFloat = function (n) {
    return !isNaN(n) || n === Infinity || n === -Infinity;
};

const solve2Linear = function (a, b, c, d, u, v) {
    let det = a * d - b * c;
    let invdet = 1.0 / det;
    let x = u * d - b * v;
    let y = -u * c + a * v;
    x *= invdet;
    y *= invdet;
    return [x, y];
};

export { IsFloat, solve2Linear };
