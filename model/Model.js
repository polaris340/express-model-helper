const {toCamelcase, toSnakecase} = require('../helper/caseHelper');

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
        // notNullable: true
      },

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

  static get tableName() {
    return this._tableName || (this._tableName = toSnakecase(/class\s+(\S+)\s+.+/.exec(this.toString())[1]));
  }

  static getAliasedColumnNames(tableName = this.tableName) {
    const hiddenColumnsSet = new Set(this.hiddenColumns);
    return [...(this.columns
      .filter(c => !hiddenColumnsSet.has(c.name))
      .map(c => `${c.name} as ${this.aliasFunc(c.name)}`))];
  }

  static get select() {
    return this.table.select(this.getAliasedColumnNames());
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
}

// column names
Model.ownColumns = [];
Model.hiddenColumns = [];
Model.immutableColumns = [];
Model.aliasFunc = toCamelcase;


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