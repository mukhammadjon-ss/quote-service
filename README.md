# 📚 Quote Service API

A modern GraphQL API for managing inspirational quotes with user authentication and personalized recommendations.

## ✨ Features

- 🎯 **Quote Management**: Random quotes, search, filtering by author/tags
- 🔐 **Authentication**: JWT-based auth with role-based access control  
- 💝 **Personalization**: Like quotes, recommendations, history tracking
- 📊 **Admin Panel**: Quote management and user analytics
- ⚡ **GraphQL API**: Modern GraphQL interface with comprehensive schema

## 🛠️ Tech Stack

- **Backend**: Node.js + TypeScript + Fastify
- **GraphQL**: Mercurius
- **Database**: MongoDB
- **Auth**: JWT + bcrypt

## 🚀 Quick Start

### Installation

```bash
# Clone and install
git clone https://github.com/mukhammadjon-ss/quote-service.git
cd quote-service
npm install

# Environment setup
cp .env.example .env
# Update .env with your MongoDB URI and JWT secrets

# Start development server
npm run dev
```

## API Usage

### Basic Queries

```bash
# Random quote
query {
  getRandomQuote {
    id
    content
    author
    tags
    likes
  }
}

# Search quotes
query {
  searchQuotes(search: "success", limit: 5) {
    quotes {
      id
      content
      author
    }
    pagination {
      totalItems
    }
  }
}
```

## Authentication

```bash
# Register
mutation {
  register(input: {
    email: "user@example.com"
    username: "johndoe" 
    password: "password123"
    firstName: "John"
    lastName: "Doe"
  }) {
    accessToken
    user { id username email }
  }
}

# Login
mutation {
  login(input: {
    email: "user@example.com"
    password: "password123"
  }) {
    accessToken
    user { id username role }
  }
}
```

## 📖 Project Structure

```bash
src/
├── graphql/         # Schema and resolvers
├── services/        # Business logic
├── plugins/         # Fastify plugins  
├── utils/           # Utilities
├── types/           # TypeScript definitions
└── app.ts          # Entry point
```

## 📝 Scripts

```bash
npm run dev          # Development server
npm run build        # Build for production
npm start           # Start production server
npm test            # Run tests
npm run lint        # Code linting
```