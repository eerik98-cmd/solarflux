# SolarFlux Project Instructions

## Project Overview
SolarFlux is a Next.js-based business management application with client management, inventory tracking, quote generation, and file management capabilities. Built with Next.js App Router, TypeScript, Tailwind CSS, and a Firebase database.

## Tech Stack
Always use the newest and best industry-standard libraries and practices based on the following core technologies:
- **Framework**: Next.js with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS, PostCSS
- **Backend Services**: Firebase, Google Gemini API
- **State Management**: React Context API

## Dashboard Features
- **Clients** - Client registry and management (`/dashboard/clients`)
- **Client Details** - Client-specific data views
  - Data view (`/dashboard/clients/[id]/data`)
  - Document generation (`/dashboard/clients/[id]/doc-gen`)
  - Documents (`/dashboard/clients/[id]/documents`)
  - Needs tracking (`/dashboard/clients/[id]/needs`)
  - Quotes (`/dashboard/clients/[id]/quotes`)
- **Quote Generator** - Generate quotes (`/dashboard/quote-generator`)
- **Inventory** - Inventory management (`/dashboard/inventory`)
- **File Manager** - File operations (`/dashboard/file-manager`)
- **Settings** - Application settings (`/dashboard/settings`)