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

    // Options - UPDATED field names to match frontend
    chargeForAddedGold: {
      type: Boolean,
      default: false,
    },
    chargeExtraGold: {
      type: Boolean,
      default: false,
    },

    // Gold Rate
    goldRate: {
      type: Number,
      required: true,
    },

    // Calculated Values - UPDATED to match frontend
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
      excessGoldWeight: {
        type: Number,
        default: 0,
      },
      goldPrice: {
        type: Number,
        required: true,
      },
      extraGoldPrice: {
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

    // Payment History
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

    // Gold Return History
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

  // Recalculate based on new customer gold
  const totalGoldWeight = parseFloat(this.calculations.totalGoldWeight);
  const newCustomerGold = this.customerGold;

  if (totalGoldWeight > newCustomerGold) {
    // Jeweler needs to add gold
    this.calculations.goldAfterDeduction = totalGoldWeight - newCustomerGold;
    this.calculations.excessGoldWeight = 0;

    // Recalculate gold price if charging for added gold
    if (this.chargeForAddedGold) {
      const goldInTolas = this.calculations.goldAfterDeduction / 11.664;
      this.calculations.goldPrice = goldInTolas * this.goldRate;
    } else {
      this.calculations.goldPrice = 0;
    }
    this.calculations.extraGoldPrice = 0;
  } else {
    // Customer has excess gold
    this.calculations.goldAfterDeduction = 0;
    this.calculations.excessGoldWeight = newCustomerGold - totalGoldWeight;
    this.calculations.goldPrice = 0;

    // Recalculate extra gold price if charging for excess
    if (this.chargeExtraGold) {
      const excessInTolas = this.calculations.excessGoldWeight / 11.664;
      this.calculations.extraGoldPrice = excessInTolas * this.goldRate;
    } else {
      this.calculations.extraGoldPrice = 0;
    }
  }

  // Recalculate total price
  this.calculations.totalPrice =
    this.calculations.goldPrice +
    this.makingCharges +
    this.otherCharges +
    this.calculations.extraGoldPrice;

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
