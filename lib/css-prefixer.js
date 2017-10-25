module.exports = function(css, callback) {
    var autoprefixer = require('autoprefixer-core'),
        postcss = require('postcss');

    return postcss([autoprefixer]).process(css).css;
};


