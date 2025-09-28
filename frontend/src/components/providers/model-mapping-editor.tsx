/**
 * Enhanced model mapping editor with add/remove functionality and validation
 * Provides an intuitive interface for managing Dyad-to-adapter model mappings
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useFieldArray, Control, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Trash2,
  Copy,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Zap,
  Database,
  Info,
  AlertTriangle,
  CheckCircle,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModelMapping, ProviderType } from '@/types/api';
import { ProviderTemplate } from '@/lib/templates/provider-templates';

interface ModelMappingEditorProps {
  control: Control<any>;
  providerType: ProviderType;
  template?: ProviderTemplate;
  className?: string;
}

interface ModelPreset {
  id: string;
  name: string;
  description: string;
  dyadModelId: string;
  adapterModelId: string;
  maxTokens?: number;
  contextWindow?: number;
  supportsStreaming?: boolean;
  supportsEmbeddings?: boolean;
  category: 'popular' | 'chat' | 'code' | 'embedding';
}

// Common model presets for different provider types
const getModelPresets = (providerType: ProviderType): ModelPreset[] => {
  const commonPresets: ModelPreset[] = [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      description: 'Most capable GPT-4 model',
      dyadModelId: 'gpt-4',
      adapterModelId: 'gpt-4',
      maxTokens: 8192,
      contextWindow: 8192,
      supportsStreaming: true,
      supportsEmbeddings: false,
      category: 'popular',
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      description: 'Fast and efficient chat model',
      dyadModelId: 'gpt-3.5-turbo',
      adapterModelId: 'gpt-3.5-turbo',
      maxTokens: 4096,
      contextWindow: 4096,
      supportsStreaming: true,
      supportsEmbeddings: false,
      category: 'chat',
    },
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      description: 'Most capable Claude model',
      dyadModelId: 'claude-3-opus',
      adapterModelId: 'claude-3-opus-20240229',
      maxTokens: 4096,
      contextWindow: 200000,
      supportsStreaming: true,
      supportsEmbeddings: false,
      category: 'popular',
    },
  ];

  const typeSpecificPresets: Record<ProviderType, ModelPreset[]> = {
    'spawn-cli': [
      {
        id: 'llama2',
        name: 'Llama 2',
        description: 'Meta Llama 2 model',
        dyadModelId: 'llama2',
        adapterModelId: 'llama2:latest',
        maxTokens: 4096,
        contextWindow: 4096,
        supportsStreaming: true,
        supportsEmbeddings: false,
        category: 'popular',
      },
      {
        id: 'codellama',
        name: 'Code Llama',
        description: 'Code-specialized Llama model',
        dyadModelId: 'codellama',
        adapterModelId: 'codellama:latest',
        maxTokens: 4096,
        contextWindow: 16384,
        supportsStreaming: true,
        supportsEmbeddings: false,
        category: 'code',
      },
    ],
    'http-sdk': commonPresets,
    'proxy': commonPresets,
    'local': [
      {
        id: 'local-model',
        name: 'Local Model',
        description: 'Generic local model',
        dyadModelId: 'local-model',
        adapterModelId: 'default',
        maxTokens: 2048,
        contextWindow: 4096,
        supportsStreaming: false,
        supportsEmbeddings: false,
        category: 'popular',
      },
    ],
  };

  return [...commonPresets, ...typeSpecificPresets[providerType]];
};

export const ModelMappingEditor: React.FC<ModelMappingEditorProps> = ({
  control,
  providerType,
  template,
  className,
}) => {
  const [showAdvanced, setShowAdvanced] = useState<Set<number>>(new Set());
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'models',
  });

  const modelsValue = useWatch({
    control,
    name: 'models',
  });

  const modelPresets = useMemo(() => getModelPresets(providerType), [providerType]);

  const toggleAdvanced = useCallback((index: number) => {
    setShowAdvanced(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const addModelFromPreset = useCallback((preset: ModelPreset) => {
    append({
      dyadModelId: preset.dyadModelId,
      adapterModelId: preset.adapterModelId,
      maxTokens: preset.maxTokens,
      contextWindow: preset.contextWindow,
      supportsStreaming: preset.supportsStreaming || false,
      supportsEmbeddings: preset.supportsEmbeddings || false,
    });
    setSelectedPreset('');
  }, [append]);

  const addEmptyModel = useCallback(() => {
    append({
      dyadModelId: '',
      adapterModelId: '',
      maxTokens: undefined,
      contextWindow: undefined,
      supportsStreaming: false,
      supportsEmbeddings: false,
    });
  }, [append]);

  const duplicateModel = useCallback((index: number) => {
    const model = modelsValue[index];
    if (model) {
      append({
        ...model,
        dyadModelId: `${model.dyadModelId}-copy`,
      });
    }
  }, [append, modelsValue]);

  const validateModelMapping = useCallback((mapping: ModelMapping) => {
    const errors: string[] = [];
    
    if (!mapping.dyadModelId) {
      errors.push('Dyad model ID is required');
    }
    
    if (!mapping.adapterModelId) {
      errors.push('Adapter model ID is required');
    }
    
    if (mapping.maxTokens && mapping.contextWindow && mapping.maxTokens > mapping.contextWindow) {
      errors.push('Max tokens cannot exceed context window');
    }
    
    return errors;
  }, []);

  const getModelStatus = useCallback((mapping: ModelMapping) => {
    const errors = validateModelMapping(mapping);
    if (errors.length > 0) return 'error';
    if (!mapping.dyadModelId || !mapping.adapterModelId) return 'incomplete';
    return 'valid';
  }, [validateModelMapping]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'incomplete':
        return <Info className="h-4 w-4 text-yellow-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'incomplete':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200';
    }
  };

  const renderModelPresets = () => {
    const categories = Array.from(new Set(modelPresets.map(p => p.category)));
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <h4 className="font-medium">Quick Add Models</h4>
          </div>
          <Select value={selectedPreset} onValueChange={setSelectedPreset}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Choose a preset..." />
            </SelectTrigger>
            <SelectContent>
              {categories.map(category => (
                <div key={category}>
                  <SelectItem value="" disabled className="font-medium capitalize">
                    {category} Models
                  </SelectItem>
                  {modelPresets
                    .filter(preset => preset.category === category)
                    .map(preset => (
                      <SelectItem
                        key={preset.id}
                        value={preset.id}
                        onSelect={() => addModelFromPreset(preset)}
                      >
                        <div className="flex flex-col">
                          <span>{preset.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {preset.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {modelPresets.slice(0, 6).map(preset => (
            <Button
              key={preset.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addModelFromPreset(preset)}
              className="justify-start h-auto p-3"
            >
              <div className="text-left">
                <div className="font-medium text-sm">{preset.name}</div>
                <div className="text-xs text-muted-foreground">
                  {preset.description}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Model Mappings
        </CardTitle>
        <CardDescription>
          Map Dyad model IDs to provider-specific model identifiers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template models notice */}
        {template?.models && template.models.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>{template.name}</strong> template includes {template.models.length} pre-configured model{template.models.length > 1 ? 's' : ''}. 
              You can modify or add additional models below.
            </AlertDescription>
          </Alert>
        )}

        {/* Model presets */}
        {renderModelPresets()}

        <Separator />

        {/* Model mappings list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <h4 className="font-medium">Model Mappings</h4>
              <Badge variant="outline">{fields.length}</Badge>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addEmptyModel}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Custom Model
            </Button>
          </div>

          {fields.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No model mappings configured. Add at least one model mapping to enable this provider.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => {
                const model = modelsValue[index] || {};
                const status = getModelStatus(model);
                const isAdvancedOpen = showAdvanced.has(index);

                return (
                  <div
                    key={field.id}
                    className={cn(
                      'border rounded-lg p-4 space-y-4 transition-colors',
                      getStatusColor(status)
                    )}
                  >
                    {/* Model header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(status)}
                        <div>
                          <h5 className="font-medium">
                            Model {index + 1}
                            {model.dyadModelId && (
                              <span className="ml-2 text-sm text-muted-foreground">
                                ({model.dyadModelId})
                              </span>
                            )}
                          </h5>
                          {status === 'error' && (
                            <p className="text-xs text-red-600">
                              {validateModelMapping(model).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleAdvanced(index)}
                              >
                                {isAdvancedOpen ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isAdvancedOpen ? 'Hide advanced settings' : 'Show advanced settings'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => duplicateModel(index)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => remove(index)}
                              className="text-red-600"
                              disabled={fields.length === 1}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Basic model configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={control}
                        name={`models.${index}.dyadModelId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dyad Model ID</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="gpt-4"
                                {...field}
                                className="font-mono"
                              />
                            </FormControl>
                            <FormDescription>
                              Model ID used by Dyad clients
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={control}
                        name={`models.${index}.adapterModelId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Provider Model ID</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="gpt-4-turbo"
                                {...field}
                                className="font-mono"
                              />
                            </FormControl>
                            <FormDescription>
                              Model ID used by the provider
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Advanced settings */}
                    <Collapsible open={isAdvancedOpen}>
                      <CollapsibleContent className="space-y-4">
                        <Separator />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={control}
                            name={`models.${index}.maxTokens`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Max Tokens</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="4096"
                                    {...field}
                                    onChange={(e) => 
                                      field.onChange(parseInt(e.target.value) || undefined)
                                    }
                                  />
                                </FormControl>
                                <FormDescription>
                                  Maximum tokens per response
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={control}
                            name={`models.${index}.contextWindow`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Context Window</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="8192"
                                    {...field}
                                    onChange={(e) => 
                                      field.onChange(parseInt(e.target.value) || undefined)
                                    }
                                  />
                                </FormControl>
                                <FormDescription>
                                  Total context window size
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={control}
                            name={`models.${index}.supportsStreaming`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-sm">Supports Streaming</FormLabel>
                                  <FormDescription className="text-xs">
                                    Model can stream responses
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={control}
                            name={`models.${index}.supportsEmbeddings`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-sm">Supports Embeddings</FormLabel>
                                  <FormDescription className="text-xs">
                                    Model can generate embeddings
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={control}
                          name={`models.${index}.costPerToken`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cost Per Token (USD)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.000001"
                                  placeholder="0.000002"
                                  {...field}
                                  onChange={(e) => 
                                    field.onChange(parseFloat(e.target.value) || undefined)
                                  }
                                />
                              </FormControl>
                              <FormDescription>
                                Cost per token in USD (optional, for cost tracking)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary */}
        {fields.length > 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>{fields.length}</strong> model mapping{fields.length > 1 ? 's' : ''} configured. 
              {modelsValue.filter((m: ModelMapping) => m.supportsStreaming).length > 0 && (
                <span> {modelsValue.filter((m: ModelMapping) => m.supportsStreaming).length} support streaming.</span>
              )}
              {modelsValue.filter((m: ModelMapping) => m.supportsEmbeddings).length > 0 && (
                <span> {modelsValue.filter((m: ModelMapping) => m.supportsEmbeddings).length} support embeddings.</span>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default ModelMappingEditor;