const mongoose = require("mongoose");
const Shop = require("../../models/Shop");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

/**
 * Create Fixed Default Shop
 * Run ONCE: npm run setup:shop
 */

async function createFixedDefaultShop() {
  try {
    console.log("🚀 Creating fixed default shop...");

    // Fixed shop ID
    const FIXED_DEFAULT_SHOP_ID = "000000000000000000000001";

    // Default shop config
    const DEFAULT_SHOP_CONFIG = {
      shopName: "Default Personal Use",
      contact: {
        countryCode: "+00",
        number: "0000000000",
        fullNumber: "+00 0000000000",
      },
      shopLogo: "https://www.svgrepo.com/show/309398/shop.svg",
      location: {
        country: "Global",
        countryCode: "GL",
        state: "Not Applicable",
        stateCode: "NA",
        city: "Not Applicable",
        address: "Default Shop for Personal Use",
        nearestPlace: "N/A",
      },
    };

    // Check for MongoDB URI
    if (!process.env.MONGODB_URI) {
      console.error("❌ MONGODB_URI not found in .env file!");
      console.log("\n📝 Please add this to your .env file:");
      console.log("MONGODB_URI=mongodb://localhost:27017/your-database-name");
      console.log("\nOr for MongoDB Atlas:");
      console.log(
        "MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database-name",
      );
      throw new Error("Missing MONGODB_URI environment variable");
    }

    console.log(
      `📍 Connecting to: ${process.env.MONGODB_URI.replace(/\/\/.*@/, "//***@")}`,
    );

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to database");

    // Check if exists
    const existingShop = await Shop.findById(FIXED_DEFAULT_SHOP_ID);

    if (existingShop) {
      console.log("⚠️  Default shop already exists!");
      console.log(`  ID: ${existingShop._id}`);
      console.log(`  Name: ${existingShop.shopName}`);

      // Update to ensure correct data
      existingShop.shopName = DEFAULT_SHOP_CONFIG.shopName;
      existingShop.isActive = true;
      await existingShop.save();
      console.log("✅ Updated default shop");

      return existingShop;
    }

    // Create new default shop
    const defaultShop = new Shop({
      _id: new mongoose.Types.ObjectId(FIXED_DEFAULT_SHOP_ID),
      userId: new mongoose.Types.ObjectId("000000000000000000000000"),
      shopName: DEFAULT_SHOP_CONFIG.shopName,
      contact: DEFAULT_SHOP_CONFIG.contact,
      shopLogo: DEFAULT_SHOP_CONFIG.shopLogo,
      location: DEFAULT_SHOP_CONFIG.location,
      isActive: true,
    });

    await defaultShop.save();

    console.log("\n✅ Successfully created default shop!");
    console.log("\nShop Details:");
    console.log(`  ID: ${defaultShop._id}`);
    console.log(`  Name: ${defaultShop.shopName}`);

    console.log("\n📝 Add to .env:");
    console.log(`DEFAULT_SHOP_ID=${defaultShop._id}\n`);

    return defaultShop;
  } catch (error) {
    console.error("❌ Error:", error.message);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log("👋 Database connection closed");
  }
}

// Run the script
if (require.main === module) {
  createFixedDefaultShop()
    .then(() => {
      console.log("\n🎉 Setup complete!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n💥 Failed:", err.message);
      process.exit(1);
    });
}

module.exports = createFixedDefaultShop;
