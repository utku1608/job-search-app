/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('jobs', function(table) {
    table.string('country', 100).notNullable().defaultTo('Türkiye');
    table.enu('preference', ['Uzaktan', 'Ofis', 'Hibrit', 'Yarı Zamanlı', 'Tam Zamanlı']).notNullable().defaultTo('Tam Zamanlı');
    table.integer('applications').defaultTo(0);
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Add indexes for better performance
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
  return knex.schema.alterTable('jobs', function(table) {
    table.dropColumn('country');
    table.dropColumn('preference');
    table.dropColumn('applications');
    table.dropColumn('updated_at');
    
    // Drop indexes
    table.dropIndex('city');
    table.dropIndex('country');
    table.dropIndex('preference');
    table.dropIndex('created_at');
  });
};