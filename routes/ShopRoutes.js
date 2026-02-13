const express = require("express");
const router = express.Router();
const {
  createShop,
  getUserShops,
  getShopById,
  updateShop,
  deleteShop,
  toggleShopActive,
  updateShopLogo,
  getAllShops,
} = require("../controllers/ShopController");
const { protect, adminOnly } = require("../middleware/Auth");
const { uploadShopLogo } = require("../config/cloudinary.config");

// Protected routes (authenticated users)
router.post("/", protect, uploadShopLogo.single("shopLogo"), createShop);
router.get("/", protect, getUserShops);
router.get("/:id", protect, getShopById);
router.put("/:id", protect, uploadShopLogo.single("shopLogo"), updateShop);
router.delete("/:id", protect, deleteShop);
router.patch("/:id/toggle-active", protect, toggleShopActive);
router.post(
  "/:id/logo",
  protect,
  uploadShopLogo.single("shopLogo"),
  updateShopLogo,
);

// Admin only routes
router.get("/admin/all", protect, adminOnly, getAllShops);

module.exports = router;
