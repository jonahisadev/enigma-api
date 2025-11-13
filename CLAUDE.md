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

### API Documentation
```bash
# Access Swagger UI (requires running server)
# Start server: yarn dev
# Visit: http://localhost:3000/docs

# Export OpenAPI specification
yarn openapi:export         # Exports YAML to openapi.yaml
yarn openapi:export:json    # Exports JSON to openapi.json

# Or use the script directly
./scripts/export-openapi.sh yaml openapi.yaml
./scripts/export-openapi.sh json openapi.json
```

The API includes full OpenAPI 3.0 documentation with:
- Complete request/response schemas
- JWT bearer authentication scheme
- Descriptions for all endpoints
- Tagged organization (Authentication, Vaults, Secrets, Roles, Role Authentication)
- Response status codes and error schemas

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
User (1) ──→ (Many) Role
Role (1) ──→ (Many) RoleAuthMethod (1) ──→ (Many) RoleToken
Role (1) ──→ (Many) RoleVaultPermission ──→ (1) Vault
```

- Users have multiple vaults for organizing secrets
- Vaults contain multiple versioned secrets
- Secrets track versions (updates create new records, not modifications)
- Users have multiple roles for delegated access (CIDR/token auth)
- Roles define which vaults can be accessed and with what permissions (read-only or read-write)
- All entities extend `Audit` base class for automatic `createdAt`/`updatedAt` timestamps

### Authentication System

**Three authentication methods**:
1. **Password (User Account)**: Email + password login for account owners
2. **CIDR (Role-Based)**: IP-based authentication for server/infrastructure access
3. **Token (Role-Based)**: Static token authentication for CI/CD and automation

**Two-token approach for password auth**:
1. **Access Token (JWT)**: Short-lived (15 min), contains user/role info
2. **Refresh Token**: Long-lived (30 days), stored in database, can be revoked (only for password auth)

**Protected routes** use `preHandler: authenticate` middleware which calls `request.jwtVerify()`.

**JWT payload structure**:
```typescript
{
  userId: string;                              // User's public ID (account owner)
  roleId?: string;                             // Role public ID (if role-based auth)
  vaultPermissions?: Array<{                   // Accessible vaults (if role-based)
    vaultId: string;
    canWrite: boolean;
  }>;
  authType: 'password' | 'cidr' | 'token';    // Authentication method used
}
```

**Access control**:
- Password auth: Full access to all user's vaults (vaultPermissions omitted)
- Role auth: Limited to vaults in `vaultPermissions` array
- `canWrite: false` = Read-only (GET operations)
- `canWrite: true` = Read-write (GET + PUT vault + POST/PUT/DELETE secrets)
- Vault deletion (DELETE /vaults/:id) requires password auth

Access authenticated user in controllers: `request.user.userId`, `request.user.roleId`, `request.user.vaultPermissions`

### Role-Based Authentication (Delegated Access)

**Purpose**: Allow users to create roles for automated systems, services, and infrastructure without sharing their password.

**Role Management Flow**:
1. User creates role: `POST /roles` with name and description
2. User adds auth method: `POST /roles/:roleId/auth-methods`
   - **CIDR**: IP-based (e.g., `{ authType: 'cidr', config: { allowedCidrs: ['10.0.1.0/24'] } }`)
   - **Token**: Static token (e.g., `{ authType: 'token', config: { lifetime: '30d', name: 'github-actions' } }`)
     - Returns token ONCE (never retrievable again, bcrypt hashed in DB)
3. User grants vault access: `POST /roles/:roleId/vaults` with `{ vaultId, canWrite: true/false }`
4. Role authenticates: `POST /roles/:roleId/login/cidr` or `POST /roles/:roleId/login/token { token }`
5. Receives JWT with embedded `vaultPermissions` array

**Key Features**:
- Roles are user-owned (isolated per account)
- Multiple auth methods per role
- Multiple vault permissions per role
- Granular read/write control per vault
- Tokens are bcrypt hashed (like passwords)
- Tokens can be individually revoked
- CIDR validation at login time only (not per-request)

**Example Use Case**:
```bash
# Create role for EC2 instance running "alpha" service
POST /roles { name: "alpha-ec2", description: "Alpha service EC2 instances" }
→ { roleId: "role-xyz" }

# Add CIDR auth for EC2 IP range
POST /roles/role-xyz/auth-methods
{ authType: "cidr", config: { allowedCidrs: ["10.0.1.0/24"] } }

# Grant read-only access to alpha vault
POST /roles/role-xyz/vaults
{ vaultId: "vault-alpha", canWrite: false }

# EC2 instance authenticates (IP: 10.0.1.50)
POST /roles/role-xyz/login/cidr
→ JWT with { userId, roleId, vaultPermissions: [{ vaultId: "vault-alpha", canWrite: false }], authType: "cidr" }

# EC2 can now read alpha vault secrets (but not modify)
GET /vaults/vault-alpha/secrets ✓
PUT /vaults/vault-alpha ✗ (read-only)
GET /vaults/vault-beta/secrets ✗ (no permission)
```

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
Role controllers are currently stubs that throw "Not implemented". When implementing:
- Follow auth/vault/secret controller patterns
- Extract business logic to service layer if complex
- Use repository pattern for data access
- Verify role ownership (role.user.publicId === request.user.userId)
- Generate public IDs and tokens with `randomUUID()` and `randomBytes()` from `crypto`
- Hash tokens with bcrypt before storing
- For CIDR validation, use `ipaddr.js` library

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
- **Authentication system**
  - Password login (login, refresh, revoke) - ✅ Fully implemented
  - Role-based auth infrastructure - ✅ Stubbed (CIDR and Token login)
- **User management** - ✅ Manual creation script
- **Vault CRUD** - ✅ Fully implemented (5 endpoints, tested)
- **Secret CRUD** - ✅ Fully implemented (5 endpoints with versioning, tested)
- **Encryption** - ✅ AES-256-CBC for vault keys and secret values
- **KMS integration** - ✅ Local KMS provider implemented, AWS KMS provider stubbed
- **Database models** - ✅ All entities created (User, Vault, Secret, RefreshToken, Role, RoleAuthMethod, RoleVaultPermission, RoleToken)
- **Test infrastructure** - ✅ 57 passing tests (auth, vaults, secrets)
- **Error handling framework** - ✅ Custom error classes with global handler
- **Validation infrastructure** - ✅ Zod schemas for all routes
- **Linting and CI/CD** - ✅ ESLint configured

### To Implement (Stub Controllers)
- **Role management** (14 endpoints) - Controllers stubbed with TODO comments
  - Role CRUD (create, get, list, update, delete)
  - Auth method management (add CIDR/token, list, remove)
  - Vault permission management (grant, list, update, revoke)
  - Token management (list, revoke)
- **Role authentication** (2 endpoints) - Controllers stubbed with TODO comments
  - CIDR login (IP-based authentication)
  - Token login (static token authentication)
- **Auth service updates** - Need to add `authType: 'password'` to existing login
- **Permission checks** - Need to add vault permission validation in vault/secret controllers
- **AWS KMS provider** - Implement AWS KMS integration
- **Database migrations** - Replace `synchronize: true` with explicit migrations

## API Endpoints

### Authentication
- `POST /accounts/login` - Login with email/password
- `POST /accounts/login/refresh` - Refresh access token
- `POST /accounts/login/revoke` - Revoke refresh token(s)

### Vaults
- `POST /vaults` - Create vault
- `GET /vaults` - List all vaults
- `GET /vaults/:id` - Get vault by ID
- `PUT /vaults/:id` - Update vault name
- `DELETE /vaults/:id` - Delete vault (owner only, cascades to secrets)

### Secrets
- `POST /vaults/:vaultId/secrets` - Create secret
- `GET /vaults/:vaultId/secrets` - List secrets (supports `?name=` and `?latest=` filters)
- `GET /vaults/:vaultId/secrets/:secretId` - Get secret (decrypted)
- `PUT /vaults/:vaultId/secrets/:secretId` - Update secret (creates new version)
- `DELETE /vaults/:vaultId/secrets?name=` - Delete secret by name (all versions)

### Roles (Stubbed)
- `POST /roles` - Create role
- `GET /roles` - List roles
- `GET /roles/:roleId` - Get role
- `PUT /roles/:roleId` - Update role
- `DELETE /roles/:roleId` - Delete role
- `POST /roles/:roleId/auth-methods` - Add CIDR or token auth method
- `GET /roles/:roleId/auth-methods` - List auth methods
- `DELETE /roles/:roleId/auth-methods/:id` - Remove auth method
- `POST /roles/:roleId/vaults` - Grant vault access
- `GET /roles/:roleId/vaults` - List vault permissions
- `PUT /roles/:roleId/vaults/:vaultId` - Update vault permission
- `DELETE /roles/:roleId/vaults/:vaultId` - Revoke vault access
- `GET /roles/:roleId/tokens` - List tokens
- `DELETE /roles/:roleId/tokens/:tokenId` - Revoke token

### Role Authentication (Stubbed)
- `POST /roles/:roleId/login/cidr` - Login via CIDR (IP-based)
- `POST /roles/:roleId/login/token` - Login via static token

## Additional Notes

- **No signup endpoint**: User creation is manual via `scripts/create-user.js`
- **Password hashing**: Uses bcrypt with 10 rounds
- **Date handling**: Uses Luxon for date manipulation
- **Linting**: ESLint with TypeScript rules, tests and scripts are ignored
- **CI/CD**: GitHub Actions runs lint and test on all pushes/PRs
