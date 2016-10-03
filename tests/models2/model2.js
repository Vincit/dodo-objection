var Model = require('objection').Model;

function Model2() {
  Model.apply(this, arguments);
}

Model.extend(Model2);

Model2.tableName = 'Model2';

module.exports = Model2;