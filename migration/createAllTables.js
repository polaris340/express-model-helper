const walk = require('walk');
const files = [];
const fs = require('fs');


module.exports = (rootPath, excludeDirectories = ['.git', 'node_modules']) => {
  const walker = walk.walk(rootPath, {
    followLinks: false,
    filters: excludeDirectories
  });

  const basePath = rootPath[0] === '/' ? '' : process.cwd() + '/';

  const models = {}; // {tableName: {model: class, references: [table names], created: false}}
  const createOrder = [];

  walker.on('file', function (root, stat, next) {
    // Add this file to the list of files
    files.push(basePath + root + '/' + stat.name);
    next();
  });


  const setCreateOrder = tableName => {
    const modelInfo = models[tableName];
    if (modelInfo.added) return;

    modelInfo.references.forEach(setCreateOrder);
    createOrder.push(tableName);
    modelInfo.added = true;
  };

  walker.on('end', async function () {
    files.filter(f => {
      if (!f.endsWith('.js')) return false;

      return true;
    }).forEach(path => {
      const content = fs.readFileSync(path);
      if (/class\s+\w+\s+extends\s+Model(\s+|{)/.test(content)) {
        console.log('processing file', path);
        const model = require(path);
        models[model.tableName] = {
          added: false,
          model: model,
          references: model.ownColumns.filter(c => c.references).map(c => c.references.split('.')[0])
        };
      }
    });

    Object.keys(models).map(tn => setCreateOrder(tn));

    for (let i = 0; i < createOrder.length; i++) {
      console.log(createOrder[i]);
      await models[createOrder[i]].model.createTable();
    }
    console.log('all tables created');
  });

};