/**
 * Secure credential management component with input masking and validation
 * Provides a user-friendly interface for managing sensitive provider credentials
 */

import React, { useState, useCallback } from 'react';
import { useFieldArray, Control, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Key,
  Shield,
  AlertTriangle,
  Info,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProviderTemplate } from '@/lib/templates/provider-templates';

interface CredentialField {
  key: string;
  value: string;
  type: 'text' | 'password' | 'url';
  masked: boolean;
}

interface CredentialManagerProps {
  control: Control<unknown>;
  template?: ProviderTemplate;
  className?: string;
}

export const CredentialManager: React.FC<CredentialManagerProps> = ({
  control,
  template,
  className,
}) => {
  const [showAllCredentials, setShowAllCredentials] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [customCredentials, setCustomCredentials] = useState<CredentialField[]>([]);

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'credentials',
  });

  // Watch for changes to detect if credentials are being used
  const credentialsValue = useWatch({
    control,
    name: 'credentials',
  });

  const hasCredentials = credentialsValue && Object.keys(credentialsValue).length > 0;

  const toggleCredentialVisibility = useCallback((index: number) => {
    const field = customCredentials[index];
    if (field) {
      const updatedField = { ...field, masked: !field.masked };
      const newCredentials = [...customCredentials];
      newCredentials[index] = updatedField;
      setCustomCredentials(newCredentials);
    }
  }, [customCredentials]);

  const copyToClipboard = useCallback(async (text: string, fieldKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, []);

  const addCustomCredential = useCallback(() => {
    setCustomCredentials(prev => [
      ...prev,
      {
        key: '',
        value: '',
        type: 'text',
        masked: false,
      },
    ]);
  }, []);

  const removeCustomCredential = useCallback((index: number) => {
    setCustomCredentials(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateCustomCredential = useCallback((index: number, field: Partial<CredentialField>) => {
    setCustomCredentials(prev => {
      const newCredentials = [...prev];
      newCredentials[index] = { ...newCredentials[index], ...field };
      return newCredentials;
    });
  }, []);

  const renderTemplateCredentials = () => {
    if (!template?.credentials) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-green-600" />
          <h4 className="font-medium">Required Credentials</h4>
          <Badge variant="outline" className="text-xs">
            Template
          </Badge>
        </div>

        {template.credentials.map((credentialConfig, index) => (
          <FormField
            key={credentialConfig.key}
            control={control}
            name={`credentials.${credentialConfig.key}`}
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="flex items-center gap-2">
                    {credentialConfig.label}
                    {credentialConfig.required && (
                      <Badge variant="destructive" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </FormLabel>
                  {credentialConfig.type === 'password' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCredentialVisibility(index)}
                    >
                      {customCredentials[index]?.masked ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      type={
                        credentialConfig.type === 'password' && 
                        customCredentials[index]?.masked !== false
                          ? 'password'
                          : 'text'
                      }
                      placeholder={credentialConfig.placeholder}
                      className={cn(
                        credentialConfig.type === 'password' && 'pr-20',
                        'font-mono text-sm'
                      )}
                    />
                    {credentialConfig.type === 'password' && field.value && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                        onClick={() => copyToClipboard(field.value, credentialConfig.key)}
                      >
                        {copiedField === credentialConfig.key ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </FormControl>
                <FormDescription className="flex items-start gap-2">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span className="text-xs">{credentialConfig.description}</span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        {template.documentation?.setupUrl && (
          <Alert>
            <ExternalLink className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Need help getting your credentials?</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.open(template.documentation?.setupUrl, '_blank')}
              >
                Setup Guide
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  const renderCustomCredentials = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-blue-600" />
            <h4 className="font-medium">Custom Credentials</h4>
            <Badge variant="outline" className="text-xs">
              Optional
            </Badge>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustomCredential}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Credential
          </Button>
        </div>

        {customCredentials.length === 0 ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Add custom credentials if your provider requires additional authentication parameters.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {customCredentials.map((credential, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Custom Credential {index + 1}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCustomCredential(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Key</Label>
                    <Input
                      placeholder="api_key"
                      value={credential.key}
                      onChange={(e) =>
                        updateCustomCredential(index, { key: e.target.value })
                      }
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={credential.type}
                      onValueChange={(value: 'text' | 'password' | 'url') =>
                        updateCustomCredential(index, { type: value })
                      }
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="password">Password</SelectItem>
                        <SelectItem value="url">URL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Value</Label>
                      {credential.type === 'password' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleCredentialVisibility(index)}
                        >
                          {credential.masked ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        type={
                          credential.type === 'password' && credential.masked
                            ? 'password'
                            : 'text'
                        }
                        placeholder="Enter value..."
                        value={credential.value}
                        onChange={(e) =>
                          updateCustomCredential(index, { value: e.target.value })
                        }
                        className="text-sm font-mono pr-8"
                      />
                      {credential.value && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                          onClick={() => copyToClipboard(credential.value, `custom-${index}`)}
                        >
                          {copiedField === `custom-${index}` ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderJsonEditor = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-purple-600" />
          <h4 className="font-medium">JSON Editor</h4>
          <Badge variant="outline" className="text-xs">
            Advanced
          </Badge>
        </div>

        <FormField
          control={control}
          name="credentials"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Credentials (JSON)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='{"api_key": "your-key", "secret": "your-secret"}'
                  value={field.value ? JSON.stringify(field.value, null, 2) : ''}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value || '{}');
                      field.onChange(parsed);
                    } catch {
                      // Invalid JSON, keep the current value
                    }
                  }}
                  rows={6}
                  className="font-mono text-sm"
                />
              </FormControl>
              <FormDescription>
                Enter credentials as a JSON object. Values will be encrypted when saved.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Credentials
            </CardTitle>
            <CardDescription>
              Manage API keys and authentication credentials for this provider
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllCredentials(!showAllCredentials)}
                >
                  {showAllCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showAllCredentials ? 'Hide credentials' : 'Show credentials'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!showAllCredentials && hasCredentials ? (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Credentials are configured and hidden for security.</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAllCredentials(true)}
              >
                <Eye className="h-4 w-4 mr-1" />
                Show
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Security Notice */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Security Notice:</strong> Credentials are encrypted when saved and never logged. 
                Only enter credentials from trusted sources.
              </AlertDescription>
            </Alert>

            {/* Template-based credentials */}
            {template?.credentials && (
              <>
                {renderTemplateCredentials()}
                <Separator />
              </>
            )}

            {/* Custom credentials */}
            {renderCustomCredentials()}
            
            <Separator />

            {/* JSON editor for advanced users */}
            {renderJsonEditor()}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CredentialManager;