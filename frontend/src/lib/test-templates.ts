/**
 * Predefined test templates for provider testing
 */

import { TestTemplate } from '@/types';

export const testTemplates: TestTemplate[] = [
  {
    id: 'basic-hello',
    name: 'Basic Hello Test',
    description: 'Simple greeting test to verify basic connectivity',
    category: 'basic',
    request: {
      model: '', // Will be set dynamically
      messages: [
        {
          role: 'user',
          content: 'Hello! Please respond with a brief greeting to confirm you are working.',
        },
      ],
      parameters: {
        maxTokens: 50,
        temperature: 0.7,
        topP: 1.0,
        stream: false,
      },
    },
    expectedBehavior: 'Should respond with a friendly greeting message',
  },
  {
    id: 'basic-math',
    name: 'Simple Math Test',
    description: 'Test basic reasoning with simple arithmetic',
    category: 'basic',
    request: {
      model: '',
      messages: [
        {
          role: 'user',
          content: 'What is 2 + 2? Please provide just the number as your answer.',
        },
      ],
      parameters: {
        maxTokens: 10,
        temperature: 0.0,
        topP: 1.0,
        stream: false,
      },
    },
    expectedBehavior: 'Should respond with "4" or similar correct answer',
  },
  {
    id: 'basic-json',
    name: 'JSON Response Test',
    description: 'Test structured output generation',
    category: 'basic',
    request: {
      model: '',
      messages: [
        {
          role: 'user',
          content: 'Please respond with a JSON object containing your name and a brief description. Format: {"name": "...", "description": "..."}',
        },
      ],
      parameters: {
        maxTokens: 100,
        temperature: 0.3,
        topP: 1.0,
        stream: false,
      },
    },
    expectedBehavior: 'Should respond with valid JSON format',
  },
  {
    id: 'conversation-context',
    name: 'Context Retention Test',
    description: 'Test ability to maintain conversation context',
    category: 'advanced',
    request: {
      model: '',
      messages: [
        {
          role: 'user',
          content: 'My name is Alice and I like cats.',
        },
        {
          role: 'assistant',
          content: 'Nice to meet you, Alice! Cats are wonderful companions.',
        },
        {
          role: 'user',
          content: 'What did I tell you I like?',
        },
      ],
      parameters: {
        maxTokens: 50,
        temperature: 0.5,
        topP: 1.0,
        stream: false,
      },
    },
    expectedBehavior: 'Should remember and mention cats from earlier in the conversation',
  },
  {
    id: 'long-response',
    name: 'Long Response Test',
    description: 'Test handling of longer text generation',
    category: 'advanced',
    request: {
      model: '',
      messages: [
        {
          role: 'user',
          content: 'Please write a short paragraph (about 100 words) explaining what artificial intelligence is.',
        },
      ],
      parameters: {
        maxTokens: 200,
        temperature: 0.7,
        topP: 1.0,
        stream: false,
      },
    },
    expectedBehavior: 'Should generate a coherent paragraph of approximately 100 words',
  },
  {
    id: 'streaming-test',
    name: 'Streaming Response Test',
    description: 'Test streaming response capability',
    category: 'advanced',
    request: {
      model: '',
      messages: [
        {
          role: 'user',
          content: 'Please count from 1 to 10, with each number on a new line.',
        },
      ],
      parameters: {
        maxTokens: 100,
        temperature: 0.0,
        topP: 1.0,
        stream: true,
      },
    },
    expectedBehavior: 'Should stream the response incrementally',
  },
  {
    id: 'performance-quick',
    name: 'Quick Performance Test',
    description: 'Minimal request to test response time',
    category: 'performance',
    request: {
      model: '',
      messages: [
        {
          role: 'user',
          content: 'Hi',
        },
      ],
      parameters: {
        maxTokens: 5,
        temperature: 0.0,
        topP: 1.0,
        stream: false,
      },
    },
    expectedBehavior: 'Should respond quickly with minimal latency',
  },
  {
    id: 'performance-load',
    name: 'Load Test Template',
    description: 'Larger request to test performance under load',
    category: 'performance',
    request: {
      model: '',
      messages: [
        {
          role: 'user',
          content: 'Please generate a detailed explanation of machine learning, including its applications, benefits, and challenges. Make it comprehensive but accessible.',
        },
      ],
      parameters: {
        maxTokens: 500,
        temperature: 0.7,
        topP: 1.0,
        stream: false,
      },
    },
    expectedBehavior: 'Should handle larger response generation efficiently',
  },
  {
    id: 'error-handling',
    name: 'Error Handling Test',
    description: 'Test with potentially problematic input',
    category: 'advanced',
    request: {
      model: '',
      messages: [
        {
          role: 'user',
          content: 'Please respond to this message with exactly 1000 words, but limit your response to 50 tokens maximum.',
        },
      ],
      parameters: {
        maxTokens: 50,
        temperature: 0.5,
        topP: 1.0,
        stream: false,
      },
    },
    expectedBehavior: 'Should handle conflicting instructions gracefully',
  },
  {
    id: 'system-prompt',
    name: 'System Prompt Test',
    description: 'Test system message handling',
    category: 'advanced',
    request: {
      model: '',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that always responds in exactly 10 words.',
        },
        {
          role: 'user',
          content: 'Tell me about the weather.',
        },
      ],
      parameters: {
        maxTokens: 50,
        temperature: 0.5,
        topP: 1.0,
        stream: false,
      },
    },
    expectedBehavior: 'Should follow system instructions and respond in exactly 10 words',
  },
];

/**
 * Get templates by category
 */
export const getTemplatesByCategory = (category: TestTemplate['category']) => {
  return testTemplates.filter(template => template.category === category);
};

/**
 * Get template by ID
 */
export const getTemplateById = (id: string) => {
  return testTemplates.find(template => template.id === id);
};

/**
 * Get all template categories
 */
export const getTemplateCategories = () => {
  const categories = new Set(testTemplates.map(template => template.category));
  return Array.from(categories);
};

/**
 * Create a custom test template
 */
export const createCustomTemplate = (
  name: string,
  description: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  parameters: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stream?: boolean;
  } = {}
): TestTemplate => {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    category: 'custom',
    request: {
      model: '',
      messages,
      parameters: {
        maxTokens: 150,
        temperature: 0.7,
        topP: 1.0,
        stream: false,
        ...parameters,
      },
    },
    expectedBehavior: 'Custom test template - behavior depends on specific implementation',
  };
};

export default testTemplates;