import { Vector2D } from 'math';

const Vertex2D = function (pos) {
    this.pos = pos;
};

Vertex2D.fromObject = function (obj) {
    return new Vertex2D(new Vector2D(obj.pos._x, obj.pos._y));
};

Vertex2D.prototype = {
    toString: function () {
        return '(' + this.pos.x.toFixed(5) + ',' + this.pos.y.toFixed(5) + ')';
    },
    getTag: function () {
        var result = this.tag;
        if (!result) {
            result = window.getTag(); // TODO: KILL THIS!!!
            this.tag = result;
        }
        return result;
    },
};

export default Vertex2D;
