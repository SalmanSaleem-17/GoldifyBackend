/**
 * Newsletter Subscriber Model
 * Schema for newsletter subscriptions
 */

const mongoose = require("mongoose");

const newsletterSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
    },
    status: {
      type: String,
      enum: ["active", "unsubscribed"],
      default: "active",
    },
    source: {
      type: String,
      enum: ["footer", "homepage", "popup", "other"],
      default: "footer",
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    unsubscribedAt: {
      type: Date,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
newsletterSchema.index({ email: 1 });
newsletterSchema.index({ status: 1 });
newsletterSchema.index({ createdAt: -1 });

// Instance method to unsubscribe
newsletterSchema.methods.unsubscribe = function () {
  this.status = "unsubscribed";
  this.unsubscribedAt = new Date();
  return this.save();
};

// Instance method to resubscribe
newsletterSchema.methods.resubscribe = function () {
  this.status = "active";
  this.unsubscribedAt = null;
  return this.save();
};

// Static method to get active subscribers count
newsletterSchema.statics.getActiveCount = function () {
  return this.countDocuments({ status: "active" });
};

// Static method to get subscribers by date range
newsletterSchema.statics.getSubscribersByDateRange = function (
  startDate,
  endDate,
) {
  return this.find({
    subscribedAt: {
      $gte: startDate,
      $lte: endDate,
    },
  });
};

const Newsletter = mongoose.model("Newsletter", newsletterSchema);

module.exports = Newsletter;
