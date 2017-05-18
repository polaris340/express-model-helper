const {memoize} = require('lodash');

const toCamelCase = snake => snake.replace(/(_[a-z])/g, m => m[1].toUpperCase());

exports.toCamelcase = memoize(toCamelCase);

exports.toSnakecase = memoize(camel => camel[0].toLowerCase() + camel.substr(1).replace(/([A-Z])/g, m => `_${m[0].toLowerCase()}`));

exports.toPascalcase = memoize(snake => snake[0].toUpperCase() + toCamelCase(snake).substr(1));