const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Type is required"],
      enum: ["Question", "Feedback", "New Feature Request"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Resolved", "Closed"],
      default: "Pending",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    adminResponse: {
      type: String,
      trim: true,
    },
    respondedAt: {
      type: Date,
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
contactSchema.index({ userId: 1, createdAt: -1 });
contactSchema.index({ status: 1, createdAt: -1 });
contactSchema.index({ type: 1, createdAt: -1 });

// Virtual for formatted creation date
contactSchema.virtual("formattedDate").get(function () {
  return this.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});

const Contact = mongoose.model("Contact", contactSchema);

module.exports = Contact;
