/**
 * Gateway Adapters Index
 * Exports all adapter implementations
 */

const BaseAdapter = require('./base.adapter');
const SpawnCliAdapter = require('./spawn-cli.adapter');
const AdapterFactory = require('./adapter.factory');

module.exports = {
  BaseAdapter,
  SpawnCliAdapter,
  AdapterFactory
};