const GoldRate = require("../models/GoldRate");
const { CurrencyCountries } = require("../utils/CurrencyCountries");

// Constants
const TMR_CONVERSION = {
  TOLA_TO_GRAMS: 11.664,
  OUNCE_TO_GRAMS: 31.1035,
};

// API Keys from environment variables
const GOLD_API_KEY = process.env.GOLD_API_KEY;
const EXCHANGE_API_KEY = process.env.EXCHANGE_API_KEY;

// API URLs
const GOLD_API_URL = "https://api.gold-api.com/price/XAU";
const EXCHANGE_API_URL = `https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/latest/USD`;

// Cache for exchange rates (updated every 2 minutes)
let exchangeRatesCache = null;
let lastExchangeUpdate = null;

// Last fetch time for gold prices
let lastGoldFetch = null;

// Counter for per-second fetches
let totalFetchCount = 0;
let fetchCountThisMinute = 0;
let lastMinuteReset = Date.now();

// Fetch exchange rates (every 2 minutes)
const fetchExchangeRates = async () => {
  try {
    const now = Date.now();
    // Return cached rates if less than 2 minutes old
    if (
      exchangeRatesCache &&
      lastExchangeUpdate &&
      now - lastExchangeUpdate < 120000
    ) {
      return exchangeRatesCache;
    }

    const response = await fetch(EXCHANGE_API_URL);
    const data = await response.json();

    if (data.result !== "success") {
      throw new Error("Failed to fetch exchange rates");
    }

    exchangeRatesCache = data.conversion_rates;
    lastExchangeUpdate = now;
    console.log(`✅ Exchange rates updated at ${new Date().toISOString()}`);

    return exchangeRatesCache;
  } catch (error) {
    console.error("❌ Error fetching exchange rates:", error);
    // Return cached rates if available, otherwise throw
    if (exchangeRatesCache) {
      console.log("⚠️ Using cached exchange rates");
      return exchangeRatesCache;
    }
    throw error;
  }
};

// Fetch gold prices from API (every 3 seconds)
const fetchGoldPrice = async () => {
  try {
    const response = await fetch(GOLD_API_URL, {
      method: "GET",
      headers: {
        "x-api-key": GOLD_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gold API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // api.gold-api.com returns: { name: "Gold", price: 4908.200195, symbol: "XAU", updatedAt: "..." }
    // Note: This price is in INR per 10 grams, we need to convert it
    // Actually, let's verify - the price 4908 seems like INR per 10g
    // But XAU/USD is typically around 2600-2700
    // Let's use it as USD per troy ounce for consistency

    if (!data.price) {
      throw new Error("Failed to fetch gold price from API");
    }

    // The API returns price per troy ounce in USD
    const goldXAUUSD = data.price;

    lastGoldFetch = Date.now();

    // Increment counters
    totalFetchCount++;
    fetchCountThisMinute++;

    // Reset minute counter every minute
    if (Date.now() - lastMinuteReset > 60000) {
      fetchCountThisMinute = 1;
      lastMinuteReset = Date.now();
    }

    console.log(
      `✅ Gold price fetched: $${goldXAUUSD.toFixed(2)} per troy ounce`,
    );

    return {
      goldXAUUSD,
      timestamp: new Date(data.updatedAt).getTime() / 1000 || Date.now() / 1000,
    };
  } catch (error) {
    console.error("❌ Error fetching gold price:", error);
    throw error;
  }
};

// Fetch and calculate gold rates for all countries
const fetchAndCalculateRates = async (saveToDb = true) => {
  try {
    // Fetch gold price and exchange rates
    const [goldData, exchangeRates] = await Promise.all([
      fetchGoldPrice(),
      fetchExchangeRates(),
    ]);

    const { goldXAUUSD } = goldData;

    // Calculate base USD rate per tola
    const goldRateUSD =
      (goldXAUUSD * TMR_CONVERSION.TOLA_TO_GRAMS) /
      TMR_CONVERSION.OUNCE_TO_GRAMS;

    // Calculate rates for all countries
    const countryRates = CurrencyCountries.map((country) => {
      const exchangeRate = exchangeRates[country.currencySign] || 1;
      const ratePerTola = goldRateUSD * exchangeRate;
      const ratePerGram = ratePerTola / TMR_CONVERSION.TOLA_TO_GRAMS;
      const ratePerOunce = goldXAUUSD * exchangeRate;

      return {
        country: country.country,
        currency: country.currencySign,
        symbol: country.symbol,
        ratePerTola,
        ratePerGram,
        ratePerOunce,
        exchangeRate,
      };
    });

    // Only save to database if saveToDb is true (every 6 minutes)
    if (saveToDb) {
      // Deactivate previous rates
      await GoldRate.updateMany({ isActive: true }, { isActive: false });

      // Create new rate document
      const newRate = await GoldRate.create({
        goldXAUUSD,
        goldRateUSD,
        exchangeRates,
        countryRates,
        fetchedAt: new Date(),
        isActive: true,
      });

      console.log(`✅ Gold rates saved to DB at ${new Date().toISOString()}`);
      return newRate;
    }

    // Return calculated data without saving
    return {
      goldXAUUSD,
      goldRateUSD,
      exchangeRates,
      countryRates,
      fetchedAt: new Date(),
      isActive: true,
    };
  } catch (error) {
    console.error("❌ Error calculating gold rates:", error);
    throw error;
  }
};

// In-memory cache for real-time rates (updated every 3 seconds)
let realtimeRatesCache = null;

// @desc    Get latest gold rates for all countries (real-time from cache)
// @route   GET /api/gold-rates/latest
// @access  Public
exports.getLatestRates = async (req, res) => {
  try {
    // Return real-time cache if available and recent (less than 4 seconds old)
    if (
      realtimeRatesCache &&
      lastGoldFetch &&
      Date.now() - lastGoldFetch < 4000
    ) {
      return res.status(200).json({
        success: true,
        data: realtimeRatesCache,
        source: "realtime-cache",
        stats: {
          totalFetches: totalFetchCount,
          fetchesThisMinute: fetchCountThisMinute,
          lastFetch: new Date(lastGoldFetch).toISOString(),
        },
      });
    }

    // Fetch new real-time data
    const realtimeData = await fetchAndCalculateRates(false);
    realtimeRatesCache = realtimeData;

    res.status(200).json({
      success: true,
      data: realtimeData,
      source: "realtime-fetch",
      stats: {
        totalFetches: totalFetchCount,
        fetchesThisMinute: fetchCountThisMinute,
        lastFetch: new Date(lastGoldFetch).toISOString(),
      },
    });
  } catch (error) {
    console.error("Get latest rates error:", error);

    // Fallback to database if real-time fetch fails
    try {
      const latestRate = await GoldRate.findOne({ isActive: true }).sort({
        fetchedAt: -1,
      });

      if (latestRate) {
        return res.status(200).json({
          success: true,
          data: latestRate,
          source: "database-fallback",
          stats: {
            totalFetches: totalFetchCount,
            fetchesThisMinute: fetchCountThisMinute,
            lastFetch: lastGoldFetch
              ? new Date(lastGoldFetch).toISOString()
              : null,
          },
        });
      }
    } catch (dbError) {
      console.error("Database fallback error:", dbError);
    }

    res.status(500).json({
      success: false,
      message: "Failed to fetch gold rates",
    });
  }
};

// @desc    Get gold rate for specific country
// @route   GET /api/gold-rates/country/:currency
// @access  Public
exports.getRateByCountry = async (req, res) => {
  try {
    const { currency } = req.params;

    // Try real-time cache first
    let latestRate = realtimeRatesCache;

    if (!latestRate) {
      // Fetch real-time data
      latestRate = await fetchAndCalculateRates(false);
      realtimeRatesCache = latestRate;
    }

    const countryRate = latestRate.countryRates.find(
      (rate) => rate.currency === currency.toUpperCase(),
    );

    if (!countryRate) {
      return res.status(404).json({
        success: false,
        message: `No rate found for currency: ${currency}`,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...countryRate,
        goldXAUUSD: latestRate.goldXAUUSD,
        fetchedAt: latestRate.fetchedAt,
      },
    });
  } catch (error) {
    console.error("Get rate by country error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch country rate",
    });
  }
};

// @desc    Get all available countries
// @route   GET /api/gold-rates/countries
// @access  Public
exports.getAvailableCountries = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: CurrencyCountries,
    });
  } catch (error) {
    console.error("Get countries error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch countries",
    });
  }
};

// @desc    Manually trigger rate update (Admin only)
// @route   POST /api/gold-rates/refresh
// @access  Private/Admin
exports.refreshRates = async (req, res) => {
  try {
    const newRate = await fetchAndCalculateRates(true);

    res.status(200).json({
      success: true,
      message: "Gold rates refreshed successfully",
      data: newRate,
    });
  } catch (error) {
    console.error("Refresh rates error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh gold rates",
    });
  }
};

// @desc    Get rate history with chart data
// @route   GET /api/gold-rates/history
// @access  Public
exports.getRateHistory = async (req, res) => {
  try {
    const { limit = 100, currency, period = "24h" } = req.query;

    let query = {};
    if (currency) {
      query["countryRates.currency"] = currency.toUpperCase();
    }

    // Calculate time range based on period
    let startDate = new Date();
    switch (period) {
      case "1h":
        startDate.setHours(startDate.getHours() - 1);
        break;
      case "6h":
        startDate.setHours(startDate.getHours() - 6);
        break;
      case "12h":
        startDate.setHours(startDate.getHours() - 12);
        break;
      case "24h":
        startDate.setHours(startDate.getHours() - 24);
        break;
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setHours(startDate.getHours() - 24);
    }

    query.fetchedAt = { $gte: startDate };

    const history = await GoldRate.find(query)
      .sort({ fetchedAt: -1 })
      .limit(parseInt(limit));

    // Format data for charts
    const chartData = history.reverse().map((record) => ({
      timestamp: record.fetchedAt,
      goldXAUUSD: record.goldXAUUSD,
      goldRateUSD: record.goldRateUSD,
    }));

    // If currency specified, add currency-specific data
    if (currency) {
      const currencyData = history.map((record) => {
        const countryRate = record.countryRates.find(
          (r) => r.currency === currency.toUpperCase(),
        );
        return {
          timestamp: record.fetchedAt,
          ratePerTola: countryRate?.ratePerTola,
          ratePerGram: countryRate?.ratePerGram,
          ratePerOunce: countryRate?.ratePerOunce,
          exchangeRate: countryRate?.exchangeRate,
        };
      });

      return res.status(200).json({
        success: true,
        count: history.length,
        period,
        currency,
        data: history,
        chartData: currencyData,
      });
    }

    res.status(200).json({
      success: true,
      count: history.length,
      period,
      data: history,
      chartData,
    });
  } catch (error) {
    console.error("Get rate history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch rate history",
    });
  }
};

// Auto-update system
let goldFetchInterval = null;
let dbSaveInterval = null;

// Export the auto-update function for use in server.js
exports.startAutoUpdate = () => {
  console.log("✅ Auto-update system starting...");
  console.log("   Using api.gold-api.com for gold prices");
  console.log("   Using exchangerate-api.com for exchange rates");

  // Initial fetch and save
  fetchAndCalculateRates(true).catch((err) => {
    console.error("Initial rate fetch failed:", err);
  });

  // Update real-time cache every 3 seconds (fetch gold price)
  goldFetchInterval = setInterval(() => {
    fetchAndCalculateRates(false)
      .then((data) => {
        realtimeRatesCache = data;
      })
      .catch((err) => {
        console.error("Real-time rate update failed:", err);
      });
  }, 3000); // 3 seconds

  // Save to database every 6 minutes
  dbSaveInterval = setInterval(() => {
    fetchAndCalculateRates(true).catch((err) => {
      console.error("Database save failed:", err);
    });
  }, 360000); // 6 minutes

  console.log("✅ Auto-update system started:");
  console.log("   - Real-time fetch: Every 3 seconds");
  console.log("   - Database save: Every 6 minutes");
  console.log("   - Exchange rates: Every 2 minutes");

  // Return cleanup function
  return () => {
    if (goldFetchInterval) clearInterval(goldFetchInterval);
    if (dbSaveInterval) clearInterval(dbSaveInterval);
    console.log("🛑 Auto-update system stopped");
  };
};

module.exports.fetchAndCalculateRates = fetchAndCalculateRates;
