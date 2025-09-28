#!/usr/bin/env node

/**
 * Security Audit Script for Dyad CLI Gateway
 * 
 * This script performs automated security checks and generates a security audit report.
 * It should be run regularly as part of the security monitoring process.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class SecurityAuditor {
  constructor() {
    this.findings = [];
    this.startTime = new Date();
    this.auditId = crypto.randomUUID();
  }

  /**
   * Add a security finding
   */
  addFinding(severity, category, title, description, recommendation, evidence = null) {
    this.findings.push({
      id: crypto.randomUUID(),
      severity,
      category,
      title,
      description,
      recommendation,
      evidence,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Check for common security misconfigurations
   */
  checkSecurityConfigurations() {
    console.log('🔍 Checking security configurations...');

    // Check for default credentials
    this.checkDefaultCredentials();
    
    // Check file permissions
    this.checkFilePermissions();
    
    // Check for exposed secrets
    this.checkExposedSecrets();
    
    // Check Docker security
    this.checkDockerSecurity();
    
    // Check network security
    this.checkNetworkSecurity();
  }

  /**
   * Check for default or weak credentials
   */
  checkDefaultCredentials() {
    const configFiles = [
      '.env',
      '.env.example',
      'config/config.js',
      'docker-compose.yml'
    ];

    configFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for common weak passwords
        const weakPasswords = ['password', '123456', 'admin', 'root', 'changeme'];
        weakPasswords.forEach(weakPass => {
          if (content.toLowerCase().includes(weakPass)) {
            this.addFinding(
              'HIGH',
              'Authentication',
              'Weak Default Password Detected',
              `Potential weak password "${weakPass}" found in ${file}`,
              'Replace with strong, randomly generated passwords',
              { file, pattern: weakPass }
            );
          }
        });

        // Check for hardcoded API keys
        const apiKeyPattern = /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[a-zA-Z0-9]{20,}["']?/gi;
        const matches = content.match(apiKeyPattern);
        if (matches) {
          this.addFinding(
            'CRITICAL',
            'Secrets Management',
            'Hardcoded Secrets Detected',
            `Potential hardcoded secrets found in ${file}`,
            'Move secrets to environment variables or secure secret management system',
            { file, matches: matches.length }
          );
        }
      }
    });
  }

  /**
   * Check file and directory permissions
   */
  checkFilePermissions() {
    const sensitiveFiles = [
      '.env',
      'config/',
      'keys/',
      'certs/',
      'logs/'
    ];

    sensitiveFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        try {
          const stats = fs.statSync(filePath);
          const mode = (stats.mode & parseInt('777', 8)).toString(8);
          
          // Check for overly permissive permissions
          if (mode === '777' || mode === '666') {
            this.addFinding(
              'HIGH',
              'File Permissions',
              'Overly Permissive File Permissions',
              `File ${file} has permissions ${mode} which may be too permissive`,
              'Restrict file permissions to minimum required (e.g., 600 for secrets)',
              { file, permissions: mode }
            );
          }
        } catch (error) {
          // File access error - might be a permission issue itself
        }
      }
    });
  }

  /**
   * Check for exposed secrets in code
   */
  checkExposedSecrets() {
    const sourceFiles = this.findSourceFiles();
    
    sourceFiles.forEach(file => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for various secret patterns
        const secretPatterns = [
          { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
          { name: 'AWS Secret Key', pattern: /[0-9a-zA-Z/+]{40}/g },
          { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g },
          { name: 'MongoDB Connection String', pattern: /mongodb:\/\/[^\s]+/g },
          { name: 'Generic API Key', pattern: /['"](sk-|pk_|rk_)[a-zA-Z0-9]{20,}['"]/g }
        ];

        secretPatterns.forEach(({ name, pattern }) => {
          const matches = content.match(pattern);
          if (matches) {
            this.addFinding(
              'CRITICAL',
              'Secrets Management',
              `${name} Exposed in Source Code`,
              `Potential ${name} found in ${file}`,
              'Remove secrets from source code and use environment variables or secret management',
              { file, secretType: name, matches: matches.length }
            );
          }
        });
      } catch (error) {
        // Skip files that can't be read
      }
    });
  }

  /**
   * Check Docker security configurations
   */
  checkDockerSecurity() {
    const dockerFiles = ['Dockerfile', 'Dockerfile.gateway', 'docker-compose.yml'];
    
    dockerFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for running as root
        if (!content.includes('USER ') && file.startsWith('Dockerfile')) {
          this.addFinding(
            'HIGH',
            'Container Security',
            'Container Running as Root',
            `Dockerfile ${file} does not specify a non-root user`,
            'Add USER directive to run container as non-root user',
            { file }
          );
        }

        // Check for Docker socket mounting
        if (content.includes('/var/run/docker.sock')) {
          this.addFinding(
            'CRITICAL',
            'Container Security',
            'Docker Socket Mounted',
            `Docker socket mounting detected in ${file}`,
            'Avoid mounting Docker socket in production; use alternative container execution methods',
            { file }
          );
        }

        // Check for privileged mode
        if (content.includes('privileged: true') || content.includes('--privileged')) {
          this.addFinding(
            'HIGH',
            'Container Security',
            'Privileged Container Mode',
            `Privileged container mode detected in ${file}`,
            'Remove privileged mode and use specific capabilities instead',
            { file }
          );
        }
      }
    });
  }

  /**
   * Check network security configurations
   */
  checkNetworkSecurity() {
    // Check for HTTP instead of HTTPS
    const configFiles = this.findSourceFiles();
    
    configFiles.forEach(file => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for HTTP URLs in production configs
        const httpPattern = /http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/g;
        const matches = content.match(httpPattern);
        if (matches) {
          this.addFinding(
            'MEDIUM',
            'Network Security',
            'HTTP URLs in Configuration',
            `HTTP URLs detected in ${file} - should use HTTPS`,
            'Replace HTTP URLs with HTTPS equivalents',
            { file, urls: matches }
          );
        }
      } catch (error) {
        // Skip files that can't be read
      }
    });
  }

  /**
   * Check dependencies for known vulnerabilities
   */
  async checkDependencyVulnerabilities() {
    console.log('🔍 Checking dependency vulnerabilities...');
    
    try {
      // Run npm audit
      const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
      const audit = JSON.parse(auditResult);
      
      if (audit.vulnerabilities) {
        Object.entries(audit.vulnerabilities).forEach(([pkg, vuln]) => {
          const severity = vuln.severity.toUpperCase();
          this.addFinding(
            severity,
            'Dependencies',
            `Vulnerable Dependency: ${pkg}`,
            `Package ${pkg} has ${vuln.severity} severity vulnerabilities`,
            'Update package to latest secure version or find alternative',
            { package: pkg, vulnerability: vuln }
          );
        });
      }
    } catch (error) {
      this.addFinding(
        'MEDIUM',
        'Dependencies',
        'Dependency Audit Failed',
        'Could not run npm audit to check for vulnerabilities',
        'Ensure npm audit can run and investigate any blocking issues',
        { error: error.message }
      );
    }
  }

  /**
   * Check for security headers in Express configuration
   */
  checkSecurityHeaders() {
    console.log('🔍 Checking security headers configuration...');
    
    const appFiles = ['src/app.js', 'src/gateway/app.js', 'app.js'];
    
    appFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for helmet usage
        if (!content.includes('helmet')) {
          this.addFinding(
            'MEDIUM',
            'Web Security',
            'Missing Security Headers Middleware',
            `File ${file} does not appear to use helmet for security headers`,
            'Add helmet middleware to set security headers',
            { file }
          );
        }

        // Check for CORS configuration
        if (!content.includes('cors')) {
          this.addFinding(
            'MEDIUM',
            'Web Security',
            'Missing CORS Configuration',
            `File ${file} does not appear to configure CORS`,
            'Add CORS middleware with appropriate configuration',
            { file }
          );
        }

        // Check for rate limiting
        if (!content.includes('rate') && !content.includes('limit')) {
          this.addFinding(
            'MEDIUM',
            'Web Security',
            'Missing Rate Limiting',
            `File ${file} does not appear to implement rate limiting`,
            'Add rate limiting middleware to prevent abuse',
            { file }
          );
        }
      }
    });
  }

  /**
   * Check authentication and authorization implementation
   */
  checkAuthImplementation() {
    console.log('🔍 Checking authentication and authorization...');
    
    const authFiles = [
      'src/middlewares/auth.js',
      'src/gateway/middlewares/apiKeyAuth.js',
      'src/controllers/auth.controller.js'
    ];

    authFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for JWT secret hardcoding
        if (content.includes('jwt') && content.includes('secret') && content.includes('"')) {
          this.addFinding(
            'HIGH',
            'Authentication',
            'Potential Hardcoded JWT Secret',
            `File ${file} may contain hardcoded JWT secret`,
            'Use environment variables for JWT secrets',
            { file }
          );
        }

        // Check for proper error handling
        if (!content.includes('try') && !content.includes('catch')) {
          this.addFinding(
            'LOW',
            'Authentication',
            'Missing Error Handling in Auth',
            `File ${file} may not have proper error handling`,
            'Add try-catch blocks for proper error handling',
            { file }
          );
        }
      }
    });
  }

  /**
   * Check logging and monitoring configuration
   */
  checkLoggingMonitoring() {
    console.log('🔍 Checking logging and monitoring...');
    
    const logFiles = [
      'src/config/logger.js',
      'src/gateway/services/structured-logger.service.js'
    ];

    logFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for sensitive data logging
        const sensitivePatterns = ['password', 'secret', 'token', 'key'];
        sensitivePatterns.forEach(pattern => {
          if (content.toLowerCase().includes(`log.*${pattern}`) || 
              content.toLowerCase().includes(`console.*${pattern}`)) {
            this.addFinding(
              'MEDIUM',
              'Logging',
              'Potential Sensitive Data Logging',
              `File ${file} may log sensitive data containing "${pattern}"`,
              'Ensure sensitive data is redacted from logs',
              { file, pattern }
            );
          }
        });
      }
    });
  }

  /**
   * Find all source files for analysis
   */
  findSourceFiles() {
    const sourceFiles = [];
    const extensions = ['.js', '.ts', '.json', '.yml', '.yaml'];
    
    const walkDir = (dir) => {
      try {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
            walkDir(filePath);
          } else if (stat.isFile() && extensions.some(ext => file.endsWith(ext))) {
            sourceFiles.push(filePath);
          }
        });
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walkDir(process.cwd());
    return sourceFiles;
  }

  /**
   * Generate security audit report
   */
  generateReport() {
    const endTime = new Date();
    const duration = endTime - this.startTime;
    
    const report = {
      auditId: this.auditId,
      timestamp: this.startTime.toISOString(),
      duration: `${duration}ms`,
      summary: {
        total: this.findings.length,
        critical: this.findings.filter(f => f.severity === 'CRITICAL').length,
        high: this.findings.filter(f => f.severity === 'HIGH').length,
        medium: this.findings.filter(f => f.severity === 'MEDIUM').length,
        low: this.findings.filter(f => f.severity === 'LOW').length
      },
      findings: this.findings,
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Generate prioritized recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Critical issues first
    const critical = this.findings.filter(f => f.severity === 'CRITICAL');
    if (critical.length > 0) {
      recommendations.push({
        priority: 'IMMEDIATE',
        title: 'Address Critical Security Issues',
        description: `${critical.length} critical security issues require immediate attention`,
        actions: critical.map(f => f.recommendation)
      });
    }

    // High severity issues
    const high = this.findings.filter(f => f.severity === 'HIGH');
    if (high.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        title: 'Fix High Severity Issues',
        description: `${high.length} high severity issues should be addressed within 72 hours`,
        actions: high.map(f => f.recommendation)
      });
    }

    // General security improvements
    recommendations.push({
      priority: 'ONGOING',
      title: 'Implement Security Best Practices',
      description: 'Continuous security improvements',
      actions: [
        'Regular dependency updates',
        'Automated security scanning in CI/CD',
        'Security training for development team',
        'Regular penetration testing',
        'Security code reviews'
      ]
    });

    return recommendations;
  }

  /**
   * Save report to file
   */
  saveReport(report) {
    const reportDir = path.join(process.cwd(), 'security-reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const filename = `security-audit-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(reportDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`📄 Security audit report saved to: ${filepath}`);
    
    return filepath;
  }

  /**
   * Print summary to console
   */
  printSummary(report) {
    console.log('\n🔒 SECURITY AUDIT SUMMARY');
    console.log('========================');
    console.log(`Audit ID: ${report.auditId}`);
    console.log(`Duration: ${report.duration}`);
    console.log(`Total Findings: ${report.summary.total}`);
    console.log(`  Critical: ${report.summary.critical}`);
    console.log(`  High: ${report.summary.high}`);
    console.log(`  Medium: ${report.summary.medium}`);
    console.log(`  Low: ${report.summary.low}`);

    if (report.summary.critical > 0) {
      console.log('\n🚨 CRITICAL ISSUES FOUND - IMMEDIATE ACTION REQUIRED');
      report.findings
        .filter(f => f.severity === 'CRITICAL')
        .forEach(finding => {
          console.log(`  - ${finding.title}`);
          console.log(`    ${finding.description}`);
        });
    }

    if (report.summary.high > 0) {
      console.log('\n⚠️  HIGH SEVERITY ISSUES');
      report.findings
        .filter(f => f.severity === 'HIGH')
        .forEach(finding => {
          console.log(`  - ${finding.title}`);
        });
    }

    console.log('\n📋 NEXT STEPS:');
    report.recommendations.forEach(rec => {
      console.log(`  ${rec.priority}: ${rec.title}`);
    });
  }

  /**
   * Run complete security audit
   */
  async runAudit() {
    console.log('🔒 Starting Security Audit...');
    console.log(`Audit ID: ${this.auditId}`);
    
    try {
      // Run all security checks
      this.checkSecurityConfigurations();
      await this.checkDependencyVulnerabilities();
      this.checkSecurityHeaders();
      this.checkAuthImplementation();
      this.checkLoggingMonitoring();

      // Generate and save report
      const report = this.generateReport();
      const reportPath = this.saveReport(report);
      this.printSummary(report);

      console.log('\n✅ Security audit completed successfully');
      return { success: true, report, reportPath };
      
    } catch (error) {
      console.error('❌ Security audit failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Run audit if called directly
if (require.main === module) {
  const auditor = new SecurityAuditor();
  auditor.runAudit()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = SecurityAuditor;