# Flyer AI - Frontend

Next.js-based web application for the Flyer AI platform.

## Quick Start

### Prerequisites
- Node.js 20+
- Backend API running on http://localhost:3001

### Installation

```bash
cd frontend
npm install
npm run dev
```

App will be available at http://localhost:3000

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js pages
│   │   ├── auth/               # Authentication pages
│   │   ├── dashboard/          # Dashboard
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   └── globals.css         # Global styles
│   ├── components/             # React components
│   ├── hooks/                  # Custom hooks
│   │   └── useAuth.ts          # Auth hook
│   ├── lib/                    # Utilities
│   │   └── api.ts              # API client
│   ├── store/                  # Zustand stores
│   │   └── authStore.ts        # Auth store
│   └── types/                  # TypeScript types
├── public/                     # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript check
- `npm run format` - Format code with Prettier

## Features

- 🎨 Modern UI with Tailwind CSS
- 🔐 JWT-based authentication
- 📱 Responsive design
- ⚡ Fast with Next.js 14
- 🎯 TypeScript for type safety
- 🌐 API integration with axios
- 🎪 State management with Zustand
- 🔔 Toast notifications with react-hot-toast

## Environment Variables

Create `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## API Integration

All API requests go through `src/lib/api.ts` which handles:
- Base URL configuration
- Authentication headers
- Error handling
- Token refresh

## Components

### Pages
- `app/` - Home page
- `app/auth/login/` - Login page
- `app/auth/register/` - Registration page
- `app/dashboard/` - Dashboard page

### Hooks
- `useAuth()` - Authentication hook with login/register/logout

### Stores
- `authStore` - Global authentication state with Zustand

## Styling

Uses Tailwind CSS for styling with custom configuration in `tailwind.config.ts`.

## Performance

- Image optimization with Next.js
- CSS module support
- API response caching
- Lazy loading components

## Testing

```bash
npm test
```

## Deployment

1. Build the project:
```bash
npm run build
```

2. Run production server:
```bash
npm start
```

Or use Docker:
```bash
docker build -f ../docker/Dockerfile.frontend -t flyer-ai-frontend .
docker run -p 3000:3000 flyer-ai-frontend
```

## Troubleshooting

### API Connection Issues
- Ensure backend is running on http://localhost:3001
- Check `.env.local` configuration
- Verify CORS is enabled in backend

### Build Errors
- Clear `.next` directory: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Run type check: `npm run type-check`

## Contributing

1. Create feature branch
2. Make changes
3. Run tests and linting
4. Submit PR

## License

MIT
