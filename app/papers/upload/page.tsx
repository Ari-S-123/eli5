'use client';

import { PdfUploader } from '@/components/PdfUploader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Id } from '@/convex/_generated/dataModel';

/**
 * Upload page - Full-page interface for uploading PDF papers
 *
 * Features:
 * - Centered upload form
 * - Instructions and guidelines
 * - Auto-redirect after upload
 */
export default function UploadPage() {
  const router = useRouter();

  /**
   * Handles successful upload by redirecting to paper detail page
   */
  const handleUploadComplete = (paperId: Id<'papers'>) => {
    router.push(`/papers/${paperId}`);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Upload Academic Paper</h1>
          <p className="text-muted-foreground">
            Upload a PDF of an academic paper to generate interactive visual demonstrations
          </p>
        </div>

        {/* Instructions */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-2">Guidelines for best results:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Upload academic papers in PDF format only</li>
              <li>File size must be less than 10MB</li>
              <li>Papers with clear text formatting work best</li>
              <li>Processing may take a minute or two</li>
              <li>Once processed, you can generate interactive demos for any concept in the paper</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Upload Component */}
        <PdfUploader onUploadComplete={handleUploadComplete} />

        {/* Additional Info */}
        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>Your papers are securely stored and only accessible to you.</p>
          <p>After uploading, our AI will extract the content and metadata from your paper.</p>
        </div>
      </div>
    </div>
  );
}
