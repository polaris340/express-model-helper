const {toCamelcase, toSnakecase} = require('../helper/caseHelper');
const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLString,
  GraphQLList,
  GraphQLNonNull,
  GraphQLID,
  GraphQLBoolean,
  GraphQLFloat
} = require('graphql');

const dbTypeQlTypeMap = {
  increments: GraphQLInt,
  integer: GraphQLInt,
  string: GraphQLString,
  float: GraphQLFloat
};

const createColumn = (table, columnData) => {
  let col = null;
  if (columnData.references) {
    // increments() -> integer('id', 10).unsigned()
    col = table.integer(columnData.name, 10).unsigned();
  } else {
    col = table[columnData.type](columnData.name, ...(columnData.params || []));
  }
  if (columnData.unique) col.unique();
  if (columnData.index) col.index();
  if (columnData.references) col.references(columnData.references);
  if (columnData.notNullable) col.notNullable();
  if (columnData.default) col.defaultTo(columnData.default);
};


class Model {

  static get columns() {
    return [
      {
        name: 'id',
        type: 'increments', // table.increments(),
        params: [] // table.increments('id', ...params)
        //default: ___ // __.defaultTo(default),
        // index: true,
        // unique: true,
        // references: 'user.id',
        // notNullable: true,
        // description: 'column description here. It will not affect to database'
      },
      ...this.references.map(r => {
        return {
          name: r.from || `${r.model.tableName}_id`,
          references: `${r.model.tableName}.${r.to || 'id'}`
        };
      }),
      ...this.ownColumns,

      {
        name: 'created',
        type: 'timestamp',
        default: this.db.raw('current_timestamp')
      },
      {
        name: 'modified',
        type: 'timestamp',
        default: this.db.raw('current_timestamp on update current_timestamp')
      }];
  }

  static get modelName() {
    return this._modelName || (this._modelName = /class\s+(\S+)\s+.+/.exec(this.toString())[1]);
  }

  static get tableName() {
    return toSnakecase(this.modelName);
  }

  static getAliasedColumnNames(tableName = this.tableName) {
    const hiddenColumnsSet = new Set(this.hiddenColumns);
    return [...(this.columns
      .filter(c => !hiddenColumnsSet.has(c.name))
      .map(c => `${tableName}.${c.name} as ${this.aliasFunc(c.name)}`))];
  }

  static get table() {
    return this.db(this.tableName);
  }

  static async createTable() {
    const created = await this.db.schema.hasTable(this.tableName);
    if (created) return;
    return await this.db.schema.createTableIfNotExists(this.tableName, table => {
      this.columns.forEach(c => createColumn(table, c));

      this.indexes.forEach(async i => {
        try {
          await table.index(i.columns, i.name, i.type);
        } catch (e) {
          console.log(e);
        }
      });

      this.uniques.forEach(async u => {
        try {
          await table.unique(u);
        } catch (e) {
          console.log(e);
        }
      });
    });
  }

  static dropTable() {
    this.db.schema.dropTableIfExists(this.tableName);
  }

  static get qlType() {
    const fields = {};
    const hiddenColumnsSet = new Set(this.hiddenColumns);
    this.columns.filter(c => !hiddenColumnsSet.has(c.name)).forEach(c => {
      fields[toCamelcase(c.name)] = {
        type: c.references ? GraphQLInt : dbTypeQlTypeMap[c.type],
        description: c.description,
        resolve: obj => obj[c.name]
      }
    });

    this.references.forEach(r => {
      fields[toCamelcase(r.model.tableName)] = {
        type: r.model.qlType,
        description: r.model.description,
        resolve: obj => obj[r.model.tableName]
      }
    });

    return this._qlType || (this._qlType = new GraphQLObjectType({
        name: this.modelName,
        description: this.description || `Table ${this.tableName}`,
        fields
      }));
  }
}

// column names
Model.ownColumns = [];
Model.hiddenColumns = [];
Model.immutableColumns = [];
Model.aliasFunc = toCamelcase;
Model.description = '';


Model.references = [
  // {
  //   model: subclass of Model,
  //   from: column name. default: model.name + '_id',
  //   to: default 'id'
  // }
];


Model.indexes = [
  //   {
  //   columns: [],
  //  name: undefined,
  //  type: undefined
  // }
];

Model.uniques = [
  // ['user_id', 'team_id'], ...
];


module.exports = Model;