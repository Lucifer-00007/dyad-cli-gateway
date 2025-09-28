/**
 * Test history viewer with comparison functionality
 */

import React, { useState } from 'react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  History, 
  CheckCircle, 
  XCircle, 
  Clock,
  Filter,
  GitCompare,
  Download,
  Search,
  Calendar,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTestHistory } from '@/hooks/api/use-providers';
import { Provider, TestResult, TestHistory } from '@/types';
import { cn } from '@/lib/utils';

interface TestHistoryViewerProps {
  provider: Provider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FilterOptions {
  status: 'all' | 'success' | 'failure';
  model: string;
  dateRange: 'all' | '24h' | '7d' | '30d';
  searchTerm: string;
}

const defaultFilters: FilterOptions = {
  status: 'all',
  model: 'all',
  dateRange: '7d',
  searchTerm: '',
};

export const TestHistoryViewer: React.FC<TestHistoryViewerProps> = ({
  provider,
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const [filters, setFilters] = useState<FilterOptions>(defaultFilters);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [page, setPage] = useState(1);

  const { data: testHistory, isLoading } = useTestHistory(provider.id, { 
    page, 
    limit: 20 
  });

  const handleFilterChange = (updates: Partial<FilterOptions>) => {
    setFilters(prev => ({ ...prev, ...updates }));
    setPage(1); // Reset to first page when filters change
  };

  const handleTestSelection = (testId: string, selected: boolean) => {
    if (selected) {
      setSelectedTests(prev => [...prev, testId]);
    } else {
      setSelectedTests(prev => prev.filter(id => id !== testId));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected && testHistory?.results) {
      setSelectedTests(testHistory.results.map(test => test.id));
    } else {
      setSelectedTests([]);
    }
  };

  const handleCompareTests = () => {
    if (selectedTests.length < 2) {
      toast({
        title: 'Select tests to compare',
        description: 'Please select at least 2 tests to compare',
        variant: 'destructive',
      });
      return;
    }
    setShowComparison(true);
  };

  const handleExportHistory = () => {
    if (!testHistory?.results) return;

    const exportData = {
      provider: provider.name,
      exportDate: new Date().toISOString(),
      filters,
      results: testHistory.results,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-history-${provider.slug}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'History exported',
      description: 'Test history has been exported successfully',
    });
  };

  const filteredResults = testHistory?.results?.filter(test => {
    // Status filter
    if (filters.status !== 'all' && test.status !== filters.status) {
      return false;
    }

    // Model filter
    if (filters.model !== 'all' && test.request.model !== filters.model) {
      return false;
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const testDate = new Date(test.startTime);
      const now = new Date();
      const diffHours = (now.getTime() - testDate.getTime()) / (1000 * 60 * 60);
      
      switch (filters.dateRange) {
        case '24h':
          if (diffHours > 24) return false;
          break;
        case '7d':
          if (diffHours > 24 * 7) return false;
          break;
        case '30d':
          if (diffHours > 24 * 30) return false;
          break;
      }
    }

    // Search term filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      const matchesModel = test.request.model.toLowerCase().includes(searchLower);
      const matchesContent = test.request.messages.some(msg => 
        msg.content.toLowerCase().includes(searchLower)
      );
      const matchesResponse = test.response?.content?.toLowerCase().includes(searchLower);
      
      if (!matchesModel && !matchesContent && !matchesResponse) {
        return false;
      }
    }

    return true;
  }) || [];

  const getUniqueModels = () => {
    if (!testHistory?.results) return [];
    const models = new Set(testHistory.results.map(test => test.request.model));
    return Array.from(models);
  };

  const getSuccessRate = () => {
    if (!filteredResults.length) return 0;
    const successful = filteredResults.filter(test => test.status === 'success').length;
    return (successful / filteredResults.length) * 100;
  };

  const getAverageLatency = () => {
    if (!filteredResults.length) return 0;
    const totalLatency = filteredResults.reduce((sum, test) => sum + (test.duration || 0), 0);
    return Math.round(totalLatency / filteredResults.length);
  };

  const selectedTestsData = testHistory?.results?.filter(test => 
    selectedTests.includes(test.id)
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Test History: {provider.name}
          </DialogTitle>
          <DialogDescription>
            View and analyze historical test results with filtering and comparison tools
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-full overflow-hidden">
          {/* Filters and Controls */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters & Controls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value: unknown) => handleFilterChange({ status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="success">Success Only</SelectItem>
                      <SelectItem value="failure">Failures Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={filters.model}
                    onValueChange={(value) => handleFilterChange({ model: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Models</SelectItem>
                      {getUniqueModels().map(model => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <Select
                    value={filters.dateRange}
                    onValueChange={(value: unknown) => handleFilterChange({ dateRange: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="24h">Last 24 Hours</SelectItem>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                      <SelectItem value="30d">Last 30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tests..."
                      value={filters.searchTerm}
                      onChange={(e) => handleFilterChange({ searchTerm: e.target.value })}
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedTests.length === filteredResults.length && filteredResults.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                    <Label htmlFor="select-all" className="text-sm">
                      Select All ({selectedTests.length} selected)
                    </Label>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCompareTests}
                    disabled={selectedTests.length < 2}
                  >
                    <GitCompare className="h-4 w-4 mr-2" />
                    Compare ({selectedTests.length})
                  </Button>
                </div>

                <Button variant="outline" size="sm" onClick={handleExportHistory}>
                  <Download className="h-4 w-4 mr-2" />
                  Export History
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold">{getSuccessRate().toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Latency</p>
                    <p className="text-2xl font-bold">{getAverageLatency()}ms</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tests</p>
                    <p className="text-2xl font-bold">{filteredResults.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Test Results */}
          <Card className="flex-1 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Test Results</CardTitle>
              <CardDescription>
                {filteredResults.length} tests found
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 h-full overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
                </div>
              ) : filteredResults.length > 0 ? (
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-3">
                    {filteredResults.map((test) => (
                      <Card 
                        key={test.id} 
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/50",
                          selectedTests.includes(test.id) && "ring-2 ring-primary"
                        )}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedTests.includes(test.id)}
                              onCheckedChange={(checked) => 
                                handleTestSelection(test.id, checked as boolean)
                              }
                            />
                            
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {test.status === 'success' ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                  )}
                                  <span className="font-medium">{test.request.model}</span>
                                  <Badge 
                                    variant={test.status === 'success' ? 'default' : 'destructive'}
                                  >
                                    {test.status}
                                  </Badge>
                                </div>
                                <div className="text-right text-sm text-muted-foreground">
                                  <p>{new Date(test.startTime).toLocaleString()}</p>
                                  <p>{test.duration}ms</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground mb-1">Request:</p>
                                  <p className="truncate">
                                    {test.request.messages[0]?.content || 'No content'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground mb-1">Response:</p>
                                  {test.status === 'success' && test.response ? (
                                    <p className="truncate">{test.response.content}</p>
                                  ) : test.error ? (
                                    <p className="text-red-500 truncate">{test.error.message}</p>
                                  ) : (
                                    <p className="text-muted-foreground">No response</p>
                                  )}
                                </div>
                              </div>

                              {test.response?.usage && (
                                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                                  <span>Tokens: {test.response.usage.total_tokens}</span>
                                  <span>Prompt: {test.response.usage.prompt_tokens}</span>
                                  <span>Completion: {test.response.usage.completion_tokens}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No test results found</p>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your filters or run some tests
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Comparison Modal */}
        {showComparison && (
          <Dialog open={showComparison} onOpenChange={setShowComparison}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Test Comparison</DialogTitle>
                <DialogDescription>
                  Comparing {selectedTests.length} selected tests
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {selectedTestsData.map((test, index) => (
                  <Card key={test.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        Test {index + 1}: {test.request.model}
                        <Badge variant={test.status === 'success' ? 'default' : 'destructive'}>
                          {test.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {new Date(test.startTime).toLocaleString()} • {test.duration}ms
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Request</Label>
                          <Card className="mt-1">
                            <CardContent className="p-3">
                              <pre className="text-xs whitespace-pre-wrap">
                                {test.request.messages.map(msg => 
                                  `${msg.role}: ${msg.content}`
                                ).join('\n')}
                              </pre>
                            </CardContent>
                          </Card>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Response</Label>
                          <Card className="mt-1">
                            <CardContent className="p-3">
                              {test.status === 'success' && test.response ? (
                                <pre className="text-xs whitespace-pre-wrap">
                                  {test.response.content}
                                </pre>
                              ) : test.error ? (
                                <div className="text-red-500 text-xs">
                                  <p><strong>Error:</strong> {test.error.message}</p>
                                  {test.error.code && <p><strong>Code:</strong> {test.error.code}</p>}
                                </div>
                              ) : (
                                <p className="text-muted-foreground text-xs">No response</p>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                      
                      {test.response?.usage && (
                        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <Label className="text-xs text-muted-foreground">Total Tokens</Label>
                            <p className="font-medium">{test.response.usage.total_tokens}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Prompt Tokens</Label>
                            <p className="font-medium">{test.response.usage.prompt_tokens}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Completion Tokens</Label>
                            <p className="font-medium">{test.response.usage.completion_tokens}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TestHistoryViewer;