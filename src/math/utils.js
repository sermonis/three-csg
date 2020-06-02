// -- Math functions (360 deg based vs 2pi)
function sin(a) {
    return Math.sin((a / 360) * Math.PI * 2);
}
function cos(a) {
    return Math.cos((a / 360) * Math.PI * 2);
}
function asin(a) {
    return (Math.asin(a) / (Math.PI * 2)) * 360;
}
function acos(a) {
    return (Math.acos(a) / (Math.PI * 2)) * 360;
}
function tan(a) {
    return Math.tan((a / 360) * Math.PI * 2);
}
function atan(a) {
    return (Math.atan(a) / (Math.PI * 2)) * 360;
}
function atan2(a, b) {
    return (Math.atan2(a, b) / (Math.PI * 2)) * 360;
}

function min(a, b) {
    return a < b ? a : b;
}
function max(a, b) {
    return a > b ? a : b;
}
function rands(min, max, vn, seed) {
    // -- seed is ignored for now, FIX IT (requires reimplementation of random())
    //    see http://stackoverflow.com/questions/424292/how-to-create-my-own-javascript-random-number-generator-that-i-can-also-set-the
    var v = new Array(vn);
    for (var i = 0; i < vn; i++) {
        v[i] = Math.random() * (max - min) + min;
    }
}

function lookup(ix, v) {
    var r = 0;
    for (var i = 0; i < v.length; i++) {
        var a0 = v[i];
        if (a0[0] >= ix) {
            i--;
            a0 = v[i];
            var a1 = v[i + 1];
            var m = 0;
            if (a0[0] !== a1[0]) {
                m = abs((ix - a0[0]) / (a1[0] - a0[0]));
            }
            if (m > 0) {
                r = a0[1] * (1 - m) + a1[1] * m;
            } else {
                r = a0[1];
            }
            return r;
        }
    }
    return r;
}

function sign(a) {
    return a < 0 ? -1 : a > 1 ? 1 : 0;
}

function round(a) {
    return floor(a + 0.5);
}

export { sin, cos, asin, acos, tan, atan, atan2, min, max, rands, lookup, sign, round };
