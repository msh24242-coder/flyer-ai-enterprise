# Contributing to SH Marketing

Thank you for considering contributing to SH Marketing! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others grow and learn

## Getting Started

### 1. Fork the Repository
```bash
git clone https://github.com/yourusername/flyer-ai-enterprise.git
cd flyer-ai-enterprise
```

### 2. Create a Feature Branch
```bash
git checkout -b feature/amazing-feature
```

### 3. Make Your Changes
Follow the coding standards and best practices outlined below.

## Development Standards

### Backend (NestJS)
- Use TypeScript strictly
- Follow NestJS conventions and patterns
- Use dependency injection for all services
- Write tests for new features
- Keep controllers thin, logic in services
- Use decorators for cross-cutting concerns

### Frontend (Next.js/React)
- Use functional components with hooks
- Implement TypeScript typing
- Follow React best practices
- Use Tailwind CSS for styling
- Component naming: PascalCase
- File naming: kebab-case for pages, components

### General
- Write clear, descriptive commit messages
- Keep PRs focused on a single feature
- Add comments for complex logic
- Follow existing code style
- Use meaningful variable and function names

## Commit Message Format

```
type(scope): description

Body (optional)
- Use past tense
- Keep lines under 72 characters
- Reference issues: Closes #123
```

### Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation
- **style**: Code style (formatting)
- **refactor**: Code refactoring
- **test**: Adding tests
- **chore**: Build, dependencies
- **perf**: Performance improvements

### Example
```
feat(products): add bulk import functionality

Implement CSV import for products with validation
- Parse CSV files
- Validate product data
- Handle duplicate SKUs

Closes #123
```

## Pull Request Process

### Before Submitting

1. **Test Your Changes**
   ```bash
   npm test
   npm run lint
   npm run type-check
   ```

2. **Update Documentation**
   - Update README if needed
   - Add inline code comments
   - Document API changes

3. **Keep Branch Updated**
   ```bash
   git fetch origin
   git rebase origin/develop
   ```

### PR Checklist

- [ ] Tests pass locally
- [ ] No linting errors
- [ ] Code follows style guide
- [ ] Documentation updated
- [ ] Commit messages are clear
- [ ] Branch is up to date
- [ ] Related issues linked

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
How to test the changes

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Tests pass
- [ ] Lint passes
- [ ] Documentation updated
```

## Testing Guidelines

### Backend Tests
```bash
cd backend
npm test                    # Run all tests
npm test -- --watch       # Watch mode
npm run test:e2e           # End-to-end tests
```

### Frontend Tests
```bash
cd frontend
npm test                    # Run tests
npm test -- --watch       # Watch mode
```

### Test Coverage
- Aim for >80% coverage
- Test happy paths and edge cases
- Mock external dependencies
- Use meaningful test descriptions

## Code Review Process

### As a Reviewer
- Check code quality and style
- Verify tests are included
- Look for potential bugs
- Suggest improvements
- Be constructive and kind

### Responding to Feedback
- Address all comments
- Ask for clarification if needed
- Commit additional changes
- Request re-review

## Release Process

1. **Version Bump**
   - Follow semantic versioning
   - Update version in package.json

2. **Changelog**
   - Document all changes
   - Group by type (features, fixes, etc.)

3. **Release Branch**
   ```bash
   git checkout -b release/v1.2.0
   ```

4. **Tag Release**
   ```bash
   git tag -a v1.2.0 -m "Release v1.2.0"
   git push origin v1.2.0
   ```

## Reporting Issues

### Bug Report
```markdown
**Description**: Clear description of the bug

**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior**: What should happen

**Actual Behavior**: What actually happens

**Environment**:
- OS: Windows/Mac/Linux
- Node: v20.x
- Browser: Chrome/Firefox

**Screenshots**: If applicable
```

### Feature Request
```markdown
**Title**: Clear title for the feature

**Description**: Detailed description

**Use Case**: Why is this needed?

**Proposed Solution**: How should it work?

**Alternatives**: Other solutions considered
```

## Setting Up Development Environment

### Backend Development
```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Docker Development
```bash
docker-compose up -d
```

## Common Tasks

### Create a New Feature Module

1. Create module structure:
```bash
mkdir -p src/modules/feature-name/{controllers,services}
```

2. Create files:
- `feature-name.module.ts` - Module definition
- `feature-name.controller.ts` - HTTP routes
- `feature-name.service.ts` - Business logic
- `dto/` - Data transfer objects
- `entities/` - Database entities

3. Register module in `app.module.ts`

### Add Database Migration

```bash
cd backend
npx prisma migrate dev --name migration_name
```

### Update Documentation

- Main README: `/README.md`
- Backend docs: `/backend/README.md`
- Frontend docs: `/frontend/README.md`
- API docs: Update in controller comments

## Help and Support

- **Questions**: Open a discussion or issue
- **Bug Reports**: GitHub Issues
- **Feature Requests**: GitHub Discussions
- **Email**: dev@flyer-ai.com

## Thank You

Thank you for contributing to SH Marketing! Your efforts help make this project better for everyone.

---

**Happy coding! 🚀**
