# SPEC.md: Academic Paper Visual Demo Generator

## Overview
A Next.js 15 application that allows authenticated users to upload academic PDFs (research papers), uses Anthropic Claude to generate interactive visual demonstrations of paper concepts, executes the generated code safely in Daytona sandboxes, and displays the results to users in real-time.

---

## Tech Stack

### Core Framework
- **Next.js 15** (App Router)
- **TypeScript** 
- **pnpm** (Package manager)
- **React 19** (included with Next.js 15)

### Authentication
- **WorkOS AuthKit** (`@workos-inc/authkit-nextjs`)
- Provides: User management, SSO, session handling, RBAC

### Database & Backend
- **Convex** (`convex`)
- Provides: Real-time database, serverless functions, file storage
- **Convex Agent Component** (`@convex-dev/agent`)
- Provides: AI agent orchestration with message history

### AI & Code Generation
- **Vercel AI SDK** (`ai`, `@ai-sdk/anthropic`)
- Provides: Streaming LLM responses, tool calling, structured outputs
- **Anthropic Claude Sonnet 4.5**
- Used for: PDF analysis, code generation, prompt engineering

### Sandbox Execution
- **Daytona TypeScript SDK** (`@daytonaio/sdk`)
- Provides: Secure code execution, isolated environments, file system access

### UI Components
- **Tailwind CSS** (Styling)
- **Radix UI** or **shadcn/ui** (Component library)
- **React PDF** (`react-pdf`) for PDF previews

---

## System Architecture

```
User → Next.js Frontend → Convex Backend → Anthropic API → Daytona Sandbox
     ← WorkOS Auth    ← Database/Files    ← Generated Code ← Execution Results
```

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                           │
│  (Next.js 15 App Router + React 19 + Tailwind)                  │
│                                                                   │
│  [Upload PDF] → [Generate Demo] → [View Results]                │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                      │
             ↓                                      ↓
┌────────────────────────────────┐   ┌─────────────────────────────┐
│     WorkOS AuthKit              │   │    Convex Backend           │
│  - Session Management           │   │  - File Storage             │
│  - User Authentication          │   │  - Database                 │
│  - RBAC                         │   │  - Actions/Mutations        │
└─────────────────────────────────┘   │  - Agent Component          │
                                      └────────┬────────────────────┘
                                               │
                                               ↓
                        ┌──────────────────────────────────────────┐
                        │      Vercel AI SDK + Anthropic           │
                        │  - PDF Content Extraction                │
                        │  - Code Generation (HTML/React/JS)       │
                        │  - Structured Output Parsing             │
                        └────────┬─────────────────────────────────┘
                                 │
                                 ↓
                        ┌────────────────────────────────────────┐
                        │       Daytona Sandbox                  │
                        │  - Execute Generated Code              │
                        │  - Capture Output/Screenshots          │
                        │  - Return Results                      │
                        └────────────────────────────────────────┘
```

---

## Database Schema (Convex)

### Tables

#### `users`
```typescript
{
  _id: Id<"users">,
  _creationTime: number,
  workosId: string,        // WorkOS user ID
  email: string,
  name: string,
  organizationId?: string, // WorkOS organization ID
}
```

#### `papers`
```typescript
{
  _id: Id<"papers">,
  _creationTime: number,
  userId: Id<"users">,
  title: string,
  fileName: string,
  fileStorageId: Id<"_storage">,  // Convex file storage reference
  pdfUrl?: string,                // Optional CDN URL
  status: "uploading" | "processing" | "ready" | "error",
  extractedContent?: string,      // Text content from PDF
  metadata?: {
    authors?: string[],
    abstract?: string,
    keywords?: string[],
  },
}
```

#### `demos`
```typescript
{
  _id: Id<"demos">,
  _creationTime: number,
  paperId: Id<"papers">,
  userId: Id<"users">,
  threadId?: string,              // Convex Agent thread ID
  concept: string,                // Main concept being demonstrated
  status: "generating" | "executing" | "ready" | "failed",
  generatedCode: string,          // HTML/React/JS code from Claude
  codeType: "html" | "react",
  executionResults?: {
    sandboxId: string,            // Daytona sandbox ID
    outputHtml?: string,          // Rendered HTML
    screenshot?: string,          // Base64 or URL
    logs?: string[],
    errors?: string[],
  },
  demoFileStorageId?: Id<"_storage">,  // Final demo HTML file
}
```

#### `agent_messages` (Convex Agent Component)
Auto-created by `@convex-dev/agent` for conversation history

#### `agent_threads` (Convex Agent Component)
Auto-created by `@convex-dev/agent` for thread management

---

## API Routes & Endpoints

### Next.js API Routes

#### `/api/auth/callback` (GET)
**Purpose:** WorkOS AuthKit callback handler
```typescript
import { handleAuth } from "@workos-inc/authkit-nextjs";
export const GET = handleAuth();
```

#### `/api/auth/signout` (GET)
**Purpose:** Sign out handler
```typescript
import { signOut } from "@workos-inc/authkit-nextjs";
export const GET = signOut();
```

### Convex Actions

#### `papers.uploadPaper` (action)
**Purpose:** Handle PDF upload and initial processing
```typescript
export const uploadPaper = action({
  args: {
    fileName: v.string(),
    fileData: v.bytes(), // PDF file data
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    
    // Store file in Convex storage
    const storageId = await ctx.storage.store(
      new Blob([args.fileData], { type: "application/pdf" })
    );
    
    // Create paper record
    const paperId = await ctx.runMutation(api.papers.create, {
      userId,
      fileName: args.fileName,
      fileStorageId: storageId,
      status: "processing",
    });
    
    // Extract PDF content using Anthropic
    const pdfUrl = await ctx.storage.getUrl(storageId);
    const extractedContent = await extractPdfContent(pdfUrl);
    
    // Update paper with extracted content
    await ctx.runMutation(api.papers.update, {
      paperId,
      extractedContent,
      status: "ready",
    });
    
    return { paperId };
  },
});
```

#### `demos.generateDemo` (action)
**Purpose:** Generate interactive demo code using Anthropic
```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { Agent } from "@convex-dev/agent";
import { components } from "./_generated/api";

export const generateDemo = action({
  args: {
    paperId: v.id("papers"),
    concept: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const paper = await ctx.runQuery(api.papers.get, { id: args.paperId });
    
    // Create agent for code generation
    const codeGenAgent = new Agent(components.agent, {
      name: "Code Generator",
      languageModel: anthropic.chat("claude-sonnet-4-20250514"),
      instructions: `You are an expert at creating interactive visual demonstrations 
        of academic paper concepts. Generate clean, self-contained HTML or React code 
        that visually demonstrates the key concept from the paper.`,
    });
    
    // Create thread for this demo generation
    const { threadId, thread } = await codeGenAgent.createThread(ctx);
    
    // Generate code
    const result = await thread.generateText({
      prompt: `
        Paper Title: ${paper.title}
        Paper Content: ${paper.extractedContent}
        
        Concept to Demonstrate: ${args.concept}
        
        Generate a complete, self-contained HTML file that visually demonstrates 
        this concept. The HTML should:
        - Include all CSS inline or in a <style> tag
        - Include all JavaScript inline or in a <script> tag
        - Be interactive and animated where appropriate
        - Work without any external dependencies
        - Be under 100KB total size
        
        Return ONLY the HTML code, no markdown or explanations.
      `,
    });
    
    // Create demo record
    const demoId = await ctx.runMutation(api.demos.create, {
      paperId: args.paperId,
      userId,
      threadId,
      concept: args.concept,
      generatedCode: result.text,
      codeType: "html",
      status: "executing",
    });
    
    // Execute in Daytona sandbox
    await ctx.scheduler.runAfter(0, api.demos.executeInSandbox, { demoId });
    
    return { demoId, threadId };
  },
});
```

#### `demos.executeInSandbox` (action)
**Purpose:** Execute generated code in Daytona sandbox
```typescript
import { Daytona } from "@daytonaio/sdk";

export const executeInSandbox = action({
  args: {
    demoId: v.id("demos"),
  },
  handler: async (ctx, args) => {
    const demo = await ctx.runQuery(api.demos.get, { id: args.demoId });
    
    // Initialize Daytona client
    const daytona = new Daytona({
      apiKey: process.env.DAYTONA_API_KEY,
      apiUrl: process.env.DAYTONA_API_URL,
    });
    
    try {
      // Create sandbox
      const sandbox = await daytona.create({
        language: "typescript",
        envVars: {
          NODE_ENV: "production",
        },
      });
      
      // Upload generated HTML to sandbox
      await sandbox.process.writeFile("demo.html", demo.generatedCode);
      
      // Start HTTP server to serve the HTML
      await sandbox.process.executeCommand(
        "npx -y http-server -p 8080 --cors"
      );
      
      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Capture screenshot (if Daytona supports it)
      // Alternative: fetch the HTML and store it
      const htmlResponse = await fetch(`${sandbox.baseUrl}:8080/demo.html`);
      const renderedHtml = await htmlResponse.text();
      
      // Store results
      const fileStorageId = await ctx.storage.store(
        new Blob([renderedHtml], { type: "text/html" })
      );
      
      // Update demo with results
      await ctx.runMutation(api.demos.update, {
        demoId: args.demoId,
        status: "ready",
        executionResults: {
          sandboxId: sandbox.id,
          outputHtml: renderedHtml,
        },
        demoFileStorageId: fileStorageId,
      });
      
      // Clean up sandbox
      await sandbox.destroy();
      
    } catch (error) {
      await ctx.runMutation(api.demos.update, {
        demoId: args.demoId,
        status: "failed",
        executionResults: {
          errors: [error.message],
        },
      });
    }
  },
});
```

### Convex Queries

#### `papers.listUserPapers` (query)
```typescript
export const listUserPapers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("papers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});
```

#### `demos.listPaperDemos` (query)
```typescript
export const listPaperDemos = query({
  args: { paperId: v.id("papers") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("demos")
      .withIndex("by_paper", (q) => q.eq("paperId", args.paperId))
      .order("desc")
      .collect();
  },
});
```

#### `demos.getDemoWithUrl` (query)
```typescript
export const getDemoWithUrl = query({
  args: { demoId: v.id("demos") },
  handler: async (ctx, args) => {
    const demo = await ctx.db.get(args.demoId);
    if (!demo) return null;
    
    // Get storage URL for the demo file
    const demoUrl = demo.demoFileStorageId
      ? await ctx.storage.getUrl(demo.demoFileStorageId)
      : null;
    
    return {
      ...demo,
      demoUrl,
    };
  },
});
```

---

## Frontend Implementation

### File Structure
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── callback/
│   │       └── route.ts
│   ├── (protected)/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── papers/
│   │   │   ├── page.tsx
│   │   │   ├── [paperId]/
│   │   │   │   └── page.tsx
│   │   │   └── upload/
│   │   │       └── page.tsx
│   │   └── demos/
│   │       └── [demoId]/
│   │           └── page.tsx
│   ├── layout.tsx
│   └── ConvexClientProvider.tsx
├── components/
│   ├── ui/              # shadcn components
│   ├── PdfUploader.tsx
│   ├── DemoGenerator.tsx
│   ├── DemoViewer.tsx
│   └── PaperCard.tsx
├── lib/
│   ├── convex.ts
│   └── utils.ts
└── middleware.ts
```

### Key Components

#### `ConvexClientProvider.tsx`
```typescript
"use client";

import { ConvexProviderWithAuthKit } from "convex/react-workos-authkit";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuthKit
      client={convex}
      workosClientId={process.env.NEXT_PUBLIC_WORKOS_CLIENT_ID!}
    >
      {children}
    </ConvexProviderWithAuthKit>
  );
}
```

#### `PdfUploader.tsx`
```typescript
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function PdfUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadPaper = useMutation(api.papers.uploadPaper);

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      const result = await uploadPaper({
        fileName: file.name,
        fileData: bytes,
      });
      
      // Redirect to paper page
      window.location.href = `/papers/${result.paperId}`;
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="block w-full text-sm"
      />
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {uploading ? "Uploading..." : "Upload PDF"}
      </button>
    </div>
  );
}
```

#### `DemoGenerator.tsx`
```typescript
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type Props = {
  paperId: Id<"papers">;
};

export function DemoGenerator({ paperId }: Props) {
  const [concept, setConcept] = useState("");
  const [generating, setGenerating] = useState(false);
  const generateDemo = useMutation(api.demos.generateDemo);

  const handleGenerate = async () => {
    if (!concept.trim()) return;
    
    setGenerating(true);
    try {
      const result = await generateDemo({
        paperId,
        concept,
      });
      
      // Redirect to demo page
      window.location.href = `/demos/${result.demoId}`;
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <textarea
        value={concept}
        onChange={(e) => setConcept(e.target.value)}
        placeholder="Describe the concept you want to visualize..."
        className="w-full h-32 p-3 border rounded"
      />
      <button
        onClick={handleGenerate}
        disabled={!concept.trim() || generating}
        className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
      >
        {generating ? "Generating..." : "Generate Demo"}
      </button>
    </div>
  );
}
```

#### `DemoViewer.tsx`
```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type Props = {
  demoId: Id<"demos">;
};

export function DemoViewer({ demoId }: Props) {
  const demo = useQuery(api.demos.getDemoWithUrl, { demoId });

  if (!demo) {
    return <div>Loading demo...</div>;
  }

  if (demo.status === "generating" || demo.status === "executing") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>{demo.status === "generating" ? "Generating code..." : "Executing in sandbox..."}</p>
        </div>
      </div>
    );
  }

  if (demo.status === "failed") {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4">
        <h3 className="text-red-800 font-semibold mb-2">Generation Failed</h3>
        <pre className="text-sm text-red-600">
          {demo.executionResults?.errors?.join("\n")}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-100 p-4 rounded">
        <h3 className="font-semibold mb-2">Concept</h3>
        <p>{demo.concept}</p>
      </div>
      
      {demo.demoUrl && (
        <div className="border rounded overflow-hidden">
          <iframe
            src={demo.demoUrl}
            className="w-full h-[600px] bg-white"
            sandbox="allow-scripts"
            title="Demo Preview"
          />
        </div>
      )}
      
      <div className="flex gap-4">
        <a
          href={demo.demoUrl || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Open in New Tab
        </a>
        <button
          onClick={() => {
            navigator.clipboard.writeText(demo.generatedCode);
          }}
          className="px-4 py-2 bg-gray-600 text-white rounded"
        >
          Copy Code
        </button>
      </div>
    </div>
  );
}
```

### Authentication Middleware (`middleware.ts`)

```typescript
import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware({
  debug: process.env.NODE_ENV === "development",
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ["/", "/login"],
  },
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
};
```

---

## Environment Variables

### `.env.local`
```bash
# Convex
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# WorkOS AuthKit
WORKOS_CLIENT_ID=
WORKOS_API_KEY=
WORKOS_COOKIE_PASSWORD= # Generate: openssl rand -base64 32
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/callback

# Anthropic
ANTHROPIC_API_KEY=

# Daytona
DAYTONA_API_KEY=
DAYTONA_API_URL=https://app.daytona.io/api
DAYTONA_TARGET=us

# Next.js
NODE_ENV=development
```

---

## Installation & Setup

### 1. Initialize Project
```bash
pnpm create next-app@latest atgen-demo --typescript --app --tailwind
cd atgen-demo
```

### 2. Install Dependencies
```bash
# Core dependencies
pnpm add convex @convex-dev/agent
pnpm add @workos-inc/authkit-nextjs
pnpm add ai @ai-sdk/anthropic
pnpm add @daytonaio/sdk

# UI dependencies
pnpm add @radix-ui/react-dialog @radix-ui/react-slot
pnpm add class-variance-authority clsx tailwind-merge
pnpm add lucide-react

# PDF handling
pnpm add react-pdf pdfjs-dist

# Dev dependencies
pnpm add -D @types/node
```

### 3. Configure Convex
```bash
pnpm convex dev
```

This will:
- Create a Convex deployment
- Generate `.env.local` with `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL`
- Create `convex/` directory

### 4. Install Convex Agent Component
```bash
# In convex/convex.config.ts
import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";

const app = defineApp();
app.use(agent);
export default app;
```

```bash
pnpm convex dev # Run again to generate agent types
```

### 5. Configure WorkOS
```bash
# Sign up at workos.com
# Get Client ID and API Key from dashboard
# Add to .env.local
# Configure redirect URI in WorkOS dashboard: http://localhost:3000/callback
```

### 6. Configure WorkOS with Convex
```bash
pnpm convex auth add workos
# This creates convex/auth.config.ts
```

### 7. Configure Daytona
```bash
# Sign up at daytona.io
# Get API key from dashboard
# Add to .env.local
```

### 8. Configure Next.js for Node Polyfills (for Daytona SDK)
```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
```

### 9. Run Development Server
```bash
# Terminal 1: Convex backend
pnpm convex dev

# Terminal 2: Next.js frontend
pnpm dev
```

---

## Security Considerations

### 1. Sandbox Isolation
- All user-generated code runs in isolated Daytona sandboxes
- No direct access to production environment
- Limited sandbox lifetime (auto-cleanup after execution)

### 2. Content Security Policy
```typescript
// middleware.ts - Add CSP headers
export function middleware(request: NextRequest) {
  const response = authkitMiddleware()(request);
  
  response.headers.set(
    "Content-Security-Policy",
    "frame-src 'self' https://*.convex.cloud; script-src 'self' 'unsafe-inline' 'unsafe-eval';"
  );
  
  return response;
}
```

### 3. File Upload Validation
```typescript
// Validate PDF files before upload
const validatePdf = (file: File): boolean => {
  // Check file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File too large");
  }
  
  // Check MIME type
  if (file.type !== "application/pdf") {
    throw new Error("Invalid file type");
  }
  
  return true;
};
```

### 4. Rate Limiting
```typescript
// Use Convex rate limiter component
import rateLimit from "@convex-dev/rate-limiter/convex.config";

app.use(rateLimit);

// In action:
await rateLimit.limit(ctx, {
  name: "demo_generation",
  key: userId,
  rate: { kind: "fixed-window", max: 10, period: "1h" },
});
```

---

## Cost Optimization

### 1. Anthropic API
- Use prompt caching for repeated paper content
- Set `max_tokens` appropriately (2000-4000 for code generation)
- Use Claude Sonnet 4 (cheaper) for simple demos, Opus for complex ones

### 2. Daytona Sandboxes
- Set timeout limits on sandbox execution (5-30 seconds)
- Destroy sandboxes immediately after use
- Pool sandboxes for multiple users if possible

### 3. Convex Storage
- Compress PDF files before storage
- Set TTL on temporary files (generated code, screenshots)
- Use CDN URLs for frequently accessed demos

---

## Testing Strategy

### Unit Tests
```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom
```

### Integration Tests
- Test Convex actions with `convex-test`
- Mock Anthropic API responses
- Mock Daytona sandbox execution

### E2E Tests
```bash
pnpm add -D playwright @playwright/test
```

---

## Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
vercel

# Configure environment variables in Vercel dashboard
# Enable Convex production deployment
pnpm convex deploy
```

### Environment Variables for Production
- Update `NEXT_PUBLIC_WORKOS_REDIRECT_URI` to production URL
- Update WorkOS redirect URIs in dashboard
- Update CORS settings in WorkOS dashboard
- Use production Anthropic API keys
- Use production Daytona API keys

---

## Monitoring & Observability

### 1. Convex Dashboard
- Monitor function execution times
- Track database queries
- View real-time logs

### 2. WorkOS Dashboard
- Monitor authentication events
- Track user sessions
- View audit logs

### 3. Custom Logging
```typescript
// Add structured logging
export const generateDemo = action({
  handler: async (ctx, args) => {
    console.log("Demo generation started", {
      paperId: args.paperId,
      userId,
      timestamp: Date.now(),
    });
    
    try {
      // ... generation logic
      console.log("Demo generation completed", {
        demoId,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      console.error("Demo generation failed", {
        error: error.message,
        paperId: args.paperId,
      });
      throw error;
    }
  },
});
```

---

## Future Enhancements

### Phase 2
- Support for multiple demo formats (D3.js, Three.js, Canvas API)
- Real-time collaboration on demos
- Demo versioning and history
- Community demo sharing

### Phase 3
- AI-powered demo suggestions based on paper content
- Automatic concept extraction from papers
- Multi-language support for generated code
- Integration with Jupyter notebooks for data visualizations

---

## Troubleshooting

### Common Issues

#### 1. Daytona SDK not working in browser
**Solution:** Ensure node polyfills are configured in `next.config.ts`

#### 2. WorkOS redirect not working
**Solution:** Verify redirect URI matches exactly in both `.env.local` and WorkOS dashboard

#### 3. Convex actions timing out
**Solution:** Increase timeout in `convex.json`:
```json
{
  "functions": {
    "demos.executeInSandbox": {
      "timeout": 300
    }
  }
}
```

#### 4. PDF upload failing
**Solution:** Check file size limits and MIME type validation

---

## Resources & Documentation

### Official Docs
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Convex Documentation](https://docs.convex.dev/)
- [WorkOS AuthKit Documentation](https://workos.com/docs/authkit)
- [Vercel AI SDK Documentation](https://ai-sdk.dev/)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Daytona Documentation](https://www.daytona.io/docs/)

### Example Repositories
- [WorkOS + Convex + Next.js Template](https://github.com/workos/template-convex-nextjs-authkit)
- [Convex Agent Examples](https://github.com/get-convex/agent)
- [Next.js B2B Starter Kit](https://github.com/workos/next-b2b-starter-kit)

---

## License
MIT
