// migrations/20250622120000_create_job_alerts_table.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('job_alerts', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('alert_name', 255).notNullable(); // "Frontend Jobs in Istanbul"
    table.string('keywords', 500); // "React, JavaScript, Frontend"
    table.string('city', 100);
    table.string('country', 100);
    table.enu('preference', ['Uzaktan', 'Ofis', 'Hibrit', 'Yarı Zamanlı', 'Tam Zamanlı']);
    table.string('company', 255); // Specific company filter
    table.integer('min_salary').unsigned();
    table.integer('max_salary').unsigned();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_notification_sent').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Foreign key constraint
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    
    // Indexes for better performance
    table.index('user_id');
    table.index('is_active');
    table.index(['city', 'country']);
    table.index('keywords');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('job_alerts');
};