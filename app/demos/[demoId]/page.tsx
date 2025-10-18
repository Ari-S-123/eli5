'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { DemoViewer } from '@/components/DemoViewer';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Id } from '@/convex/_generated/dataModel';
import { use } from 'react';

/**
 * Demo detail page - Full-screen viewer for a specific demo
 *
 * Features:
 * - Full-screen demo viewer
 * - Back navigation
 * - Error handling
 */
export default function DemoDetailPage({ params }: { params: Promise<{ demoId: string }> }) {
  const { demoId: demoIdParam } = use(params);
  const demoId = demoIdParam as Id<'demos'>;
  const demo = useQuery(api.demos.getDemo, { demoId });

  // Loading state
  if (demo === undefined) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="space-y-8">
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // Demo not found
  if (demo === null) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <AlertCircle className="h-16 w-16 text-destructive" />
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg">Demo Not Found</h3>
              <p className="text-sm text-muted-foreground">
                The demo you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
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
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href={`/papers/${demo.paperId}`}>
          <Button variant="ghost" size="sm">
            ← Back to Paper
          </Button>
        </Link>
      </div>

      {/* Demo Viewer */}
      <DemoViewer demoId={demoId} />
    </div>
  );
}
