const {memoize} = require('lodash');

const toCamelcase = memoize(snake => snake.replace(/(_[a-z])/g, m => m[1].toUpperCase()));
const toSnakecase = memoize(camel => camel[0].toLowerCase() + camel.substr(1).replace(/([A-Z])/g, m => `_${m[0].toLowerCase()}`));

exports.toCamelcase = toCamelcase;

exports.toSnakecase = toSnakecase;

exports.toPascalcase = memoize(snake => snake[0].toUpperCase() + toCamelcase(snake).substr(1));

exports.objectKeysToCamel = obj => {
  const res = {};
  Object.keys(obj).forEach(k => res[toCamelcase(k)] = obj[k]);

  return res;
};

exports.objectKeysToSnake = obj => {
  const res = {};
  Object.keys(obj).forEach(k => res[toSnakecase(k)] = obj[k]);

  return res;
};