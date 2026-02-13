const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    shopName: {
      type: String,
      required: [true, "Please provide shop name"],
      trim: true,
      minlength: [2, "Shop name must be at least 2 characters"],
      maxlength: [100, "Shop name cannot exceed 100 characters"],
    },
    contact: {
      countryCode: {
        type: String,
        required: [true, "Country code is required"],
        trim: true,
      },
      number: {
        type: String,
        required: [true, "Contact number is required"],
        trim: true,
      },
      fullNumber: {
        type: String,
        required: true,
        trim: true,
      },
    },
    shopLogo: {
      type: String,
      default: "https://www.svgrepo.com/show/309398/shop.svg",
    },
    location: {
      country: {
        type: String,
        required: [true, "Country is required"],
        trim: true,
      },
      countryCode: {
        type: String,
        required: true,
        trim: true,
      },
      state: {
        type: String,
        required: [true, "State is required"],
        trim: true,
      },
      stateCode: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        // required: [true, "City is required"],
        trim: true,
      },
      address: {
        type: String,
        required: [true, "Address is required"],
        trim: true,
        maxlength: [200, "Address cannot exceed 200 characters"],
      },
      nearestPlace: {
        type: String,
        trim: true,
        maxlength: [100, "Nearest place cannot exceed 100 characters"],
      },
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
shopSchema.index({ userId: 1, isActive: 1 });

const Shop = mongoose.model("Shop", shopSchema);

module.exports = Shop;
