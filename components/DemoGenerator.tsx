'use client';

import { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription } from './ui/alert';
import { Wand2 } from 'lucide-react';
import { Id } from '@/convex/_generated/dataModel';

/**
 * Props for the DemoGenerator component
 */
type DemoGeneratorProps = {
  paperId: Id<'papers'>;
  onGenerateComplete?: (demoId: Id<'demos'>) => void;
};

/**
 * Component for generating interactive demonstrations from paper concepts
 * 
 * Features:
 * - Concept description input
 * - Loading states during generation
 * - Error handling
 */
export function DemoGenerator({ paperId, onGenerateComplete }: DemoGeneratorProps) {
  const [concept, setConcept] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateDemo = useAction(api.demos.generateDemo);

  /**
   * Handles the demo generation process
   */
  const handleGenerate = async () => {
    if (!concept.trim()) {
      setError('Please describe the concept you want to visualize');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const demoId = await generateDemo({
        paperId,
        concept: concept.trim(),
      });

      // Reset form
      setConcept('');
      setGenerating(false);

      // Notify parent component
      onGenerateComplete?.(demoId);
    } catch (err) {
      console.error('Demo generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate demo. Please try again.');
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Interactive Demo</CardTitle>
        <CardDescription>
          Describe a concept from the paper that you&apos;d like to see visualized
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {generating ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wand2 className="h-4 w-4 animate-spin" />
              <span>Generating your interactive demo... This may take a minute.</span>
            </div>
          </div>
        ) : (
          <>
            <Textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Example: Visualize the gradient descent algorithm mentioned in section 3..."
              className="min-h-32 resize-none"
              disabled={generating}
            />

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button onClick={handleGenerate} disabled={!concept.trim() || generating} className="w-full">
              <Wand2 className="mr-2 h-4 w-4" />
              {generating ? 'Generating...' : 'Generate Demo'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

