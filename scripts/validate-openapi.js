#!/usr/bin/env node

/**
 * OpenAPI Specification Validator
 * Validates the OpenAPI spec file for syntax and structure
 */

const fs = require('fs');
const path = require('path');

// Try to require YAML from backend node_modules
let YAML;
try {
  YAML = require(path.join(__dirname, '../backend/node_modules/yaml'));
} catch (error) {
  console.error('❌ YAML module not found. Please run "npm install" in the backend directory first.');
  process.exit(1);
}

const openApiPath = path.join(__dirname, '../md-docs/openapi.yaml');

try {
  console.log('🔍 Validating OpenAPI specification...');
  
  // Check if file exists
  if (!fs.existsSync(openApiPath)) {
    console.error('❌ OpenAPI specification file not found:', openApiPath);
    process.exit(1);
  }
  
  // Read and parse YAML
  const yamlContent = fs.readFileSync(openApiPath, 'utf8');
  const spec = YAML.parse(yamlContent);
  
  // Basic validation checks
  const errors = [];
  
  // Check required OpenAPI fields
  if (!spec.openapi) {
    errors.push('Missing required field: openapi');
  }
  
  if (!spec.info) {
    errors.push('Missing required field: info');
  } else {
    if (!spec.info.title) errors.push('Missing required field: info.title');
    if (!spec.info.version) errors.push('Missing required field: info.version');
  }
  
  if (!spec.paths) {
    errors.push('Missing required field: paths');
  }
  
  // Check if paths are defined
  if (spec.paths && Object.keys(spec.paths).length === 0) {
    errors.push('No paths defined in the specification');
  }
  
  // Check components schemas
  if (spec.components && spec.components.schemas) {
    const schemas = spec.components.schemas;
    const schemaNames = Object.keys(schemas);
    
    console.log(`📋 Found ${schemaNames.length} schema definitions:`);
    schemaNames.forEach(name => {
      console.log(`   - ${name}`);
    });
    
    // Check for common required schemas
    const requiredSchemas = [
      'ErrorResponse',
      'ChatCompletionRequest',
      'ChatCompletionResponse',
      'ModelsResponse',
      'Provider'
    ];
    
    requiredSchemas.forEach(schemaName => {
      if (!schemas[schemaName]) {
        errors.push(`Missing required schema: ${schemaName}`);
      }
    });
  }
  
  // Check paths
  if (spec.paths) {
    const paths = Object.keys(spec.paths);
    console.log(`🛣️  Found ${paths.length} API endpoints:`);
    
    paths.forEach(path => {
      const methods = Object.keys(spec.paths[path]);
      methods.forEach(method => {
        if (method !== 'parameters') {
          console.log(`   ${method.toUpperCase()} ${path}`);
        }
      });
    });
    
    // Check for required endpoints
    const requiredEndpoints = [
      '/health',
      '/ready',
      '/v1/models',
      '/v1/chat/completions',
      '/admin/providers'
    ];
    
    requiredEndpoints.forEach(endpoint => {
      if (!paths.includes(endpoint)) {
        errors.push(`Missing required endpoint: ${endpoint}`);
      }
    });
  }
  
  // Check security schemes
  if (spec.components && spec.components.securitySchemes) {
    const securitySchemes = Object.keys(spec.components.securitySchemes);
    console.log(`🔐 Found ${securitySchemes.length} security schemes:`);
    securitySchemes.forEach(scheme => {
      console.log(`   - ${scheme}`);
    });
  }
  
  // Report results
  if (errors.length > 0) {
    console.error('\n❌ Validation failed with errors:');
    errors.forEach(error => {
      console.error(`   - ${error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ OpenAPI specification is valid!');
    console.log(`📊 Summary:`);
    console.log(`   - OpenAPI version: ${spec.openapi}`);
    console.log(`   - API title: ${spec.info.title}`);
    console.log(`   - API version: ${spec.info.version}`);
    console.log(`   - Endpoints: ${Object.keys(spec.paths).length}`);
    console.log(`   - Schemas: ${spec.components?.schemas ? Object.keys(spec.components.schemas).length : 0}`);
    console.log(`   - Security schemes: ${spec.components?.securitySchemes ? Object.keys(spec.components.securitySchemes).length : 0}`);
  }
  
} catch (error) {
  console.error('❌ Error validating OpenAPI specification:');
  console.error(error.message);
  process.exit(1);
}