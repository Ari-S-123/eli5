'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DemoGenerator } from '@/components/DemoGenerator';
import { DemoViewer } from '@/components/DemoViewer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Calendar,
  User,
  Tag,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { Id } from '@/convex/_generated/dataModel';
import { useState } from 'react';

/**
 * Paper detail page - View paper information and generate demos
 *
 * Features:
 * - Paper metadata display
 * - PDF preview link
 * - List of existing demos
 * - Generate new demo form
 * - Status indicators
 */
export default function PaperDetailPage({ params }: { params: { paperId: string } }) {
  const paperId = params.paperId as Id<'papers'>;
  const paper = useQuery(api.papers.getPaper, { paperId });
  const demos = useQuery(api.demos.listPaperDemos, { paperId });
  const [selectedDemoId, setSelectedDemoId] = useState<Id<'demos'> | null>(null);

  /**
   * Gets the appropriate status badge
   */
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'uploading':
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Uploading
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="secondary">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case 'ready':
        return (
          <Badge variant="default">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Ready
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  /**
   * Formats timestamp as readable date
   */
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Handles demo generation completion
   */
  const handleDemoGenerated = (demoId: Id<'demos'>) => {
    setSelectedDemoId(demoId);
  };

  // Loading state
  if (paper === undefined) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="space-y-8">
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // Paper not found
  if (paper === null) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <AlertCircle className="h-16 w-16 text-destructive" />
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg">Paper Not Found</h3>
              <p className="text-sm text-muted-foreground">
                The paper you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
              </p>
            </div>
            <Link href="/papers">
              <Button variant="outline">Back to Papers</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <Link href="/papers">
                <Button variant="ghost" size="sm">
                  ← Back
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{paper.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(paper._creationTime)}
              </div>
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {paper.fileName}
              </div>
            </div>
          </div>
          {getStatusBadge(paper.status)}
        </div>

        {paper.pdfUrl && (
          <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <ExternalLink className="mr-2 h-4 w-4" />
              View PDF
            </Button>
          </a>
        )}
      </div>

      <Separator />

      {/* Paper metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Paper Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {paper.metadata?.authors && paper.metadata.authors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4" />
                  Authors
                </div>
                <div className="text-sm text-muted-foreground">{paper.metadata.authors.join(', ')}</div>
              </div>
            )}

            {paper.metadata?.keywords && paper.metadata.keywords.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="h-4 w-4" />
                  Keywords
                </div>
                <div className="flex flex-wrap gap-2">
                  {paper.metadata.keywords.map((keyword, index) => (
                    <Badge key={index} variant="outline">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {paper.metadata?.abstract && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Abstract</div>
                <p className="text-sm text-muted-foreground line-clamp-6">{paper.metadata.abstract}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Demo Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Total Demos</div>
              <div className="text-3xl font-bold">{demos?.length ?? 0}</div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="text-sm font-medium">Ready Demos</div>
              <div className="text-3xl font-bold">{demos?.filter((d) => d.status === 'ready').length ?? 0}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error state */}
      {paper.status === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>There was an error processing this paper. Please try uploading it again.</AlertDescription>
        </Alert>
      )}

      {/* Processing state */}
      {paper.status === 'processing' && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Your paper is being processed. This may take a minute. You can generate demos once processing is complete.
          </AlertDescription>
        </Alert>
      )}

      {/* Demos section */}
      {paper.status === 'ready' && (
        <Tabs defaultValue="generate" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="generate">
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Demo
            </TabsTrigger>
            <TabsTrigger value="existing">Existing Demos ({demos?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="generate">
            <DemoGenerator paperId={paperId} onGenerateComplete={handleDemoGenerated} />
            {selectedDemoId && (
              <div className="mt-6">
                <DemoViewer demoId={selectedDemoId} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="existing">
            {demos === undefined ? (
              <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : demos.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                  <Sparkles className="h-16 w-16 text-muted-foreground" />
                  <div className="text-center space-y-2">
                    <h3 className="font-semibold text-lg">No demos yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Generate your first interactive demonstration for this paper
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {demos.map((demo) => (
                  <DemoViewer key={demo._id} demoId={demo._id} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
