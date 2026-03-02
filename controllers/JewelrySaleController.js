const JewelrySale = require("../models/JewelrySale");

// Create a new jewelry sale
const createSale = async (req, res) => {
  try {
    const userId = req.user._id;
    const shopId = req.user.shopId || req.body.shopId || undefined;

    const advance = parseFloat(req.body.advancePayment) || 0;
    const bal = req.body.calculations?.remainingBalance ?? 0;

    let paymentStatus = "pending";
    if (bal <= 0) paymentStatus = bal < 0 ? "overpaid" : "paid";
    else if (advance > 0) paymentStatus = "partial";

    const saleData = {
      ...req.body,
      userId,
      ...(shopId && { shopId }),
      currentPayment: advance,
      paymentStatus,
    };

    if (saleData.calculations) {
      saleData.calculations.arrears = Math.max(0, bal);
    }

    if (advance > 0) {
      saleData.paymentHistory = [
        { amount: advance, method: "cash", note: "Initial advance payment" },
      ];
    }

    const sale = new JewelrySale(saleData);
    await sale.save();

    res
      .status(201)
      .json({
        success: true,
        message: "Sale created successfully",
        data: sale,
      });
  } catch (error) {
    console.error("=== SALE CREATE ERROR ===");
    console.error("Message:", error.message);
    console.error("Name:", error.name);

    // Print each failing Mongoose validation field
    if (error.errors) {
      Object.keys(error.errors).forEach((key) => {
        console.error(`  Field [${key}]: ${error.errors[key].message}`);
      });
    }

    console.error("Body received:", JSON.stringify(req.body, null, 2));
    console.error("========================");

    res.status(500).json({
      success: false,
      message: error.message,
      fields: error.errors ? Object.keys(error.errors) : [],
      error: error.message,
    });
  }
};

// Get all sales for a user
const getAllSales = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      customerName,
      paymentStatus,
      deliveryStatus,
    } = req.query;

    const shopId = req.user.shopId || req.query.shopId;
    const query = shopId ? { shopId } : { userId };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (customerName)
      query.customerName = { $regex: customerName, $options: "i" };
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (deliveryStatus) query.deliveryStatus = deliveryStatus;

    const sales = await JewelrySale.find(query)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await JewelrySale.countDocuments(query);

    res.status(200).json({
      success: true,
      data: sales,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count,
    });
  } catch (error) {
    console.error("Error fetching sales:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch sales",
        error: error.message,
      });
  }
};

// Get single sale by ID
const getSaleById = async (req, res) => {
  try {
    const sale = await JewelrySale.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });
    res.status(200).json({ success: true, data: sale });
  } catch (error) {
    console.error("Error fetching sale:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch sale",
        error: error.message,
      });
  }
};

// Update sale
const updateSale = async (req, res) => {
  try {
    const sale = await JewelrySale.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });

    Object.keys(req.body).forEach((key) => {
      if (
        !["_id", "userId", "paymentHistory", "goldReturnHistory"].includes(key)
      ) {
        sale[key] = req.body[key];
      }
    });

    await sale.save();
    res
      .status(200)
      .json({
        success: true,
        message: "Sale updated successfully",
        data: sale,
      });
  } catch (error) {
    console.error("Error updating sale:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to update sale",
        error: error.message,
      });
  }
};

// Delete sale
const deleteSale = async (req, res) => {
  try {
    const sale = await JewelrySale.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });
    res
      .status(200)
      .json({ success: true, message: "Sale deleted successfully" });
  } catch (error) {
    console.error("Error deleting sale:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete sale",
        error: error.message,
      });
  }
};

// Get sales statistics
const getSalesStatistics = async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = req.query;

    const query = { userId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const sales = await JewelrySale.find(query);

    const totalGoldWeight = sales.reduce((sum, sale) => {
      const itemsTotal = (sale.items || []).reduce(
        (s, it) => s + (it.goldWeight || 0),
        0,
      );
      return sum + itemsTotal;
    }, 0);

    const stats = {
      totalSales: sales.length,
      totalRevenue: sales.reduce(
        (sum, s) => sum + s.calculations.totalPrice,
        0,
      ),
      totalBalance: sales.reduce(
        (sum, s) => sum + s.calculations.remainingBalance,
        0,
      ),
      totalArrears: sales.reduce(
        (sum, s) => sum + (s.calculations.arrears || 0),
        0,
      ),
      totalAdvance: sales.reduce((sum, s) => sum + s.advancePayment, 0),
      totalPayments: sales.reduce((sum, s) => sum + s.currentPayment, 0),
      totalGoldWeight,
      totalCustomerGold: sales.reduce((sum, s) => sum + s.customerGold, 0),
      averageSaleValue:
        sales.length > 0
          ? sales.reduce((sum, s) => sum + s.calculations.totalPrice, 0) /
            sales.length
          : 0,
      pendingSales: sales.filter((s) => s.paymentStatus === "pending").length,
      partialSales: sales.filter((s) => s.paymentStatus === "partial").length,
      paidSales: sales.filter((s) => s.paymentStatus === "paid").length,
      overpaidSales: sales.filter((s) => s.paymentStatus === "overpaid").length,
    };

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch statistics",
        error: error.message,
      });
  }
};

// Add payment
const addPayment = async (req, res) => {
  try {
    const { amount, method = "cash", note = "" } = req.body;
    if (!amount || amount <= 0)
      return res
        .status(400)
        .json({ success: false, message: "Valid payment amount required" });

    const sale = await JewelrySale.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });

    await sale.addPayment(amount, method, note);
    res
      .status(200)
      .json({
        success: true,
        message: "Payment added successfully",
        data: sale,
      });
  } catch (error) {
    console.error("Error adding payment:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to add payment",
        error: error.message,
      });
  }
};

// Mark sale as fully paid
const markAsPaid = async (req, res) => {
  try {
    const sale = await JewelrySale.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });

    await sale.markAsPaid();
    res
      .status(200)
      .json({
        success: true,
        message: "Sale marked as fully paid",
        data: sale,
      });
  } catch (error) {
    console.error("Error marking as paid:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to mark as paid",
        error: error.message,
      });
  }
};

// Add gold return
const addGoldReturn = async (req, res) => {
  try {
    const { weight, note = "" } = req.body;
    if (!weight || weight <= 0)
      return res
        .status(400)
        .json({ success: false, message: "Valid gold weight required" });

    const sale = await JewelrySale.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });

    await sale.addGoldReturn(weight, note);
    res
      .status(200)
      .json({
        success: true,
        message: "Gold return added successfully",
        data: sale,
      });
  } catch (error) {
    console.error("Error adding gold return:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to add gold return",
        error: error.message,
      });
  }
};

// Mark as delivered
const markAsDelivered = async (req, res) => {
  try {
    const sale = await JewelrySale.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });

    await sale.markAsDelivered(req.body.deliveryDate);
    res
      .status(200)
      .json({ success: true, message: "Sale marked as delivered", data: sale });
  } catch (error) {
    console.error("Error marking as delivered:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to mark as delivered",
        error: error.message,
      });
  }
};

// Get pending payments
const getPendingPayments = async (req, res) => {
  try {
    const sales = await JewelrySale.getPendingPayments(req.user._id);
    res.status(200).json({ success: true, data: sales });
  } catch (error) {
    console.error("Error fetching pending payments:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch pending payments",
        error: error.message,
      });
  }
};

// Get total arrears
const getTotalArrears = async (req, res) => {
  try {
    const totalArrears = await JewelrySale.getTotalArrears(req.user._id);
    res.status(200).json({ success: true, data: { totalArrears } });
  } catch (error) {
    console.error("Error fetching total arrears:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch total arrears",
        error: error.message,
      });
  }
};

module.exports = {
  createSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
  getSalesStatistics,
  addPayment,
  markAsPaid,
  addGoldReturn,
  markAsDelivered,
  getPendingPayments,
  getTotalArrears,
};
