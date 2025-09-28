/**
 * Dynamic adapter configuration editor with type-specific field rendering
 * Provides specialized configuration interfaces for each adapter type
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Control, useWatch, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Info,
  AlertTriangle,
  CheckCircle,
  Terminal,
  Globe,
  Server,
  Zap,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProviderType } from '@/types/api';
import { ProviderTemplate } from '@/lib/templates/provider-templates';

interface AdapterConfigEditorProps {
  control: Control<any>;
  providerType: ProviderType;
  template?: ProviderTemplate;
  className?: string;
}

interface ConfigSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  required: boolean;
  defaultOpen: boolean;
}

const getAdapterIcon = (type: ProviderType) => {
  const icons = {
    'spawn-cli': Terminal,
    'http-sdk': Globe,
    'proxy': Zap,
    'local': Server,
  };
  return icons[type];
};

const getAdapterDescription = (type: ProviderType) => {
  const descriptions = {
    'spawn-cli': 'Execute CLI commands with optional Docker sandboxing',
    'http-sdk': 'Connect to HTTP APIs with authentication and headers',
    'proxy': 'Proxy requests to another service with transformation',
    'local': 'Connect to local model servers and services',
  };
  return descriptions[type];
};

export const AdapterConfigEditor: React.FC<AdapterConfigEditorProps> = ({
  control,
  providerType,
  template,
  className,
}) => {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['basic']));
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleSection = useCallback((sectionId: string) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // Watch for Docker sandbox setting to show/hide related fields
  const dockerSandbox = useWatch({
    control,
    name: 'adapterConfig.dockerSandbox',
  });

  const authType = useWatch({
    control,
    name: 'adapterConfig.authType',
  });

  const renderSpawnCliConfig = () => {
    const sections: ConfigSection[] = [
      {
        id: 'basic',
        title: 'Command Configuration',
        description: 'Basic command execution settings',
        icon: Terminal,
        required: true,
        defaultOpen: true,
      },
      {
        id: 'sandbox',
        title: 'Docker Sandbox',
        description: 'Containerized execution for security',
        icon: Settings,
        required: false,
        defaultOpen: false,
      },
      {
        id: 'advanced',
        title: 'Advanced Settings',
        description: 'Environment and resource limits',
        icon: Settings,
        required: false,
        defaultOpen: false,
      },
    ];

    return (
      <div className="space-y-4">
        {sections.map((section) => (
          <Collapsible
            key={section.id}
            open={openSections.has(section.id)}
            onOpenChange={() => toggleSection(section.id)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-4 h-auto border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <section.icon className="h-4 w-4" />
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{section.title}</span>
                      {section.required && (
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </div>
                {openSections.has(section.id) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="space-y-4 pl-4">
                {section.id === 'basic' && (
                  <>
                    <FormField
                      control={control}
                      name="adapterConfig.command"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Command Path</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="/usr/local/bin/my-cli"
                              {...field}
                              className="font-mono"
                            />
                          </FormControl>
                          <FormDescription>
                            Full path to the executable command
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="adapterConfig.args"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Arguments</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="--json&#10;--verbose&#10;--config /path/to/config"
                              value={Array.isArray(field.value) ? field.value.join('\n') : ''}
                              onChange={(e) => 
                                field.onChange(e.target.value.split('\n').filter(Boolean))
                              }
                              rows={3}
                              className="font-mono text-sm"
                            />
                          </FormControl>
                          <FormDescription>
                            Command line arguments (one per line)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="adapterConfig.timeoutSeconds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timeout (seconds)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="300"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum execution time (1-300 seconds)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {section.id === 'sandbox' && (
                  <>
                    <FormField
                      control={control}
                      name="adapterConfig.dockerSandbox"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Docker Sandbox</FormLabel>
                            <FormDescription>
                              Run commands in isolated Docker containers for security
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

                    {dockerSandbox && (
                      <>
                        <FormField
                          control={control}
                          name="adapterConfig.sandboxImage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Docker Image</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="python:3.11-slim"
                                  {...field}
                                  className="font-mono"
                                />
                              </FormControl>
                              <FormDescription>
                                Docker image to use for sandboxed execution
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={control}
                            name="adapterConfig.memoryLimit"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Memory Limit</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="512m"
                                    {...field}
                                    className="font-mono"
                                  />
                                </FormControl>
                                <FormDescription>
                                  Memory limit (e.g., 512m, 1g)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={control}
                            name="adapterConfig.cpuLimit"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CPU Limit</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="0.5"
                                    {...field}
                                    className="font-mono"
                                  />
                                </FormControl>
                                <FormDescription>
                                  CPU limit (e.g., 0.5, 1.0)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}

                {section.id === 'advanced' && (
                  <>
                    <FormField
                      control={control}
                      name="adapterConfig.workingDirectory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Working Directory</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="/app"
                              {...field}
                              className="font-mono"
                            />
                          </FormControl>
                          <FormDescription>
                            Working directory for command execution
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <EnvironmentVariablesEditor control={control} />

                    <FormField
                      control={control}
                      name="adapterConfig.retryAttempts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Retry Attempts</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="5"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormDescription>
                            Number of retry attempts on failure (0-5)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );
  };

  const renderHttpSdkConfig = () => {
    return (
      <div className="space-y-6">
        {/* Basic Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <h4 className="font-medium">HTTP Configuration</h4>
          </div>

          <FormField
            control={control}
            name="adapterConfig.baseUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://api.example.com/v1"
                    {...field}
                    className="font-mono"
                  />
                </FormControl>
                <FormDescription>
                  Base URL for the HTTP API endpoint
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="adapterConfig.authType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Authentication Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select authentication type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="api-key">API Key</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                    <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Authentication method for API requests
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        {/* Headers Configuration */}
        <HeadersEditor control={control} />

        <Separator />

        {/* Advanced Settings */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span>Advanced Settings</span>
              {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={control}
                name="adapterConfig.timeoutSeconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timeout (seconds)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="300"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="adapterConfig.retryAttempts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Retry Attempts</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="5"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 3)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="adapterConfig.maxConcurrentRequests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Concurrent</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 10)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {authType === 'oauth2' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={control}
                  name="adapterConfig.region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region</FormLabel>
                      <FormControl>
                        <Input placeholder="us-east-1" {...field} />
                      </FormControl>
                      <FormDescription>
                        AWS region for OAuth authentication
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="adapterConfig.modelPrefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model Prefix</FormLabel>
                      <FormControl>
                        <Input placeholder="anthropic." {...field} />
                      </FormControl>
                      <FormDescription>
                        Prefix to add to model names
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  };

  const renderProxyConfig = () => {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <h4 className="font-medium">Proxy Configuration</h4>
          </div>

          <FormField
            control={control}
            name="adapterConfig.proxyUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Proxy URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://proxy.example.com/v1"
                    {...field}
                    className="font-mono"
                  />
                </FormControl>
                <FormDescription>
                  URL of the proxy server to forward requests to
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="adapterConfig.apiKeyHeaderName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API Key Header</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Authorization"
                    {...field}
                    className="font-mono"
                  />
                </FormControl>
                <FormDescription>
                  Header name for API key authentication
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <ForwardHeadersEditor control={control} />

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <h4 className="font-medium">Transformation Settings</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control}
              name="adapterConfig.transformRequest"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Transform Requests</FormLabel>
                    <FormDescription>
                      Apply request transformations
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
              name="adapterConfig.transformResponse"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Transform Responses</FormLabel>
                    <FormDescription>
                      Apply response transformations
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
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={control}
            name="adapterConfig.timeoutSeconds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timeout (seconds)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    max="300"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="adapterConfig.retryAttempts"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Retry Attempts</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    max="5"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 3)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="adapterConfig.maxConcurrentRequests"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Concurrent</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 10)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    );
  };

  const renderLocalConfig = () => {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            <h4 className="font-medium">Local Server Configuration</h4>
          </div>

          <FormField
            control={control}
            name="adapterConfig.localUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Server URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="http://localhost:11434"
                    {...field}
                    className="font-mono"
                  />
                </FormControl>
                <FormDescription>
                  URL of the local model server
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control}
              name="adapterConfig.protocol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Protocol</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select protocol" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="http">HTTP</SelectItem>
                      <SelectItem value="grpc">gRPC</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Communication protocol
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="adapterConfig.healthCheckPath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Health Check Path</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="/health"
                      {...field}
                      className="font-mono"
                    />
                  </FormControl>
                  <FormDescription>
                    Health check endpoint path
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={control}
            name="adapterConfig.modelPath"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model Path</FormLabel>
                <FormControl>
                  <Input
                    placeholder="/api/models"
                    {...field}
                    className="font-mono"
                  />
                </FormControl>
                <FormDescription>
                  API path for model operations (optional)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <h4 className="font-medium">Connection Settings</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control}
              name="adapterConfig.keepAlive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Keep Alive</FormLabel>
                    <FormDescription>
                      Maintain persistent connections
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
              name="adapterConfig.connectionPoolSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Connection Pool Size</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 5)}
                    />
                  </FormControl>
                  <FormDescription>
                    Number of pooled connections (1-50)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={control}
              name="adapterConfig.timeoutSeconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timeout (seconds)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="300"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="adapterConfig.retryAttempts"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Retry Attempts</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="5"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 3)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="adapterConfig.maxConcurrentRequests"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Concurrent</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 10)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>
    );
  };

  const AdapterIcon = getAdapterIcon(providerType);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AdapterIcon className="h-5 w-5" />
          Adapter Configuration
        </CardTitle>
        <CardDescription>
          {getAdapterDescription(providerType)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {template && (
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Configuration based on <strong>{template.name}</strong> template</span>
              {template.documentation?.apiDocsUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(template.documentation?.apiDocsUrl, '_blank')}
                >
                  API Docs
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {providerType === 'spawn-cli' && renderSpawnCliConfig()}
        {providerType === 'http-sdk' && renderHttpSdkConfig()}
        {providerType === 'proxy' && renderProxyConfig()}
        {providerType === 'local' && renderLocalConfig()}
      </CardContent>
    </Card>
  );
};

// Helper components for complex field types
const EnvironmentVariablesEditor: React.FC<{ control: Control<any> }> = ({ control }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'adapterConfig.environmentVariables',
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Environment Variables</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ key: '', value: '' })}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Variable
        </Button>
      </div>

      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-2">
          <Input
            placeholder="VARIABLE_NAME"
            {...control.register(`adapterConfig.environmentVariables.${index}.key`)}
            className="font-mono"
          />
          <Input
            placeholder="value"
            {...control.register(`adapterConfig.environmentVariables.${index}.value`)}
            className="font-mono"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => remove(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
};

const HeadersEditor: React.FC<{ control: Control<any> }> = ({ control }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'adapterConfig.headers',
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <Label>Custom Headers</Label>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ key: '', value: '' })}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Header
        </Button>
      </div>

      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-2">
          <Input
            placeholder="Header-Name"
            {...control.register(`adapterConfig.headers.${index}.key`)}
            className="font-mono"
          />
          <Input
            placeholder="header-value"
            {...control.register(`adapterConfig.headers.${index}.value`)}
            className="font-mono"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => remove(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
};

const ForwardHeadersEditor: React.FC<{ control: Control<any> }> = ({ control }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'adapterConfig.forwardHeaders',
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          <Label>Forward Headers</Label>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append('')}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Header
        </Button>
      </div>

      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-2">
          <Input
            placeholder="Header-Name"
            {...control.register(`adapterConfig.forwardHeaders.${index}`)}
            className="font-mono"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => remove(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
};

export default AdapterConfigEditor;