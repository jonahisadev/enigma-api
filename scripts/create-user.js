#!/usr/bin/env node

/**
 * Script to create a new user in the database
 * Usage: node scripts/create-user.js <email> <password> <name> <kmsProvider> <accountKeyId>
 * Example: node scripts/create-user.js user@example.com mypassword "John Doe" aws key123
 */

require('dotenv/config');
const { DataSource } = require('typeorm');
const { hashSync } = require('bcrypt');
const { randomUUID } = require('crypto');

// Parse command line arguments
const [, , email, password, name, kmsProvider, accountKeyId] = process.argv;

if (!email || !password || !name || !kmsProvider || !accountKeyId) {
  console.error('Usage: node scripts/create-user.js <email> <password> <name> <kmsProvider> <accountKeyId>');
  console.error('Example: node scripts/create-user.js user@example.com mypassword "John Doe" aws key123');
  console.error('\nKMS Providers: aws, gcp, azure, local');
  process.exit(1);
}

// Validate KMS provider
const validKmsProviders = ['aws', 'gcp', 'azure', 'local'];
if (!validKmsProviders.includes(kmsProvider)) {
  console.error(`Invalid KMS provider. Must be one of: ${validKmsProviders.join(', ')}`);
  process.exit(1);
}

// Create TypeORM DataSource
const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: true,
  logging: false,
  entities: ['src/models/**/*.model.ts'],
});

async function createUser() {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    console.log('Database connection initialized');

    // Hash the password
    const hashedPassword = hashSync(password, 10);

    // Generate public ID
    const publicId = randomUUID();

    // Insert user
    const result = await AppDataSource.query(
      `INSERT INTO users (public_id, name, email, password, kms_provider, kms_account_key_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, public_id, name, email, kms_provider, kms_account_key_id, created_at`,
      [publicId, name, email, hashedPassword, kmsProvider, accountKeyId]
    );

    console.log('\n✅ User created successfully!');
    console.log('-----------------------------------');
    console.log('ID:', result[0].id);
    console.log('Public ID:', result[0].public_id);
    console.log('Name:', result[0].name);
    console.log('Email:', result[0].email);
    console.log('KMS Provider:', result[0].kms_provider);
    console.log('Account Key ID:', result[0].kms_account_key_id);
    console.log('Created At:', result[0].created_at);
    console.log('-----------------------------------\n');

  } catch (error) {
    console.error(error)
    if (error.code === '23505') {
      console.error('\n❌ Error: A user with this email already exists');
    } else {
      console.error('\n❌ Error creating user:', error.message);
    }
    process.exit(1);
  } finally {
    // Close database connection
    await AppDataSource.destroy();
  }
}

createUser();
