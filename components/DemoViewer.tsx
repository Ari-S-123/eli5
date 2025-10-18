'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ExternalLink, Copy, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Id } from '@/convex/_generated/dataModel';
import { useState } from 'react';

/**
 * Props for the DemoViewer component
 */
type DemoViewerProps = {
  demoId: Id<'demos'>;
};

/**
 * Component for viewing interactive demonstrations
 * 
 * Features:
 * - Status display with badges
 * - Iframe preview of demo
 * - Code viewer
 * - Copy code functionality
 * - Open in new tab
 * - Error display
 */
export function DemoViewer({ demoId }: DemoViewerProps) {
  const demo = useQuery(api.demos.getDemo, { demoId });
  const [copied, setCopied] = useState(false);

  /**
   * Copies the generated code to clipboard
   */
  const handleCopyCode = async () => {
    if (!demo?.generatedCode) return;

    try {
      await navigator.clipboard.writeText(demo.generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  /**
   * Opens the demo in a new tab
   */
  const handleOpenInNewTab = () => {
    if (!demo?.demoUrl) return;
    window.open(demo.demoUrl, '_blank');
  };

  /**
   * Gets the appropriate badge variant for the status
   */
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'generating':
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Generating
          </Badge>
        );
      case 'executing':
        return (
          <Badge variant="secondary">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Executing
          </Badge>
        );
      case 'ready':
        return (
          <Badge variant="default">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Ready
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Loading state
  if (!demo) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Generating or executing state
  if (demo.status === 'generating' || demo.status === 'executing') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Interactive Demo</CardTitle>
            {getStatusBadge(demo.status)}
          </div>
          <CardDescription>{demo.concept}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {demo.status === 'generating'
                ? 'Generating interactive demonstration...'
                : 'Executing code in sandbox environment...'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Failed state
  if (demo.status === 'failed') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Interactive Demo</CardTitle>
            {getStatusBadge(demo.status)}
          </div>
          <CardDescription>{demo.concept}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-2">Generation Failed</p>
              {demo.executionResults?.errors && demo.executionResults.errors.length > 0 ? (
                <pre className="text-xs whitespace-pre-wrap">
                  {demo.executionResults.errors.join('\n')}
                </pre>
              ) : (
                <p>An unknown error occurred while generating the demo.</p>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Ready state
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Interactive Demo</CardTitle>
          {getStatusBadge(demo.status)}
        </div>
        <CardDescription>{demo.concept}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="space-y-4">
            {demo.demoUrl ? (
              <>
                <div className="border rounded-lg overflow-hidden bg-background">
                  <iframe
                    src={demo.demoUrl}
                    className="w-full h-[600px] bg-white"
                    sandbox="allow-scripts allow-same-origin"
                    title="Demo Preview"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleOpenInNewTab} variant="default">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in New Tab
                  </Button>
                  <Button onClick={handleCopyCode} variant="outline">
                    <Copy className="mr-2 h-4 w-4" />
                    {copied ? 'Copied!' : 'Copy Code'}
                  </Button>
                </div>
              </>
            ) : (
              <Alert>
                <AlertDescription>
                  Demo is ready but the preview URL is not available. Try viewing the code instead.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="code" className="space-y-4">
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs max-h-[600px] overflow-y-auto">
                <code>{demo.generatedCode}</code>
              </pre>
              <Button
                onClick={handleCopyCode}
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
              >
                <Copy className="mr-2 h-3 w-3" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

