// migrations/20250622120001_create_notification_logs_table.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('notification_logs', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.integer('job_alert_id').unsigned().nullable(); // Null for related job notifications
    table.integer('job_id').unsigned().nullable(); // Related job
    table.enu('type', ['job_alert', 'related_job', 'system']).notNullable();
    table.string('title', 255).notNullable();
    table.text('message').notNullable();
    table.enu('status', ['pending', 'sent', 'failed']).defaultTo('pending');
    table.string('delivery_method', 50).defaultTo('email'); // email, sms, push
    table.text('error_message').nullable();
    table.timestamp('sent_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Foreign key constraints
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('job_alert_id').references('id').inTable('job_alerts').onDelete('CASCADE');
    table.foreign('job_id').references('id').inTable('jobs').onDelete('SET NULL');
    
    // Indexes
    table.index('user_id');
    table.index('type');
    table.index('status');
    table.index('created_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('notification_logs');
};