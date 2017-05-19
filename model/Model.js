const {toCamelcase, toSnakecase, toPascalcase} = require('../helper/caseHelper');
const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLString,
  GraphQLList,
  GraphQLNonNull,
  GraphQLID,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInputObjectType
} = require('graphql');

const dbTypeQlTypeMap = {
  increments: GraphQLInt,
  integer: GraphQLInt,
  string: GraphQLString,
  float: GraphQLFloat,
  'enum': GraphQLString,
  timestamp: GraphQLString,
  json: GraphQLString
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
        params: [], // table.increments('id', ...params)
        immutable: true,
        queryable: true,
        // sortable: false
        // canCreate: false - only set to true when immutable is true but set value when create row
        // hidden: false
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
        default: this.db.raw('current_timestamp'),
        immutable: true,
        sortable: true,
        index: true
      },
      {
        name: 'modified',
        type: 'timestamp',
        default: this.db.raw('current_timestamp on update current_timestamp'),
        immutable: true,
        sortable: true,
        index: true
      }];
  }

  static get modelName() {
    return this._modelName || (this._modelName = /class\s+(\S+)\s+.+/.exec(this.toString())[1]);
  }


  static set camelPluralName(val) {
    this._camelPluralName = val;
  }

  static get camelPluralName() {
    return this._camelPluralName || this.camelName + 's';
  }

  static get camelName() {
    return this._camelName || (this._camelName = toCamelcase(this.tableName));
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
    const hiddenColumnsSet = new Set(this.columns.filter(c => c.hidden)).map(c => c.name);
    this.columns.filter(c => !hiddenColumnsSet.has(c.name)).forEach(c => {
      fields[toCamelcase(c.name)] = this.customFields[c.name] || {
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


  static get queryFields() {
    const args = {};
    this.columns.forEach(c => {
      args[toCamelcase(c.name)] = {type: c.references ? GraphQLInt : dbTypeQlTypeMap[c.type]}
    });

    return {
      [this.camelPluralName]: {
        type: new GraphQLList(this.qlType),
        args,
        resolve: (_, params) => {

          return this.table.select().where(params);
        }
      }
    };
  }

  static get qlInputType() {
    const immutableColumnNamesSet = new Set(this.columns.filter(c => c.immutable && !!c.canCreate).map(c => c.name));
    const fields = {};
    this.columns
      .filter(c => !immutableColumnNamesSet.has(c.name) && c.name !== 'id' && c.name !== 'created' && c.name !== 'modified')
      .forEach(c => {
        fields[toCamelcase(c.name)] = this.customFields[c.name] || {
            type: c.references ? GraphQLInt : dbTypeQlTypeMap[c.type]
          };
      });

    return this._qlInputType || (this._qlInputType = new GraphQLInputObjectType({
        name: `${this.modelName}Attributes`,
        fields
      }));
  }

  static get qlMutationType() {

    return this._qlMutationType || (this._qlMutationType = new GraphQLObjectType({
        name: `${this.modelName}Mutations`,
        fields: {
          [`create${this.modelName}`]: {
            type: this.qlType,
            args: {
              input: {type: this.qlInputType}
            },
            resolve: (value, {input}) => this.table.insert(input).then(res => this.table.select().where({id: res[0]}))
          },
          [`delete${this.modelName}`]: {
            type: this.qlType,
            args: {
              id: {
                type: new GraphQLNonNull(GraphQLInt)
              }
            },
            resolve: (value, {id}) => this.table.where({id}).del()
          }
        }
      }));
  }

}

// column names
Model.ownColumns = [];

Model.aliasFunc = toCamelcase;
Model.description = '';
Model.customFields = {}; // name: ql field definition


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