import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Square, 
  Save, 
  Download, 
  Upload, 
  Trash2, 
  Settings, 
  MessageSquare,
  Bot,
  User,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  RotateCcw,
  Zap,
  BarChart3
} from 'lucide-react';
import { useModels } from '@/hooks/api/use-models';
import { ChatService } from '@/services/chat';
import { ChatMessage, ChatCompletionRequest, ChatCompletionChunk } from '@/types';
import { PromptTemplates, BatchTesting } from '@/components/chat';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface StreamingResponse {
  content: string;
  isComplete: boolean;
  error?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface Conversation {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt?: string;
}

interface RequestMetadata {
  model: string;
  duration: number;
  timestamp: string;
  tokenCount?: number;
  error?: string;
}

const ChatPlayground: React.FC = () => {
  // State management
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState<StreamingResponse | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showRequestInspector, setShowRequestInspector] = useState(false);
  const [lastRequest, setLastRequest] = useState<ChatCompletionRequest | null>(null);
  const [lastResponse, setLastResponse] = useState<Record<string, unknown> | null>(null);
  const [lastMetadata, setLastMetadata] = useState<RequestMetadata | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [selectedModelsForBatch, setSelectedModelsForBatch] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('chat');

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Hooks
  const { data: modelsResponse, isLoading: modelsLoading } = useModels();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingResponse]);

  // Load conversations on mount
  useEffect(() => {
    const savedConversations = ChatService.loadConversations();
    setConversations(savedConversations);
  }, []);

  // Auto-select first model when models load
  useEffect(() => {
    if (modelsResponse?.data && modelsResponse.data.length > 0 && !selectedModel) {
      setSelectedModel(modelsResponse.data[0].id);
    }
  }, [modelsResponse, selectedModel]);

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !selectedModel || isStreaming) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputMessage('');
    setIsStreaming(true);
    setStreamingResponse({ content: '', isComplete: false });

    const request: ChatCompletionRequest = {
      model: selectedModel,
      messages: newMessages,
      stream: true,
      max_tokens: 1000,
      temperature: 0.7,
    };

    setLastRequest(request);
    const startTime = Date.now();

    try {
      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      await ChatService.sendStreamingChatCompletion(
        request,
        (chunk: ChatCompletionChunk) => {
          const content = chunk.choices?.[0]?.delta?.content || '';
          const finishReason = chunk.choices?.[0]?.finish_reason;
          
          setStreamingResponse(prev => ({
            content: (prev?.content || '') + content,
            isComplete: finishReason === 'stop',
            usage: chunk.usage,
          }));

          if (finishReason === 'stop') {
            setIsStreaming(false);
          }
        },
        abortControllerRef.current.signal
      );

      const duration = Date.now() - startTime;
      setLastMetadata({
        model: selectedModel,
        duration,
        timestamp: new Date().toISOString(),
      });

    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      setIsStreaming(false);
      
      const isAbortError = error instanceof Error && error.name === 'AbortError';
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      
      if (isAbortError) {
        setStreamingResponse(prev => prev ? { ...prev, isComplete: true } : null);
      } else {
        setStreamingResponse({
          content: '',
          isComplete: true,
          error: errorMessage,
        });
        
        setLastMetadata({
          model: selectedModel,
          duration,
          timestamp: new Date().toISOString(),
          error: errorMessage,
        });
        
        toast.error('Failed to send message', {
          description: errorMessage,
        });
      }
    }
  }, [inputMessage, selectedModel, messages, isStreaming]);

  // Complete the streaming response and add to messages
  useEffect(() => {
    if (streamingResponse?.isComplete && !isStreaming) {
      if (streamingResponse.content && !streamingResponse.error) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: streamingResponse.content,
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setLastResponse({
          content: streamingResponse.content,
          usage: streamingResponse.usage,
        });
      }
      
      setStreamingResponse(null);
    }
  }, [streamingResponse, isStreaming]);

  const handleCancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
    setStreamingResponse(prev => prev ? { ...prev, isComplete: true } : null);
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleSaveConversation = useCallback(() => {
    if (messages.length === 0) {
      toast.error('No messages to save');
      return;
    }

    const conversation = ChatService.createConversation(messages);
    ChatService.saveConversation(conversation);
    
    setConversations(prev => [conversation, ...prev.filter(c => c.id !== conversation.id)]);
    setCurrentConversationId(conversation.id);
    
    toast.success('Conversation saved');
  }, [messages]);

  const handleLoadConversation = useCallback((conversation: Conversation) => {
    setMessages(conversation.messages);
    setCurrentConversationId(conversation.id);
    setStreamingResponse(null);
    setIsStreaming(false);
    
    toast.success(`Loaded conversation: ${conversation.name}`);
  }, []);

  const handleDeleteConversation = useCallback((conversationId: string) => {
    ChatService.deleteConversation(conversationId);
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    
    if (currentConversationId === conversationId) {
      setCurrentConversationId(null);
    }
    
    toast.success('Conversation deleted');
  }, [currentConversationId]);

  const handleExportConversation = useCallback((format: 'json' | 'markdown' | 'txt') => {
    if (messages.length === 0) {
      toast.error('No messages to export');
      return;
    }

    const conversation = {
      id: currentConversationId || 'current',
      name: messages.find(m => m.role === 'user')?.content.substring(0, 50) || 'Chat Export',
      messages,
    };

    const content = ChatService.exportConversation(conversation, format);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`Conversation exported as ${format.toUpperCase()}`);
  }, [messages, currentConversationId]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setStreamingResponse(null);
    setIsStreaming(false);
    setCurrentConversationId(null);
    setLastRequest(null);
    setLastResponse(null);
    setLastMetadata(null);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const handleCopyMessage = useCallback(async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
      toast.success('Message copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy message');
    }
  }, []);

  const handleApplyTemplate = useCallback((templateMessages: ChatMessage[], parameters?: Record<string, unknown>) => {
    setMessages(templateMessages);
    setActiveTab('chat');
    
    // Focus the input after applying template
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  }, []);

  const availableModels = modelsResponse?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat Playground"
        description="Test and interact with your AI providers in real-time"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Chat Playground', isCurrentPage: true }
        ]}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chat">Chat Interface</TabsTrigger>
          <TabsTrigger value="templates">Prompt Templates</TabsTrigger>
          <TabsTrigger value="batch">Batch Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Chat Interface */}
            <div className="lg:col-span-3 space-y-4">
          {/* Model Selection and Controls */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Chat Interface</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRequestInspector(!showRequestInspector)}
                  >
                    {showRequestInspector ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    Inspector
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearChat}
                    disabled={messages.length === 0 && !streamingResponse}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Model Selection */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
                      <SelectValue placeholder={modelsLoading ? "Loading models..." : "Select a model"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center gap-2">
                            <span>{model.id}</span>
                            {model.supports_streaming && (
                              <Badge variant="secondary" className="text-xs">
                                <Zap className="w-3 h-3 mr-1" />
                                Streaming
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedModel && (
                  <Badge variant="outline">
                    {availableModels.find(m => m.id === selectedModel)?.owned_by || 'Unknown Provider'}
                  </Badge>
                )}
              </div>

              {/* Messages Area */}
              <div className="border rounded-lg">
                <ScrollArea className="h-96 p-4">
                  <div className="space-y-4">
                    {messages.length === 0 && !streamingResponse && (
                      <div className="text-center text-muted-foreground py-8">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Start a conversation by typing a message below</p>
                      </div>
                    )}
                    
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={cn(
                          "flex gap-3 group",
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {message.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4" />
                          </div>
                        )}
                        
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg px-4 py-2 relative",
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          )}
                        >
                          <div className="whitespace-pre-wrap break-words">
                            {message.content}
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "absolute -top-2 -right-2 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity",
                              message.role === 'user' ? 'text-primary-foreground/70 hover:text-primary-foreground' : ''
                            )}
                            onClick={() => handleCopyMessage(message.content, `${index}`)}
                          >
                            {copiedMessageId === `${index}` ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                        
                        {message.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Streaming Response */}
                    {streamingResponse && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4" />
                        </div>
                        
                        <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                          {streamingResponse.error ? (
                            <div className="flex items-center gap-2 text-destructive">
                              <AlertCircle className="w-4 h-4" />
                              <span>Error: {streamingResponse.error}</span>
                            </div>
                          ) : (
                            <div>
                              <div className="whitespace-pre-wrap break-words">
                                {streamingResponse.content}
                                {!streamingResponse.isComplete && (
                                  <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-1" />
                                )}
                              </div>
                              
                              {!streamingResponse.isComplete && (
                                <div className="mt-2 pt-2 border-t">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelStream}
                                  >
                                    <Square className="w-3 h-3 mr-1" />
                                    Cancel
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </div>

              {/* Input Area */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                    className="min-h-[60px] resize-none"
                    disabled={isStreaming || !selectedModel}
                  />
                </div>
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || !selectedModel || isStreaming}
                  size="lg"
                  className="px-6"
                >
                  {isStreaming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Request Inspector */}
          {showRequestInspector && (lastRequest || lastResponse || lastMetadata) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Request Inspector</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lastMetadata && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="font-medium text-muted-foreground">Model</div>
                      <div>{lastMetadata.model}</div>
                    </div>
                    <div>
                      <div className="font-medium text-muted-foreground">Duration</div>
                      <div>{lastMetadata.duration}ms</div>
                    </div>
                    <div>
                      <div className="font-medium text-muted-foreground">Timestamp</div>
                      <div>{new Date(lastMetadata.timestamp).toLocaleTimeString()}</div>
                    </div>
                    <div>
                      <div className="font-medium text-muted-foreground">Status</div>
                      <div className={lastMetadata.error ? 'text-destructive' : 'text-green-600'}>
                        {lastMetadata.error ? 'Error' : 'Success'}
                      </div>
                    </div>
                  </div>
                )}
                
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lastRequest && (
                    <div>
                      <div className="font-medium mb-2">Request</div>
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                        {JSON.stringify(lastRequest, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {lastResponse && (
                    <div>
                      <div className="font-medium mb-2">Response</div>
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                        {JSON.stringify(lastResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
          {/* Conversation Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Conversations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveConversation}
                  disabled={messages.length === 0}
                  className="flex-1"
                >
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportConversation('json')}
                  disabled={messages.length === 0}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
              
              <Separator />
              
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {conversations.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-4">
                      No saved conversations
                    </div>
                  ) : (
                    conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={cn(
                          "p-2 rounded border cursor-pointer hover:bg-muted/50 transition-colors",
                          currentConversationId === conversation.id && "bg-muted border-primary"
                        )}
                        onClick={() => handleLoadConversation(conversation)}
                      >
                        <div className="font-medium text-sm truncate">
                          {conversation.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(conversation.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {conversation.messages.length} messages
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-6 h-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(conversation.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleExportConversation('markdown')}
                disabled={messages.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export as Markdown
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleExportConversation('txt')}
                disabled={messages.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export as Text
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                disabled
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Conversation
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                disabled
              >
                <Settings className="w-4 h-4 mr-2" />
                Chat Settings
              </Button>
            </CardContent>
          </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <PromptTemplates 
                onApplyTemplate={handleApplyTemplate}
                selectedModel={selectedModel}
              />
            </div>
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Template Usage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2">
                      Templates provide pre-configured prompts for testing different scenarios:
                    </p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li><strong>Basic:</strong> Simple connectivity tests</li>
                      <li><strong>Advanced:</strong> Complex reasoning tasks</li>
                      <li><strong>Performance:</strong> Speed and efficiency tests</li>
                      <li><strong>Custom:</strong> Your own templates</li>
                    </ul>
                  </div>
                  <Separator />
                  <div className="text-sm">
                    <p className="font-medium mb-2">Quick Actions:</p>
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start"
                        onClick={() => setActiveTab('chat')}
                        disabled={messages.length === 0}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Go to Chat
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start"
                        onClick={() => setActiveTab('batch')}
                      >
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Batch Test
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="batch" className="space-y-0">
          <BatchTesting 
            selectedModels={selectedModelsForBatch}
            onModelSelectionChange={setSelectedModelsForBatch}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChatPlayground;