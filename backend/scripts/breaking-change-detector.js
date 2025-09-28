#!/usr/bin/env node

/**
 * Breaking Change Detection Script
 * 
 * Analyzes OpenAPI specifications and code changes to detect breaking changes
 * that could affect API consumers.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const { execSync } = require('child_process');

class BreakingChangeDetector {
  constructor() {
    this.breakingChanges = [];
    this.warnings = [];
  }

  /**
   * Compare two OpenAPI specifications for breaking changes
   */
  async compareOpenAPISpecs(baseSpecPath, currentSpecPath) {
    console.log('🔍 Analyzing OpenAPI specifications for breaking changes...');

    if (!fs.existsSync(baseSpecPath)) {
      console.log('⚠️  No base specification found, skipping OpenAPI comparison');
      return;
    }

    try {
      const baseSpec = yaml.parse(fs.readFileSync(baseSpecPath, 'utf8'));
      const currentSpec = yaml.parse(fs.readFileSync(currentSpecPath, 'utf8'));

      // Check version changes
      this.checkVersionChanges(baseSpec, currentSpec);
      
      // Check endpoint changes
      this.checkEndpointChanges(baseSpec, currentSpec);
      
      // Check schema changes
      this.checkSchemaChanges(baseSpec, currentSpec);
      
      // Check parameter changes
      this.checkParameterChanges(baseSpec, currentSpec);
      
      // Check response changes
      this.checkResponseChanges(baseSpec, currentSpec);

    } catch (error) {
      console.error('❌ Error comparing OpenAPI specs:', error.message);
      this.warnings.push({
        type: 'spec_comparison_error',
        message: `Failed to compare OpenAPI specs: ${error.message}`
      });
    }
  }

  /**
   * Check for version changes
   */
  checkVersionChanges(baseSpec, currentSpec) {
    const baseVersion = baseSpec.info?.version;
    const currentVersion = currentSpec.info?.version;

    if (baseVersion && currentVersion) {
      const baseMajor = parseInt(baseVersion.split('.')[0]);
      const currentMajor = parseInt(currentVersion.split('.')[0]);

      if (currentMajor > baseMajor) {
        this.breakingChanges.push({
          type: 'major_version_bump',
          message: `Major version increased from ${baseVersion} to ${currentVersion}`,
          severity: 'high',
          impact: 'All API consumers may be affected'
        });
      }
    }
  }

  /**
   * Check for endpoint changes
   */
  checkEndpointChanges(baseSpec, currentSpec) {
    const basePaths = baseSpec.paths || {};
    const currentPaths = currentSpec.paths || {};

    // Check for removed endpoints
    for (const [path, methods] of Object.entries(basePaths)) {
      if (!currentPaths[path]) {
        this.breakingChanges.push({
          type: 'endpoint_removed',
          message: `Endpoint removed: ${path}`,
          severity: 'high',
          impact: 'Clients using this endpoint will fail'
        });
        continue;
      }

      // Check for removed HTTP methods
      for (const method of Object.keys(methods)) {
        if (method === 'parameters') continue; // Skip path-level parameters
        
        if (!currentPaths[path][method]) {
          this.breakingChanges.push({
            type: 'method_removed',
            message: `HTTP method removed: ${method.toUpperCase()} ${path}`,
            severity: 'high',
            impact: 'Clients using this method will fail'
          });
        }
      }
    }

    // Check for new required parameters
    for (const [path, methods] of Object.entries(currentPaths)) {
      if (!basePaths[path]) continue;

      for (const [method, spec] of Object.entries(methods)) {
        if (method === 'parameters') continue;
        
        const baseMethod = basePaths[path]?.[method];
        if (!baseMethod) continue;

        this.checkNewRequiredParameters(baseMethod, spec, `${method.toUpperCase()} ${path}`);
      }
    }
  }

  /**
   * Check for new required parameters
   */
  checkNewRequiredParameters(baseMethod, currentMethod, endpoint) {
    const baseParams = baseMethod.parameters || [];
    const currentParams = currentMethod.parameters || [];

    for (const param of currentParams) {
      if (!param.required) continue;

      const baseParam = baseParams.find(p => p.name === param.name && p.in === param.in);
      if (!baseParam) {
        this.breakingChanges.push({
          type: 'new_required_parameter',
          message: `New required parameter added: ${param.name} (${param.in}) in ${endpoint}`,
          severity: 'high',
          impact: 'Existing clients will fail validation'
        });
      } else if (!baseParam.required) {
        this.breakingChanges.push({
          type: 'parameter_made_required',
          message: `Parameter made required: ${param.name} (${param.in}) in ${endpoint}`,
          severity: 'high',
          impact: 'Existing clients may fail validation'
        });
      }
    }
  }

  /**
   * Check for schema changes
   */
  checkSchemaChanges(baseSpec, currentSpec) {
    const baseSchemas = baseSpec.components?.schemas || {};
    const currentSchemas = currentSpec.components?.schemas || {};

    for (const [schemaName, baseSchema] of Object.entries(baseSchemas)) {
      const currentSchema = currentSchemas[schemaName];
      
      if (!currentSchema) {
        this.breakingChanges.push({
          type: 'schema_removed',
          message: `Schema removed: ${schemaName}`,
          severity: 'high',
          impact: 'Clients using this schema will fail'
        });
        continue;
      }

      this.checkSchemaPropertyChanges(baseSchema, currentSchema, schemaName);
    }
  }

  /**
   * Check for schema property changes
   */
  checkSchemaPropertyChanges(baseSchema, currentSchema, schemaName) {
    const baseProps = baseSchema.properties || {};
    const currentProps = currentSchema.properties || {};
    const baseRequired = baseSchema.required || [];
    const currentRequired = currentSchema.required || [];

    // Check for removed properties
    for (const propName of Object.keys(baseProps)) {
      if (!currentProps[propName]) {
        this.breakingChanges.push({
          type: 'property_removed',
          message: `Property removed: ${propName} from schema ${schemaName}`,
          severity: 'medium',
          impact: 'Clients expecting this property may fail'
        });
      }
    }

    // Check for new required properties
    for (const propName of currentRequired) {
      if (!baseRequired.includes(propName)) {
        this.breakingChanges.push({
          type: 'property_made_required',
          message: `Property made required: ${propName} in schema ${schemaName}`,
          severity: 'high',
          impact: 'Existing clients may fail validation'
        });
      }
    }

    // Check for type changes
    for (const [propName, baseProp] of Object.entries(baseProps)) {
      const currentProp = currentProps[propName];
      if (!currentProp) continue;

      if (baseProp.type && currentProp.type && baseProp.type !== currentProp.type) {
        this.breakingChanges.push({
          type: 'property_type_changed',
          message: `Property type changed: ${propName} in schema ${schemaName} (${baseProp.type} → ${currentProp.type})`,
          severity: 'high',
          impact: 'Clients may fail type validation'
        });
      }
    }
  }

  /**
   * Check for parameter changes
   */
  checkParameterChanges(baseSpec, currentSpec) {
    // This is handled in checkEndpointChanges for now
    // Could be expanded for global parameter changes
  }

  /**
   * Check for response changes
   */
  checkResponseChanges(baseSpec, currentSpec) {
    const basePaths = baseSpec.paths || {};
    const currentPaths = currentSpec.paths || {};

    for (const [path, methods] of Object.entries(basePaths)) {
      if (!currentPaths[path]) continue;

      for (const [method, spec] of Object.entries(methods)) {
        if (method === 'parameters') continue;
        
        const currentMethod = currentPaths[path]?.[method];
        if (!currentMethod) continue;

        this.checkResponseStatusChanges(spec, currentMethod, `${method.toUpperCase()} ${path}`);
      }
    }
  }

  /**
   * Check for response status code changes
   */
  checkResponseStatusChanges(baseMethod, currentMethod, endpoint) {
    const baseResponses = baseMethod.responses || {};
    const currentResponses = currentMethod.responses || {};

    // Check for removed success responses
    for (const statusCode of Object.keys(baseResponses)) {
      if (statusCode.startsWith('2') && !currentResponses[statusCode]) {
        this.breakingChanges.push({
          type: 'success_response_removed',
          message: `Success response removed: ${statusCode} from ${endpoint}`,
          severity: 'high',
          impact: 'Clients expecting this response will fail'
        });
      }
    }

    // Check for new error responses
    for (const statusCode of Object.keys(currentResponses)) {
      if (statusCode.startsWith('4') && !baseResponses[statusCode]) {
        this.warnings.push({
          type: 'new_error_response',
          message: `New error response added: ${statusCode} to ${endpoint}`,
          impact: 'Clients should handle this new error case'
        });
      }
    }
  }

  /**
   * Analyze code changes for breaking changes
   */
  analyzeCodeChanges() {
    console.log('🔍 Analyzing code changes for breaking changes...');

    try {
      // Get list of changed files
      const changedFiles = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' })
        .split('\n')
        .filter(file => file.trim())
        .filter(file => file.endsWith('.js') || file.endsWith('.ts'));

      for (const file of changedFiles) {
        this.analyzeFileChanges(file);
      }
    } catch (error) {
      console.log('⚠️  Could not analyze git changes:', error.message);
    }
  }

  /**
   * Analyze changes in a specific file
   */
  analyzeFileChanges(filePath) {
    try {
      const diff = execSync(`git diff HEAD~1 HEAD -- "${filePath}"`, { encoding: 'utf8' });
      
      // Check for removed exports
      const removedExports = diff.match(/^-.*(?:module\.exports|export)/gm);
      if (removedExports) {
        this.breakingChanges.push({
          type: 'export_removed',
          message: `Exports removed from ${filePath}`,
          severity: 'high',
          impact: 'Modules importing these exports will fail'
        });
      }

      // Check for changed function signatures
      const functionChanges = diff.match(/^[-+].*function\s+\w+\s*\([^)]*\)/gm);
      if (functionChanges) {
        this.warnings.push({
          type: 'function_signature_changed',
          message: `Function signatures may have changed in ${filePath}`,
          impact: 'Review for parameter changes that could break callers'
        });
      }

      // Check for removed middleware or routes
      if (filePath.includes('routes') || filePath.includes('middleware')) {
        const removedRoutes = diff.match(/^-.*(?:router\.|app\.)/gm);
        if (removedRoutes) {
          this.breakingChanges.push({
            type: 'route_removed',
            message: `Routes or middleware removed from ${filePath}`,
            severity: 'high',
            impact: 'API endpoints may no longer be available'
          });
        }
      }

    } catch (error) {
      // File might not exist in previous commit
    }
  }

  /**
   * Check database schema changes
   */
  checkDatabaseChanges() {
    console.log('🔍 Checking database schema changes...');

    const migrationFiles = [];
    const migrationsDir = path.join(process.cwd(), 'migrations');
    
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir);
      migrationFiles.push(...files.filter(f => f.endsWith('.js')));
    }

    // Check for new migrations
    try {
      const newMigrations = execSync('git diff --name-only HEAD~1 HEAD -- migrations/', { encoding: 'utf8' })
        .split('\n')
        .filter(file => file.trim());

      for (const migration of newMigrations) {
        if (migration.includes('drop') || migration.includes('remove')) {
          this.breakingChanges.push({
            type: 'database_schema_breaking',
            message: `Potentially breaking database migration: ${migration}`,
            severity: 'high',
            impact: 'Database schema changes may break existing data access'
          });
        }
      }
    } catch (error) {
      // No migrations directory or git changes
    }
  }

  /**
   * Generate breaking change report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        breakingChanges: this.breakingChanges.length,
        warnings: this.warnings.length,
        hasBreakingChanges: this.breakingChanges.length > 0
      },
      breakingChanges: this.breakingChanges,
      warnings: this.warnings,
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Generate recommendations based on findings
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.breakingChanges.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        title: 'Review Breaking Changes',
        description: `${this.breakingChanges.length} breaking changes detected`,
        actions: [
          'Review all breaking changes for necessity',
          'Update API documentation',
          'Consider deprecation period for removed features',
          'Increment major version number',
          'Notify API consumers of changes'
        ]
      });

      const highSeverityChanges = this.breakingChanges.filter(c => c.severity === 'high');
      if (highSeverityChanges.length > 0) {
        recommendations.push({
          priority: 'CRITICAL',
          title: 'High Severity Breaking Changes',
          description: `${highSeverityChanges.length} high severity breaking changes require immediate attention`,
          actions: [
            'Consider reverting high-impact changes',
            'Implement backward compatibility where possible',
            'Create migration guide for consumers',
            'Plan phased rollout strategy'
          ]
        });
      }
    }

    if (this.warnings.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        title: 'Review Warnings',
        description: `${this.warnings.length} potential issues identified`,
        actions: [
          'Review warnings for potential impact',
          'Update documentation as needed',
          'Consider adding deprecation notices'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Print summary to console
   */
  printSummary(report) {
    console.log('\n🔍 BREAKING CHANGE ANALYSIS');
    console.log('===========================');
    console.log(`Breaking Changes: ${report.summary.breakingChanges}`);
    console.log(`Warnings: ${report.summary.warnings}`);

    if (report.summary.hasBreakingChanges) {
      console.log('\n🚨 BREAKING CHANGES DETECTED:');
      report.breakingChanges.forEach(change => {
        console.log(`  ${change.severity.toUpperCase()}: ${change.message}`);
        console.log(`    Impact: ${change.impact}`);
      });
    }

    if (report.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      report.warnings.forEach(warning => {
        console.log(`  - ${warning.message}`);
      });
    }

    console.log('\n📋 RECOMMENDATIONS:');
    report.recommendations.forEach(rec => {
      console.log(`  ${rec.priority}: ${rec.title}`);
    });
  }

  /**
   * Run complete breaking change analysis
   */
  async runAnalysis() {
    console.log('🔍 Starting breaking change analysis...');

    try {
      // Compare OpenAPI specs
      const baseSpecPath = '/tmp/base-openapi.yaml';
      const currentSpecPath = path.join(process.cwd(), '../md-docs/openapi.yaml');
      
      await this.compareOpenAPISpecs(baseSpecPath, currentSpecPath);
      
      // Analyze code changes
      this.analyzeCodeChanges();
      
      // Check database changes
      this.checkDatabaseChanges();

      // Generate report
      const report = this.generateReport();
      this.printSummary(report);

      // Save report
      const reportPath = path.join(process.cwd(), 'breaking-change-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Report saved to: ${reportPath}`);

      // Exit with error code if breaking changes found
      if (report.summary.hasBreakingChanges) {
        console.log('\n❌ Breaking changes detected - review required');
        return { success: false, report };
      } else {
        console.log('\n✅ No breaking changes detected');
        return { success: true, report };
      }

    } catch (error) {
      console.error('❌ Breaking change analysis failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Run analysis if called directly
if (require.main === module) {
  const detector = new BreakingChangeDetector();
  detector.runAnalysis()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = BreakingChangeDetector;