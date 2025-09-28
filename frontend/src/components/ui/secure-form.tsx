/**
 * Secure form components with comprehensive validation and sanitization
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useForm, UseFormReturn, FieldValues, Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertTriangle, Eye, EyeOff, Lock, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSecurityValidation, securitySchemas, SecurityAuditor, CSRFProtection } from '@/lib/security';

interface SecureFormFieldProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  type?: 'text' | 'password' | 'email' | 'url' | 'textarea' | 'command' | 'json';
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showSecurityIndicator?: boolean;
  maxLength?: number;
  sanitizationType?: 'text' | 'html' | 'command' | 'url' | 'json' | 'filePath' | 'envVar';
}

/**
 * Secure form field with validation and sanitization
 */
export function SecureFormField<T extends FieldValues>({
  form,
  name,
  label,
  type = 'text',
  placeholder,
  description,
  required = false,
  disabled = false,
  className,
  showSecurityIndicator = false,
  maxLength,
  sanitizationType = 'text',
}: SecureFormFieldProps<T>) {
  const [showPassword, setShowPassword] = useState(false);
  const [securityLevel, setSecurityLevel] = useState<'safe' | 'warning' | 'danger'>('safe');
  const { validateInput, sanitizeInput } = useSecurityValidation();

  const fieldValue = form.watch(name);
  const fieldError = form.formState.errors[name];

  // Security validation
  const validateSecurity = useCallback((value: string) => {
    if (!value) {
      setSecurityLevel('safe');
      return;
    }

    const issues = SecurityAuditor.auditFormData({ [name]: value });
    if (issues.length > 0) {
      setSecurityLevel('danger');
    } else if (value.length > (maxLength || 1000) * 0.8) {
      setSecurityLevel('warning');
    } else {
      setSecurityLevel('safe');
    }
  }, [name, maxLength]);

  // Handle input change with sanitization
  const handleChange = useCallback((value: string) => {
    const sanitized = sanitizeInput(value, sanitizationType);
    form.setValue(name, sanitized as T[Path<T>]);
    validateSecurity(sanitized);
  }, [form, name, sanitizeInput, sanitizationType, validateSecurity]);

  const securityIndicatorColor = useMemo(() => {
    switch (securityLevel) {
      case 'safe':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'danger':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }, [securityLevel]);

  const renderInput = () => {
    const commonProps = {
      id: name,
      placeholder,
      disabled,
      className: cn(
        'transition-colors',
        fieldError && 'border-red-500 focus:border-red-500',
        securityLevel === 'danger' && 'border-red-300',
        className
      ),
      value: fieldValue || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        handleChange(e.target.value);
      },
      maxLength,
    };

    switch (type) {
      case 'password':
        return (
          <div className="relative">
            <Input
              {...commonProps}
              type={showPassword ? 'text' : 'password'}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        );
      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            rows={4}
          />
        );
      default:
        return (
          <Input
            {...commonProps}
            type={type}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={name} className={cn(required && 'after:content-["*"] after:ml-0.5 after:text-red-500')}>
          {label}
        </Label>
        {showSecurityIndicator && fieldValue && (
          <div className={cn('flex items-center gap-1 px-2 py-1 rounded border text-xs', securityIndicatorColor)}>
            <Shield className="h-3 w-3" />
            <span>
              {securityLevel === 'safe' ? 'Secure' : 
               securityLevel === 'warning' ? 'Warning' : 'Unsafe'}
            </span>
          </div>
        )}
      </div>
      
      {renderInput()}
      
      {description && (
        <p className="text-sm text-gray-600">{description}</p>
      )}
      
      {fieldError && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          {fieldError.message as string}
        </p>
      )}
      
      {maxLength && fieldValue && (
        <div className="flex justify-end">
          <span className={cn(
            'text-xs',
            fieldValue.length > maxLength * 0.9 ? 'text-red-600' : 'text-gray-500'
          )}>
            {fieldValue.length}/{maxLength}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Secure form wrapper with CSRF protection
 */
interface SecureFormProps<T extends FieldValues> {
  schema: z.ZodSchema<T>;
  onSubmit: (data: T) => Promise<void> | void;
  children: (form: UseFormReturn<T>) => React.ReactNode;
  defaultValues?: Partial<T>;
  className?: string;
  enableCSRF?: boolean;
  showSecurityAudit?: boolean;
  title?: string;
  description?: string;
}

export function SecureForm<T extends FieldValues>({
  schema,
  onSubmit,
  children,
  defaultValues,
  className,
  enableCSRF = true,
  showSecurityAudit = false,
  title,
  description,
}: SecureFormProps<T>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [securityIssues, setSecurityIssues] = useState<string[]>([]);
  const [csrfToken, setCsrfToken] = useState<string>('');

  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onChange',
  });

  // Initialize CSRF token
  React.useEffect(() => {
    if (enableCSRF) {
      const token = CSRFProtection.getToken();
      setCsrfToken(token);
    }
  }, [enableCSRF]);

  // Security audit
  const auditFormData = useCallback((data: T) => {
    const issues = SecurityAuditor.auditFormData(data as Record<string, unknown>);
    setSecurityIssues(issues);
    return issues.length === 0;
  }, []);

  const handleSubmit = form.handleSubmit(async (data) => {
    setIsSubmitting(true);
    
    try {
      // Security audit
      if (showSecurityAudit && !auditFormData(data)) {
        throw new Error('Security validation failed');
      }

      // CSRF validation
      if (enableCSRF && !CSRFProtection.isValidToken(csrfToken)) {
        throw new Error('CSRF token validation failed');
      }

      await onSubmit(data);
    } catch (error) {
      console.error('Form submission error:', error);
      form.setError('root', {
        type: 'manual',
        message: error instanceof Error ? error.message : 'Submission failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  });

  const formContent = (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      {enableCSRF && (
        <input type="hidden" name="_csrf" value={csrfToken} />
      )}
      
      {children(form)}
      
      {form.formState.errors.root && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Submission Error</AlertTitle>
          <AlertDescription>
            {form.formState.errors.root.message}
          </AlertDescription>
        </Alert>
      )}
      
      {showSecurityAudit && securityIssues.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Security Issues Detected</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {securityIssues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enableCSRF && (
            <Badge variant="outline" className="text-xs">
              <Lock className="mr-1 h-3 w-3" />
              CSRF Protected
            </Badge>
          )}
          {showSecurityAudit && securityIssues.length === 0 && form.formState.isDirty && (
            <Badge variant="outline" className="text-xs text-green-600">
              <CheckCircle className="mr-1 h-3 w-3" />
              Security Validated
            </Badge>
          )}
        </div>
        
        <Button
          type="submit"
          disabled={isSubmitting || !form.formState.isValid}
          className="min-w-[100px]"
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </Button>
      </div>
    </form>
  );

  if (title || description) {
    return (
      <Card className={className}>
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          {formContent}
        </CardContent>
      </Card>
    );
  }

  return formContent;
}

/**
 * Provider configuration form with security validation
 */
interface ProviderFormData {
  name: string;
  slug: string;
  type: 'spawn-cli' | 'http-sdk' | 'proxy' | 'local';
  description?: string;
  command?: string;
  baseUrl?: string;
  apiKey?: string;
}

const providerFormSchema = z.object({
  name: securitySchemas.providerName,
  slug: securitySchemas.providerSlug,
  type: z.enum(['spawn-cli', 'http-sdk', 'proxy', 'local']),
  description: securitySchemas.safeText.optional(),
  command: securitySchemas.command.optional(),
  baseUrl: securitySchemas.url.optional(),
  apiKey: securitySchemas.apiKey.optional(),
});

interface SecureProviderFormProps {
  onSubmit: (data: ProviderFormData) => Promise<void>;
  defaultValues?: Partial<ProviderFormData>;
  className?: string;
}

export const SecureProviderForm: React.FC<SecureProviderFormProps> = ({
  onSubmit,
  defaultValues,
  className,
}) => {
  return (
    <SecureForm
      schema={providerFormSchema}
      onSubmit={onSubmit}
      defaultValues={defaultValues}
      className={className}
      enableCSRF={true}
      showSecurityAudit={true}
      title="Provider Configuration"
      description="Configure a new AI provider with security validation"
    >
      {(form) => (
        <>
          <SecureFormField
            form={form}
            name="name"
            label="Provider Name"
            required
            showSecurityIndicator
            maxLength={100}
            description="A human-readable name for the provider"
          />
          
          <SecureFormField
            form={form}
            name="slug"
            label="Provider Slug"
            required
            showSecurityIndicator
            maxLength={50}
            description="A unique identifier (lowercase, hyphens only)"
          />
          
          <SecureFormField
            form={form}
            name="description"
            label="Description"
            type="textarea"
            maxLength={500}
            description="Optional description of the provider"
          />
          
          {form.watch('type') === 'spawn-cli' && (
            <SecureFormField
              form={form}
              name="command"
              label="Command"
              required
              showSecurityIndicator
              sanitizationType="command"
              maxLength={500}
              description="Command to execute for this provider"
            />
          )}
          
          {(form.watch('type') === 'http-sdk' || form.watch('type') === 'proxy') && (
            <>
              <SecureFormField
                form={form}
                name="baseUrl"
                label="Base URL"
                type="url"
                required
                showSecurityIndicator
                sanitizationType="url"
                maxLength={2000}
                description="Base URL for the provider API"
              />
              
              <SecureFormField
                form={form}
                name="apiKey"
                label="API Key"
                type="password"
                showSecurityIndicator
                maxLength={100}
                description="API key for authentication (will be encrypted)"
              />
            </>
          )}
        </>
      )}
    </SecureForm>
  );
};

/**
 * Secure JSON editor component
 */
interface SecureJsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  showSecurityIndicator?: boolean;
}

export const SecureJsonEditor: React.FC<SecureJsonEditorProps> = ({
  value,
  onChange,
  label,
  placeholder = '{}',
  className,
  maxLength = 10000,
  showSecurityIndicator = true,
}) => {
  const [isValid, setIsValid] = useState(true);
  const [securityLevel, setSecurityLevel] = useState<'safe' | 'warning' | 'danger'>('safe');
  const { sanitizeInput } = useSecurityValidation();

  const validateJson = useCallback((jsonString: string) => {
    try {
      if (jsonString.trim()) {
        JSON.parse(jsonString);
      }
      setIsValid(true);
    } catch {
      setIsValid(false);
    }
  }, []);

  const validateSecurity = useCallback((jsonString: string) => {
    const issues = SecurityAuditor.auditFormData({ json: jsonString });
    setSecurityLevel(issues.length > 0 ? 'danger' : 'safe');
  }, []);

  const handleChange = useCallback((newValue: string) => {
    const sanitized = sanitizeInput(newValue, 'json');
    onChange(sanitized);
    validateJson(sanitized);
    validateSecurity(sanitized);
  }, [onChange, sanitizeInput, validateJson, validateSecurity]);

  const securityIndicatorColor = useMemo(() => {
    switch (securityLevel) {
      case 'safe':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'danger':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }, [securityLevel]);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {showSecurityIndicator && value && (
          <div className={cn('flex items-center gap-1 px-2 py-1 rounded border text-xs', securityIndicatorColor)}>
            <Shield className="h-3 w-3" />
            <span>{securityLevel === 'safe' ? 'Secure JSON' : 'Security Warning'}</span>
          </div>
        )}
      </div>
      
      <Textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'font-mono text-sm',
          !isValid && 'border-red-500',
          securityLevel === 'danger' && 'border-red-300'
        )}
        rows={8}
        maxLength={maxLength}
      />
      
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {isValid ? (
            <span className="text-green-600 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Valid JSON
            </span>
          ) : (
            <span className="text-red-600 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Invalid JSON
            </span>
          )}
        </div>
        
        <span className={cn(
          value.length > maxLength * 0.9 ? 'text-red-600' : 'text-gray-500'
        )}>
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
};