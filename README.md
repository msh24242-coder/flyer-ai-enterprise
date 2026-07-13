# Flyer AI Enterprise 🎨

Professional flyer creation platform with AI-powered design assistance. Create stunning flyers in minutes with our intuitive editor and advanced AI features.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/flyer-ai-enterprise.git
cd flyer-ai-enterprise

# Start Docker services
docker-compose up -d

# Setup backend
cd backend
npm install
cp .env.example .env
npx prisma migrate dev --name init
npx prisma db seed
npm run dev

# In another terminal, setup frontend
cd frontend
npm install
npm run dev
```

### Access Points
| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Web application |
| Backend API | http://localhost:3001 | REST API |
| API Docs | http://localhost:3001/api/docs | Swagger documentation |
| PgAdmin | http://localhost:5050 | Database management |
| RabbitMQ | http://localhost:15672 | Message queue |
| Redis Commander | http://localhost:8081 | Cache management |
| Elasticsearch | http://localhost:9200 | Search engine |

## 📁 Project Structure

```
flyer-ai-enterprise/
├── backend/                    # NestJS API
│   ├── src/
│   │   ├── main.ts            # Entry point
│   │   ├── app.module.ts      # Main module
│   │   ├── modules/           # Feature modules
│   │   │   ├── auth/          # Authentication
│   │   │   ├── products/      # Products management
│   │   │   ├── flyers/        # Flyer creation
│   │   │   ├── assets/        # Asset management
│   │   │   └── users/         # User management
│   │   ├── common/            # Shared utilities
│   │   └── database/          # Database config
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── seed.ts            # Seed data
│   ├── package.json
│   └── README.md
│
├── frontend/                   # Next.js Application
│   ├── src/
│   │   ├── app/               # Pages
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom hooks
│   │   ├── lib/               # Utilities
│   │   ├── store/             # Zustand stores
│   │   └── types/             # TypeScript types
│   ├── public/                # Static assets
│   ├── package.json
│   └── README.md
│
├── docker/                     # Docker configurations
│   ├── Dockerfile.backend     # Backend image
│   └── Dockerfile.frontend    # Frontend image
│
├── scripts/                    # Utility scripts
├── .github/workflows/         # CI/CD pipelines
├── docker-compose.yml         # Docker compose config
└── README.md                  # This file
```

## 🔧 Development

### Backend Development

```bash
cd backend

# Start development server (with hot reload)
npm run dev

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Database management
npx prisma migrate dev       # Create new migration
npx prisma db seed          # Seed database
npx prisma studio           # Open Prisma Studio
npm run prisma:generate     # Generate Prisma client
```

### Frontend Development

```bash
cd frontend

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Format code
npm run format
```

## 📚 API Documentation

### Authentication Endpoints

#### Register
```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "companyName": "My Company"
}
```

#### Login
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### Get Profile
```bash
GET /api/v1/auth/profile
Authorization: Bearer {token}
```

### Products Endpoints

#### List Products
```bash
GET /api/v1/products
Authorization: Bearer {token}
```

#### Create Product
```bash
POST /api/v1/products
Authorization: Bearer {token}
Content-Type: application/json

{
  "sku": "PROD-001",
  "name": "Product Name",
  "description": "Product description",
  "basePrice": 99.99
}
```

#### Get Product
```bash
GET /api/v1/products/{id}
Authorization: Bearer {token}
```

#### Update Product
```bash
PUT /api/v1/products/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Name",
  "basePrice": 129.99
}
```

#### Delete Product
```bash
DELETE /api/v1/products/{id}
Authorization: Bearer {token}
```

### Flyers Endpoints

#### List Flyers
```bash
GET /api/v1/flyers
Authorization: Bearer {token}
```

#### Create Flyer
```bash
POST /api/v1/flyers
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Summer Sale",
  "description": "Special summer promotion",
  "designData": {}
}
```

#### Get Flyer
```bash
GET /api/v1/flyers/{id}
Authorization: Bearer {token}
```

#### Update Flyer
```bash
PUT /api/v1/flyers/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Updated Title",
  "designData": {}
}
```

#### Publish Flyer
```bash
POST /api/v1/flyers/{id}/publish
Authorization: Bearer {token}
```

#### Delete Flyer
```bash
DELETE /api/v1/flyers/{id}
Authorization: Bearer {token}
```

### Assets Endpoints

#### List Assets
```bash
GET /api/v1/assets
Authorization: Bearer {token}
```

#### Upload Asset
```bash
POST /api/v1/assets
Authorization: Bearer {token}
Content-Type: application/json

{
  "filename": "image.jpg",
  "fileType": "image",
  "mimeType": "image/jpeg",
  "storagePath": "assets/images/image.jpg",
  "publicUrl": "https://cdn.example.com/image.jpg"
}
```

#### Get Asset
```bash
GET /api/v1/assets/{id}
Authorization: Bearer {token}
```

#### Delete Asset
```bash
DELETE /api/v1/assets/{id}
Authorization: Bearer {token}
```

### Users Endpoints

#### List Users
```bash
GET /api/v1/users
Authorization: Bearer {token}
```

#### Get User
```bash
GET /api/v1/users/{id}
Authorization: Bearer {token}
```

## 🐳 Docker Deployment

### Build Images

```bash
# Build backend
docker build -f docker/Dockerfile.backend -t flyer-ai-backend:latest .

# Build frontend
docker build -f docker/Dockerfile.frontend -t flyer-ai-frontend:latest .
```

### Run with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Remove volumes
docker-compose down -v
```

## 🚀 Deployment

### Environment Variables

Create `.env` files for production:

**Backend (.env)**
```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:password@host:5432/flyer_ai
REDIS_URL=redis://host:6379
JWT_SECRET=your-secret-key
AWS_S3_BUCKET=your-bucket
```

**Frontend (.env.local)**
```
NEXT_PUBLIC_API_URL=https://api.flyer-ai.com
```

### CI/CD Pipeline

The project includes GitHub Actions workflows for:
- Automated testing (backend & frontend)
- Docker image building and pushing
- Automatic deployment to staging on `develop` branch
- Automatic deployment to production on `main` branch

Secrets required in GitHub:
- `DEPLOY_KEY` - SSH private key
- `DEPLOY_HOST` - Deployment server host
- `DEPLOY_USER` - Deployment server user
- `SLACK_WEBHOOK_URL` - Slack notifications

## 📊 Database Schema

The application uses PostgreSQL with the following main entities:

- **Company** - Multi-tenant organizations
- **User** - Application users
- **Flyer** - Flyer designs
- **Product** - E-commerce products
- **Asset** - Uploaded files and images
- **Subscription** - Billing and subscriptions
- **AuditLog** - Activity tracking
- **Task** - Project management tasks

See `backend/prisma/schema.prisma` for complete schema.

## 🔐 Security Features

- ✅ JWT authentication
- ✅ Password hashing with bcryptjs
- ✅ CORS protection
- ✅ Helmet security headers
- ✅ Input validation with class-validator
- ✅ SQL injection prevention with Prisma
- ✅ Rate limiting
- ✅ Audit logging

## 📈 Performance

- ✅ Database query optimization
- ✅ Redis caching
- ✅ Image optimization
- ✅ API response compression
- ✅ CDN-ready asset delivery
- ✅ Database indexing

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

## 📝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see LICENSE file for details.

## 🤝 Support

For support, email support@flyer-ai.com or open an issue on GitHub.

## 🎯 Roadmap

### Phase 1: MVP (Current)
- ✅ User authentication
- ✅ Basic flyer editor
- ✅ Product management
- ✅ Asset management

### Phase 2: Advanced Features
- 🔄 AI-powered design suggestions
- 🔄 Real-time collaboration
- 🔄 Template system
- 🔄 Export to multiple formats

### Phase 3: Enterprise
- 🔄 White-label support
- 🔄 Advanced analytics
- 🔄 Team management
- 🔄 Custom integrations

### Phase 4: Scale
- 🔄 Mobile applications
- 🔄 Print integration
- 🔄 Social media publishing
- 🔄 Global expansion

## 📞 Contact

- **Email**: info@flyer-ai.com
- **Website**: https://flyer-ai.com
- **Twitter**: @flyeraiapp
- **LinkedIn**: flyer-ai

---

**Built with ❤️ by the Flyer AI Team**
