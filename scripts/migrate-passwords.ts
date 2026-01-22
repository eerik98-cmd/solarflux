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

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SALT_ROUNDS = 10;

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

async function migratePasswords() {
  console.log('🔐 Starting password migration...\n');

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  try {
    // Get all users
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);

    if (snapshot.empty) {
      console.log('❌ No users found in database.');
      return;
    }

    console.log(`📊 Found ${snapshot.size} user(s) to process.\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each user
    for (const userDoc of snapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
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
        await updateDoc(doc(db, 'users', userId), {
          password: hashedPassword,
        });

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
    console.log(`📊 Total processed: ${snapshot.size}`);
    console.log('='.repeat(50) + '\n');

    if (migratedCount > 0) {
      console.log('🎉 Password migration completed successfully!');
      console.log('⚠️  Users will need to use their existing passwords to login.');
      console.log('💡 Passwords are now securely hashed with bcrypt.\n');
    } else if (skippedCount === snapshot.size) {
      console.log('✨ All passwords were already hashed. No migration needed.\n');
    }

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
