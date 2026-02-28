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
const { shopLogoMemoryUpload } = require("../config/cloudinary.config");

// Protected routes (authenticated users)
router.post("/", protect, shopLogoMemoryUpload.single("shopLogo"), createShop);
router.get("/", protect, getUserShops);
router.get("/:id", protect, getShopById);
router.put("/:id", protect, shopLogoMemoryUpload.single("shopLogo"), updateShop);
router.delete("/:id", protect, deleteShop);
router.patch("/:id/toggle-active", protect, toggleShopActive);
router.post(
  "/:id/logo",
  protect,
  shopLogoMemoryUpload.single("shopLogo"),
  updateShopLogo,
);

// Admin only routes
router.get("/admin/all", protect, adminOnly, getAllShops);

module.exports = router;
