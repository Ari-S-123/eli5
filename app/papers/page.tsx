'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PaperCard } from '@/components/PaperCard';
import { Upload, Search, FileText, Filter } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Papers page - List all papers for the current user
 * 
 * Features:
 * - Grid display of papers
 * - Search functionality
 * - Filter by status
 * - Empty state
 * - Upload button
 */
export default function PapersPage() {
  const papers = useQuery(api.papers.listUserPapers, {});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filter papers based on search and status
  const filteredPapers = papers?.filter((paper) => {
    const matchesSearch =
      !searchQuery ||
      paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      paper.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      paper.metadata?.authors?.some((author) =>
        author.toLowerCase().includes(searchQuery.toLowerCase())
      ) ||
      paper.metadata?.keywords?.some((keyword) =>
        keyword.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesStatus = statusFilter === 'all' || paper.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusCount = (status: string) => {
    if (!papers) return 0;
    if (status === 'all') return papers.length;
    return papers.filter((p) => p.status === status).length;
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Papers Library</h1>
          <p className="text-muted-foreground">
            Manage your uploaded academic papers and generate demonstrations
          </p>
        </div>
        <Link href="/papers/upload">
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload Paper
          </Button>
        </Link>
      </div>

      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search papers by title, author, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Filter className="mr-2 h-4 w-4" />
                  Status: {statusFilter === 'all' ? 'All' : statusFilter}
                  <Badge variant="secondary" className="ml-2">
                    {getStatusCount(statusFilter)}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                  <DropdownMenuRadioItem value="all">
                    All ({getStatusCount('all')})
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="ready">
                    Ready ({getStatusCount('ready')})
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="processing">
                    Processing ({getStatusCount('processing')})
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="error">
                    Error ({getStatusCount('error')})
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Papers Grid */}
      {!papers ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-80 animate-pulse bg-muted" />
          ))}
        </div>
      ) : filteredPapers && filteredPapers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <FileText className="h-16 w-16 text-muted-foreground" />
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg">
                {papers.length === 0 ? 'No papers yet' : 'No papers found'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {papers.length === 0
                  ? 'Upload your first academic paper to start generating interactive demonstrations'
                  : 'Try adjusting your search or filter criteria'}
              </p>
            </div>
            {papers.length === 0 ? (
              <Link href="/papers/upload">
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Your First Paper
                </Button>
              </Link>
            ) : (
              <Button variant="outline" onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}>
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPapers?.map((paper) => (
            <PaperCard key={paper._id} paper={paper} />
          ))}
        </div>
      )}
    </div>
  );
}

