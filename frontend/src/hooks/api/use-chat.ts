/**
 * React Query hooks for chat playground functionality
 */

import { useMutation } from '@tanstack/react-query';
import { ChatService } from '@/services';
import { ChatCompletionRequest } from '@/types';

export const useChatCompletion = () => {
  return useMutation({
    mutationKey: ['chat-completion'],
    mutationFn: (request: ChatCompletionRequest) => ChatService.sendChatCompletion(request),
  });
};

export const useTestProvider = () => {
  return useMutation({
    mutationKey: ['test-provider-chat'],
    mutationFn: ({
      providerId,
      model,
      message,
    }: {
      providerId: string;
      model: string;
      message?: string;
    }) => ChatService.testProvider(providerId, model, message),
  });
};

// Custom hook for streaming chat
export const useStreamingChat = () => {
  return useMutation({
    mutationKey: ['streaming-chat'],
    mutationFn: async ({
      request,
      onChunk,
      signal,
    }: {
      request: ChatCompletionRequest;
      onChunk: (chunk: unknown) => void;
      signal?: AbortSignal;
    }) => {
      return ChatService.sendStreamingChatCompletion(request, onChunk, signal);
    },
  });
};