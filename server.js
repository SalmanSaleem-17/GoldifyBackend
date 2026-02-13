const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// Load env vars
dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

// Routes
app.use("/api/auth", require("./routes/AuthRoutes"));
app.use("/api/profile", require("./routes/ProfileImageRoutes")); // Profile Image Routes
app.use("/api/gold-rates", require("./routes/GoldRateRoutes"));
app.use("/api/shop-records", require("./routes/ShopRecordRoutes"));
app.use("/api/custom-gold-rate", require("./routes/CustomGoldRateRoutes"));
app.use("/api/contacts", require("./routes/ContactRoutes"));
app.use("/api/jewelry-sales", require("./routes/JewelrySaleRoutes"));
app.use("/api/newsletter", require("./routes/NewsletterRoutes"));
app.use("/api/shops", require("./routes/ShopRoutes"));

// Health check route
app.get("/", (req, res) => {
  res.json({ message: "Goldify API is running!" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Multer file size error
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File size too large. Maximum size is 5MB.",
    });
  }

  // Multer file type error
  if (err.message === "Only image files are allowed!") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Cloudinary error
  if (err.message && err.message.includes("cloudinary")) {
    return res.status(500).json({
      success: false,
      message: "Image upload service error. Please try again.",
    });
  }

  res.status(500).json({
    success: false,
    message: err.message || "Something went wrong!",
  });
});

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

// Import gold rate auto-update
const { startAutoUpdate } = require("./controllers/GoldrateController");

// Global variable to store cleanup function
let goldRateCleanup = null;

// Start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);

    // Start gold rate auto-update
    console.log("🔄 Starting gold rate auto-update (every 15 seconds)...");
    goldRateCleanup = startAutoUpdate();
  });
});

// Graceful shutdown handlers
process.on("SIGINT", async () => {
  console.log("\n⏹️  Shutting down gracefully...");

  // Stop gold rate updates
  if (goldRateCleanup) {
    goldRateCleanup();
    console.log("✅ Gold rate updates stopped");
  }

  // Close database connection
  try {
    await mongoose.connection.close();
    console.log("✅ MongoDB connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  console.log("\n⏹️  SIGTERM received. Shutting down...");

  if (goldRateCleanup) {
    goldRateCleanup();
  }

  try {
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
});

// Email related files
const emailService = require("./services/email.service");
const emailTransporter = require("./services/emailTransporter.service");
const emailConfig = require("./config/email.config");
const emailTemplates = require("./templates/email.templates");

module.exports = {
  // Main service
  emailService,

  // Individual components (if needed)
  emailTransporter,
  emailConfig,
  emailTemplates,
};

// DO NOT export multiple things - just export app
module.exports = app;
