'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PaperCard } from '@/components/PaperCard';
import { Upload, FileText, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Dashboard page - Landing page for authenticated users
 *
 * Features:
 * - Welcome message
 * - Quick stats
 * - Recent papers list
 * - Upload new paper button
 */
export default function DashboardPage() {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const papers = useQuery(api.papers.listUserPapers, {});
  const ensureUser = useMutation(api.users.ensureUser);

  // Ensure user exists on first load
  useEffect(() => {
    if (currentUser === null) {
      ensureUser();
    }
  }, [currentUser, ensureUser]);

  const recentPapers = papers?.slice(0, 6) ?? [];

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome back{currentUser?.name ? `, ${currentUser.name}` : ''}!
        </h1>
        <p className="text-muted-foreground">
          Upload academic papers and generate interactive visual demonstrations to better understand complex concepts.
        </p>
      </div>

      <Separator />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Papers</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{papers?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">Uploaded academic papers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready Papers</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{papers?.filter((p) => p.status === 'ready').length ?? 0}</div>
            <p className="text-xs text-muted-foreground">Papers ready for demo generation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Generate Demos</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Link href="/papers/upload">
              <Button className="w-full mt-1">
                <Upload className="mr-2 h-4 w-4" />
                Upload Paper
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Recent Papers */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Recent Papers</h2>
            <p className="text-sm text-muted-foreground">Your most recently uploaded academic papers</p>
          </div>
          {papers && papers.length > 0 && (
            <Link href="/papers">
              <Button variant="outline">View All</Button>
            </Link>
          )}
        </div>

        {!papers ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="h-64 animate-pulse bg-muted" />
            ))}
          </div>
        ) : papers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">No papers yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Upload your first academic paper to start generating interactive demonstrations
                </p>
              </div>
              <Link href="/papers/upload">
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Your First Paper
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentPapers.map((paper) => (
              <PaperCard key={paper._id} paper={paper} />
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Browse Papers</CardTitle>
            <CardDescription>View and manage all your uploaded papers</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/papers">
              <Button variant="outline" className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                View All Papers
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload New Paper</CardTitle>
            <CardDescription>Add a new academic paper to your library</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/papers/upload">
              <Button className="w-full">
                <Upload className="mr-2 h-4 w-4" />
                Upload Paper
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
