# Flyer AI Enterprise - Backend

NestJS-based API for the Flyer AI Enterprise platform.

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16
- Redis 7
- RabbitMQ 3.12

### Installation

```bash
cd backend
npm install
```

### Database Setup

```bash
# Create database
npx prisma migrate dev --name init

# Seed database
npx prisma db seed

# View database
npx prisma studio
```

### Development

```bash
npm run dev
```

Server runs on http://localhost:3001

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `GET /api/v1/auth/profile` - Get user profile
- `GET /api/v1/auth/health` - Health check

### Products
- `GET /api/v1/products` - List products
- `POST /api/v1/products` - Create product
- `GET /api/v1/products/:id` - Get product
- `PUT /api/v1/products/:id` - Update product
- `DELETE /api/v1/products/:id` - Delete product

### Flyers
- `GET /api/v1/flyers` - List flyers
- `POST /api/v1/flyers` - Create flyer
- `GET /api/v1/flyers/:id` - Get flyer
- `PUT /api/v1/flyers/:id` - Update flyer
- `POST /api/v1/flyers/:id/publish` - Publish flyer
- `DELETE /api/v1/flyers/:id` - Delete flyer

### Assets
- `GET /api/v1/assets` - List assets
- `POST /api/v1/assets` - Upload asset
- `GET /api/v1/assets/:id` - Get asset
- `DELETE /api/v1/assets/:id` - Delete asset

### Users
- `GET /api/v1/users` - List users
- `GET /api/v1/users/:id` - Get user

## Project Structure

```
backend/
├── src/
│   ├── main.ts                 # Entry point
│   ├── app.module.ts           # Main module
│   ├── modules/                # Feature modules
│   │   ├── auth/               # Authentication
│   │   ├── products/           # Products
│   │   ├── flyers/             # Flyers
│   │   ├── assets/             # Assets
│   │   └── users/              # Users
│   ├── common/                 # Shared utilities
│   └── database/               # Database configuration
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── seed.ts                 # Seed data
├── package.json
├── tsconfig.json
└── .env
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database
- `npm run prisma:studio` - Open Prisma Studio
