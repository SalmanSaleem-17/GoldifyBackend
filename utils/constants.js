/**
 * Application Constants
 */

// Fixed Default Shop ID for non-shopkeeper users
const FIXED_DEFAULT_SHOP_ID =
  process.env.DEFAULT_SHOP_ID || "000000000000000000000001";

// Default shop configuration
const DEFAULT_SHOP_CONFIG = {
  shopName: "Default Personal Use",
  contact: {
    countryCode: "+00",
    number: "0000000000",
    fullNumber: "+00 0000000000",
  },
  shopLogo: "https://www.svgrepo.com/show/309398/shop.svg",
  location: {
    country: "Global",
    countryCode: "GL",
    state: "Not Applicable",
    stateCode: "NA",
    city: "Not Applicable",
    address: "Default Shop for Personal Use",
    nearestPlace: "N/A",
  },
};

// Gold calculation constants
const GOLD_UNITS = {
  TOLA_TO_GRAMS: 11.664,
  MASHA_TO_GRAMS: 0.972,
  RATTI_TO_GRAMS: 0.1215,
  OUNCE_TO_GRAMS: 31.1035,
};

module.exports = {
  FIXED_DEFAULT_SHOP_ID,
  DEFAULT_SHOP_CONFIG,
  GOLD_UNITS,
};
