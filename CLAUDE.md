# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **secrets management API** built with Fastify and TypeORM, designed to securely store and manage encryption keys and secrets across multiple vaults with KMS integration support.

## Development Commands

### Running the Application
```bash
yarn dev              # Run with ts-node
yarn dev:watch        # Run with hot reload (nodemon)
yarn build            # Compile TypeScript to dist/
yarn start            # Run compiled JavaScript
```

### Testing
```bash
yarn test             # Run all tests
yarn test:watch       # Run tests in watch mode
yarn test:coverage    # Generate coverage report

# Run a single test file
npx jest src/test/routes/auth.test.ts
```

### Code Quality
```bash
yarn lint             # Check for linting errors
yarn lint:fix         # Auto-fix linting issues
```

### User Management
```bash
# Create a user manually (no signup endpoint)
node scripts/create-user.js <email> <password> <name> <kmsProvider> <accountKeyId>
```

## Architecture

### Request Flow
```
Route (Fastify plugin)
  → Zod Validation
  → Auth Middleware (if protected)
  → Controller (request handling)
  → Service (business logic)
  → Repository (data access)
  → TypeORM Model (database)
```

### Key Patterns

**Fastify Plugin Pattern**: All routes are wrapped with `fastify-plugin` and registered in `src/index.ts`:
```typescript
const routes = async (fastify: FastifyInstance) => {
  fastify.post('/path', {
    preHandler: authenticate,      // Optional middleware
    schema: { body: zodSchema },   // Validation
    handler: controllerFunction,   // Handler
  });
};
export default fp(routes);
```

**Repository Pattern**: Thin wrappers around TypeORM repositories for centralized data access:
```typescript
export const UserRepository = AppDataSource.getRepository(User);
```

**Service Layer**: Reusable business logic extracted from controllers (see `src/services/auth.service.ts`).

### Database Relationships

```
User (1) ──→ (Many) Vault (1) ──→ (Many) Secret
User (1) ──→ (Many) RefreshToken
```

- Users have multiple vaults for organizing secrets
- Vaults contain multiple versioned secrets
- Secrets track versions (updates create new records, not modifications)
- All entities extend `Audit` base class for automatic `createdAt`/`updatedAt` timestamps

### Authentication System

**Two-token approach**:
1. **Access Token (JWT)**: Short-lived (15 min), contains `userId` (public ID)
2. **Refresh Token**: Long-lived (30 days), stored in database, can be revoked

**Protected routes** use `preHandler: authenticate` middleware which calls `request.jwtVerify()`.

**JWT payload structure**:
```typescript
{ userId: string }  // User's public ID (UUID), not database ID
```

Access authenticated user in controllers: `request.user.userId`

### Error Handling

Custom error classes in `src/services/errors.ts`:
- `BadRequestError(reason)` → 400
- `UnauthorizedError(reason)` → 401
- `NotFoundError(reason)` → 404
- `ConflictError(reason)` → 409
- `InternalServerError(reason)` → 500

Global error handler catches all errors and returns consistent format:
```typescript
{ ok: false, reason: string }
```

Fastify validation errors (Zod) are automatically handled and return 400 status.

### Validation with Zod

All routes use Zod schemas for validation (`src/schemas/`). The `fastify-type-provider-zod` integration provides:
- Automatic request validation (body, params, query)
- Type inference in controllers
- Error responses with validation details

When adding new routes:
1. Create Zod schema in appropriate schema file
2. Add to route definition: `schema: { body: mySchema }`
3. TypeScript will infer request types automatically

## Testing Approach

**Unit tests** with Jest using mocked repositories (no real database):

```typescript
// Mock repositories
jest.mock('../../repositories/user.repository', () => ({
  UserRepository: {
    findOne: jest.fn(),
    save: jest.fn(),
  },
}));

// Mock data and behaviors
(UserRepository.findOne as any).mockResolvedValue(mockUser);
```

Tests are isolated, fast (~2s for full suite), and use `app.inject()` for request simulation.

**Test helper** (`src/test/auth-helper.ts`) builds test Fastify app with JWT and error handling configured.

## Important Conventions

### Public IDs
- All entities have both integer `id` (PK) and `publicId` (UUID)
- **Always use `publicId` in APIs** (URLs, JWT payload, responses)
- Internal `id` should never be exposed externally

### Secret Versioning
- Secrets have a `version` field (default 1)
- **Updating a secret creates a new record** with `version + 1`
- Deleting by name removes **all versions** of that secret
- This provides audit trail and rollback capability

### Stub Controllers
Vault and Secret controllers are currently stubs that throw "Not implemented". When implementing:
- Follow auth controller patterns
- Extract business logic to service layer
- Use repository pattern for data access
- Verify authorization (check entity belongs to authenticated user)
- Generate public IDs with `randomUUID()` from `crypto`

### Database Schema Management
Currently using `synchronize: true` in TypeORM (auto-generates schema). For production:
- Create explicit migrations
- Set `synchronize: false`
- Track schema changes in version control

## Configuration

### Environment Variables
```bash
DATABASE_URL=postgresql://...    # PostgreSQL connection string
JWT_SECRET=...                   # Secret for signing JWTs (required in production)
NODE_ENV=development|production
PORT=3000                        # Server port (default: 3000)
```

### TypeORM Data Source
- Located in `src/data-source.ts`
- Entities are explicitly listed (not auto-discovered)
- When adding new entities, register in `entities` array

### Type Extensions
Fastify module augmentation in `src/types/fastify.d.ts` adds:
- `request.user` with JWT payload structure
- `FastifyJWT` interface for type safety

When modifying JWT payload, update both the type definition and `auth.service.ts` generation logic.

## Code Organization

```
src/
├── controllers/     # Request handlers (throw errors, delegate to services)
├── services/        # Business logic (reusable, testable functions)
├── repositories/    # Data access (TypeORM repository wrappers)
├── routes/          # Route definitions (Fastify plugins with validation)
├── middleware/      # Request middleware (currently only auth)
├── models/          # TypeORM entities (database schema)
├── schemas/         # Zod validation schemas
├── types/           # TypeScript type definitions & module augmentation
└── test/            # Test files and helpers (ignored by linter)
```

When adding new features:
1. Create model in `models/` with proper decorators
2. Create repository in `repositories/`
3. Add Zod schemas in `schemas/`
4. Create controller in `controllers/`
5. Extract business logic to `services/` if reusable
6. Create route file in `routes/` as Fastify plugin
7. Register route in `src/index.ts`
8. Write tests in `test/routes/`

## Current Implementation Status

### Completed
- Authentication system (login, refresh, revoke)
- User management (manual creation script)
- Database models and relationships
- Error handling framework
- Validation infrastructure
- Test infrastructure
- Linting and CI/CD

### To Implement (Stub Controllers)
- Vault CRUD operations (5 endpoints)
- Secret CRUD operations (5 endpoints)
- Encryption of vault keys and secret values
- KMS integration for encryption key management
- Database migrations (replace synchronize)

## Additional Notes

- **No signup endpoint**: User creation is manual via `scripts/create-user.js`
- **Password hashing**: Uses bcrypt with 10 rounds
- **Date handling**: Uses Luxon for date manipulation
- **Linting**: ESLint with TypeScript rules, tests and scripts are ignored
- **CI/CD**: GitHub Actions runs lint and test on all pushes/PRs
