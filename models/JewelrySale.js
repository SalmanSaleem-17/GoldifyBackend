const mongoose = require("mongoose");

const jewelrySaleSchema = new mongoose.Schema(
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
      index: true,
    },

    // Customer Details
    customerName: { type: String, required: true, trim: true },
    contactNumber: { type: String, trim: true },

    // Multiple jewelry items (each with optional name, gold weight, stone weight)
    items: [
      {
        name: { type: String, trim: true, default: "" },
        goldWeight: { type: Number, required: true, min: 0 },
        stoneWeight: { type: Number, default: 0, min: 0 },
      },
    ],

    // Polish per Tola
    polishPerTola: { type: Number, default: 0, min: 0 },

    // Customer Gold (what customer provided)
    customerGold: { type: Number, default: 0, min: 0 },

    // Charge options
    chargeForAddedGold: { type: Boolean, default: false },
    chargeExtraGold: { type: Boolean, default: false },

    // Charges
    makingCharges: { type: Number, default: 0, min: 0 },

    // Multiple other charges with optional descriptions
    otherCharges: [
      {
        description: { type: String, trim: true, default: "" },
        amount: { type: Number, required: true, min: 0 },
      },
    ],

    // Payment
    advancePayment: { type: Number, default: 0, min: 0 },
    currentPayment: { type: Number, default: 0, min: 0 },

    // Gold Rate (per tola)
    goldRate: { type: Number, required: true },

    // Calculated Values
    calculations: {
      totalGoldWeight: { type: Number, required: true },
      totalStoneWeight: { type: Number, default: 0 },
      netGoldWeight: { type: Number, required: true },
      polishWeight: { type: Number, required: true },
      totalWithPolish: { type: Number, required: true },
      goldAfterDeduction: { type: Number, required: true },
      excessGoldWeight: { type: Number, default: 0 },
      goldPrice: { type: Number, required: true },
      extraGoldPrice: { type: Number, default: 0 },
      totalOtherCharges: { type: Number, default: 0 },
      totalPrice: { type: Number, required: true },
      remainingBalance: { type: Number, required: true },
      arrears: { type: Number, default: 0 },
    },

    // Payment Status
    paymentStatus: {
      type: String,
      enum: ["pending", "partial", "paid", "overpaid"],
      default: "pending",
    },

    // Delivery Status
    deliveryStatus: {
      type: String,
      enum: ["pending", "ready", "delivered"],
      default: "pending",
    },

    // Payment History
    paymentHistory: [
      {
        amount: { type: Number, required: true },
        date: { type: Date, default: Date.now },
        method: {
          type: String,
          enum: ["cash", "card", "bank_transfer", "online", "gold", "other"],
          default: "cash",
        },
        note: { type: String, trim: true },
      },
    ],

    // Gold Return History
    goldReturnHistory: [
      {
        weight: { type: Number, required: true },
        date: { type: Date, default: Date.now },
        note: { type: String, trim: true },
      },
    ],

    // Notes
    notes: { type: String, trim: true },

    // Dates
    orderDate: { type: Date, default: Date.now },
    deliveryDate: { type: Date },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Indexes
jewelrySaleSchema.index({ userId: 1, date: -1 });
jewelrySaleSchema.index({ shopId: 1, date: -1 });
jewelrySaleSchema.index({ customerName: 1 });
jewelrySaleSchema.index({ paymentStatus: 1 });
jewelrySaleSchema.index({ deliveryStatus: 1 });

// Virtual
jewelrySaleSchema.virtual("isPaymentComplete").get(function () {
  return this.calculations.remainingBalance <= 0;
});

// Internal helper
function syncPaymentStatus(sale) {
  const bal = sale.calculations.remainingBalance;
  if (bal <= 0) {
    sale.paymentStatus = bal < 0 ? "overpaid" : "paid";
  } else if (sale.currentPayment > 0) {
    sale.paymentStatus = "partial";
  } else {
    sale.paymentStatus = "pending";
  }
}

// Add cash payment
jewelrySaleSchema.methods.addPayment = function (amount, method = "cash", note = "") {
  this.paymentHistory.push({ amount: parseFloat(amount), method, note });
  this.currentPayment = (this.currentPayment || 0) + parseFloat(amount);
  this.calculations.remainingBalance = this.calculations.totalPrice - this.currentPayment;
  this.calculations.arrears = Math.max(0, this.calculations.remainingBalance);
  syncPaymentStatus(this);
  return this.save();
};

// Mark sale as fully paid (settle all arrears)
jewelrySaleSchema.methods.markAsPaid = function () {
  const remaining = this.calculations.remainingBalance;
  if (remaining > 0) {
    this.paymentHistory.push({ amount: remaining, method: "cash", note: "Marked as fully paid" });
    this.currentPayment = (this.currentPayment || 0) + remaining;
  }
  this.calculations.remainingBalance = 0;
  this.calculations.arrears = 0;
  this.paymentStatus = "paid";
  return this.save();
};

// Add gold return
jewelrySaleSchema.methods.addGoldReturn = function (weight, note = "") {
  this.goldReturnHistory.push({ weight: parseFloat(weight), note });
  this.customerGold = (this.customerGold || 0) + parseFloat(weight);

  const totalWithPolish = parseFloat(this.calculations.totalWithPolish || this.calculations.totalGoldWeight);
  const newCustomerGold = this.customerGold;

  if (totalWithPolish > newCustomerGold) {
    this.calculations.goldAfterDeduction = totalWithPolish - newCustomerGold;
    this.calculations.excessGoldWeight = 0;
    this.calculations.goldPrice = this.chargeForAddedGold
      ? (this.calculations.goldAfterDeduction / 11.664) * this.goldRate
      : 0;
    this.calculations.extraGoldPrice = 0;
  } else {
    this.calculations.goldAfterDeduction = 0;
    this.calculations.excessGoldWeight = newCustomerGold - totalWithPolish;
    this.calculations.goldPrice = 0;
    this.calculations.extraGoldPrice = this.chargeExtraGold
      ? (this.calculations.excessGoldWeight / 11.664) * this.goldRate
      : 0;
  }

  this.calculations.totalPrice =
    this.calculations.goldPrice +
    this.makingCharges +
    (this.calculations.totalOtherCharges || 0) +
    this.calculations.extraGoldPrice;

  this.calculations.remainingBalance = this.calculations.totalPrice - this.currentPayment;
  this.calculations.arrears = Math.max(0, this.calculations.remainingBalance);
  syncPaymentStatus(this);
  return this.save();
};

// Mark as delivered
jewelrySaleSchema.methods.markAsDelivered = function (deliveryDate = new Date()) {
  this.deliveryStatus = "delivered";
  this.deliveryDate = deliveryDate;
  return this.save();
};

// Static: pending payments
jewelrySaleSchema.statics.getPendingPayments = function (userId) {
  return this.find({ userId, paymentStatus: { $in: ["pending", "partial"] } }).sort({ date: -1 });
};

// Static: total arrears
jewelrySaleSchema.statics.getTotalArrears = async function (userId) {
  const sales = await this.find({ userId, paymentStatus: { $in: ["pending", "partial"] } });
  return sales.reduce((sum, sale) => sum + (sale.calculations.arrears || 0), 0);
};

module.exports = mongoose.model("JewelrySale", jewelrySaleSchema);
