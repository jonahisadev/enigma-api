# OpenAPI Specification Usage Guide

This document explains how to generate and use the OpenAPI specification for the Enigma Secrets Management API.

## Generating the OpenAPI Spec

### Prerequisites
The API server must be running to generate the OpenAPI specification.

```bash
# Start the development server
yarn dev

# Or start the production server
yarn build
yarn start
```

### Export Methods

#### Method 1: Using npm scripts (Recommended)
```bash
# Export as YAML (default)
yarn openapi:export

# Export as JSON
yarn openapi:export:json
```

#### Method 2: Using the export script directly
```bash
# Export as YAML
./scripts/export-openapi.sh yaml openapi.yaml

# Export as JSON
./scripts/export-openapi.sh json openapi.json
```

#### Method 3: Direct HTTP requests
```bash
# YAML format
curl http://localhost:3000/docs/yaml > openapi.yaml

# JSON format
curl http://localhost:3000/docs/json > openapi.json
```

## Using the OpenAPI Spec

### 1. Interactive Documentation (Swagger UI)

Visit `http://localhost:3000/docs` while the server is running to access the interactive Swagger UI where you can:
- Browse all available endpoints
- View request/response schemas
- Test API calls directly from the browser
- Authenticate using JWT bearer tokens

### 2. Generating Client SDKs with LLMs

You can provide the generated OpenAPI specification to LLMs (like Claude, ChatGPT, etc.) to generate client libraries in any programming language.

**Example prompt:**
```
I have an OpenAPI 3.0 specification for a secrets management API.
Please generate a TypeScript client SDK with the following features:
- Typed request/response interfaces
- Error handling
- JWT authentication support
- Axios-based HTTP client

Here's the OpenAPI spec:
[paste openapi.yaml contents]
```

**Supported client languages:**
- TypeScript/JavaScript
- Python
- Go
- Java
- Ruby
- PHP
- C#
- Rust
- And many more...

### 3. Code Generation Tools

You can also use automated code generation tools:

#### OpenAPI Generator
```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript client
openapi-generator-cli generate \
  -i openapi.yaml \
  -g typescript-axios \
  -o ./generated-client

# Generate Python client
openapi-generator-cli generate \
  -i openapi.yaml \
  -g python \
  -o ./generated-client
```

#### Swagger Codegen
```bash
# Using Docker
docker run --rm -v ${PWD}:/local swaggerapi/swagger-codegen-cli generate \
  -i /local/openapi.yaml \
  -l typescript-axios \
  -o /local/generated-client
```

### 4. API Testing Tools

Import the OpenAPI spec into popular API testing tools:

- **Postman**: File → Import → Upload openapi.yaml
- **Insomnia**: Create → Import From → File → openapi.yaml
- **Bruno**: Import → OpenAPI
- **Thunder Client** (VS Code): Import from OpenAPI

### 5. API Mocking

Use the spec to create mock servers for testing:

```bash
# Using Prism
npm install -g @stoplight/prism-cli
prism mock openapi.yaml
```

## OpenAPI Specification Details

The generated specification includes:

### Endpoints Covered
- **Authentication** (3 endpoints)
  - Login with email/password
  - Refresh access token
  - Revoke refresh tokens

- **Vaults** (5 endpoints)
  - Create, list, get, update, delete vaults

- **Secrets** (5 endpoints)
  - Create, list, get, update, delete secrets with versioning

- **Roles** (14 endpoints)
  - Role CRUD operations
  - Auth method management (CIDR/token)
  - Vault permission management
  - Token management

- **Role Authentication** (2 endpoints)
  - CIDR-based login
  - Token-based login

### Authentication
All protected endpoints use JWT bearer authentication:

```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

To authenticate API requests:
1. Call `/accounts/login` with email/password
2. Use the returned `accessToken` in subsequent requests
3. Add header: `Authorization: Bearer <accessToken>`

### Response Format
All responses follow a consistent format:

**Success:**
```json
{
  "ok": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "ok": false,
  "reason": "Error description"
}
```

## Example: Generating a Python Client with an LLM

1. Export the OpenAPI spec:
   ```bash
   yarn openapi:export
   ```

2. Copy the contents of `openapi.yaml`

3. Prompt your LLM:
   ```
   Create a Python client library for this API with:
   - Type hints for all methods
   - Requests-based HTTP client
   - JWT authentication handling
   - Custom exceptions for API errors
   - Async support using httpx

   OpenAPI Specification:
   [paste openapi.yaml]
   ```

4. The LLM will generate a complete client with:
   - Typed request/response models
   - Authentication handling
   - Error handling
   - Documentation

## Updating the OpenAPI Spec

The OpenAPI specification is generated automatically from:
- Route definitions in `src/routes/*.ts`
- Zod schemas in `src/schemas/*.ts`
- OpenAPI metadata in `src/index.ts`

To update the spec:
1. Modify route schemas or add new routes
2. Restart the server
3. Re-export the OpenAPI spec

## Troubleshooting

### Server not running error
```
Error: Server is not running at http://localhost:3000
```
**Solution:** Start the server with `yarn dev` before exporting

### Empty or invalid spec
**Solution:** Ensure all routes are properly registered in `src/index.ts`

### Missing descriptions
**Solution:** Add `.describe()` calls to Zod schemas for better documentation

## Additional Resources

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [OpenAPI Generator](https://openapi-generator.tech/)
- [Fastify Swagger Plugin](https://github.com/fastify/fastify-swagger)
