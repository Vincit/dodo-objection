'use strict';

const Model = require('objection').Model;

class Model1 extends Model {
  static get tableName() { return 'Model1'; }
}

module.exports = Model1;