const {memoize} = require('lodash');

exports.toCamelcase = memoize(snake => snake.replace(/(_[a-z])/g, m => m[1].toUpperCase()));

exports.toSnakecase = memoize(camel => camel[0].toLowerCase() + camel.substr(1).replace(/([A-Z])/g, m => `_${m[0].toLowerCase()}`));