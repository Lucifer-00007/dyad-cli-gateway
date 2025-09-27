#!/usr/bin/env node

/**
 * Security Audit Script
 * Comprehensive security checks for the Dyad CLI Gateway
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SecurityAuditor {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      checks: [],
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0,
        total: 0
      }
    };
  }

  /**
   * Run all security checks
   */
  async runAudit() {
    console.log('🔒 Starting Security Audit for Dyad CLI Gateway\n');

    // Dependency vulnerability check
    await this.checkDependencyVulnerabilities();
    
    // Configuration security check
    await this.checkConfigurationSecurity();
    
    // File permissions check
    await this.checkFilePermissions();
    
    // Docker security check
    await this.checkDockerSecurity();
    
    // Code security patterns check
    await this.checkCodeSecurity();
    
    // Environment security check
    await this.checkEnvironmentSecurity();
    
    // Generate report
    this.generateReport();
    
    return this.results;
  }

  /**
   * Check for dependency vulnerabilities
   */
  async checkDependencyVulnerabilities() {
    this.addCheck('Dependency Vulnerabilities', 'info', 'Checking for known vulnerabilities in dependencies...');
    
    try {
      // Run npm audit
      const auditOutput = execSync('npm audit --json', { 
        encoding: 'utf8',
        cwd: process.cwd()
      });
      
      const auditData = JSON.parse(auditOutput);
      const vulnCount = auditData.metadata?.vulnerabilities?.total || 0;
      
      if (vulnCount === 0) {
        this.addCheck('Dependency Vulnerabilities', 'pass', 'No known vulnerabilities found in dependencies');
      } else {
        const critical = auditData.metadata.vulnerabilities.critical || 0;
        const high = auditData.metadata.vulnerabilities.high || 0;
        
        if (critical > 0 || high > 0) {
          this.addCheck('Dependency Vulnerabilities', 'fail', 
            `Found ${critical} critical and ${high} high severity vulnerabilities`);
        } else {
          this.addCheck('Dependency Vulnerabilities', 'warning', 
            `Found ${vulnCount} low/medium severity vulnerabilities`);
        }
      }
    } catch (error) {
      if (error.stdout) {
        try {
          const auditData = JSON.parse(error.stdout);
          const vulnCount = auditData.metadata?.vulnerabilities?.total || 0;
          const critical = auditData.metadata?.vulnerabilities?.critical || 0;
          const high = auditData.metadata?.vulnerabilities?.high || 0;
          
          if (critical > 0 || high > 0) {
            this.addCheck('Dependency Vulnerabilities', 'fail', 
              `Found ${critical} critical and ${high} high severity vulnerabilities`);
          } else if (vulnCount > 0) {
            this.addCheck('Dependency Vulnerabilities', 'warning', 
              `Found ${vulnCount} low/medium severity vulnerabilities`);
          }
        } catch (parseError) {
          this.addCheck('Dependency Vulnerabilities', 'fail', 'Failed to parse npm audit output');
        }
      } else {
        this.addCheck('Dependency Vulnerabilities', 'fail', `Audit failed: ${error.message}`);
      }
    }
  }

  /**
   * Check configuration security
   */
  async checkConfigurationSecurity() {
    this.addCheck('Configuration Security', 'info', 'Checking security configuration...');
    
    const issues = [];
    
    // Check if security middleware is properly configured
    const securityMiddlewarePath = path.join(__dirname, '../src/gateway/middlewares/security.js');
    if (!fs.existsSync(securityMiddlewarePath)) {
      issues.push('Security middleware not found');
    }
    
    // Check if security config exists
    const securityConfigPath = path.join(__dirname, '../src/gateway/config/security.config.js');
    if (!fs.existsSync(securityConfigPath)) {
      issues.push('Security configuration not found');
    }
    
    // Check environment variables
    const requiredEnvVars = [
      'NODE_ENV',
      'JWT_SECRET',
      'MONGODB_URL'
    ];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        issues.push(`Missing required environment variable: ${envVar}`);
      }
    }
    
    // Check JWT secret strength
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      issues.push('JWT secret is too short (minimum 32 characters recommended)');
    }
    
    if (issues.length === 0) {
      this.addCheck('Configuration Security', 'pass', 'Security configuration is properly set up');
    } else {
      this.addCheck('Configuration Security', 'fail', `Issues found: ${issues.join(', ')}`);
    }
  }

  /**
   * Check file permissions
   */
  async checkFilePermissions() {
    this.addCheck('File Permissions', 'info', 'Checking file permissions...');
    
    const issues = [];
    const sensitiveFiles = [
      'package.json',
      'package-lock.json',
      'yarn.lock',
      '.env',
      '.env.example'
    ];
    
    for (const file of sensitiveFiles) {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        
        // Check if file is world-writable (security risk)
        if (stats.mode & 0o002) {
          issues.push(`${file} is world-writable`);
        }
        
        // Check if file is world-readable for sensitive files
        if ((file === '.env' || file.startsWith('.env.')) && (stats.mode & 0o004)) {
          issues.push(`${file} is world-readable`);
        }
      }
    }
    
    if (issues.length === 0) {
      this.addCheck('File Permissions', 'pass', 'File permissions are secure');
    } else {
      this.addCheck('File Permissions', 'warning', `Issues found: ${issues.join(', ')}`);
    }
  }

  /**
   * Check Docker security
   */
  async checkDockerSecurity() {
    this.addCheck('Docker Security', 'info', 'Checking Docker configuration...');
    
    const issues = [];
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile.gateway');
    
    if (fs.existsSync(dockerfilePath)) {
      const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
      
      // Check for non-root user
      if (!dockerfileContent.includes('USER ') || dockerfileContent.includes('USER root')) {
        issues.push('Dockerfile should run as non-root user');
      }
      
      // Check for security updates
      if (!dockerfileContent.includes('apk update') && !dockerfileContent.includes('apt-get update')) {
        issues.push('Dockerfile should update packages for security patches');
      }
      
      // Check for minimal base image
      if (!dockerfileContent.includes('alpine') && !dockerfileContent.includes('distroless')) {
        issues.push('Consider using minimal base image (alpine or distroless)');
      }
      
      // Check for health check
      if (!dockerfileContent.includes('HEALTHCHECK')) {
        issues.push('Dockerfile should include health check');
      }
      
      // Check for proper signal handling
      if (!dockerfileContent.includes('dumb-init') && !dockerfileContent.includes('tini')) {
        issues.push('Consider using init system (dumb-init or tini) for proper signal handling');
      }
    } else {
      issues.push('Dockerfile.gateway not found');
    }
    
    if (issues.length === 0) {
      this.addCheck('Docker Security', 'pass', 'Docker configuration follows security best practices');
    } else {
      this.addCheck('Docker Security', 'warning', `Recommendations: ${issues.join(', ')}`);
    }
  }

  /**
   * Check code for security patterns
   */
  async checkCodeSecurity() {
    this.addCheck('Code Security', 'info', 'Scanning code for security patterns...');
    
    const issues = [];
    const srcPath = path.join(process.cwd(), 'src');
    
    if (fs.existsSync(srcPath)) {
      const files = this.getAllJSFiles(srcPath);
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative(process.cwd(), file);
        
        // Check for potential security issues
        const securityPatterns = [
          { pattern: /eval\s*\(/, message: 'Use of eval() detected' },
          { pattern: /new Function\s*\(/, message: 'Use of Function constructor detected' },
          { pattern: /innerHTML\s*=/, message: 'Use of innerHTML detected (XSS risk)' },
          { pattern: /document\.write\s*\(/, message: 'Use of document.write detected' },
          { pattern: /process\.env\.[A-Z_]+/g, message: 'Environment variable access detected', severity: 'info' },
          { pattern: /password|secret|key/i, message: 'Potential sensitive data in code', severity: 'warning' },
          { pattern: /console\.log\s*\(.*password|console\.log\s*\(.*secret/i, message: 'Potential secret logging detected' }
        ];
        
        for (const { pattern, message, severity = 'warning' } of securityPatterns) {
          if (pattern.test(content)) {
            issues.push(`${relativePath}: ${message}`);
          }
        }
      }
    }
    
    if (issues.length === 0) {
      this.addCheck('Code Security', 'pass', 'No obvious security issues found in code');
    } else {
      this.addCheck('Code Security', 'warning', `Potential issues: ${issues.slice(0, 5).join(', ')}${issues.length > 5 ? '...' : ''}`);
    }
  }

  /**
   * Check environment security
   */
  async checkEnvironmentSecurity() {
    this.addCheck('Environment Security', 'info', 'Checking environment configuration...');
    
    const issues = [];
    
    // Check NODE_ENV
    if (process.env.NODE_ENV !== 'production') {
      issues.push('NODE_ENV should be set to "production" in production');
    }
    
    // Check for debug flags
    if (process.env.DEBUG) {
      issues.push('DEBUG environment variable is set (should be disabled in production)');
    }
    
    // Check for development dependencies in production
    if (process.env.NODE_ENV === 'production') {
      try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        if (packageJson.devDependencies && Object.keys(packageJson.devDependencies).length > 0) {
          issues.push('Development dependencies present in production build');
        }
      } catch (error) {
        // Ignore if package.json can't be read
      }
    }
    
    // Check for secure defaults
    const securityEnvVars = [
      { name: 'SECURITY_HTTPS_REQUIRED', expected: 'true' },
      { name: 'SECURITY_HEADERS_ENABLED', expected: 'true' },
      { name: 'SECURITY_CSP_ENABLED', expected: 'true' }
    ];
    
    for (const { name, expected } of securityEnvVars) {
      if (process.env[name] !== expected) {
        issues.push(`${name} should be set to "${expected}"`);
      }
    }
    
    if (issues.length === 0) {
      this.addCheck('Environment Security', 'pass', 'Environment is properly configured for security');
    } else {
      this.addCheck('Environment Security', 'warning', `Recommendations: ${issues.join(', ')}`);
    }
  }

  /**
   * Get all JavaScript files recursively
   */
  getAllJSFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        files.push(...this.getAllJSFiles(fullPath));
      } else if (stat.isFile() && item.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * Add a check result
   */
  addCheck(category, status, message) {
    this.results.checks.push({
      category,
      status,
      message,
      timestamp: new Date().toISOString()
    });
    
    this.results.summary.total++;
    
    switch (status) {
      case 'pass':
        this.results.summary.passed++;
        break;
      case 'fail':
        this.results.summary.failed++;
        break;
      case 'warning':
        this.results.summary.warnings++;
        break;
    }
  }

  /**
   * Generate and display audit report
   */
  generateReport() {
    console.log('\n📊 Security Audit Report');
    console.log('========================\n');
    
    // Summary
    console.log(`✅ Passed: ${this.results.summary.passed}`);
    console.log(`❌ Failed: ${this.results.summary.failed}`);
    console.log(`⚠️  Warnings: ${this.results.summary.warnings}`);
    console.log(`📋 Total Checks: ${this.results.summary.total}\n`);
    
    // Detailed results
    for (const check of this.results.checks) {
      const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
      console.log(`${icon} ${check.category}: ${check.message}`);
    }
    
    console.log('\n');
    
    // Overall status
    if (this.results.summary.failed > 0) {
      console.log('🚨 Security audit FAILED - Critical issues found!');
      process.exit(1);
    } else if (this.results.summary.warnings > 0) {
      console.log('⚠️  Security audit completed with warnings');
      process.exit(0);
    } else {
      console.log('🎉 Security audit PASSED - No issues found!');
      process.exit(0);
    }
  }
}

// Run audit if called directly
if (require.main === module) {
  const auditor = new SecurityAuditor();
  auditor.runAudit().catch(error => {
    console.error('Security audit failed:', error);
    process.exit(1);
  });
}

module.exports = SecurityAuditor;