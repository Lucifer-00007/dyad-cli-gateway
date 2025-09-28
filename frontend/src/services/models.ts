/**
 * Models API services for OpenAI v1 endpoints
 */

import { apiClient, handleApiError } from '@/lib/api-client';
import { ModelsResponse, Model } from '@/types';

export class ModelsService {
  private static readonly BASE_PATH = '/v1/models';

  /**
   * Get list of available models from all enabled providers
   */
  static async getModels(): Promise<ModelsResponse> {
    try {
      const response = await apiClient.get<ModelsResponse>(this.BASE_PATH);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get models grouped by provider
   */
  static async getModelsByProvider(): Promise<Record<string, Model[]>> {
    try {
      const response = await this.getModels();
      const modelsByProvider: Record<string, Model[]> = {};

      response.data.forEach(model => {
        const provider = model.owned_by;
        if (!modelsByProvider[provider]) {
          modelsByProvider[provider] = [];
        }
        modelsByProvider[provider].push(model);
      });

      return modelsByProvider;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get models that support streaming
   */
  static async getStreamingModels(): Promise<Model[]> {
    try {
      const response = await this.getModels();
      return response.data.filter(model => model.supports_streaming);
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get models that support embeddings
   */
  static async getEmbeddingModels(): Promise<Model[]> {
    try {
      const response = await this.getModels();
      return response.data.filter(model => model.supports_embeddings);
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get model by ID
   */
  static async getModel(modelId: string): Promise<Model | null> {
    try {
      const response = await this.getModels();
      return response.data.find(model => model.id === modelId) || null;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Get model statistics
   */
  static async getModelStats(): Promise<{
    total: number;
    streamingSupported: number;
    embeddingsSupported: number;
    byProvider: Record<string, number>;
  }> {
    try {
      const response = await this.getModels();
      const models = response.data;

      return {
        total: models.length,
        streamingSupported: models.filter(m => m.supports_streaming).length,
        embeddingsSupported: models.filter(m => m.supports_embeddings).length,
        byProvider: models.reduce((acc, model) => {
          const provider = model.owned_by;
          acc[provider] = (acc[provider] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };
    } catch (error) {
      throw handleApiError(error);
    }
  }
}