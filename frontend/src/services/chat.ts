/**
 * Chat playground API services for testing providers
 */

import { apiClient, handleApiError, createStreamingRequest } from '@/lib/api-client';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ChatMessage,
} from '@/types';

export class ChatService {
  private static readonly BASE_PATH = '/v1/chat/completions';

  /**
   * Send a chat completion request
   */
  static async sendChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const response = await apiClient.post<ChatCompletionResponse>(this.BASE_PATH, request);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Send a streaming chat completion request
   */
  static async sendStreamingChatCompletion(
    request: ChatCompletionRequest,
    onChunk: (chunk: ChatCompletionChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      const streamingRequest = { ...request, stream: true };
      
      await createStreamingRequest(
        this.BASE_PATH,
        streamingRequest,
        (data: string) => {
          try {
            const chunk = JSON.parse(data) as ChatCompletionChunk;
            onChunk(chunk);
          } catch (parseError) {
            console.warn('Failed to parse streaming chunk:', data);
          }
        },
        signal
      );
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Test a specific provider with a sample message
   */
  static async testProvider(
    providerId: string,
    model: string,
    message: string = 'Hello, please respond with a brief test message.'
  ): Promise<{
    success: boolean;
    response?: ChatCompletionResponse;
    error?: string;
    duration: number;
  }> {
    const startTime = Date.now();
    
    try {
      const request: ChatCompletionRequest = {
        model,
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
        max_tokens: 100,
        temperature: 0.7,
      };

      const response = await this.sendChatCompletion(request);
      const duration = Date.now() - startTime;

      return {
        success: true,
        response,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const apiError = handleApiError(error);
      
      return {
        success: false,
        error: apiError.message,
        duration,
      };
    }
  }

  /**
   * Validate chat request before sending
   */
  static validateChatRequest(request: ChatCompletionRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!request.model || request.model.trim() === '') {
      errors.push('Model is required');
    }

    if (!request.messages || request.messages.length === 0) {
      errors.push('At least one message is required');
    }

    if (request.messages) {
      request.messages.forEach((message, index) => {
        if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
          errors.push(`Message ${index + 1}: Invalid role`);
        }
        if (!message.content || message.content.trim() === '') {
          errors.push(`Message ${index + 1}: Content is required`);
        }
      });
    }

    if (request.max_tokens && (request.max_tokens < 1 || request.max_tokens > 4096)) {
      errors.push('Max tokens must be between 1 and 4096');
    }

    if (request.temperature && (request.temperature < 0 || request.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2');
    }

    if (request.top_p && (request.top_p < 0 || request.top_p > 1)) {
      errors.push('Top P must be between 0 and 1');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a conversation from messages
   */
  static createConversation(messages: ChatMessage[]): {
    id: string;
    name: string;
    messages: ChatMessage[];
    createdAt: string;
  } {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const firstUserMessage = messages.find(m => m.role === 'user')?.content || 'New Conversation';
    const name = firstUserMessage.length > 50 
      ? `${firstUserMessage.substring(0, 50)}...` 
      : firstUserMessage;

    return {
      id,
      name,
      messages,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Save conversation to local storage
   */
  static saveConversation(conversation: {
    id: string;
    name: string;
    messages: ChatMessage[];
    createdAt: string;
  }): void {
    try {
      const saved = localStorage.getItem('dyad-conversations') || '[]';
      const conversations = JSON.parse(saved);
      
      const existingIndex = conversations.findIndex((c: any) => c.id === conversation.id);
      if (existingIndex >= 0) {
        conversations[existingIndex] = { ...conversation, updatedAt: new Date().toISOString() };
      } else {
        conversations.unshift(conversation);
      }

      // Keep only the last 50 conversations
      if (conversations.length > 50) {
        conversations.splice(50);
      }

      localStorage.setItem('dyad-conversations', JSON.stringify(conversations));
    } catch (error) {
      console.warn('Failed to save conversation:', error);
    }
  }

  /**
   * Load conversations from local storage
   */
  static loadConversations(): Array<{
    id: string;
    name: string;
    messages: ChatMessage[];
    createdAt: string;
    updatedAt?: string;
  }> {
    try {
      const saved = localStorage.getItem('dyad-conversations') || '[]';
      return JSON.parse(saved);
    } catch (error) {
      console.warn('Failed to load conversations:', error);
      return [];
    }
  }

  /**
   * Delete conversation
   */
  static deleteConversation(conversationId: string): void {
    try {
      const saved = localStorage.getItem('dyad-conversations') || '[]';
      const conversations = JSON.parse(saved);
      const filtered = conversations.filter((c: any) => c.id !== conversationId);
      localStorage.setItem('dyad-conversations', JSON.stringify(filtered));
    } catch (error) {
      console.warn('Failed to delete conversation:', error);
    }
  }

  /**
   * Export conversation
   */
  static exportConversation(
    conversation: { id: string; name: string; messages: ChatMessage[] },
    format: 'json' | 'markdown' | 'txt'
  ): string {
    switch (format) {
      case 'json':
        return JSON.stringify(conversation, null, 2);
      
      case 'markdown':
        let markdown = `# ${conversation.name}\n\n`;
        conversation.messages.forEach(message => {
          markdown += `## ${message.role.charAt(0).toUpperCase() + message.role.slice(1)}\n\n`;
          markdown += `${message.content}\n\n`;
        });
        return markdown;
      
      case 'txt':
        let text = `${conversation.name}\n${'='.repeat(conversation.name.length)}\n\n`;
        conversation.messages.forEach(message => {
          text += `${message.role.toUpperCase()}:\n${message.content}\n\n`;
        });
        return text;
      
      default:
        return JSON.stringify(conversation, null, 2);
    }
  }
}