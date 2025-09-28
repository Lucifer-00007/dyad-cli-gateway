import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Edit, 
  Play, 
  Power, 
  PowerOff, 
  Trash2, 
  Activity, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Eye,
  Copy,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { Provider } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useDeleteConfirmation, useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { 
  useDeleteProvider, 
  useToggleProvider, 
  useTestProvider,
  useProviderHealth 
} from '@/hooks/api/use-providers';
import { ProviderTestDialog, HealthCheckConfig, TestHistoryViewer } from '@/components/providers';
import { formatDistanceToNow, format } from 'date-fns';

interface ProviderDetailProps {
  provider: Provider;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const ProviderDetail: React.FC<ProviderDetailProps> = ({
  provider,
  onEdit,
  onDelete,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [healthConfigOpen, setHealthConfigOpen] = useState(false);
  const [testHistoryOpen, setTestHistoryOpen] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestingProvider, setIsTestingProvider] = useState(false);

  const { showDeleteConfirmation, ConfirmationDialog: DeleteDialog } = useDeleteConfirmation();
  const { showConfirmation, ConfirmationDialog: ToggleDialog } = useConfirmationDialog();

  // API hooks
  const deleteProviderMutation = useDeleteProvider();
  const toggleProviderMutation = useToggleProvider();
  const testProviderMutation = useTestProvider();
  const { data: healthData, refetch: refetchHealth } = useProviderHealth(provider.id);

  const handleEdit = () => {
    if (onEdit) {
      onEdit();
    } else {
      navigate(`/providers/${provider.id}/edit`);
    }
  };

  const handleDelete = () => {
    showDeleteConfirmation(
      `provider "${provider.name}"`,
      async () => {
        try {
          await deleteProviderMutation.mutateAsync(provider.id);
          toast({
            title: 'Provider deleted',
            description: `${provider.name} has been successfully deleted.`,
          });
          if (onDelete) {
            onDelete();
          } else {
            navigate('/providers');
          }
        } catch (error) {
          toast({
            title: 'Delete failed',
            description: 'Failed to delete provider. Please try again.',
            variant: 'destructive',
          });
        }
      },
      {
        description: `This will permanently delete the provider "${provider.name}" and all its configurations. This action cannot be undone.`,
      }
    );
  };

  const handleToggle = () => {
    const action = provider.enabled ? 'disable' : 'enable';
    const actionTitle = provider.enabled ? 'Disable Provider' : 'Enable Provider';
    
    showConfirmation({
      title: actionTitle,
      description: `Are you sure you want to ${action} "${provider.name}"? ${
        provider.enabled 
          ? 'This will stop all requests to this provider.' 
          : 'This will allow requests to be sent to this provider.'
      }`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      variant: provider.enabled ? 'warning' : 'default',
      onConfirm: async () => {
        try {
          await toggleProviderMutation.mutateAsync({ 
            id: provider.id, 
            enabled: !provider.enabled 
          });
          toast({
            title: `Provider ${action}d`,
            description: `${provider.name} has been ${action}d.`,
          });
        } catch (error) {
          toast({
            title: `Failed to ${action} provider`,
            description: `Could not ${action} ${provider.name}. Please try again.`,
            variant: 'destructive',
          });
        }
      },
    });
  };

  const handleTest = async () => {
    setIsTestingProvider(true);
    setTestResult(null);
    
    try {
      const result = await testProviderMutation.mutateAsync({ 
        id: provider.id, 
        dryRun: false 
      });
      
      setTestResult(result);
      
      if (result.status === 'success') {
        toast({
          title: 'Test successful',
          description: `${provider.name} responded successfully in ${result.duration}ms.`,
        });
      } else {
        toast({
          title: 'Test failed',
          description: result.error?.message || 'Provider test failed.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Test error',
        description: 'Failed to test provider. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsTestingProvider(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      description: 'Text has been copied to your clipboard.',
    });
  };

  const getStatusIcon = () => {
    if (!provider.enabled) {
      return <PowerOff className="h-5 w-5 text-muted-foreground" />;
    }
    
    switch (provider.healthStatus?.status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'unhealthy':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = () => {
    if (!provider.enabled) {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    
    switch (provider.healthStatus?.status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">Healthy</Badge>;
      case 'unhealthy':
        return <Badge variant="destructive">Unhealthy</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatLastChecked = () => {
    if (!provider.healthStatus?.lastChecked) {
      return 'Never';
    }
    
    try {
      return formatDistanceToNow(new Date(provider.healthStatus.lastChecked), { 
        addSuffix: true 
      });
    } catch {
      return 'Unknown';
    }
  };

  const renderAdapterConfig = () => {
    const config = provider.adapterConfig;
    
    switch (provider.type) {
      case 'spawn-cli':
        return (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Command</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 px-2 py-1 bg-muted rounded text-sm font-mono">
                  {config.command || 'Not configured'}
                </code>
                {config.command && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(config.command)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            {config.args && config.args.length > 0 && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Arguments</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 px-2 py-1 bg-muted rounded text-sm font-mono">
                    {config.args.join(' ')}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(config.args.join(' '))}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Docker Sandbox</label>
                <div className="mt-1">
                  <Badge variant={config.dockerSandbox ? 'default' : 'secondary'}>
                    {config.dockerSandbox ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Timeout</label>
                <div className="mt-1">
                  <span className="text-sm">{config.timeoutSeconds || 30}s</span>
                </div>
              </div>
            </div>
            
            {config.dockerSandbox && config.sandboxImage && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Sandbox Image</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 px-2 py-1 bg-muted rounded text-sm font-mono">
                    {config.sandboxImage}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(config.sandboxImage)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        );

      case 'http-sdk':
        return (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Base URL</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 px-2 py-1 bg-muted rounded text-sm font-mono">
                  {config.baseUrl || 'Not configured'}
                </code>
                {config.baseUrl && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(config.baseUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(config.baseUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Timeout</label>
              <div className="mt-1">
                <span className="text-sm">{config.timeoutSeconds || 30}s</span>
              </div>
            </div>
            
            {config.headers && Object.keys(config.headers).length > 0 && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Custom Headers</label>
                <div className="mt-1">
                  <pre className="px-2 py-1 bg-muted rounded text-xs font-mono overflow-x-auto">
                    {JSON.stringify(config.headers, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );

      case 'proxy':
        return (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Proxy URL</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 px-2 py-1 bg-muted rounded text-sm font-mono">
                  {config.proxyUrl || 'Not configured'}
                </code>
                {config.proxyUrl && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(config.proxyUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(config.proxyUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Timeout</label>
              <div className="mt-1">
                <span className="text-sm">{config.timeoutSeconds || 30}s</span>
              </div>
            </div>
          </div>
        );

      case 'local':
        return (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Local URL</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 px-2 py-1 bg-muted rounded text-sm font-mono">
                  {config.localUrl || 'Not configured'}
                </code>
                {config.localUrl && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(config.localUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(config.localUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Health Check Path</label>
                <div className="mt-1">
                  <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                    {config.healthCheckPath || '/health'}
                  </code>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Timeout</label>
                <div className="mt-1">
                  <span className="text-sm">{config.timeoutSeconds || 30}s</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div className="text-sm text-muted-foreground">No configuration available</div>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <h1 className="text-2xl font-semibold tracking-tight">{provider.name}</h1>
            {getStatusBadge()}
          </div>
          {provider.description && (
            <p className="text-muted-foreground">{provider.description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            disabled={!provider.enabled}
            onClick={() => setTestDialogOpen(true)}
          >
            <Play className="h-4 w-4 mr-2" />
            Test Provider
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => setHealthConfigOpen(true)}
          >
            <Activity className="h-4 w-4 mr-2" />
            Health Check
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => setTestHistoryOpen(true)}
          >
            <Clock className="h-4 w-4 mr-2" />
            Test History
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleToggle}
            disabled={toggleProviderMutation.isPending}
          >
            {provider.enabled ? (
              <>
                <PowerOff className="h-4 w-4 mr-2" />
                Disable
              </>
            ) : (
              <>
                <Power className="h-4 w-4 mr-2" />
                Enable
              </>
            )}
          </Button>
          
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={provider.enabled || deleteProviderMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Provider Type</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">
                  {provider.type.replace('-', ' ')}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Models</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {provider.models?.length || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last Health Check</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-sm">
                  {formatLastChecked()}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <div className="mt-1 font-medium">{provider.name}</div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Slug</label>
                  <div className="mt-1 font-mono text-sm">{provider.slug}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <div className="mt-1 text-sm">
                    {format(new Date(provider.createdAt), 'PPP')}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                  <div className="mt-1 text-sm">
                    {format(new Date(provider.updatedAt), 'PPP')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Mappings</CardTitle>
              <CardDescription>
                Mapping between Dyad model IDs and provider-specific model IDs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {provider.models && provider.models.length > 0 ? (
                <div className="space-y-4">
                  {provider.models.map((model, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Dyad Model ID</label>
                          <div className="mt-1 font-mono text-sm">{model.dyadModelId}</div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Provider Model ID</label>
                          <div className="mt-1 font-mono text-sm">{model.adapterModelId}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        {model.maxTokens && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Max Tokens</label>
                            <div className="mt-1 text-sm">{model.maxTokens.toLocaleString()}</div>
                          </div>
                        )}
                        
                        {model.contextWindow && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Context Window</label>
                            <div className="mt-1 text-sm">{model.contextWindow.toLocaleString()}</div>
                          </div>
                        )}
                        
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Streaming</label>
                          <div className="mt-1">
                            <Badge variant={model.supportsStreaming ? 'default' : 'secondary'}>
                              {model.supportsStreaming ? 'Supported' : 'Not Supported'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Embeddings</label>
                          <div className="mt-1">
                            <Badge variant={model.supportsEmbeddings ? 'default' : 'secondary'}>
                              {model.supportsEmbeddings ? 'Supported' : 'Not Supported'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No model mappings configured
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Adapter Configuration</CardTitle>
              <CardDescription>
                Configuration specific to the {provider.type.replace('-', ' ')} adapter
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderAdapterConfig()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Health Status</CardTitle>
                <CardDescription>
                  Current health status and monitoring information
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchHealth()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {getStatusIcon()}
                <div>
                  <div className="font-medium">
                    {provider.healthStatus?.status || 'Unknown'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Last checked: {formatLastChecked()}
                  </div>
                </div>
              </div>
              
              {provider.healthStatus?.errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {provider.healthStatus.errorMessage}
                  </AlertDescription>
                </Alert>
              )}
              
              {healthData && (
                <div className="space-y-2">
                  <h4 className="font-medium">Latest Health Check</h4>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
                    {JSON.stringify(healthData, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DeleteDialog />
      <ToggleDialog />
      
      {/* New comprehensive testing dialogs */}
      <ProviderTestDialog
        provider={provider}
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
      />
      
      <HealthCheckConfig
        provider={provider}
        open={healthConfigOpen}
        onOpenChange={setHealthConfigOpen}
      />
      
      <TestHistoryViewer
        provider={provider}
        open={testHistoryOpen}
        onOpenChange={setTestHistoryOpen}
      />
    </div>
  );
};