/**
 * Gateway Adapters Index
 * Exports all adapter implementations
 */

const BaseAdapter = require('./base.adapter');
const SpawnCliAdapter = require('./spawn-cli.adapter');
const HttpSdkAdapter = require('./http-sdk.adapter');
const ProxyAdapter = require('./proxy.adapter');
const LocalAdapter = require('./local.adapter');
const AdapterFactory = require('./adapter.factory');

module.exports = {
  BaseAdapter,
  SpawnCliAdapter,
  HttpSdkAdapter,
  ProxyAdapter,
  LocalAdapter,
  AdapterFactory
};