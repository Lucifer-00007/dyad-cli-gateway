/**
 * Security dashboard component for monitoring and managing security features
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  Lock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Settings,
  Eye,
  Clock,
  Zap
} from 'lucide-react';
import { useSecurity, SecurityStatus } from '@/contexts/security-context';
import { RateLimitIndicator, QuotaManager, useRateLimit } from '@/components/ui/rate-limit-indicator';
import { SecureProviderForm } from '@/components/ui/secure-form';
import { SecurityIndicator } from '@/components/ui/secure-content';

export const SecurityDashboard: React.FC = () => {
  const security = useSecurity();
  const [testFormData, setTestFormData] = useState({});
  const rateLimitStatus = useRateLimit('dashboard', 50, 60000);

  const handleTestFormSubmit = async (data: Record<string, unknown>) => {
    setTestFormData(data);
    security.reportSecurityIssue('Test form submitted successfully', 'low');
  };

  const handleSecurityAudit = () => {
    const issues = security.auditFormData(testFormData);
    if (issues.length > 0) {
      security.reportSecurityIssue(`Form audit found issues: ${issues.join(', ')}`, 'medium');
    } else {
      security.reportSecurityIssue('Form audit passed - no issues found', 'low');
    }
  };

  const mockQuotas = {
    requests: {
      used: 750,
      limit: 1000,
      period: 'hour' as const,
      resetTime: Date.now() + 3600000,
    },
    tokens: {
      used: 45000,
      limit: 100000,
      period: 'day' as const,
      resetTime: Date.now() + 86400000,
    },
    storage: {
      used: 2.5 * 1024 * 1024 * 1024, // 2.5GB
      limit: 5 * 1024 * 1024 * 1024,  // 5GB
      period: 'month' as const,
      resetTime: Date.now() + 30 * 86400000,
    },
  };

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Dashboard
              </CardTitle>
              <CardDescription>
                Monitor and manage application security features
              </CardDescription>
            </div>
            <SecurityStatus />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* HTTPS Status */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              {security.isSecureConnection ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <div className="font-medium">HTTPS</div>
                <div className="text-sm text-gray-600">
                  {security.isSecureConnection ? 'Secure' : 'Insecure'}
                </div>
              </div>
            </div>

            {/* CSRF Protection */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              {security.csrfToken ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <div className="font-medium">CSRF</div>
                <div className="text-sm text-gray-600">
                  {security.csrfToken ? 'Protected' : 'Not Protected'}
                </div>
              </div>
            </div>

            {/* XSS Protection */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              {security.securityReport.xssProtectionEnabled ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <div className="font-medium">XSS Protection</div>
                <div className="text-sm text-gray-600">
                  {security.securityReport.xssProtectionEnabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>
            </div>

            {/* Rate Limiting */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              {security.securityReport.rateLimitingEnabled ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <div className="font-medium">Rate Limiting</div>
                <div className="text-sm text-gray-600">
                  {security.securityReport.rateLimitingEnabled ? 'Active' : 'Inactive'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="monitoring" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monitoring">Security Monitoring</TabsTrigger>
          <TabsTrigger value="rate-limits">Rate Limits & Quotas</TabsTrigger>
          <TabsTrigger value="form-security">Form Security</TabsTrigger>
          <TabsTrigger value="settings">Security Settings</TabsTrigger>
        </TabsList>

        {/* Security Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Security Level */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Security Level</CardTitle>
                <CardDescription>Current application security level</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Current Level:</span>
                  <Badge variant={security.securityLevel === 'high' ? 'default' : 'destructive'}>
                    {security.securityLevel.toUpperCase()}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Security Score</span>
                    <span>
                      {security.securityLevel === 'high' ? '90%' : 
                       security.securityLevel === 'medium' ? '70%' : '40%'}
                    </span>
                  </div>
                  <Progress 
                    value={security.securityLevel === 'high' ? 90 : 
                           security.securityLevel === 'medium' ? 70 : 40}
                    className="h-2"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => security.updateSecurityLevel('low')}
                  >
                    Low
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => security.updateSecurityLevel('medium')}
                  >
                    Medium
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => security.updateSecurityLevel('high')}
                  >
                    High
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Security Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Security Actions</CardTitle>
                <CardDescription>Manage security features and settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={security.refreshCSRFToken}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh CSRF Token
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleSecurityAudit}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Audit Form Data
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={security.clearSecureStorage}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Clear Secure Storage
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => security.reportSecurityIssue('Test security alert', 'medium')}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Test Security Alert
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Rate Limits & Quotas Tab */}
        <TabsContent value="rate-limits" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rate Limit Status */}
            <RateLimitIndicator
              status={rateLimitStatus.status}
              variant="detailed"
              showDetails={true}
            />

            {/* Quota Management */}
            <QuotaManager
              quotas={mockQuotas}
              showUpgradeOption={true}
              onUpgrade={() => security.reportSecurityIssue('Upgrade requested', 'low')}
            />
          </div>
        </TabsContent>

        {/* Form Security Tab */}
        <TabsContent value="form-security" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Secure Form Demo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Secure Form Demo</CardTitle>
                <CardDescription>
                  Test form with security validation and sanitization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SecureProviderForm
                  onSubmit={handleTestFormSubmit}
                  className="space-y-4"
                />
              </CardContent>
            </Card>

            {/* Security Indicators */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Security Indicators</CardTitle>
                <CardDescription>
                  Examples of security status indicators
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Content Security Levels:</div>
                  <div className="space-y-2">
                    <SecurityIndicator level="safe" message="Content is secure and validated" />
                    <SecurityIndicator level="warning" message="Content may need attention" />
                    <SecurityIndicator level="danger" message="Content contains security risks" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Form Validation Status:</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Input sanitized and validated</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span>Input contains warnings</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span>Input failed security validation</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Security Configuration</CardTitle>
              <CardDescription>
                Current security settings and configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Security Report */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Security Features:</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span>CSRF Protection:</span>
                        <Badge variant={security.securityReport.csrfEnabled ? 'default' : 'destructive'}>
                          {security.securityReport.csrfEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>XSS Protection:</span>
                        <Badge variant={security.securityReport.xssProtectionEnabled ? 'default' : 'destructive'}>
                          {security.securityReport.xssProtectionEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>HTTPS Only:</span>
                        <Badge variant={security.securityReport.httpsOnly ? 'default' : 'destructive'}>
                          {security.securityReport.httpsOnly ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Secure Storage:</span>
                        <Badge variant={security.securityReport.secureStorageUsed ? 'default' : 'destructive'}>
                          {security.securityReport.secureStorageUsed ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Rate Limiting:</span>
                        <Badge variant={security.securityReport.rateLimitingEnabled ? 'default' : 'destructive'}>
                          {security.securityReport.rateLimitingEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Current Session:</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Security Level:</span>
                        <Badge>{security.securityLevel.toUpperCase()}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>CSRF Token:</span>
                        <Badge variant={security.csrfToken ? 'default' : 'destructive'}>
                          {security.csrfToken ? 'Present' : 'Missing'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Connection:</span>
                        <Badge variant={security.isSecureConnection ? 'default' : 'destructive'}>
                          {security.isSecureConnection ? 'Secure' : 'Insecure'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security Recommendations */}
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertTitle>Security Recommendations</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      {!security.isSecureConnection && (
                        <li>Enable HTTPS for secure communication</li>
                      )}
                      {!security.csrfToken && (
                        <li>Ensure CSRF tokens are properly configured</li>
                      )}
                      {security.securityLevel !== 'high' && (
                        <li>Consider upgrading to high security level for production</li>
                      )}
                      <li>Regularly audit form inputs and API responses</li>
                      <li>Monitor rate limits and quota usage</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};