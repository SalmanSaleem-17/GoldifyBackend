const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
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
    // For ADD: Store gold rate at time of purchase
    // For SUBTRACT: Store gold rate at time of sale
    customGoldRateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomGoldRate",
      required: true,
    },
    // Snapshot of rates at transaction time
    rateSnapshot: {
      ratePerTola: Number,
      ratePerGram: Number,
      ratePerOunce: Number,
      symbol: String,
      currency: String,
    },
    // Sale details (only for subtract/sell transactions)
    saleDetails: {
      totalPrice: Number, // weight × rate
      customerName: String,
      notes: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: true },
);

const shopRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    // Store date as YYYY-MM-DD for easy querying
    dateString: {
      type: String,
      required: true,
      index: true,
    },
    transactions: [transactionSchema],
    // Calculated totals
    addTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    subtractTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    balance: {
      type: Number,
      default: 0,
    },
    // Sales totals
    totalSalesAmount: {
      type: Number,
      default: 0,
    },
    totalTransactions: {
      type: Number,
      default: 0,
    },
    // Metadata
    lastUpdated: {
      type: Date,
      default: Date.now,
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

// Compound index for efficient querying by user and date
shopRecordSchema.index({ userId: 1, dateString: 1 }, { unique: true });

// Index for date range queries
shopRecordSchema.index({ userId: 1, date: -1 });

// Method to calculate totals
shopRecordSchema.methods.calculateTotals = function () {
  const addTotal = this.transactions
    .filter((t) => t.type === "add")
    .reduce((sum, t) => sum + t.weight, 0);

  const subtractTotal = this.transactions
    .filter((t) => t.type === "subtract")
    .reduce((sum, t) => sum + t.weight, 0);

  const totalSalesAmount = this.transactions
    .filter((t) => t.type === "subtract" && t.saleDetails)
    .reduce((sum, t) => sum + (t.saleDetails.totalPrice || 0), 0);

  this.addTotal = parseFloat(addTotal.toFixed(3));
  this.subtractTotal = parseFloat(subtractTotal.toFixed(3));
  this.balance = parseFloat((addTotal - subtractTotal).toFixed(3));
  this.totalSalesAmount = parseFloat(totalSalesAmount.toFixed(2));
  this.totalTransactions = this.transactions.length;
  this.lastUpdated = new Date();
};

// Static method to get today's record for a user
shopRecordSchema.statics.getTodayRecord = async function (userId) {
  const today = new Date();
  const dateString = today.toISOString().split("T")[0]; // YYYY-MM-DD

  let record = await this.findOne({ userId, dateString, isActive: true });

  if (!record) {
    record = await this.create({
      userId,
      date: today,
      dateString,
      transactions: [],
      addTotal: 0,
      subtractTotal: 0,
      balance: 0,
    });
  }

  return record;
};

// Static method to get record by date
shopRecordSchema.statics.getRecordByDate = async function (userId, dateString) {
  return await this.findOne({ userId, dateString, isActive: true });
};

// Static method to get records in date range
shopRecordSchema.statics.getRecordsInRange = async function (
  userId,
  startDate,
  endDate,
) {
  return await this.find({
    userId,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
    isActive: true,
  }).sort({ date: -1 });
};

// Static method to get monthly summary
shopRecordSchema.statics.getMonthlySummary = async function (
  userId,
  year,
  month,
) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const records = await this.find({
    userId,
    date: { $gte: startDate, $lte: endDate },
    isActive: true,
  }).sort({ date: -1 });

  const totalAdd = records.reduce((sum, r) => sum + r.addTotal, 0);
  const totalSubtract = records.reduce((sum, r) => sum + r.subtractTotal, 0);
  const totalBalance = totalAdd - totalSubtract;

  return {
    records,
    summary: {
      totalDays: records.length,
      totalAdd: parseFloat(totalAdd.toFixed(3)),
      totalSubtract: parseFloat(totalSubtract.toFixed(3)),
      totalBalance: parseFloat(totalBalance.toFixed(3)),
    },
  };
};

// Pre-save middleware to ensure totals are calculated
shopRecordSchema.pre("save", function () {
  if (this.isModified("transactions")) {
    this.calculateTotals();
  }
});

const ShopRecord = mongoose.model("ShopRecord", shopRecordSchema);

module.exports = ShopRecord;
