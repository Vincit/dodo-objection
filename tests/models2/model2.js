'use strict';

const Model = require('objection').Model;

class Model2 extends Model {
  static get tableName() { return 'Model2'; }
}

module.exports = Model2;