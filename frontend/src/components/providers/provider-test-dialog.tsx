/**
 * Comprehensive provider testing dialog with real-time progress and results
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Copy, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Zap,
  FileText,
  Settings,
  History
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  useRunProviderTest, 
  useCancelTest, 
  useTestResult, 
  useTestTemplates,
  useTestHistory 
} from '@/hooks/api/use-providers';
import { 
  Provider, 
  TestRequest, 
  TestResult, 
  TestTemplate, 
  ChatMessage 
} from '@/types';
import { cn } from '@/lib/utils';

interface ProviderTestDialogProps {
  provider: Provider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TestConfiguration {
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  topP: number;
  stream: boolean;
}

const defaultTestConfig: TestConfiguration = {
  model: '',
  messages: [
    {
      role: 'user',
      content: 'Hello! Please respond with a brief test message to verify connectivity.',
    },
  ],
  maxTokens: 150,
  temperature: 0.7,
  topP: 1.0,
  stream: false,
};

export const ProviderTestDialog: React.FC<ProviderTestDialogProps> = ({
  provider,
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('configure');
  const [testConfig, setTestConfig] = useState<TestConfiguration>(defaultTestConfig);
  const [currentTestId, setCurrentTestId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // API hooks
  const runTestMutation = useRunProviderTest();
  const cancelTestMutation = useCancelTest();
  const { data: testResult, isLoading: isLoadingResult } = useTestResult(currentTestId);
  const { data: templates } = useTestTemplates();
  const { data: testHistory, refetch: refetchHistory } = useTestHistory(provider.id);

  // Set default model when provider changes
  useEffect(() => {
    if (provider.models.length > 0 && !testConfig.model) {
      setTestConfig(prev => ({
        ...prev,
        model: provider.models[0].dyadModelId,
      }));
    }
  }, [provider.models, testConfig.model]);

  // Handle test completion
  useEffect(() => {
    if (testResult && testResult.status !== 'running') {
      if (testResult.status === 'success') {
        toast({
          title: 'Test completed successfully',
          description: `Test completed in ${testResult.duration}ms`,
        });
        setActiveTab('results');
      } else if (testResult.status === 'failure') {
        toast({
          title: 'Test failed',
          description: testResult.error?.message || 'Test failed with unknown error',
          variant: 'destructive',
        });
        setActiveTab('results');
      }
      refetchHistory();
    }
  }, [testResult, toast, refetchHistory]);

  const handleRunTest = async () => {
    try {
      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      const testRequest: Omit<TestRequest, 'id' | 'providerId'> = {
        model: testConfig.model,
        messages: testConfig.messages,
        parameters: {
          maxTokens: testConfig.maxTokens,
          temperature: testConfig.temperature,
          topP: testConfig.topP,
          stream: testConfig.stream,
        },
        metadata: {
          testType: 'manual',
          template: selectedTemplate || undefined,
        },
      };

      const result = await runTestMutation.mutateAsync({
        id: provider.id,
        testRequest,
      });

      setCurrentTestId(result.id);
      setActiveTab('progress');

      toast({
        title: 'Test started',
        description: 'Running provider test...',
      });
    } catch (error) {
      toast({
        title: 'Failed to start test',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleCancelTest = async () => {
    if (currentTestId) {
      try {
        await cancelTestMutation.mutateAsync(currentTestId);
        abortControllerRef.current?.abort();
        toast({
          title: 'Test cancelled',
          description: 'The test has been cancelled',
        });
      } catch (error) {
        toast({
          title: 'Failed to cancel test',
          description: 'Could not cancel the running test',
          variant: 'destructive',
        });
      }
    }
  };

  const handleApplyTemplate = (templateId: string) => {
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      setTestConfig({
        model: testConfig.model, // Keep current model
        messages: template.request.messages,
        maxTokens: template.request.parameters.maxTokens || defaultTestConfig.maxTokens,
        temperature: template.request.parameters.temperature || defaultTestConfig.temperature,
        topP: template.request.parameters.topP || defaultTestConfig.topP,
        stream: template.request.parameters.stream || defaultTestConfig.stream,
      });
      setSelectedTemplate(templateId);
      toast({
        title: 'Template applied',
        description: `Applied "${template.name}" template`,
      });
    }
  };

  const handleCopyResult = () => {
    if (testResult?.response?.content) {
      navigator.clipboard.writeText(testResult.response.content);
      toast({
        title: 'Copied to clipboard',
        description: 'Test response copied to clipboard',
      });
    }
  };

  const handleExportResult = () => {
    if (testResult) {
      const exportData = {
        provider: provider.name,
        timestamp: testResult.startTime,
        request: testResult.request,
        response: testResult.response,
        duration: testResult.duration,
        status: testResult.status,
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-result-${provider.slug}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const isTestRunning = testResult?.status === 'running';
  const canRunTest = testConfig.model && testConfig.messages.length > 0 && !isTestRunning;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Test Provider: {provider.name}
          </DialogTitle>
          <DialogDescription>
            Configure and run comprehensive tests to validate provider functionality
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="configure" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configure
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Progress
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Results
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden mt-4">
            <TabsContent value="configure" className="h-full overflow-auto space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Test Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle>Test Configuration</CardTitle>
                    <CardDescription>
                      Configure the test request parameters
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="model">Model</Label>
                      <Select
                        value={testConfig.model}
                        onValueChange={(value) => 
                          setTestConfig(prev => ({ ...prev, model: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          {provider.models.map((model) => (
                            <SelectItem key={model.dyadModelId} value={model.dyadModelId}>
                              {model.dyadModelId}
                              <span className="text-muted-foreground ml-2">
                                → {model.adapterModelId}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="messages">Test Messages</Label>
                      <div className="space-y-2">
                        {testConfig.messages.map((message, index) => (
                          <div key={index} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{message.role}</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newMessages = testConfig.messages.filter((_, i) => i !== index);
                                  setTestConfig(prev => ({ ...prev, messages: newMessages }));
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                            <Textarea
                              value={message.content}
                              onChange={(e) => {
                                const newMessages = [...testConfig.messages];
                                newMessages[index] = { ...message, content: e.target.value };
                                setTestConfig(prev => ({ ...prev, messages: newMessages }));
                              }}
                              placeholder="Enter message content..."
                              rows={3}
                            />
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTestConfig(prev => ({
                              ...prev,
                              messages: [
                                ...prev.messages,
                                { role: 'user', content: '' },
                              ],
                            }));
                          }}
                        >
                          Add Message
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="maxTokens">Max Tokens</Label>
                        <Input
                          id="maxTokens"
                          type="number"
                          value={testConfig.maxTokens}
                          onChange={(e) => 
                            setTestConfig(prev => ({ 
                              ...prev, 
                              maxTokens: parseInt(e.target.value) || 0 
                            }))
                          }
                          min={1}
                          max={4096}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Temperature: {testConfig.temperature}</Label>
                        <Slider
                          value={[testConfig.temperature]}
                          onValueChange={([value]) => 
                            setTestConfig(prev => ({ ...prev, temperature: value }))
                          }
                          min={0}
                          max={2}
                          step={0.1}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Top P: {testConfig.topP}</Label>
                        <Slider
                          value={[testConfig.topP]}
                          onValueChange={([value]) => 
                            setTestConfig(prev => ({ ...prev, topP: value }))
                          }
                          min={0}
                          max={1}
                          step={0.1}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="stream"
                          checked={testConfig.stream}
                          onCheckedChange={(checked) => 
                            setTestConfig(prev => ({ ...prev, stream: checked }))
                          }
                        />
                        <Label htmlFor="stream">Enable Streaming</Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Templates */}
                <Card>
                  <CardHeader>
                    <CardTitle>Test Templates</CardTitle>
                    <CardDescription>
                      Use predefined test templates for common scenarios
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {templates?.map((template) => (
                          <Card 
                            key={template.id} 
                            className={cn(
                              "cursor-pointer transition-colors hover:bg-muted/50",
                              selectedTemplate === template.id && "ring-2 ring-primary"
                            )}
                            onClick={() => handleApplyTemplate(template.id)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-medium">{template.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {template.description}
                                  </p>
                                  <Badge variant="secondary" className="mt-1">
                                    {template.category}
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleRunTest} 
                  disabled={!canRunTest || runTestMutation.isPending}
                >
                  {runTestMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run Test
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="progress" className="h-full overflow-auto">
              {isTestRunning ? (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        Test in Progress
                      </CardTitle>
                      <CardDescription>
                        Running test against {provider.name}...
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span>Status:</span>
                          <Badge variant="secondary">
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            Running
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Started:</span>
                          <span className="text-sm text-muted-foreground">
                            {testResult?.startTime ? new Date(testResult.startTime).toLocaleTimeString() : 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Model:</span>
                          <span className="text-sm">{testResult?.request.model}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex justify-center">
                    <Button 
                      variant="destructive" 
                      onClick={handleCancelTest}
                      disabled={cancelTestMutation.isPending}
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Cancel Test
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No test currently running</p>
                    <p className="text-sm text-muted-foreground">
                      Configure and start a test to see progress here
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="results" className="h-full overflow-auto">
              {testResult ? (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {testResult.status === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        )}
                        Test Result
                      </CardTitle>
                      <CardDescription>
                        Test completed on {new Date(testResult.startTime).toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <Label className="text-sm text-muted-foreground">Status</Label>
                          <Badge 
                            variant={testResult.status === 'success' ? 'default' : 'destructive'}
                            className="mt-1"
                          >
                            {testResult.status}
                          </Badge>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Duration</Label>
                          <p className="font-medium">{testResult.duration}ms</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Model</Label>
                          <p className="font-medium">{testResult.request.model}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Tokens Used</Label>
                          <p className="font-medium">
                            {testResult.response?.usage?.total_tokens || 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 mb-4">
                        <Button variant="outline" size="sm" onClick={handleCopyResult}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Response
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportResult}>
                          <Download className="h-4 w-4 mr-2" />
                          Export Result
                        </Button>
                      </div>

                      <Separator className="my-4" />

                      {testResult.status === 'success' && testResult.response ? (
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm font-medium">Response</Label>
                            <Card className="mt-2">
                              <CardContent className="p-4">
                                <pre className="whitespace-pre-wrap text-sm">
                                  {testResult.response.content}
                                </pre>
                              </CardContent>
                            </Card>
                          </div>

                          {testResult.response.usage && (
                            <div>
                              <Label className="text-sm font-medium">Token Usage</Label>
                              <div className="grid grid-cols-3 gap-4 mt-2">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Prompt</Label>
                                  <p className="font-medium">{testResult.response.usage.prompt_tokens}</p>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Completion</Label>
                                  <p className="font-medium">{testResult.response.usage.completion_tokens}</p>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Total</Label>
                                  <p className="font-medium">{testResult.response.usage.total_tokens}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : testResult.error ? (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="space-y-2">
                              <p><strong>Error:</strong> {testResult.error.message}</p>
                              {testResult.error.code && (
                                <p><strong>Code:</strong> {testResult.error.code}</p>
                              )}
                              {testResult.error.details && (
                                <details className="mt-2">
                                  <summary className="cursor-pointer">Error Details</summary>
                                  <pre className="mt-2 text-xs">
                                    {JSON.stringify(testResult.error.details, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      {testResult.logs && testResult.logs.length > 0 && (
                        <div className="mt-4">
                          <Label className="text-sm font-medium">Logs</Label>
                          <ScrollArea className="h-32 mt-2 border rounded">
                            <div className="p-2 space-y-1">
                              {testResult.logs.map((log, index) => (
                                <div key={index} className="text-xs">
                                  <span className="text-muted-foreground">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                  </span>
                                  <span className={cn(
                                    "ml-2 font-medium",
                                    log.level === 'error' && "text-red-500",
                                    log.level === 'warn' && "text-yellow-500",
                                    log.level === 'info' && "text-blue-500"
                                  )}>
                                    [{log.level.toUpperCase()}]
                                  </span>
                                  <span className="ml-2">{log.message}</span>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No test results available</p>
                    <p className="text-sm text-muted-foreground">
                      Run a test to see results here
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="h-full overflow-auto">
              <Card>
                <CardHeader>
                  <CardTitle>Test History</CardTitle>
                  <CardDescription>
                    Recent test results for {provider.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {testHistory?.results && testHistory.results.length > 0 ? (
                    <ScrollArea className="h-96">
                      <div className="space-y-3">
                        {testHistory.results.map((result) => (
                          <Card key={result.id} className="cursor-pointer hover:bg-muted/50">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {result.status === 'success' ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                  )}
                                  <div>
                                    <p className="font-medium">{result.request.model}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {new Date(result.startTime).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <Badge 
                                    variant={result.status === 'success' ? 'default' : 'destructive'}
                                  >
                                    {result.status}
                                  </Badge>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {result.duration}ms
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center">
                        <History className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No test history available</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ProviderTestDialog;