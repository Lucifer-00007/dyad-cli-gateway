// MongoDB initialization script for Gateway
// This script runs when the MongoDB container starts for the first time

// Switch to the gateway database
db = db.getSiblingDB('dyad-gateway');

// Create collections with initial indexes
db.createCollection('providers');
db.createCollection('apikeys');
db.createCollection('auditlogs');

// Create indexes for providers collection
db.providers.createIndex({ "slug": 1 }, { unique: true });
db.providers.createIndex({ "enabled": 1 });
db.providers.createIndex({ "type": 1 });

// Create indexes for apikeys collection
db.apikeys.createIndex({ "keyHash": 1 }, { unique: true });
db.apikeys.createIndex({ "enabled": 1 });
db.apikeys.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 });

// Create indexes for audit logs
db.auditlogs.createIndex({ "timestamp": 1 });
db.auditlogs.createIndex({ "action": 1 });
db.auditlogs.createIndex({ "userId": 1 });

print('Gateway database initialized successfully');