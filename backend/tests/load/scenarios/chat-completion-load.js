/**
 * Chat Completion Load Test Scenarios
 * Specific load testing scenarios for chat completion endpoints
 */

const LoadTester = require('../load-test');
const logger = require('../../../src/config/logger');

class ChatCompletionLoadTest extends LoadTester {
  constructor(options = {}) {
    super({
      ...options,
      scenarios: ['chat-completion', 'chat-completion-streaming']
    });

    this.chatScenarios = [
      {
        name: 'simple-question',
        messages: [
          { role: 'user', content: 'What is the capital of France?' }
        ],
        max_tokens: 50
      },
      {
        name: 'complex-conversation',
        messages: [
          { role: 'system', content: 'You are a helpful coding assistant.' },
          { role: 'user', content: 'Explain how to implement a binary search algorithm.' },
          { role: 'assistant', content: 'Binary search is an efficient algorithm...' },
          { role: 'user', content: 'Can you show me a Python implementation?' }
        ],
        max_tokens: 200
      },
      {
        name: 'long-context',
        messages: [
          { 
            role: 'user', 
            content: 'Analyze this long text: ' + 'Lorem ipsum '.repeat(100) + 'What are the key themes?'
          }
        ],
        max_tokens: 150
      },
      {
        name: 'code-generation',
        messages: [
          { role: 'user', content: 'Write a JavaScript function to sort an array of objects by a specific property.' }
        ],
        max_tokens: 300
      },
      {
        name: 'creative-writing',
        messages: [
          { role: 'user', content: 'Write a short story about a robot learning to paint.' }
        ],
        max_tokens: 500
      }
    ];
  }

  /**
   * Test chat completion with various scenarios
   */
  async testChatCompletion() {
    const scenario = this.selectChatScenario();
    
    const response = await this.makeRequest('POST', '/v1/chat/completions', {
      model: 'test-model',
      messages: scenario.messages,
      max_tokens: scenario.max_tokens,
      temperature: Math.random() * 0.5 + 0.5, // Random temperature between 0.5-1.0
    });

    // Validate response structure
    this.validateChatResponse(response.data);
    
    return {
      scenario: scenario.name,
      tokensUsed: response.data.usage?.total_tokens || 0,
      ...response.data
    };
  }

  /**
   * Test streaming chat completion
   */
  async testChatCompletionStreaming() {
    const scenario = this.selectChatScenario();
    
    const response = await this.makeStreamingRequest('POST', '/v1/chat/completions', {
      model: 'test-model',
      messages: scenario.messages,
      max_tokens: scenario.max_tokens,
      stream: true,
      temperature: Math.random() * 0.5 + 0.5,
    });

    return {
      scenario: scenario.name,
      chunks: response.chunks,
      totalTime: response.totalTime
    };
  }

  /**
   * Select random chat scenario
   */
  selectChatScenario() {
    return this.chatScenarios[Math.floor(Math.random() * this.chatScenarios.length)];
  }

  /**
   * Validate chat completion response
   */
  validateChatResponse(response) {
    if (!response.id) {
      throw new Error('Response missing id field');
    }
    
    if (!response.choices || !Array.isArray(response.choices)) {
      throw new Error('Response missing or invalid choices field');
    }
    
    if (response.choices.length === 0) {
      throw new Error('Response has no choices');
    }
    
    const choice = response.choices[0];
    if (!choice.message || !choice.message.content) {
      throw new Error('Response choice missing message content');
    }
    
    if (!response.usage) {
      throw new Error('Response missing usage information');
    }
  }

  /**
   * Make streaming request and collect chunks
   */
  async makeStreamingRequest(method, path, data) {
    const axios = require('axios');
    const startTime = performance.now();
    
    const response = await axios({
      method,
      url: `${this.options.baseUrl}${path}`,
      data,
      headers: {
        'Authorization': `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream',
      timeout: 30000
    });

    return new Promise((resolve, reject) => {
      let chunks = 0;
      let totalContent = '';
      
      response.data.on('data', (chunk) => {
        chunks++;
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.choices?.[0]?.delta?.content) {
                totalContent += data.choices[0].delta.content;
              }
            } catch (error) {
              // Ignore parsing errors for partial chunks
            }
          }
        }
      });

      response.data.on('end', () => {
        const endTime = performance.now();
        resolve({
          chunks,
          totalTime: endTime - startTime,
          contentLength: totalContent.length
        });
      });

      response.data.on('error', reject);
      
      // Timeout handling
      setTimeout(() => {
        reject(new Error('Streaming timeout'));
      }, 30000);
    });
  }

  /**
   * Run concurrent chat completion test
   */
  async runConcurrentTest(concurrency = 5, duration = 30000) {
    logger.info('Starting concurrent chat completion test', { concurrency, duration });
    
    const originalOptions = { ...this.options };
    this.options.maxConcurrent = concurrency;
    this.options.duration = duration;
    this.options.scenarios = ['chat-completion'];
    
    try {
      const report = await this.run();
      return report;
    } finally {
      this.options = originalOptions;
    }
  }

  /**
   * Run streaming performance test
   */
  async runStreamingTest(concurrency = 3, duration = 30000) {
    logger.info('Starting streaming performance test', { concurrency, duration });
    
    const originalOptions = { ...this.options };
    this.options.maxConcurrent = concurrency;
    this.options.duration = duration;
    this.options.scenarios = ['chat-completion-streaming'];
    
    try {
      const report = await this.run();
      return report;
    } finally {
      this.options = originalOptions;
    }
  }

  /**
   * Run mixed workload test
   */
  async runMixedWorkloadTest(concurrency = 8, duration = 60000) {
    logger.info('Starting mixed workload test', { concurrency, duration });
    
    const originalOptions = { ...this.options };
    this.options.maxConcurrent = concurrency;
    this.options.duration = duration;
    this.options.scenarios = ['chat-completion', 'chat-completion-streaming', 'models-list'];
    
    try {
      const report = await this.run();
      return report;
    } finally {
      this.options = originalOptions;
    }
  }
}

module.exports = ChatCompletionLoadTest;