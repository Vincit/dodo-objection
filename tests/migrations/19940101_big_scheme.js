exports.up = function(knex) {

  return knex.schema
    .createTable('Model1', function(table) {
      table.bigincrements('id').primary();
    })
    .createTable('Model2', function(table) {
      table.bigincrements('id').primary();
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('Model1')
    .dropTableIfExists('Model2')
  ;
};
