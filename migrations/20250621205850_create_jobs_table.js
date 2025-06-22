/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('jobs', function(table) {
    table.increments('id').primary();
    table.string('title', 255).notNullable();
    table.string('company', 255).notNullable();
    table.string('city', 100).notNullable();
    table.string('country', 100).notNullable();
    table.enu('preference', ['Uzaktan', 'Ofis', 'Hibrit', 'Yarı Zamanlı', 'Tam Zamanlı']).notNullable();
    table.text('description').defaultTo('');
    table.integer('applications').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes for better performance
    table.index('city');
    table.index('country');
    table.index('preference');
    table.index('created_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('jobs');
};