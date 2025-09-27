/**
 * Migration: Add Provider Health Tracking
 * Created: 2023-12-01T13:00:00.000Z
 */

module.exports = {
  /**
   * Run the migration
   * @param {mongoose} mongoose - Mongoose instance
   */
  async up(mongoose) {
    const db = mongoose.connection.db;
    
    console.log('Adding health tracking fields to providers...');
    
    // Add health tracking fields to existing providers
    await db.collection('providers').updateMany(
      {},
      {
        $set: {
          healthStatus: 'unknown',
          lastHealthCheck: null,
          healthCheckFailures: 0,
          circuitBreakerState: 'closed',
          circuitBreakerLastOpened: null
        }
      }
    );
    
    // Add indexes for health tracking
    await db.collection('providers').createIndex({ healthStatus: 1 });
    await db.collection('providers').createIndex({ lastHealthCheck: 1 });
    await db.collection('providers').createIndex({ circuitBreakerState: 1 });
    
    console.log('Migration 20231201130000_add_provider_health_tracking applied');
  },

  /**
   * Rollback the migration
   * @param {mongoose} mongoose - Mongoose instance
   */
  async down(mongoose) {
    const db = mongoose.connection.db;
    
    console.log('Removing health tracking fields from providers...');
    
    // Remove health tracking fields
    await db.collection('providers').updateMany(
      {},
      {
        $unset: {
          healthStatus: '',
          lastHealthCheck: '',
          healthCheckFailures: '',
          circuitBreakerState: '',
          circuitBreakerLastOpened: ''
        }
      }
    );
    
    // Drop health tracking indexes
    await db.collection('providers').dropIndex({ healthStatus: 1 }).catch(() => {});
    await db.collection('providers').dropIndex({ lastHealthCheck: 1 }).catch(() => {});
    await db.collection('providers').dropIndex({ circuitBreakerState: 1 }).catch(() => {});
    
    console.log('Migration 20231201130000_add_provider_health_tracking rolled back');
  }
};