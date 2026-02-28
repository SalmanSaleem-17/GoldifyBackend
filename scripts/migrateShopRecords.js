/**
 * Migration: Add shopId to ShopRecords and drop old userId+dateString index
 *
 * Run once with: node scripts/migrateShopRecords.js
 *
 * What it does:
 *  1. Drops the stale unique index { userId:1, dateString:1 }
 *  2. Finds every ShopRecord that has no shopId
 *  3. Looks up the user's active shop and assigns it
 *  4. Deletes records whose user has no shop at all (they are unrecoverable)
 *  5. Mongoose will auto-create the new { shopId:1, dateString:1 } index on next start
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

  const db = mongoose.connection.db;
  const col = db.collection("shoprecords");

  // ── 1. Drop old unique index ───────────────────────────────────────────────
  const indexes = await col.indexes();
  const oldIndex = indexes.find((i) => i.name === "userId_1_dateString_1");

  if (oldIndex) {
    await col.dropIndex("userId_1_dateString_1");
    console.log("✅ Dropped old index: userId_1_dateString_1");
  } else {
    console.log("ℹ️  Old index not found — already dropped or never existed");
  }

  // ── 2. Migrate records that have no shopId ────────────────────────────────
  const orphans = await col.find({ shopId: { $exists: false } }).toArray();
  console.log(`Found ${orphans.length} records without shopId`);

  if (orphans.length === 0) {
    console.log("✅ Nothing to migrate");
    await mongoose.disconnect();
    return;
  }

  // Cache userId → activeShopId to avoid repeated DB hits
  const shopCache = new Map();
  const shopCol = db.collection("shops");

  let updated = 0;
  let deleted = 0;

  for (const record of orphans) {
    const userId = record.userId.toString();

    if (!shopCache.has(userId)) {
      const shop = await shopCol.findOne({
        userId: record.userId,
        isActive: true,
      });
      shopCache.set(userId, shop ? shop._id : null);
    }

    const shopId = shopCache.get(userId);

    if (shopId) {
      await col.updateOne(
        { _id: record._id },
        { $set: { shopId } },
      );
      updated++;
    } else {
      // No active shop for this user — record is unrecoverable
      await col.deleteOne({ _id: record._id });
      deleted++;
    }
  }

  console.log(`✅ Updated ${updated} records with shopId`);
  if (deleted > 0) {
    console.log(`🗑️  Deleted ${deleted} records (users with no active shop)`);
  }

  await mongoose.disconnect();
  console.log("Done. Restart the server — Mongoose will create the new index automatically.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
