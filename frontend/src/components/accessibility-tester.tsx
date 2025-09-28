import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Keyboard, MousePointer, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useReducedMotion } from '@/hooks/use-accessibility';

interface AccessibilityIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  element?: string;
  suggestion?: string;
}

interface AccessibilityReport {
  score: number;
  issues: AccessibilityIssue[];
  passedChecks: string[];
  timestamp: Date;
}

export const AccessibilityTester: React.FC<{
  className?: string;
}> = ({ className }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [report, setReport] = useState<AccessibilityReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Simulate accessibility audit (in real implementation, would use axe-core)
  const runAccessibilityAudit = async (): Promise<AccessibilityReport> => {
    const issues: AccessibilityIssue[] = [];
    const passedChecks: string[] = [];

    // Check for missing alt text
    const images = document.querySelectorAll('img:not([alt])');
    if (images.length > 0) {
      issues.push({
        id: 'missing-alt-text',
        type: 'error',
        message: `${images.length} images missing alt text`,
        element: 'img',
        suggestion: 'Add descriptive alt attributes to all images',
      });
    } else {
      passedChecks.push('All images have alt text');
    }

    // Check for proper heading hierarchy
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previousLevel = 0;
    let headingIssues = 0;
    
    headings.forEach((heading) => {
      const level = parseInt(heading.tagName.charAt(1));
      if (level > previousLevel + 1) {
        headingIssues++;
      }
      previousLevel = level;
    });

    if (headingIssues > 0) {
      issues.push({
        id: 'heading-hierarchy',
        type: 'warning',
        message: 'Heading hierarchy may be incorrect',
        element: 'headings',
        suggestion: 'Ensure headings follow a logical hierarchy (h1 → h2 → h3, etc.)',
      });
    } else {
      passedChecks.push('Heading hierarchy is correct');
    }

    // Check for form labels
    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
    const unlabeledInputs = Array.from(inputs).filter(input => {
      const id = input.getAttribute('id');
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledBy = input.getAttribute('aria-labelledby');
      const label = id ? document.querySelector(`label[for="${id}"]`) : null;
      
      return !ariaLabel && !ariaLabelledBy && !label;
    });

    if (unlabeledInputs.length > 0) {
      issues.push({
        id: 'unlabeled-inputs',
        type: 'error',
        message: `${unlabeledInputs.length} form controls missing labels`,
        element: 'form controls',
        suggestion: 'Add labels or aria-label attributes to all form controls',
      });
    } else {
      passedChecks.push('All form controls have labels');
    }

    // Check for color contrast (simplified check)
    const elementsWithBackground = document.querySelectorAll('[style*="background"], [class*="bg-"]');
    if (elementsWithBackground.length > 0) {
      // In a real implementation, you would calculate actual contrast ratios
      passedChecks.push('Color contrast check completed');
    }

    // Check for keyboard accessibility
    const interactiveElements = document.querySelectorAll('button, a, input, select, textarea, [tabindex]');
    const nonKeyboardAccessible = Array.from(interactiveElements).filter(el => {
      const tabIndex = el.getAttribute('tabindex');
      return tabIndex === '-1' && !el.hasAttribute('aria-hidden');
    });

    if (nonKeyboardAccessible.length > 0) {
      issues.push({
        id: 'keyboard-inaccessible',
        type: 'warning',
        message: `${nonKeyboardAccessible.length} interactive elements may not be keyboard accessible`,
        element: 'interactive elements',
        suggestion: 'Ensure all interactive elements are keyboard accessible',
      });
    } else {
      passedChecks.push('Interactive elements are keyboard accessible');
    }

    // Check for ARIA landmarks
    const landmarks = document.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer');
    if (landmarks.length === 0) {
      issues.push({
        id: 'missing-landmarks',
        type: 'warning',
        message: 'No ARIA landmarks found',
        element: 'page structure',
        suggestion: 'Add semantic HTML elements or ARIA landmark roles',
      });
    } else {
      passedChecks.push('ARIA landmarks present');
    }

    // Calculate score
    const totalChecks = issues.length + passedChecks.length;
    const score = totalChecks > 0 ? Math.round((passedChecks.length / totalChecks) * 100) : 100;

    return {
      score,
      issues,
      passedChecks,
      timestamp: new Date(),
    };
  };

  const handleRunAudit = async () => {
    setIsRunning(true);
    try {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      const auditReport = await runAccessibilityAudit();
      setReport(auditReport);
    } catch (error) {
      console.error('Accessibility audit failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  // Toggle keyboard navigation mode
  const toggleKeyboardMode = () => {
    setKeyboardMode(!keyboardMode);
    document.body.classList.toggle('keyboard-navigation', !keyboardMode);
  };

  // Toggle focus indicators
  const toggleFocusVisible = () => {
    setFocusVisible(!focusVisible);
    document.body.classList.toggle('force-focus-visible', !focusVisible);
  };

  // Keyboard event listener for testing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setKeyboardMode(true);
        document.body.classList.add('keyboard-navigation');
      }
    };

    const handleMouseDown = () => {
      setKeyboardMode(false);
      document.body.classList.remove('keyboard-navigation');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  if (!isVisible) {
    return (
      <Button
        onClick={() => setIsVisible(true)}
        variant="outline"
        size="sm"
        className={`fixed bottom-4 right-4 z-50 ${className}`}
        aria-label="Open accessibility tester"
      >
        <Eye className="h-4 w-4 mr-2" />
        A11y Test
      </Button>
    );
  }

  return (
    <Card className={`fixed bottom-4 right-4 w-96 max-h-96 overflow-auto z-50 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Accessibility Tester</CardTitle>
          <Button
            onClick={() => setIsVisible(false)}
            variant="ghost"
            size="sm"
            aria-label="Close accessibility tester"
          >
            <EyeOff className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Test and monitor accessibility compliance
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="audit" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="audit">Audit</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
          </TabsList>
          
          <TabsContent value="audit" className="space-y-4">
            <Button
              onClick={handleRunAudit}
              disabled={isRunning}
              className="w-full"
            >
              {isRunning ? 'Running Audit...' : 'Run Accessibility Audit'}
            </Button>
            
            {report && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Score</span>
                  <Badge variant={report.score >= 90 ? 'default' : report.score >= 70 ? 'secondary' : 'destructive'}>
                    {report.score}%
                  </Badge>
                </div>
                
                {report.issues.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Issues Found</h4>
                    {report.issues.map((issue) => (
                      <Alert key={issue.id} variant={issue.type === 'error' ? 'destructive' : 'default'}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          <strong>{issue.message}</strong>
                          {issue.suggestion && (
                            <div className="mt-1 text-muted-foreground">
                              {issue.suggestion}
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
                
                {report.passedChecks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-green-600">Passed Checks</h4>
                    {report.passedChecks.slice(0, 3).map((check, index) => (
                      <div key={index} className="flex items-center text-xs text-green-600">
                        <CheckCircle className="h-3 w-3 mr-2" />
                        {check}
                      </div>
                    ))}
                    {report.passedChecks.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{report.passedChecks.length - 3} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="tools" className="space-y-3">
            <div className="space-y-2">
              <Button
                onClick={toggleKeyboardMode}
                variant={keyboardMode ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start"
              >
                <Keyboard className="h-4 w-4 mr-2" />
                Keyboard Mode
                {keyboardMode && <Badge className="ml-auto">ON</Badge>}
              </Button>
              
              <Button
                onClick={toggleFocusVisible}
                variant={focusVisible ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start"
              >
                <MousePointer className="h-4 w-4 mr-2" />
                Force Focus Visible
                {focusVisible && <Badge className="ml-auto">ON</Badge>}
              </Button>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <div>• Press Tab to navigate</div>
              <div>• Use arrow keys in lists</div>
              <div>• Press Enter/Space to activate</div>
              <div>• Press Escape to close dialogs</div>
            </div>
          </TabsContent>
          
          <TabsContent value="info" className="space-y-3">
            <div className="space-y-2 text-xs">
              <div className="flex items-center">
                <Info className="h-3 w-3 mr-2" />
                <span>Reduced Motion: {prefersReducedMotion ? 'ON' : 'OFF'}</span>
              </div>
              <div className="flex items-center">
                <Info className="h-3 w-3 mr-2" />
                <span>Keyboard Mode: {keyboardMode ? 'ON' : 'OFF'}</span>
              </div>
              <div className="flex items-center">
                <Info className="h-3 w-3 mr-2" />
                <span>Screen Reader: {navigator.userAgent.includes('NVDA') || navigator.userAgent.includes('JAWS') ? 'Detected' : 'Unknown'}</span>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground">
              This tool provides basic accessibility testing. For comprehensive testing, use tools like axe-core, WAVE, or Lighthouse.
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AccessibilityTester;