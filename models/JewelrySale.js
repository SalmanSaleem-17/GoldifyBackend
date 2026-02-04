const mongoose = require("mongoose");

const jewelrySaleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Customer Details
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    contactNumber: {
      type: String,
      trim: true,
    },

    // Gold Weight Details
    goldWeight: {
      type: Number,
      required: true,
      min: 0,
    },
    stoneWeight: {
      type: Number,
      default: 0,
      min: 0,
    },
    polishPerTola: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Customer Gold (what customer provided)
    customerGold: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Charges
    makingCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    otherCharges: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Payment Details
    advancePayment: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Current Payment (what customer has paid so far including advance)
    currentPayment: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Options
    includeCustomerGoldPrice: {
      type: Boolean,
      default: false,
    },

    // Gold Rate
    goldRate: {
      type: Number,
      required: true,
    },

    // Calculated Values
    calculations: {
      netGoldWeight: {
        type: Number,
        required: true,
      },
      polishWeight: {
        type: Number,
        required: true,
      },
      totalGoldWeight: {
        type: Number,
        required: true,
      },
      goldAfterDeduction: {
        type: Number,
        required: true,
      },
      goldPrice: {
        type: Number,
        required: true,
      },
      customerGoldPrice: {
        type: Number,
        default: 0,
      },
      totalPrice: {
        type: Number,
        required: true,
      },
      remainingBalance: {
        type: Number,
        required: true,
      },

      // Final Calculations (NEW)
      finalCustomerPayment: {
        type: Number,
        default: 0,
      },
      finalCustomerGoldWeight: {
        type: Number,
        default: 0,
      },
      arrears: {
        type: Number,
        default: 0,
      },
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

    // Payment History (NEW)
    paymentHistory: [
      {
        amount: {
          type: Number,
          required: true,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        method: {
          type: String,
          enum: ["cash", "card", "bank_transfer", "online", "gold", "other"],
          default: "cash",
        },
        note: {
          type: String,
          trim: true,
        },
      },
    ],

    // Gold Return History (NEW)
    goldReturnHistory: [
      {
        weight: {
          type: Number,
          required: true,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        note: {
          type: String,
          trim: true,
        },
      },
    ],

    // Notes
    notes: {
      type: String,
      trim: true,
    },

    // Dates
    orderDate: {
      type: Date,
      default: Date.now,
    },
    deliveryDate: {
      type: Date,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better query performance
jewelrySaleSchema.index({ userId: 1, date: -1 });
jewelrySaleSchema.index({ customerName: 1 });
jewelrySaleSchema.index({ paymentStatus: 1 });
jewelrySaleSchema.index({ deliveryStatus: 1 });

// Virtual for checking if payment is complete
jewelrySaleSchema.virtual("isPaymentComplete").get(function () {
  return this.calculations.remainingBalance <= 0;
});

// Method to add payment
jewelrySaleSchema.methods.addPayment = function (
  amount,
  method = "cash",
  note = "",
) {
  this.paymentHistory.push({
    amount: parseFloat(amount),
    method,
    note,
  });

  this.currentPayment = (this.currentPayment || 0) + parseFloat(amount);
  this.calculations.finalCustomerPayment = this.currentPayment;
  this.calculations.remainingBalance =
    this.calculations.totalPrice - this.currentPayment;
  this.calculations.arrears = this.calculations.remainingBalance;

  // Update payment status
  if (this.calculations.remainingBalance <= 0) {
    this.paymentStatus =
      this.calculations.remainingBalance < 0 ? "overpaid" : "paid";
  } else if (this.currentPayment > 0) {
    this.paymentStatus = "partial";
  } else {
    this.paymentStatus = "pending";
  }

  return this.save();
};

// Method to add gold return
jewelrySaleSchema.methods.addGoldReturn = function (weight, note = "") {
  this.goldReturnHistory.push({
    weight: parseFloat(weight),
    note,
  });

  this.customerGold = (this.customerGold || 0) + parseFloat(weight);
  this.calculations.finalCustomerGoldWeight = this.customerGold;

  // Recalculate gold after deduction
  this.calculations.goldAfterDeduction = Math.max(
    0,
    this.calculations.totalGoldWeight - this.customerGold,
  );

  // Recalculate gold price
  this.calculations.goldPrice =
    (this.calculations.goldAfterDeduction / 11.664) * this.goldRate;

  // Recalculate total price
  this.calculations.totalPrice =
    this.calculations.goldPrice +
    this.makingCharges +
    this.otherCharges +
    (this.includeCustomerGoldPrice ? this.calculations.customerGoldPrice : 0);

  // Recalculate remaining balance and arrears
  this.calculations.remainingBalance =
    this.calculations.totalPrice - this.currentPayment;
  this.calculations.arrears = this.calculations.remainingBalance;

  // Update payment status
  if (this.calculations.remainingBalance <= 0) {
    this.paymentStatus =
      this.calculations.remainingBalance < 0 ? "overpaid" : "paid";
  } else if (this.currentPayment > 0) {
    this.paymentStatus = "partial";
  }

  return this.save();
};

// Method to mark as delivered
jewelrySaleSchema.methods.markAsDelivered = function (
  deliveryDate = new Date(),
) {
  this.deliveryStatus = "delivered";
  this.deliveryDate = deliveryDate;
  return this.save();
};

// Static method to get pending payments for a user
jewelrySaleSchema.statics.getPendingPayments = function (userId) {
  return this.find({
    userId,
    paymentStatus: { $in: ["pending", "partial"] },
  }).sort({ date: -1 });
};

// Static method to get total arrears for a user
jewelrySaleSchema.statics.getTotalArrears = async function (userId) {
  const sales = await this.find({
    userId,
    paymentStatus: { $in: ["pending", "partial"] },
  });

  return sales.reduce((sum, sale) => sum + sale.calculations.arrears, 0);
};

module.exports = mongoose.model("JewelrySale", jewelrySaleSchema);
