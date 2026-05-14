/**
 * Password Migration Script
 * 
 * This script migrates plain-text passwords to bcrypt hashed passwords.
 * Run this once to hash all existing passwords in the users collection.
 * 
 * Usage:
 *   npm run migrate-passwords
 * 
 * Or run directly:
 *   node --loader ts-node/esm scripts/migrate-passwords.ts
 */

import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SALT_ROUNDS = 10;

async function migratePasswords() {
  console.log('🔐 Starting password migration...\n');

  try {
    const mongoUri = process.env.MONGODB_URI;
    const mongoDb = process.env.MONGODB_DB || 'solarflux';

    if (!mongoUri) {
      throw new Error('MONGODB_URI is not set. Please configure .env.local');
    }

    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(mongoDb);

    // Get all users
    const users = await db.collection('users').find({}).toArray();

    if (users.length === 0) {
      console.log('❌ No users found in database.');
      await client.close();
      return;
    }

    console.log(`📊 Found ${users.length} user(s) to process.\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each user
    for (const userData of users) {
      const userId = String(userData.id || userData._id);
      const username = userData.username || 'Unknown';
      const currentPassword = userData.password;

      // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
      if (currentPassword && currentPassword.match(/^\$2[aby]\$/)) {
        console.log(`⏭️  Skipping ${username} (ID: ${userId}) - Already hashed`);
        skippedCount++;
        continue;
      }

      // Check if password exists
      if (!currentPassword) {
        console.log(`⚠️  Warning: User ${username} (ID: ${userId}) has no password`);
        errorCount++;
        continue;
      }

      try {
        // Hash the password
        console.log(`🔄 Hashing password for ${username} (ID: ${userId})...`);
        const hashedPassword = await bcrypt.hash(currentPassword, SALT_ROUNDS);

        // Update the user document
        await db.collection('users').updateOne(
          { _id: userData._id },
          { $set: { password: hashedPassword } }
        );

        console.log(`✅ Successfully migrated ${username}\n`);
        migratedCount++;
      } catch (error) {
        console.error(`❌ Error migrating ${username}:`, error);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📈 MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Successfully migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped (already hashed): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${users.length}`);
    console.log('='.repeat(50) + '\n');

    if (migratedCount > 0) {
      console.log('🎉 Password migration completed successfully!');
      console.log('⚠️  Users will need to use their existing passwords to login.');
      console.log('💡 Passwords are now securely hashed with bcrypt.\n');
    } else if (skippedCount === users.length) {
      console.log('✨ All passwords were already hashed. No migration needed.\n');
    }

    await client.close();

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migratePasswords()
  .then(() => {
    console.log('Migration script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
