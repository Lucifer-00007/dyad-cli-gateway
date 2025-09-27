/**
 * Gateway Controllers Index
 * Exports all gateway controller modules
 */

const v1Controller = require('./v1.controller');
const adminController = require('./admin.controller');

module.exports = {
  v1Controller,
  adminController,
};