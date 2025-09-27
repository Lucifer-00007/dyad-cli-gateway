/**
 * Migration: Initial Setup
 * Created: 2023-12-01T12:00:00.000Z
 */

module.exports = {
  /**
   * Run the migration
   * @param {mongoose} mongoose - Mongoose instance
   */
  async up(mongoose) {
    const db = mongoose.connection.db;
    
    console.log('Creating initial collections and indexes...');
    
    // Create providers collection with indexes
    await db.collection('providers').createIndex({ slug: 1 }, { unique: true });
    await db.collection('providers').createIndex({ enabled: 1 });
    await db.collection('providers').createIndex({ type: 1 });
    await db.collection('providers').createIndex({ 'models.dyadModelId': 1 });
    
    // Create apikeys collection with indexes
    await db.collection('apikeys').createIndex({ keyHash: 1 }, { unique: true });
    await db.collection('apikeys').createIndex({ enabled: 1 });
    await db.collection('apikeys').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection('apikeys').createIndex({ userId: 1 });
    
    // Create auditlogs collection with indexes
    await db.collection('auditlogs').createIndex({ timestamp: 1 });
    await db.collection('auditlogs').createIndex({ action: 1 });
    await db.collection('auditlogs').createIndex({ userId: 1 });
    await db.collection('auditlogs').createIndex({ resourceType: 1 });
    await db.collection('auditlogs').createIndex({ resourceId: 1 });
    
    // Create users collection with indexes (if not exists from main app)
    try {
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('users').createIndex({ role: 1 });
    } catch (error) {
      // Index might already exist from main application
      console.log('Users indexes may already exist:', error.message);
    }
    
    console.log('Migration 20231201120000_initial_setup applied');
  },

  /**
   * Rollback the migration
   * @param {mongoose} mongoose - Mongoose instance
   */
  async down(mongoose) {
    const db = mongoose.connection.db;
    
    console.log('Dropping collections created in initial setup...');
    
    // Drop collections (this will also drop their indexes)
    await db.collection('providers').drop().catch(() => {});
    await db.collection('apikeys').drop().catch(() => {});
    await db.collection('auditlogs').drop().catch(() => {});
    
    console.log('Migration 20231201120000_initial_setup rolled back');
  }
};