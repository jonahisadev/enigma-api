#!/usr/bin/env node

/**
 * Script to create a new invite in the database
 * Usage: node scripts/create-invite.js <email> <kmsProvider>
 * Example: node scripts/create-invite.js user@example.com local
 */

require('dotenv/config');
const { DataSource } = require('typeorm');
const { randomUUID } = require('crypto');

// Parse command line arguments
const [, , email, kmsProvider] = process.argv;

if (!email || !kmsProvider) {
  console.error('Usage: node scripts/create-invite.js <email> <kmsProvider>');
  console.error('Example: node scripts/create-invite.js user@example.com local');
  console.error('\nKMS Providers: aws, gcp, azure, local');
  process.exit(1);
}

// Validate email format
if (!email.includes('@')) {
  console.error('Invalid email format');
  process.exit(1);
}

// Validate KMS provider
const validKmsProviders = ['aws', 'gcp', 'azure', 'local'];
if (!validKmsProviders.includes(kmsProvider)) {
  console.error(`Invalid KMS provider. Must be one of: ${validKmsProviders.join(', ')}`);
  process.exit(1);
}

// Generate random 6-letter uppercase invite code
function generateInviteCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

// Create TypeORM DataSource
const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: true,
  logging: false,
  entities: ['dist/models/**/*.model.js'],
});

async function createInvite() {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    console.log('Database connection initialized');

    // Generate invite code and public ID
    const inviteCode = generateInviteCode();
    const publicId = randomUUID();

    // Insert invite
    const result = await AppDataSource.query(
      `INSERT INTO invites (public_id, invite_code, email, kms_provider, used_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NULL, NOW(), NOW())
       RETURNING id, public_id, invite_code, email, kms_provider, used_at, created_at`,
      [publicId, inviteCode, email, kmsProvider]
    );

    console.log('\n✅ Invite created successfully!');
    console.log('-----------------------------------');
    console.log('ID:', result[0].id);
    console.log('Public ID:', result[0].public_id);
    console.log('Invite Code:', result[0].invite_code);
    console.log('Email:', result[0].email);
    console.log('KMS Provider:', result[0].kms_provider);
    console.log('Used At:', result[0].used_at);
    console.log('Created At:', result[0].created_at);
    console.log('-----------------------------------');
    console.log('\n📧 Send this invite code to the user:', result[0].invite_code);
    console.log('-----------------------------------\n');

  } catch (error) {
    console.error(error);
    if (error.code === '23505') {
      console.error('\n❌ Error: An invite with this code already exists (extremely rare - try again)');
    } else {
      console.error('\n❌ Error creating invite:', error.message);
    }
    process.exit(1);
  } finally {
    // Close database connection
    await AppDataSource.destroy();
  }
}

createInvite();
