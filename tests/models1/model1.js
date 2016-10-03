var Model = require('objection').Model;

function Model1() {
  Model.apply(this, arguments);
}

Model.extend(Model1);

Model1.tableName = 'Model1';

module.exports = Model1;