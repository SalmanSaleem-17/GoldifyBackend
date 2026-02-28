const mongoose = require("mongoose");
const ShopRecord = require("../models/ShopRecord");
const Shop = require("../models/Shop");

// ── Helper: verify shop belongs to requesting user ────────────────────────────
const getVerifiedShop = async (shopId, userId) => {
  if (!shopId) return null;
  return await Shop.findOne({ _id: shopId, userId, isActive: true });
};

// ── Helper: extract shopId from request (query, body, or params) ─────────────
const resolveShopId = (req) =>
  req.query.shopId || req.body.shopId || req.params.shopId || null;

// ── Helper: today's date as YYYY-MM-DD string ─────────────────────────────────
const getTodayDateString = () => new Date().toISOString().split("T")[0];

// ── Helper: cumulative balance for a shop (all-time add − subtract) ───────────
const getCumulativeBalance = async (shopObjectId) => {
  const result = await ShopRecord.aggregate([
    { $match: { shopId: shopObjectId, isActive: true } },
    {
      $group: {
        _id: null,
        totalAdd: {
          $sum: { $cond: [{ $eq: ["$type", "add"] }, "$weight", 0] },
        },
        totalSubtract: {
          $sum: { $cond: [{ $eq: ["$type", "subtract"] }, "$weight", 0] },
        },
      },
    },
  ]);

  if (!result.length) return 0;
  return parseFloat((result[0].totalAdd - result[0].totalSubtract).toFixed(3));
};

// ── Helper: build today's summary object ─────────────────────────────────────
// balance = cumulative all-time balance (= available gold for selling)
const buildTodayRecord = async (shopId) => {
  const shopObjectId = new mongoose.Types.ObjectId(shopId);
  const dateString = getTodayDateString();

  const [transactions, balance] = await Promise.all([
    ShopRecord.find({ shopId: shopObjectId, dateString, isActive: true }).sort({
      timestamp: 1,
    }),
    getCumulativeBalance(shopObjectId),
  ]);

  let addTotal = 0;
  let subtractTotal = 0;
  let totalSalesAmount = 0;

  for (const t of transactions) {
    if (t.type === "add") {
      addTotal += t.weight;
    } else {
      subtractTotal += t.weight;
      if (t.saleDetails?.totalPrice) totalSalesAmount += t.saleDetails.totalPrice;
    }
  }

  return {
    addTotal: parseFloat(addTotal.toFixed(3)),
    subtractTotal: parseFloat(subtractTotal.toFixed(3)),
    balance, // cumulative all-time (what the frontend uses for sell checks)
    totalSalesAmount: parseFloat(totalSalesAmount.toFixed(2)),
    totalTransactions: transactions.length,
    dateString,
    transactions,
  };
};

// ── Helper: aggregate daily summaries for a shop over a date range ────────────
// Returns array of { dateString, addTotal, subtractTotal, balance, totalSalesAmount, totalTransactions }
const aggregateDailyRecords = async (shopObjectId, startDate, endDate) => {
  return await ShopRecord.aggregate([
    {
      $match: {
        shopId: shopObjectId,
        isActive: true,
        dateString: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: "$dateString",
        addTotal: {
          $sum: { $cond: [{ $eq: ["$type", "add"] }, "$weight", 0] },
        },
        subtractTotal: {
          $sum: { $cond: [{ $eq: ["$type", "subtract"] }, "$weight", 0] },
        },
        totalSalesAmount: { $sum: { $ifNull: ["$saleDetails.totalPrice", 0] } },
        totalTransactions: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        dateString: "$_id",
        addTotal: { $round: ["$addTotal", 3] },
        subtractTotal: { $round: ["$subtractTotal", 3] },
        balance: { $round: [{ $subtract: ["$addTotal", "$subtractTotal"] }, 3] },
        totalSalesAmount: { $round: ["$totalSalesAmount", 2] },
        totalTransactions: 1,
      },
    },
    { $sort: { dateString: -1 } },
  ]);
};

// @desc    Get today's shop summary (with cumulative balance)
// @route   GET /api/shop-records/today?shopId=<id>
// @access  Private
exports.getTodayRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const shopId = resolveShopId(req);

    if (!shopId) {
      return res
        .status(400)
        .json({ success: false, message: "shopId is required" });
    }

    const shop = await getVerifiedShop(shopId, userId);
    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: "Shop not found or access denied" });
    }

    const record = await buildTodayRecord(shopId);
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error("Get today record error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get today's record",
      error: error.message,
    });
  }
};

// @desc    Get all transactions for a specific date
// @route   GET /api/shop-records/date/:dateString?shopId=<id>
// @access  Private
exports.getRecordByDate = async (req, res) => {
  try {
    const userId = req.user.id;
    const shopId = resolveShopId(req);
    const { dateString } = req.params;

    if (!shopId) {
      return res
        .status(400)
        .json({ success: false, message: "shopId is required" });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    const shop = await getVerifiedShop(shopId, userId);
    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: "Shop not found or access denied" });
    }

    const transactions = await ShopRecord.find({
      shopId,
      dateString,
      isActive: true,
    }).sort({ timestamp: 1 });

    if (!transactions.length) {
      return res
        .status(404)
        .json({ success: false, message: "No record found for this date" });
    }

    let addTotal = 0;
    let subtractTotal = 0;
    let totalSalesAmount = 0;

    for (const t of transactions) {
      if (t.type === "add") {
        addTotal += t.weight;
      } else {
        subtractTotal += t.weight;
        if (t.saleDetails?.totalPrice) totalSalesAmount += t.saleDetails.totalPrice;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        dateString,
        addTotal: parseFloat(addTotal.toFixed(3)),
        subtractTotal: parseFloat(subtractTotal.toFixed(3)),
        balance: parseFloat((addTotal - subtractTotal).toFixed(3)),
        totalSalesAmount: parseFloat(totalSalesAmount.toFixed(2)),
        totalTransactions: transactions.length,
        transactions,
      },
    });
  } catch (error) {
    console.error("Get record by date error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get record",
      error: error.message,
    });
  }
};

// @desc    Add a new transaction
// @route   POST /api/shop-records/transaction
// @access  Private
exports.addTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, weight, customerName, notes, shopId } = req.body;

    if (!shopId) {
      return res
        .status(400)
        .json({ success: false, message: "shopId is required" });
    }

    if (!type || !["add", "subtract"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction type. Use 'add' or 'subtract'",
      });
    }

    if (!weight || weight <= 0) {
      return res.status(400).json({
        success: false,
        message: "Weight must be a positive number",
      });
    }

    const shop = await getVerifiedShop(shopId, userId);
    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: "Shop not found or access denied" });
    }

    // Get custom gold rate for this specific shop
    const CustomGoldRate = require("../models/CustomGoldRate");
    const customRate = await CustomGoldRate.getShopRate(userId, shopId);

    if (!customRate || customRate.ratePerTola === 0) {
      return res.status(400).json({
        success: false,
        message: "Please set your custom gold rate first",
      });
    }

    // For SUBTRACT: check cumulative balance (not just today's)
    if (type === "subtract") {
      const shopObjectId = new mongoose.Types.ObjectId(shopId);
      const balance = await getCumulativeBalance(shopObjectId);
      if (balance < weight) {
        return res.status(400).json({
          success: false,
          message: `Insufficient gold. Available: ${balance.toFixed(3)}g`,
        });
      }
    }

    const dateString = getTodayDateString();

    const rateSnapshot = {
      ratePerTola: customRate.ratePerTola,
      ratePerGram: customRate.ratePerGram,
      ratePerOunce: customRate.ratePerOunce,
      symbol: customRate.symbol,
      currency: customRate.currency,
    };

    const transactionData = {
      userId,
      shopId,
      type,
      weight: parseFloat(parseFloat(weight).toFixed(3)),
      rateSnapshot,
      timestamp: new Date(),
      dateString,
    };

    if (type === "subtract") {
      const totalPrice = parseFloat(
        (weight * customRate.ratePerGram).toFixed(2),
      );
      transactionData.saleDetails = {
        totalPrice,
        customerName: customerName || "Walk-in Customer",
        notes: notes || "",
      };
    }

    const newTransaction = await ShopRecord.create(transactionData);

    // Build updated today summary
    const record = await buildTodayRecord(shopId);

    res.status(201).json({
      success: true,
      message: "Transaction added successfully",
      data: record,
      transaction: newTransaction,
    });
  } catch (error) {
    console.error("Add transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add transaction",
      error: error.message,
    });
  }
};

// @desc    Delete a specific transaction
// @route   DELETE /api/shop-records/transaction/:transactionId?shopId=<id>
// @access  Private
exports.deleteTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const shopId = resolveShopId(req);
    const { transactionId } = req.params;

    if (!shopId) {
      return res
        .status(400)
        .json({ success: false, message: "shopId is required" });
    }

    const shop = await getVerifiedShop(shopId, userId);
    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: "Shop not found or access denied" });
    }

    const transaction = await ShopRecord.findOne({
      _id: transactionId,
      shopId,
    });

    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    await ShopRecord.deleteOne({ _id: transactionId });

    const record = await buildTodayRecord(shopId);
    res.status(200).json({
      success: true,
      message: "Transaction deleted successfully",
      data: record,
    });
  } catch (error) {
    console.error("Delete transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete transaction",
      error: error.message,
    });
  }
};

// @desc    Clear all of today's transactions for a shop
// @route   DELETE /api/shop-records/clear?shopId=<id>
// @access  Private
exports.clearTodayRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const shopId = resolveShopId(req);

    if (!shopId) {
      return res
        .status(400)
        .json({ success: false, message: "shopId is required" });
    }

    const shop = await getVerifiedShop(shopId, userId);
    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: "Shop not found or access denied" });
    }

    const dateString = getTodayDateString();
    await ShopRecord.deleteMany({ shopId, dateString });

    const record = await buildTodayRecord(shopId);
    res.status(200).json({
      success: true,
      message: "All transactions cleared successfully",
      data: record,
    });
  } catch (error) {
    console.error("Clear record error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear transactions",
      error: error.message,
    });
  }
};

// @desc    Get daily summaries in a date range
// @route   GET /api/shop-records/range?shopId=<id>&startDate=&endDate=
// @access  Private
exports.getRecordsInRange = async (req, res) => {
  try {
    const userId = req.user.id;
    const shopId = resolveShopId(req);
    const { startDate, endDate } = req.query;

    if (!shopId) {
      return res
        .status(400)
        .json({ success: false, message: "shopId is required" });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const shop = await getVerifiedShop(shopId, userId);
    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: "Shop not found or access denied" });
    }

    const shopObjectId = new mongoose.Types.ObjectId(shopId);
    const records = await aggregateDailyRecords(shopObjectId, startDate, endDate);

    const totalAdd = records.reduce((sum, r) => sum + r.addTotal, 0);
    const totalSubtract = records.reduce((sum, r) => sum + r.subtractTotal, 0);

    res.status(200).json({
      success: true,
      data: {
        records,
        summary: {
          totalDays: records.length,
          totalAdd: parseFloat(totalAdd.toFixed(3)),
          totalSubtract: parseFloat(totalSubtract.toFixed(3)),
          totalBalance: parseFloat((totalAdd - totalSubtract).toFixed(3)),
        },
      },
    });
  } catch (error) {
    console.error("Get records in range error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get records",
      error: error.message,
    });
  }
};

// @desc    Get monthly summary (daily aggregates for a month)
// @route   GET /api/shop-records/monthly/:year/:month?shopId=<id>
// @access  Private
exports.getMonthlySummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const shopId = resolveShopId(req);
    const { year, month } = req.params;

    if (!shopId) {
      return res
        .status(400)
        .json({ success: false, message: "shopId is required" });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid year or month" });
    }

    const shop = await getVerifiedShop(shopId, userId);
    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: "Shop not found or access denied" });
    }

    const monthStr = String(monthNum).padStart(2, "0");
    const startDate = `${yearNum}-${monthStr}-01`;
    // Last day of month
    const endDate = new Date(yearNum, monthNum, 0).toISOString().split("T")[0];

    const shopObjectId = new mongoose.Types.ObjectId(shopId);
    const records = await aggregateDailyRecords(shopObjectId, startDate, endDate);

    const totalAdd = records.reduce((sum, r) => sum + r.addTotal, 0);
    const totalSubtract = records.reduce((sum, r) => sum + r.subtractTotal, 0);

    res.status(200).json({
      success: true,
      data: {
        records,
        summary: {
          totalDays: records.length,
          totalAdd: parseFloat(totalAdd.toFixed(3)),
          totalSubtract: parseFloat(totalSubtract.toFixed(3)),
          totalBalance: parseFloat((totalAdd - totalSubtract).toFixed(3)),
        },
      },
    });
  } catch (error) {
    console.error("Get monthly summary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get monthly summary",
      error: error.message,
    });
  }
};

// @desc    Get recent days (aggregated daily summaries)
// @route   GET /api/shop-records/recent?shopId=<id>&limit=<n>
// @access  Private
exports.getRecentRecords = async (req, res) => {
  try {
    const userId = req.user.id;
    const shopId = resolveShopId(req);
    const limit = parseInt(req.query.limit) || 7;

    if (!shopId) {
      return res
        .status(400)
        .json({ success: false, message: "shopId is required" });
    }

    const shop = await getVerifiedShop(shopId, userId);
    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: "Shop not found or access denied" });
    }

    const shopObjectId = new mongoose.Types.ObjectId(shopId);

    const records = await ShopRecord.aggregate([
      { $match: { shopId: shopObjectId, isActive: true } },
      {
        $group: {
          _id: "$dateString",
          addTotal: {
            $sum: { $cond: [{ $eq: ["$type", "add"] }, "$weight", 0] },
          },
          subtractTotal: {
            $sum: { $cond: [{ $eq: ["$type", "subtract"] }, "$weight", 0] },
          },
          totalSalesAmount: {
            $sum: { $ifNull: ["$saleDetails.totalPrice", 0] },
          },
          totalTransactions: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          dateString: "$_id",
          addTotal: { $round: ["$addTotal", 3] },
          subtractTotal: { $round: ["$subtractTotal", 3] },
          balance: {
            $round: [{ $subtract: ["$addTotal", "$subtractTotal"] }, 3],
          },
          totalSalesAmount: { $round: ["$totalSalesAmount", 2] },
          totalTransactions: 1,
        },
      },
      { $sort: { dateString: -1 } },
      { $limit: limit },
    ]);

    res.status(200).json({ success: true, data: records });
  } catch (error) {
    console.error("Get recent records error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get recent records",
      error: error.message,
    });
  }
};

// @desc    Get statistics summary (today, current month, all-time)
// @route   GET /api/shop-records/statistics?shopId=<id>
// @access  Private
exports.getStatistics = async (req, res) => {
  try {
    const userId = req.user.id;
    const shopId = resolveShopId(req);

    if (!shopId) {
      return res
        .status(400)
        .json({ success: false, message: "shopId is required" });
    }

    const shop = await getVerifiedShop(shopId, userId);
    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: "Shop not found or access denied" });
    }

    const shopObjectId = new mongoose.Types.ObjectId(shopId);
    const now = new Date();
    const todayDateString = getTodayDateString();
    const monthStr = String(now.getMonth() + 1).padStart(2, "0");
    const monthStart = `${now.getFullYear()}-${monthStr}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    // Run all aggregations in parallel
    const [allTimeAgg, todayAgg, monthAgg] = await Promise.all([
      // All-time
      ShopRecord.aggregate([
        { $match: { shopId: shopObjectId, isActive: true } },
        {
          $group: {
            _id: null,
            totalAdd: {
              $sum: { $cond: [{ $eq: ["$type", "add"] }, "$weight", 0] },
            },
            totalSubtract: {
              $sum: { $cond: [{ $eq: ["$type", "subtract"] }, "$weight", 0] },
            },
            distinctDays: { $addToSet: "$dateString" },
          },
        },
      ]),
      // Today
      ShopRecord.aggregate([
        {
          $match: {
            shopId: shopObjectId,
            isActive: true,
            dateString: todayDateString,
          },
        },
        {
          $group: {
            _id: null,
            addTotal: {
              $sum: { $cond: [{ $eq: ["$type", "add"] }, "$weight", 0] },
            },
            subtractTotal: {
              $sum: { $cond: [{ $eq: ["$type", "subtract"] }, "$weight", 0] },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      // Current month
      ShopRecord.aggregate([
        {
          $match: {
            shopId: shopObjectId,
            isActive: true,
            dateString: { $gte: monthStart, $lte: monthEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalAdd: {
              $sum: { $cond: [{ $eq: ["$type", "add"] }, "$weight", 0] },
            },
            totalSubtract: {
              $sum: { $cond: [{ $eq: ["$type", "subtract"] }, "$weight", 0] },
            },
            distinctDays: { $addToSet: "$dateString" },
          },
        },
      ]),
    ]);

    const allTime = allTimeAgg[0] || {
      totalAdd: 0,
      totalSubtract: 0,
      distinctDays: [],
    };
    const today = todayAgg[0] || { addTotal: 0, subtractTotal: 0, count: 0 };
    const month = monthAgg[0] || {
      totalAdd: 0,
      totalSubtract: 0,
      distinctDays: [],
    };

    const cumulativeBalance = parseFloat(
      (allTime.totalAdd - allTime.totalSubtract).toFixed(3),
    );

    res.status(200).json({
      success: true,
      data: {
        today: {
          addTotal: parseFloat((today.addTotal || 0).toFixed(3)),
          subtractTotal: parseFloat((today.subtractTotal || 0).toFixed(3)),
          balance: cumulativeBalance, // current available gold
          transactionCount: today.count || 0,
        },
        currentMonth: {
          totalDays: month.distinctDays?.length || 0,
          totalAdd: parseFloat((month.totalAdd || 0).toFixed(3)),
          totalSubtract: parseFloat((month.totalSubtract || 0).toFixed(3)),
          totalBalance: parseFloat(
            ((month.totalAdd || 0) - (month.totalSubtract || 0)).toFixed(3),
          ),
        },
        allTime: {
          totalDays: allTime.distinctDays?.length || 0,
          totalAdd: parseFloat((allTime.totalAdd || 0).toFixed(3)),
          totalSubtract: parseFloat((allTime.totalSubtract || 0).toFixed(3)),
          totalBalance: cumulativeBalance,
        },
      },
    });
  } catch (error) {
    console.error("Get statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get statistics",
      error: error.message,
    });
  }
};

// @desc    Update a transaction (weight or type)
// @route   PUT /api/shop-records/transaction/:transactionId
// @access  Private
exports.updateTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const shopId = resolveShopId(req);
    const { transactionId } = req.params;
    const { weight, type } = req.body;

    if (!shopId) {
      return res
        .status(400)
        .json({ success: false, message: "shopId is required" });
    }

    const shop = await getVerifiedShop(shopId, userId);
    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: "Shop not found or access denied" });
    }

    const transaction = await ShopRecord.findOne({ _id: transactionId, shopId });

    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    if (weight !== undefined) {
      if (weight <= 0) {
        return res.status(400).json({
          success: false,
          message: "Weight must be a positive number",
        });
      }
      transaction.weight = parseFloat(parseFloat(weight).toFixed(3));
    }

    if (type !== undefined) {
      if (!["add", "subtract"].includes(type)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid transaction type" });
      }
      transaction.type = type;
    }

    await transaction.save();

    const record = await buildTodayRecord(shopId);
    res.status(200).json({
      success: true,
      message: "Transaction updated successfully",
      data: record,
    });
  } catch (error) {
    console.error("Update transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update transaction",
      error: error.message,
    });
  }
};

module.exports = exports;
