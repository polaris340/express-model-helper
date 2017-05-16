const {toCamelcase, toSnakecase} = require('../helper/caseHelper');

class Model {

  static get columns() {
    return [
      {
        name: 'id',
        type: 'increments', // table.increments(),
        params: [] // table.increments('id', ...params)
        //default: ___ // __.defaultTo(default
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
    return toSnakecase(/class\s+(\S+)\s+.+/.exec(this.toString())[1]);
  }

  static get select() {
    const hiddenColumnsSet = new Set(this.hiddenColumns);

    return this.table.select(
      ...this.columns
        .filter(c => !hiddenColumnsSet.has(c.name))
        .map(c => `${c.name} as ${toCamelcase(c.name)}`)
    );
  }

  static get table() {
    return this.db(this.tableName);
  }

  static async createTable() {
    return await this.db.schema.createTableIfNotExists(this.tableName, table => {
      this.columns.forEach(c => {
        let col = null;
        if (c.references) {
          // knex에서 increments()를 int(10) unsigned로 만듬
          col = table.integer(c.name, 10).unsigned();
        } else {
          col = table[c.type](c.name, ...(c.params || []));
        }
        if (c.unique) col.unique();
        if (c.index) col.index();
        if (c.references) col.references(c.references);
        if (c.notNullable) col.notNullable();
        if (c.default) col.defaultTo(c.default);
      });

      this.indexes.forEach(i => {
        table.index(i.columns, i.name, i.type);
      });

      this.uniques.forEach(u => table.unique());
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