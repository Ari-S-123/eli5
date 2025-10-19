# ELI5 - Academic Paper Visual Demo Generator

Transform academic papers into interactive visual demonstrations using AI.

## Overview

ELI5 is a Next.js application that allows authenticated users to upload academic PDFs, automatically extracts content using Anthropic's Claude AI, and generates interactive visual demonstrations of complex concepts from the papers. The generated code is executed in secure Daytona sandboxes to provide safe, isolated execution.

## TODO:

- Fix Daytona Sandbox.
- Improve UI/UX.

## Features

- **PDF Upload & Analysis**: Upload academic papers and let AI extract content, authors, abstract, and keywords
- **AI-Powered Demo Generation**: Describe any concept from a paper and generate interactive HTML visualizations
- **Secure Code Execution**: All generated code runs in isolated Daytona sandboxes
- **Real-time Updates**: Live status updates using Convex real-time database
- **User Authentication**: Secure authentication via WorkOS AuthKit
- **Modern UI**: Beautiful, responsive interface built with Shadcn UI components

## Tech Stack

### Core Framework

- **Next.js 15** (App Router)
- **TypeScript**
- **React 19**
- **Tailwind CSS**

### Authentication

- **WorkOS AuthKit** - User management and SSO

### Database & Backend

- **Convex** - Real-time database and serverless functions
- File storage for PDFs and generated demos

### AI & Code Generation

- **Vercel AI SDK** - Streaming LLM responses
- **Anthropic Claude Sonnet 4.5** - PDF analysis and code generation
- Uses Anthropic's PDF analyzing skill for superior document understanding

### Sandbox Execution

- **Daytona SDK** - Secure, isolated code execution environment

### UI Components

- **Shadcn UI** - Beautiful, accessible component library
- **Lucide React** - Icon library

## Getting Started

### Prerequisites

- Node.js 18+ installed
- pnpm package manager
- Accounts and API keys for:
  - Convex (https://convex.dev)
  - WorkOS (https://workos.com)
  - Anthropic (https://console.anthropic.com)
  - Daytona (https://daytona.io)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd eli5
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory:

   ```bash
   # Convex
   CONVEX_DEPLOYMENT=<your-convex-deployment>
   NEXT_PUBLIC_CONVEX_URL=<your-convex-url>

   # WorkOS AuthKit
   WORKOS_CLIENT_ID=<your-workos-client-id>
   WORKOS_API_KEY=<your-workos-api-key>
   WORKOS_COOKIE_PASSWORD=<generate-with: openssl rand -base64 32>
   NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/callback

   # Anthropic
   ANTHROPIC_API_KEY=<your-anthropic-api-key>

   # Daytona
   DAYTONA_API_KEY=<your-daytona-api-key>
   DAYTONA_API_URL=https://api.daytona.io
   DAYTONA_TARGET=us

   # Next.js
   NODE_ENV=development
   ```

4. **Configure WorkOS**
   - Go to your WorkOS dashboard
   - Add the redirect URI: `http://localhost:3000/callback`
   - Configure authentication settings

5. **Set up Convex**

   ```bash
   pnpx convex dev
   ```

   This will:
   - Create a Convex deployment
   - Generate the database schema
   - Start the Convex development server

6. **Run the development server**

   Open two terminals:

   **Terminal 1** (Convex backend):

   ```bash
   pnpx convex dev
   ```

   **Terminal 2** (Next.js frontend):

   ```bash
   pnpm dev
   ```

7. **Open your browser**

   Navigate to `http://localhost:3000`

## Project Structure

```
eli5/
├── app/                          # Next.js App Router pages
│   ├── dashboard/               # User dashboard
│   ├── papers/                  # Paper management
│   │   ├── [paperId]/          # Paper detail page
│   │   └── upload/             # Upload new paper
│   ├── demos/                   # Demo viewer
│   │   └── [demoId]/           # Individual demo page
│   ├── layout.tsx              # Root layout with navigation
│   └── page.tsx                # Landing page
├── components/                  # React components
│   ├── ui/                     # Shadcn UI components
│   ├── ConvexClientProvider.tsx
│   ├── DemoGenerator.tsx        # Generate demos form
│   ├── DemoViewer.tsx          # View demos
│   ├── Navigation.tsx          # Main navigation bar
│   ├── PaperCard.tsx           # Paper display card
│   └── PdfUploader.tsx         # PDF upload component
├── convex/                      # Convex backend
│   ├── _generated/             # Auto-generated types
│   ├── demos.ts                # Demo generation & execution
│   ├── papers.ts               # PDF upload & processing
│   ├── schema.ts               # Database schema
│   └── users.ts                # User management
├── lib/                         # Utility functions
│   └── utils.ts
└── middleware.ts               # Route protection
```

## Usage

### 1. Upload a Paper

1. Sign in to your account
2. Navigate to "Upload" or click "Upload Paper" button
3. Drag and drop a PDF or click to browse
4. Wait for the AI to process the paper (1-2 minutes)

### 2. Generate a Demo

1. Go to the paper detail page
2. Switch to "Generate Demo" tab
3. Describe the concept you want to visualize
4. Click "Generate Demo"
5. Wait for the AI to generate and execute the code

### 3. View Demos

- View demos on the paper detail page
- Open demos in new tabs
- Copy the generated code
- Browse all your papers and demos from the dashboard

## Database Schema

### Users

- Stores user information from WorkOS authentication
- Fields: `workosId`, `email`, `name`, `organizationId`

### Papers

- Stores uploaded PDFs and extracted content
- Fields: `userId`, `title`, `fileName`, `fileStorageId`, `status`, `extractedContent`, `metadata`
- Status: `uploading` | `processing` | `ready` | `error`

### Demos

- Stores generated visual demonstrations
- Fields: `paperId`, `userId`, `concept`, `status`, `generatedCode`, `executionResults`
- Status: `generating` | `executing` | `ready` | `failed`

## API Endpoints

### Convex Functions

**Papers:**

- `papers.generateUploadUrl()` - Get upload URL for PDF
- `papers.createPaper()` - Create paper record
- `papers.listUserPapers()` - List user's papers
- `papers.getPaper()` - Get single paper
- `papers.extractPdfContent()` - Extract content using Anthropic

**Demos:**

- `demos.generateDemo()` - Generate demo code using AI
- `demos.listPaperDemos()` - List demos for a paper
- `demos.getDemo()` - Get single demo with URL

**Users:**

- `users.ensureUser()` - Auto-provision user from auth
- `users.getCurrentUser()` - Get current user info

## Security Considerations

- All user-generated code runs in isolated Daytona sandboxes
- File uploads are validated (type, size)
- Authentication required for all protected routes
- WorkOS handles secure session management
- Convex enforces row-level security

## Development

### Adding New Shadcn Components

```bash
pnpx shadcn@latest add <component-name>
```

### Running Linter

```bash
pnpm lint
```

### Type Checking

```bash
pnpm type-check
```

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy Convex production:
   ```bash
   pnpm convex deploy
   ```
5. Update `NEXT_PUBLIC_WORKOS_REDIRECT_URI` to production URL
6. Update WorkOS redirect URIs in dashboard

## Troubleshooting

### PDF Processing Fails

- Check Anthropic API key
- Verify PDF file is valid and under 10MB
- Check Convex logs for errors

### Demo Generation Fails

- Verify Anthropic API key
- Check Daytona API credentials
- Review Convex action logs

### Authentication Issues

- Verify WorkOS credentials
- Check redirect URI matches exactly
- Clear cookies and try again

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Follow the existing code style
2. Use TypeScript for all new code
3. Document functions with JSDoc comments
4. Use Shadcn UI components for all UI
5. Write descriptive commit messages

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built with [Next.js](https://nextjs.org)
- Powered by [Convex](https://convex.dev)
- Authentication by [WorkOS](https://workos.com)
- AI by [Anthropic Claude](https://anthropic.com)
- Sandbox execution by [Daytona](https://daytona.io)
- UI components by [Shadcn UI](https://ui.shadcn.com)
