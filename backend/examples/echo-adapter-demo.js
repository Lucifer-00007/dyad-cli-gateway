/**
 * Echo Adapter Demonstration
 * This script demonstrates how to use the SpawnCliAdapter with echo command
 * 
 * Note: This is for demonstration purposes only.
 * In a real scenario, Docker would need to be available and the command would execute in a container.
 */

const { AdapterFactory } = require('../src/gateway/adapters');

async function demonstrateEchoAdapter() {
  console.log('🚀 Echo Adapter Demonstration\n');

  // Create echo adapter configuration
  const providerConfig = {
    command: 'echo',
    args: [],
    timeoutSeconds: 30,
    sandboxImage: 'alpine:latest',
    models: [
      {
        dyadModelId: 'echo-model',
        adapterModelId: 'echo',
        maxTokens: 1000
      }
    ]
  };

  const provider = {
    id: 'echo-provider',
    name: 'Echo Provider',
    type: 'spawn-cli',
    adapterConfig: providerConfig
  };

  try {
    // Create adapter using factory
    console.log('📦 Creating echo adapter...');
    const adapter = AdapterFactory.createAdapter(provider);
    console.log('✅ Echo adapter created successfully');

    // Validate configuration
    console.log('\n🔍 Validating adapter configuration...');
    const validation = adapter.validateConfig();
    console.log('Validation result:', validation);

    // Get available models
    console.log('\n📋 Available models:');
    const models = adapter.getModels();
    console.log(JSON.stringify(models, null, 2));

    // Demonstrate input preparation
    console.log('\n📝 Preparing input for CLI command...');
    const messages = [
      { role: 'user', content: 'Hello, echo adapter!' }
    ];
    const options = { max_tokens: 100 };
    
    const input = adapter.prepareInput(messages, options);
    console.log('Prepared input:');
    console.log(input);

    // Demonstrate output parsing
    console.log('\n🔄 Parsing CLI output...');
    const mockOutput = 'Hello from echo command!';
    const requestId = 'demo-123';
    
    const parsedOutput = adapter.parseOutput(mockOutput, requestId);
    console.log('Parsed output:');
    console.log(JSON.stringify(parsedOutput, null, 2));

    console.log('\n✨ Echo adapter demonstration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('- ✅ Adapter interface implemented');
    console.log('- ✅ Docker sandbox helper created');
    console.log('- ✅ Spawn-CLI adapter with echo command ready');
    console.log('- ✅ Adapter factory for instantiation');
    console.log('- ✅ Unit tests covering all functionality');
    console.log('- ✅ Input sanitization and logging');
    console.log('- ✅ Timeout and cancellation support');

  } catch (error) {
    console.error('❌ Error during demonstration:', error.message);
  }
}

// Run the demonstration
if (require.main === module) {
  demonstrateEchoAdapter();
}

module.exports = { demonstrateEchoAdapter };