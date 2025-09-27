#!/usr/bin/env node

/**
 * Database Migration Script for Dyad CLI Gateway
 * Handles database schema migrations and data transformations
 */

const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const config = require('../src/config/config');
const logger = require('../src/config/logger');

// Migration tracking schema
const migrationSchema = new mongoose.Schema({
  version: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  appliedAt: { type: Date, default: Date.now },
  checksum: { type: String, required: true }
});

const Migration = mongoose.model('Migration', migrationSchema);

class DatabaseMigrator {
  constructor() {
    this.migrationsDir = path.join(__dirname, '../migrations');
    this.appliedMigrations = new Set();
  }

  async connect() {
    try {
      await mongoose.connect(config.mongoose.url, config.mongoose.options);
      logger.info('Connected to MongoDB for migrations');
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }

  async loadAppliedMigrations() {
    try {
      const applied = await Migration.find({}).sort({ version: 1 });
      this.appliedMigrations = new Set(applied.map(m => m.version));
      logger.info(`Found ${applied.length} applied migrations`);
    } catch (error) {
      logger.warn('Migration collection not found, creating it...');
      // Collection will be created when first migration is recorded
    }
  }

  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsDir);
      return files
        .filter(file => file.endsWith('.js'))
        .sort()
        .map(file => ({
          version: file.replace('.js', ''),
          filename: file,
          path: path.join(this.migrationsDir, file)
        }));
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('Migrations directory not found, creating it...');
        await fs.mkdir(this.migrationsDir, { recursive: true });
        return [];
      }
      throw error;
    }
  }

  async calculateChecksum(filePath) {
    const crypto = require('crypto');
    const content = await fs.readFile(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async runMigration(migration) {
    logger.info(`Running migration: ${migration.version}`);
    
    try {
      // Load and execute the migration
      const migrationModule = require(migration.path);
      
      if (typeof migrationModule.up !== 'function') {
        throw new Error(`Migration ${migration.version} does not export an 'up' function`);
      }

      // Run the migration
      await migrationModule.up(mongoose);
      
      // Calculate checksum and record the migration
      const checksum = await this.calculateChecksum(migration.path);
      
      await Migration.create({
        version: migration.version,
        name: migration.filename,
        checksum
      });
      
      logger.info(`Migration ${migration.version} completed successfully`);
    } catch (error) {
      logger.error(`Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  async rollbackMigration(migration) {
    logger.info(`Rolling back migration: ${migration.version}`);
    
    try {
      // Load and execute the rollback
      const migrationModule = require(migration.path);
      
      if (typeof migrationModule.down !== 'function') {
        throw new Error(`Migration ${migration.version} does not export a 'down' function`);
      }

      // Run the rollback
      await migrationModule.down(mongoose);
      
      // Remove the migration record
      await Migration.deleteOne({ version: migration.version });
      
      logger.info(`Migration ${migration.version} rolled back successfully`);
    } catch (error) {
      logger.error(`Rollback of migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  async migrate() {
    logger.info('Starting database migration...');
    
    await this.connect();
    await this.loadAppliedMigrations();
    
    const migrationFiles = await this.getMigrationFiles();
    const pendingMigrations = migrationFiles.filter(m => !this.appliedMigrations.has(m.version));
    
    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations found');
      return;
    }
    
    logger.info(`Found ${pendingMigrations.length} pending migrations`);
    
    for (const migration of pendingMigrations) {
      await this.runMigration(migration);
    }
    
    logger.info('All migrations completed successfully');
  }

  async rollback(targetVersion) {
    logger.info(`Rolling back to version: ${targetVersion || 'previous'}`);
    
    await this.connect();
    await this.loadAppliedMigrations();
    
    const appliedMigrations = await Migration.find({}).sort({ version: -1 });
    
    if (appliedMigrations.length === 0) {
      logger.info('No migrations to rollback');
      return;
    }
    
    let migrationsToRollback;
    
    if (targetVersion) {
      // Rollback to specific version
      migrationsToRollback = appliedMigrations.filter(m => m.version > targetVersion);
    } else {
      // Rollback last migration only
      migrationsToRollback = [appliedMigrations[0]];
    }
    
    if (migrationsToRollback.length === 0) {
      logger.info('No migrations to rollback');
      return;
    }
    
    logger.info(`Rolling back ${migrationsToRollback.length} migrations`);
    
    for (const migration of migrationsToRollback) {
      const migrationFile = {
        version: migration.version,
        filename: migration.name,
        path: path.join(this.migrationsDir, migration.name)
      };
      
      await this.rollbackMigration(migrationFile);
    }
    
    logger.info('Rollback completed successfully');
  }

  async status() {
    await this.connect();
    await this.loadAppliedMigrations();
    
    const migrationFiles = await this.getMigrationFiles();
    const appliedMigrations = await Migration.find({}).sort({ version: 1 });
    
    console.log('\n=== Migration Status ===\n');
    
    if (migrationFiles.length === 0) {
      console.log('No migration files found');
      return;
    }
    
    for (const file of migrationFiles) {
      const applied = appliedMigrations.find(m => m.version === file.version);
      const status = applied ? '✓ Applied' : '✗ Pending';
      const appliedAt = applied ? ` (${applied.appliedAt.toISOString()})` : '';
      
      console.log(`${status} ${file.version}${appliedAt}`);
    }
    
    console.log(`\nTotal: ${migrationFiles.length} migrations, ${appliedMigrations.length} applied\n`);
  }

  async createMigration(name) {
    if (!name) {
      throw new Error('Migration name is required');
    }
    
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
    const version = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}`;
    const filename = `${version}.js`;
    const filePath = path.join(this.migrationsDir, filename);
    
    const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

module.exports = {
  /**
   * Run the migration
   * @param {mongoose} mongoose - Mongoose instance
   */
  async up(mongoose) {
    // Add your migration logic here
    // Example:
    // const db = mongoose.connection.db;
    // await db.collection('providers').createIndex({ slug: 1 }, { unique: true });
    
    console.log('Migration ${version} applied');
  },

  /**
   * Rollback the migration
   * @param {mongoose} mongoose - Mongoose instance
   */
  async down(mongoose) {
    // Add your rollback logic here
    // Example:
    // const db = mongoose.connection.db;
    // await db.collection('providers').dropIndex({ slug: 1 });
    
    console.log('Migration ${version} rolled back');
  }
};
`;
    
    await fs.mkdir(this.migrationsDir, { recursive: true });
    await fs.writeFile(filePath, template);
    
    logger.info(`Created migration file: ${filename}`);
    console.log(`Migration file created: ${filePath}`);
  }
}

// CLI interface
async function main() {
  const migrator = new DatabaseMigrator();
  const command = process.argv[2];
  const arg = process.argv[3];
  
  try {
    switch (command) {
      case 'migrate':
      case 'up':
        await migrator.migrate();
        break;
        
      case 'rollback':
      case 'down':
        await migrator.rollback(arg);
        break;
        
      case 'status':
        await migrator.status();
        break;
        
      case 'create':
        await migrator.createMigration(arg);
        break;
        
      default:
        console.log(`
Usage: node migrate-database.js <command> [options]

Commands:
  migrate, up              Run pending migrations
  rollback, down [version] Rollback migrations (to specific version or last one)
  status                   Show migration status
  create <name>           Create a new migration file

Examples:
  node migrate-database.js migrate
  node migrate-database.js rollback
  node migrate-database.js rollback 20231201120000_initial_setup
  node migrate-database.js status
  node migrate-database.js create "add user indexes"
        `);
        process.exit(1);
    }
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await migrator.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = DatabaseMigrator;