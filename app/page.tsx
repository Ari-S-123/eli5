'use client';

import { Authenticated, Unauthenticated } from 'convex/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, FileText, Wand2, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Home/Landing page
 * 
 * For authenticated users: Redirects to dashboard
 * For unauthenticated users: Shows landing page with sign in/up
 */
export default function Home() {
  const router = useRouter();

  return (
    <>
      <Authenticated>
        <RedirectToDashboard />
      </Authenticated>
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
    </>
  );
}

/**
 * Redirects authenticated users to dashboard
 */
function RedirectToDashboard() {
  const router = useRouter();

  useEffect(() => {
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="container mx-auto py-16 px-4 flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Redirecting to dashboard...</p>
    </div>
  );
}

/**
 * Landing page for unauthenticated users
 */
function LandingPage() {
  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-5xl mx-auto space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <Sparkles className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight">
            ELI5
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform academic papers into interactive visual demonstrations. 
            Upload PDFs and let AI generate engaging visualizations of complex concepts.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Link href="/sign-up">
              <Button size="lg">
                Get Started
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <FileText className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Upload Papers</CardTitle>
              <CardDescription>
                Upload academic PDFs and our AI automatically extracts and analyzes the content
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Wand2 className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Generate Demos</CardTitle>
              <CardDescription>
                Describe any concept from the paper and AI generates interactive visualizations
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CheckCircle className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Learn Better</CardTitle>
              <CardDescription>
                View interactive demonstrations that make complex concepts easy to understand
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* How it works */}
        <div className="space-y-6 text-center">
          <h2 className="text-3xl font-bold">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    1
                  </div>
                </div>
                <CardTitle className="text-lg">Upload PDF</CardTitle>
                <CardDescription>
                  Upload any academic paper in PDF format
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    2
                  </div>
                </div>
                <CardTitle className="text-lg">AI Analysis</CardTitle>
                <CardDescription>
                  Our AI analyzes and extracts key information
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    3
                  </div>
                </div>
                <CardTitle className="text-lg">Describe Concept</CardTitle>
                <CardDescription>
                  Tell us what concept you want to visualize
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    4
                  </div>
                </div>
                <CardTitle className="text-lg">View Demo</CardTitle>
                <CardDescription>
                  Get an interactive visual demonstration
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* CTA */}
        <Card className="border-primary">
          <CardContent className="pt-6 text-center space-y-4">
            <h2 className="text-2xl font-bold">Ready to get started?</h2>
            <p className="text-muted-foreground">
              Sign up now and start generating interactive demonstrations from your academic papers
            </p>
            <Link href="/sign-up">
              <Button size="lg">
                Create Free Account
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
