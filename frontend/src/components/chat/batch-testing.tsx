import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Play, 
  Square, 
  Download, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2,
  AlertTriangle,
  BarChart3,
  FileText,
  Zap
} from 'lucide-react';
import { testTemplates } from '@/lib/test-templates';
import { ChatService } from '@/services/chat';
import { useModels } from '@/hooks/api/use-models';
import { TestTemplate, ChatCompletionRequest, Model } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BatchTestResult {
  id: string;
  templateId: string;
  templateName: string;
  model: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: number;
  endTime?: number;
  duration?: number;
  response?: string;
  error?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface BatchTestingProps {
  selectedModels: string[];
  onModelSelectionChange: (models: string[]) => void;
}

export const BatchTesting: React.FC<BatchTestingProps> = ({
  selectedModels,
  onModelSelectionChange,
}) => {
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BatchTestResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const { data: modelsResponse } = useModels();
  const availableModels = useMemo(() => modelsResponse?.data || [], [modelsResponse?.data]);

  const handleTemplateToggle = useCallback((templateId: string, checked: boolean) => {
    setSelectedTemplates(prev => 
      checked 
        ? [...prev, templateId]
        : prev.filter(id => id !== templateId)
    );
  }, []);

  const handleModelToggle = useCallback((modelId: string, checked: boolean) => {
    const newModels = checked 
      ? [...selectedModels, modelId]
      : selectedModels.filter(id => id !== modelId);
    onModelSelectionChange(newModels);
  }, [selectedModels, onModelSelectionChange]);

  const handleSelectAllTemplates = useCallback((checked: boolean) => {
    setSelectedTemplates(checked ? testTemplates.map(t => t.id) : []);
  }, []);

  const handleSelectAllModels = useCallback((checked: boolean) => {
    onModelSelectionChange(checked ? availableModels.map(m => m.id) : []);
  }, [availableModels, onModelSelectionChange]);

  const runBatchTests = useCallback(async () => {
    if (selectedTemplates.length === 0 || selectedModels.length === 0) {
      toast.error('Please select at least one template and one model');
      return;
    }

    setIsRunning(true);
    setProgress(0);
    
    const controller = new AbortController();
    setAbortController(controller);

    // Create all test combinations
    const testCombinations: BatchTestResult[] = [];
    selectedTemplates.forEach(templateId => {
      const template = testTemplates.find(t => t.id === templateId);
      if (template) {
        selectedModels.forEach(modelId => {
          testCombinations.push({
            id: `${templateId}-${modelId}-${Date.now()}`,
            templateId,
            templateName: template.name,
            model: modelId,
            status: 'pending',
          });
        });
      }
    });

    setResults(testCombinations);

    let completedTests = 0;
    const totalTests = testCombinations.length;

    // Run tests sequentially to avoid overwhelming the API
    for (const testResult of testCombinations) {
      if (controller.signal.aborted) {
        break;
      }

      const template = testTemplates.find(t => t.id === testResult.templateId);
      if (!template) continue;

      // Update status to running
      setResults(prev => prev.map(r => 
        r.id === testResult.id 
          ? { ...r, status: 'running', startTime: Date.now() }
          : r
      ));

      try {
        const request: ChatCompletionRequest = {
          model: testResult.model,
          messages: template.request.messages,
          max_tokens: template.request.parameters.maxTokens,
          temperature: template.request.parameters.temperature,
          top_p: template.request.parameters.topP,
          stream: false, // Use non-streaming for batch tests
        };

        const response = await ChatService.sendChatCompletion(request);
        const endTime = Date.now();

        setResults(prev => prev.map(r => 
          r.id === testResult.id 
            ? { 
                ...r, 
                status: 'completed',
                endTime,
                duration: endTime - (r.startTime || endTime),
                response: response.choices[0]?.message?.content || '',
                usage: response.usage,
              }
            : r
        ));

      } catch (error: unknown) {
        const endTime = Date.now();
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        setResults(prev => prev.map(r => 
          r.id === testResult.id 
            ? { 
                ...r, 
                status: 'failed',
                endTime,
                duration: endTime - (r.startTime || endTime),
                error: errorMessage,
              }
            : r
        ));
      }

      completedTests++;
      setProgress((completedTests / totalTests) * 100);

      // Small delay between tests to be respectful to the API
      if (completedTests < totalTests && !controller.signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsRunning(false);
    setAbortController(null);
    
    if (!controller.signal.aborted) {
      toast.success(`Batch testing completed: ${completedTests} tests run`);
    }
  }, [selectedTemplates, selectedModels]);

  const handleCancelTests = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setIsRunning(false);
      setAbortController(null);
      
      // Mark running tests as cancelled
      setResults(prev => prev.map(r => 
        r.status === 'running' || r.status === 'pending'
          ? { ...r, status: 'cancelled' }
          : r
      ));
      
      toast.info('Batch testing cancelled');
    }
  }, [abortController]);

  const handleExportResults = useCallback(() => {
    if (results.length === 0) {
      toast.error('No results to export');
      return;
    }

    const exportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: results.length,
        completed: results.filter(r => r.status === 'completed').length,
        failed: results.filter(r => r.status === 'failed').length,
        cancelled: results.filter(r => r.status === 'cancelled').length,
        averageDuration: results
          .filter(r => r.duration)
          .reduce((sum, r) => sum + (r.duration || 0), 0) / 
          results.filter(r => r.duration).length || 0,
      },
      results: results.map(r => ({
        template: r.templateName,
        model: r.model,
        status: r.status,
        duration: r.duration,
        response: r.response?.substring(0, 200) + (r.response && r.response.length > 200 ? '...' : ''),
        error: r.error,
        usage: r.usage,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-test-results-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Results exported successfully');
  }, [results]);

  const getStatusIcon = (status: BatchTestResult['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'cancelled':
        return <Square className="w-4 h-4 text-gray-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: BatchTestResult['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'running':
        return 'text-blue-600';
      case 'cancelled':
        return 'text-gray-600';
      default:
        return 'text-gray-400';
    }
  };

  const completedResults = results.filter(r => r.status === 'completed');
  const failedResults = results.filter(r => r.status === 'failed');
  const averageDuration = completedResults.length > 0 
    ? completedResults.reduce((sum, r) => sum + (r.duration || 0), 0) / completedResults.length
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Batch Testing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Select Templates</h4>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all-templates"
                  checked={selectedTemplates.length === testTemplates.length}
                  onCheckedChange={handleSelectAllTemplates}
                />
                <label htmlFor="select-all-templates" className="text-sm">
                  Select All ({testTemplates.length})
                </label>
              </div>
            </div>
            <ScrollArea className="h-32 border rounded p-2">
              <div className="space-y-2">
                {testTemplates.map((template) => (
                  <div key={template.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`template-${template.id}`}
                      checked={selectedTemplates.includes(template.id)}
                      onCheckedChange={(checked) => handleTemplateToggle(template.id, checked as boolean)}
                    />
                    <label htmlFor={`template-${template.id}`} className="text-sm flex-1">
                      {template.name}
                    </label>
                    <Badge variant="outline" className="text-xs">
                      {template.category}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Model Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Select Models</h4>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all-models"
                  checked={selectedModels.length === availableModels.length}
                  onCheckedChange={handleSelectAllModels}
                />
                <label htmlFor="select-all-models" className="text-sm">
                  Select All ({availableModels.length})
                </label>
              </div>
            </div>
            <ScrollArea className="h-32 border rounded p-2">
              <div className="space-y-2">
                {availableModels.map((model) => (
                  <div key={model.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`model-${model.id}`}
                      checked={selectedModels.includes(model.id)}
                      onCheckedChange={(checked) => handleModelToggle(model.id, checked as boolean)}
                    />
                    <label htmlFor={`model-${model.id}`} className="text-sm flex-1">
                      {model.id}
                    </label>
                    <Badge variant="outline" className="text-xs">
                      {model.owned_by}
                    </Badge>
                    {model.supports_streaming && (
                      <Badge variant="secondary" className="text-xs">
                        <Zap className="w-3 h-3 mr-1" />
                        Stream
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedTemplates.length} templates × {selectedModels.length} models = {selectedTemplates.length * selectedModels.length} tests
            </div>
            <div className="flex gap-2">
              {isRunning ? (
                <Button variant="outline" onClick={handleCancelTests}>
                  <Square className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              ) : (
                <Button 
                  onClick={runBatchTests}
                  disabled={selectedTemplates.length === 0 || selectedModels.length === 0}
                >
                  <Play className="w-4 h-4 mr-1" />
                  Run Tests
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={handleExportResults}
                disabled={results.length === 0}
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            </div>
          </div>

          {/* Progress */}
          {isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Running tests...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Test Results</CardTitle>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>{completedResults.length} completed</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span>{failedResults.length} failed</span>
                </div>
                {averageDuration > 0 && (
                  <div className="text-muted-foreground">
                    Avg: {Math.round(averageDuration)}ms
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusIcon(result.status)}
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {result.templateName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {result.model}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className={cn("capitalize", getStatusColor(result.status))}>
                        {result.status}
                      </div>
                      {result.duration && (
                        <div className="text-muted-foreground">
                          {result.duration}ms
                        </div>
                      )}
                      {result.usage && (
                        <div className="text-muted-foreground">
                          {result.usage.total_tokens} tokens
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BatchTesting;