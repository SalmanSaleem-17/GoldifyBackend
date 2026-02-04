const mongoose = require("mongoose");

const goldRateSchema = new mongoose.Schema(
  {
    // Base gold rate in USD per ounce (XAU/USD)
    goldXAUUSD: {
      type: Number,
      required: true,
    },

    // Calculated rate per tola in USD
    goldRateUSD: {
      type: Number,
      required: true,
    },

    // Exchange rates for all currencies
    exchangeRates: {
      type: Map,
      of: Number,
      required: true,
    },

    // Country-specific rates (calculated from base rate)
    countryRates: [
      {
        country: String,
        currency: String,
        symbol: String,
        ratePerTola: Number,
        ratePerGram: Number,
        ratePerOunce: Number,
        exchangeRate: Number,
      },
    ],

    // Metadata
    fetchedAt: {
      type: Date,
      default: Date.now,
    },

    source: {
      type: String,
      default: "exchangerate-api.com & goldprice.org",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
goldRateSchema.index({ fetchedAt: -1 });
goldRateSchema.index({ isActive: 1 });

// Static method to get latest rate
goldRateSchema.statics.getLatestRate = async function () {
  return await this.findOne({ isActive: true }).sort({ fetchedAt: -1 });
};

// Static method to get rate for specific country
goldRateSchema.statics.getRateForCountry = async function (currency) {
  const latestRate = await this.getLatestRate();
  if (!latestRate) return null;

  return latestRate.countryRates.find((rate) => rate.currency === currency);
};

// Method to deactivate old rates
goldRateSchema.methods.deactivate = async function () {
  this.isActive = false;
  return await this.save();
};

const GoldRate = mongoose.model("GoldRate", goldRateSchema);

module.exports = GoldRate;
