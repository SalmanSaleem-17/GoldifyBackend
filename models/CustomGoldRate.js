const mongoose = require("mongoose");

const customGoldRateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
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

// Get user's rate
customGoldRateSchema.statics.getUserRate = async function (userId) {
  return await this.findOne({ userId });
};

// Create or update rate
customGoldRateSchema.statics.setUserRate = async function (
  userId,
  country,
  currency,
  symbol,
  ratePerTola,
) {
  let rate = await this.findOne({ userId });

  if (rate) {
    rate.country = country;
    rate.currency = currency;
    rate.symbol = symbol;
    rate.calculateFromTola(ratePerTola);
  } else {
    rate = new this({
      userId,
      country,
      currency,
      symbol,
      ratePerTola: 0,
      ratePerGram: 0,
      ratePerOunce: 0,
      updateCount: 0,
    });
    rate.calculateFromTola(ratePerTola);
  }

  await rate.save();
  return rate;
};

const CustomGoldRate = mongoose.model("CustomGoldRate", customGoldRateSchema);

module.exports = CustomGoldRate;
