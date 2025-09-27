/**
 * Gateway Routes Index
 * Exports all gateway route modules
 */

const v1Routes = require('./v1');
const adminRoutes = require('./admin');

module.exports = {
  v1Routes,
  adminRoutes,
};