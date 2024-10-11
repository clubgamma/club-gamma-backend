# Contributing to Club Gamma Backend

Thank you for your interest in contributing to our backend project! This document provides guidelines and steps for setting up the development environment and contributing.

## Table of Contents
- [Getting Started](#getting-started)
    - [Finding an Issue](#finding-an-issue)
    - [Creating an Issue](#creating-an-issue)
- [Development Setup](#development-setup)
    - [Prerequisites](#prerequisites)
    - [Environment Setup](#environment-setup)
    - [Database Setup](#database-setup)
    - [API Keys and Secrets](#api-keys-and-secrets)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [API Documentation](#api-documentation)
- [Code Style](#code-style)
- [Community Guidelines](#community-guidelines)

## Getting Started

### Finding an Issue
1. Check our [issues page](https://github.com/clubgamma/club-gamma-backend/issues)
2. Look for `good first issue` labels
3. Comment on the issue to get assigned

### Creating an Issue
1. Check existing issues first
2. Use our issue templates
3. Provide detailed reproduction steps for bugs
4. For features, explain the use case

## Development Setup

### Prerequisites
- Node.js (v18 or higher)
- npm (v8 or higher)
- Git
- PostgreSQL (v14 or higher)

### Environment Setup

1. Fork and clone the repository
```bash
git clone https://github.com/your-username/backend-project.git
cd backend-project
```

2. Install dependencies
```bash
npm install
```

3. Copy the example environment file
```bash
cp .env.example .env
```

4. Set up environment variables (details below)

### Database Setup

1. Install PostgreSQL if you haven't already
2. Create a new database
```sql
CREATE DATABASE your_database_name;
```

3. Update DATABASE_URL in .env
```
DATABASE_URL="postgresql://username:password@localhost:5432/your_database_name"
```

4. Run Prisma db push
```bash
npx prisma db push
```

### API Keys and Secrets

#### GitHub OAuth App
1. Go to GitHub Settings > Developer settings > OAuth Apps > New OAuth App
2. Set Homepage URL to your frontend URL
3. Set Authorization callback URL to `{FRONTEND_URL}/redirect`
4. Add to .env:
```
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

#### GitHub Personal Access Token
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate a new token with required permissions
3. Add to .env:
```
GITHUB_TOKEN=your_token
```

#### SendGrid API Key
1. Create a SendGrid account
2. Go to Settings > API Keys > Create API Key
3. Add to .env:
```
SENDGRID_API_KEY=your_sendgrid_key
MAILER_MAIL=your_verified_sender@example.com
MAILER_NAME=Your Name
```

#### JWT Secret
Generate a secure random string:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Add to .env:
```
JWT_SECRET=generated_secret
```

#### Webhook Secret
Generate another secure random string for webhook verification:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Add to .env:
```
WEBHOOK_SECRET=generated_secret
```

#### Other Environment Variables
```
FRONTEND_URL=http://localhost:5173
PORT=3000
```

## Development Workflow

1. Create a new branch
```bash
git checkout -b feature/your-feature-name
```

2. Start the development server
```bash
npm run dev
```

3. Make your changes
4. Run tests
```bash
npm test
```

## Pull Request Process

1. Update API documentation if needed
2. Update Prisma schema and run push if needed
```bash
npx prisma db push
```
3. Push your changes and create a PR

### PR Best Practices
- Keep PRs focused and reasonably sized
- Link related issues

## Code Style

- We use ESLint
- Follow existing patterns in the codebase
- Use meaningful variable and function names

### Database Guidelines
- Use meaningful model names
- Follow Prisma best practices
- Create indexes for frequently queried fields

## Community Guidelines

- Be respectful and inclusive
- Help others in the community
- Follow our [Code of Conduct](https://clubgamma.github.io/code-of-conduct/)

## Need Help?

- Ask in issues or pull requests
- Join our [Discord](https://discord.com/invite/CgMRHtXjrf)

## License

By contributing, you agree that your contributions will be licensed under the project's license.
