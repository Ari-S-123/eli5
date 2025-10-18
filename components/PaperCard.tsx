'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { FileText, Clock, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { Id } from '@/convex/_generated/dataModel';

/**
 * Props for the PaperCard component
 */
type PaperCardProps = {
  paper: {
    _id: Id<'papers'>;
    _creationTime: number;
    title: string;
    fileName: string;
    status: 'uploading' | 'processing' | 'ready' | 'error';
    metadata?: {
      authors?: string[];
      abstract?: string;
      keywords?: string[];
    };
  };
};

/**
 * Component for displaying paper information in a card format
 *
 * Features:
 * - Paper metadata display
 * - Status indicators
 * - Link to paper detail page
 * - Visual status badges
 */
export function PaperCard({ paper }: PaperCardProps) {
  /**
   * Gets the appropriate status badge for the paper
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
   * Formats the creation time as a readable date
   */
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1">
            <FileText className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg line-clamp-2">{paper.title}</CardTitle>
              <CardDescription className="mt-1">Uploaded {formatDate(paper._creationTime)}</CardDescription>
            </div>
          </div>
          {getStatusBadge(paper.status)}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metadata */}
        {paper.metadata && (
          <div className="space-y-2 text-sm">
            {paper.metadata.authors && paper.metadata.authors.length > 0 && (
              <div>
                <span className="font-medium text-muted-foreground">Authors: </span>
                <span className="text-foreground">{paper.metadata.authors.slice(0, 3).join(', ')}</span>
                {paper.metadata.authors.length > 3 && (
                  <span className="text-muted-foreground"> +{paper.metadata.authors.length - 3} more</span>
                )}
              </div>
            )}

            {paper.metadata.keywords && paper.metadata.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {paper.metadata.keywords.slice(0, 5).map((keyword, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
                {paper.metadata.keywords.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{paper.metadata.keywords.length - 5}
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* File name */}
        <p className="text-xs text-muted-foreground truncate">{paper.fileName}</p>

        {/* Action button */}
        <Link href={`/papers/${paper._id}`} className="block">
          <Button variant="outline" className="w-full">
            <ExternalLink className="mr-2 h-4 w-4" />
            View Details
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
