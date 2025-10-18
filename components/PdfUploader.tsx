'use client';

import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Upload, FileText, X } from 'lucide-react';
import { Id } from '@/convex/_generated/dataModel';

/**
 * Props for the PdfUploader component
 */
type PdfUploaderProps = {
  onUploadComplete?: (paperId: Id<'papers'>) => void;
};

/**
 * Component for uploading PDF files with drag-and-drop support
 *
 * Features:
 * - File validation (PDF only, max 10MB)
 * - Drag and drop interface
 * - Upload progress indicator
 * - Error handling
 */
export function PdfUploader({ onUploadComplete }: PdfUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.papers.generateUploadUrl);
  const createPaper = useMutation(api.papers.createPaper);

  /**
   * Validates the selected file
   *
   * @param selectedFile - File to validate
   * @returns Error message or null if valid
   */
  const validateFile = (selectedFile: File): string | null => {
    if (!selectedFile.type || selectedFile.type !== 'application/pdf') {
      return 'Please select a valid PDF file';
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      return 'File size must be less than 10MB';
    }

    return null;
  };

  /**
   * Handles file selection
   */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        setFile(null);
      } else {
        setError(null);
        setFile(selectedFile);
      }
    }
  };

  /**
   * Handles drag over event
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  /**
   * Handles drag leave event
   */
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  /**
   * Handles file drop
   */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const validationError = validateFile(droppedFile);
      if (validationError) {
        setError(validationError);
        setFile(null);
      } else {
        setError(null);
        setFile(droppedFile);
      }
    }
  };

  /**
   * Handles the upload process
   */
  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: Get upload URL (10% progress)
      setProgress(10);
      const uploadUrl = await generateUploadUrl();

      // Step 2: Upload file to Convex storage (10% -> 70%)
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error('File upload failed');
      }

      const { storageId } = await response.json();
      setProgress(70);

      // Step 3: Create paper record (70% -> 90%)
      const paperId = await createPaper({
        fileName: file.name,
        fileStorageId: storageId,
        title: file.name.replace('.pdf', ''),
      });
      setProgress(90);

      // Step 4: Complete (100%)
      setProgress(100);

      // Reset state
      setTimeout(() => {
        setFile(null);
        setUploading(false);
        setProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        onUploadComplete?.(paperId);
      }, 500);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setUploading(false);
      setProgress(0);
    }
  };

  /**
   * Clears the selected file
   */
  const handleClear = () => {
    setFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Academic Paper</CardTitle>
        <CardDescription>Upload a PDF file (max 10MB) to generate interactive demonstrations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drag and drop area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
        >
          {!file ? (
            <div className="flex flex-col items-center gap-4">
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Drag and drop your PDF here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="pdf-upload"
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} type="button">
                Select File
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClear} disabled={uploading}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Progress bar */}
        {uploading && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground text-center">Uploading and processing... {progress}%</p>
          </div>
        )}

        {/* Upload button */}
        <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
          {uploading ? 'Uploading...' : 'Upload PDF'}
        </Button>
      </CardContent>
    </Card>
  );
}
