import { FuzzyFactory } from 'core';
import { CONSTANTS } from 'utils';
import { Side } from 'math';

const FuzzyCAGFactory = function () {
    this.vertexfactory = new FuzzyFactory(2, CONSTANTS.EPS);
};

FuzzyCAGFactory.prototype = {
    getVertex: function (sourcevertex) {
        let elements = [sourcevertex.pos._x, sourcevertex.pos._y];
        let result = this.vertexfactory.lookupOrCreate(elements, function (els) {
            return sourcevertex;
        });
        return result;
    },

    getSide: function (sourceside) {
        let vertex0 = this.getVertex(sourceside.vertex0);
        let vertex1 = this.getVertex(sourceside.vertex1);
        return new Side(vertex0, vertex1);
    },
};

export default FuzzyCAGFactory;
