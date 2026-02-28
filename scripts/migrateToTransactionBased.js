/**
 * Migration: Switch ShopRecord from daily-based to transaction-based
 *
 * Run once with: node scripts/migrateToTransactionBased.js
 *
 * What it does:
 *  1. Drops the stale UNIQUE index { shopId:1, dateString:1 }
 *     (this index was unique in the old daily schema; in the new
 *      transaction schema multiple records can share the same date)
 *  2. Drops stale { shopId:1, date:-1 } and { userId:1, date:-1 }
 *     indexes (old schema had a `date` field; new schema uses only `dateString`)
 *  3. Mongoose will auto-create the new non-unique indexes on next start
 */

require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error("MONGODB_URI not found in .env");
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const col = mongoose.connection.db.collection("shoprecords");
  const indexes = await col.indexes();

  console.log(
    "Current indexes:",
    indexes.map((i) => i.name),
  );

  // Indexes to drop (stale from the old daily-based schema)
  const toDrop = [
    "shopId_1_dateString_1", // was UNIQUE — must become non-unique
    "shopId_1_date_-1", // old `date` field no longer exists
    "userId_1_date_-1", // old `date` field no longer exists
  ];

  for (const indexName of toDrop) {
    const exists = indexes.find((i) => i.name === indexName);
    if (exists) {
      await col.dropIndex(indexName);
      console.log(`✅ Dropped: ${indexName}`);
    } else {
      console.log(`ℹ️  Not found (already gone): ${indexName}`);
    }
  }

  await mongoose.disconnect();
  console.log(
    "Done. Restart the server — Mongoose will create the new indexes automatically.",
  );
}

run().catch((err) => {
  console.error("Migration failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
