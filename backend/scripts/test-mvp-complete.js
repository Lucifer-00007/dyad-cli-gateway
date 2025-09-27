#!/usr/bin/env node

/**
 * MVP Complete Test Runner
 * Validates all MVP requirements are working end-to-end
 */

const { execSync } = require('child_process');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runCommand(command, description) {
  log(`\n${colors.blue}Running: ${description}${colors.reset}`);
  log(`${colors.cyan}Command: ${command}${colors.reset}`);
  
  try {
    const output = execSync(command, { 
      stdio: 'inherit', 
      cwd: path.join(__dirname, '..'),
      env: { 
        ...process.env, 
        NODE_ENV: 'test',
        JWT_SECRET: 'test-jwt-secret-for-mvp-validation',
        MONGODB_URL: process.env.MONGODB_URL || 'mongodb://localhost:27017/test'
      }
    });
    log(`${colors.green}✓ ${description} completed successfully${colors.reset}`);
    return true;
  } catch (error) {
    log(`${colors.red}✗ ${description} failed${colors.reset}`);
    log(`${colors.red}Error: ${error.message}${colors.reset}`);
    return false;
  }
}

async function main() {
  log(`${colors.bright}${colors.magenta}=== Dyad CLI Gateway MVP Complete Test Suite ===${colors.reset}`);
  log(`${colors.yellow}This script validates all MVP requirements are working end-to-end${colors.reset}\n`);

  const testSuites = [
    {
      command: 'npm run lint',
      description: 'Code linting and style checks',
    },
    {
      command: 'npm test -- --testPathPattern=unit/',
      description: 'Unit tests (models, services, adapters)',
    },
    {
      command: 'npm run test:contract',
      description: 'OpenAPI contract validation tests',
    },
    {
      command: 'npm run test:workflow',
      description: 'Echo adapter complete workflow validation',
    },
    {
      command: 'npm run test:e2e',
      description: 'End-to-end provider registration → chat completion flow',
    },
    {
      command: 'npm test -- --testPathPattern=gateway/admin-endpoints.test.js',
      description: 'Admin API endpoints (provider CRUD)',
    },
    {
      command: 'npm test -- --testPathPattern=gateway/openai-endpoints.test.js',
      description: 'OpenAI-compatible endpoints (/v1/chat/completions, /v1/models)',
    },
    {
      command: 'npm test -- --testPathPattern=gateway/gateway-orchestration.test.js',
      description: 'Gateway orchestration and response normalization',
    },
    {
      command: 'npm test -- --testPathPattern=gateway/middleware-integration.test.js',
      description: 'Authentication and middleware integration',
    },
    {
      command: 'npm run validate:openapi',
      description: 'OpenAPI specification validation',
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const suite of testSuites) {
    if (runCommand(suite.command, suite.description)) {
      passed++;
    } else {
      failed++;
    }
  }

  log(`\n${colors.bright}=== Test Results Summary ===${colors.reset}`);
  log(`${colors.green}Passed: ${passed}${colors.reset}`);
  log(`${colors.red}Failed: ${failed}${colors.reset}`);
  log(`${colors.cyan}Total: ${passed + failed}${colors.reset}`);

  if (failed === 0) {
    log(`\n${colors.bright}${colors.green}🎉 All MVP requirements validated successfully!${colors.reset}`);
    log(`${colors.green}The Dyad CLI Gateway MVP is ready for deployment.${colors.reset}`);
    
    log(`\n${colors.bright}MVP Features Validated:${colors.reset}`);
    log(`${colors.green}✓ Provider management (CRUD operations)${colors.reset}`);
    log(`${colors.green}✓ OpenAI-compatible API endpoints${colors.reset}`);
    log(`${colors.green}✓ Echo adapter with sandboxing${colors.reset}`);
    log(`${colors.green}✓ API key authentication${colors.reset}`);
    log(`${colors.green}✓ Response normalization${colors.reset}`);
    log(`${colors.green}✓ Error handling and mapping${colors.reset}`);
    log(`${colors.green}✓ Admin API with JWT authentication${colors.reset}`);
    log(`${colors.green}✓ OpenAPI specification compliance${colors.reset}`);
    log(`${colors.green}✓ Complete end-to-end workflows${colors.reset}`);
    
    process.exit(0);
  } else {
    log(`\n${colors.bright}${colors.red}❌ Some tests failed. Please review and fix the issues.${colors.reset}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    log(`${colors.red}Script execution failed: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { main };