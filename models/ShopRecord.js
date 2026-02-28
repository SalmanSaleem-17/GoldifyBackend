const mongoose = require("mongoose");

/**
 * Transaction-based ShopRecord schema.
 * Each document = ONE transaction (add or subtract).
 * Stats (totals, balance) are computed via aggregation in the controller.
 */
const shopRecordSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ["add", "subtract"],
      required: true,
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
    },
    // Snapshot of rates at transaction time (direct values, no external reference)
    rateSnapshot: {
      ratePerTola: Number,
      ratePerGram: Number,
      ratePerOunce: Number,
      symbol: String,
      currency: String,
    },
    // Sale details (only for subtract/sell transactions)
    saleDetails: {
      totalPrice: Number,
      customerName: String,
      notes: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    // YYYY-MM-DD stored for efficient daily grouping queries
    dateString: {
      type: String,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Indexes for common query patterns
shopRecordSchema.index({ shopId: 1, dateString: 1 });
shopRecordSchema.index({ shopId: 1, timestamp: -1 });
shopRecordSchema.index({ userId: 1, timestamp: -1 });

const ShopRecord = mongoose.model("ShopRecord", shopRecordSchema);

module.exports = ShopRecord;
