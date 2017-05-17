const knex = require('knex');
const Model = require('./model/Model');
const caseHelper = require('./helper/caseHelper');

const initialize = dbConfig => {
  Model.db = knex({
    client: 'mysql',
    connection: dbConfig
  });

  return Model;
};

module.exports = {
  initialize,
  Model,
  caseHelper,
  createAllTables: require('./migration/createAllTables')
};