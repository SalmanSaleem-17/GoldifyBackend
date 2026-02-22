const mongoose = require("mongoose");

const customGoldRateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    country: {
      type: String,
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
    symbol: {
      type: String,
      required: true,
    },
    ratePerTola: {
      type: Number,
      required: true,
      default: 0,
    },
    ratePerGram: {
      type: Number,
      required: true,
      default: 0,
    },
    ratePerOunce: {
      type: Number,
      required: true,
      default: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    updateCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// IMPORTANT: Compound unique index - one rate per user-shop combination
customGoldRateSchema.index({ userId: 1, shopId: 1 }, { unique: true });

// Calculate rates from tola
customGoldRateSchema.methods.calculateFromTola = function (ratePerTola) {
  const TOLA_TO_GRAMS = 11.664;
  const OUNCE_TO_GRAMS = 31.1035;

  this.ratePerTola = parseFloat(parseFloat(ratePerTola).toFixed(2));
  this.ratePerGram = parseFloat((ratePerTola / TOLA_TO_GRAMS).toFixed(2));
  this.ratePerOunce = parseFloat(
    ((ratePerTola / TOLA_TO_GRAMS) * OUNCE_TO_GRAMS).toFixed(2),
  );
  this.lastUpdated = new Date();
  this.updateCount += 1;
};

// Get rate for a specific shop
customGoldRateSchema.statics.getShopRate = async function (userId, shopId) {
  return await this.findOne({ userId, shopId });
};

// BACKWARD COMPATIBILITY: Get user's rate for active shop
customGoldRateSchema.statics.getUserRate = async function (userId) {
  const Shop = mongoose.model("Shop");
  const activeShop = await Shop.findOne({ userId, isActive: true });

  if (!activeShop) {
    return null;
  }

  return await this.findOne({ userId, shopId: activeShop._id });
};

// UPSERT: Update existing or create new - ALWAYS ONE RECORD PER SHOP
customGoldRateSchema.statics.setShopRate = async function (
  userId,
  shopId,
  country,
  currency,
  symbol,
  ratePerTola,
) {
  // Use findOneAndUpdate with upsert: true
  // This ensures we ALWAYS update if exists, create if not
  const rate = await this.findOneAndUpdate(
    { userId, shopId }, // Find by userId + shopId
    {
      $set: {
        country,
        currency,
        symbol,
      },
      $setOnInsert: {
        userId,
        shopId,
        ratePerTola: 0,
        ratePerGram: 0,
        ratePerOunce: 0,
        updateCount: 0,
      },
    },
    {
      upsert: true, // Create if doesn't exist
      new: false, // Return old document to check if it existed
      runValidators: true,
    },
  );

  // Now update the rates
  const updatedRate = await this.findOne({ userId, shopId });
  updatedRate.calculateFromTola(ratePerTola);
  await updatedRate.save();

  return updatedRate;
};

// BACKWARD COMPATIBILITY: Set user rate (uses active shop)
customGoldRateSchema.statics.setUserRate = async function (
  userId,
  country,
  currency,
  symbol,
  ratePerTola,
) {
  const Shop = mongoose.model("Shop");
  const activeShop = await Shop.findOne({ userId, isActive: true });

  if (!activeShop) {
    throw new Error("No active shop found. Please activate a shop first.");
  }

  return await this.setShopRate(
    userId,
    activeShop._id,
    country,
    currency,
    symbol,
    ratePerTola,
  );
};

// Get all rates for a user (across all shops)
customGoldRateSchema.statics.getUserRates = async function (userId) {
  return await this.find({ userId }).populate(
    "shopId",
    "shopName location.country isActive",
  );
};

const CustomGoldRate = mongoose.model("CustomGoldRate", customGoldRateSchema);

module.exports = CustomGoldRate;
