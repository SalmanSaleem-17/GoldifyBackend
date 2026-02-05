/**
 * Newsletter Controller
 * Handles newsletter subscription operations
 */

const Newsletter = require("../models/Newsletter");
const emailService = require("../services/email.service");

class NewsletterController {
  /**
   * Subscribe to newsletter
   * @route POST /api/newsletter/subscribe
   * @access Public
   */
  async subscribe(req, res) {
    try {
      const { email, source = "footer" } = req.body;

      // Validate email
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      // Get IP address and user agent
      const ipAddress =
        req.headers["x-forwarded-for"] || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"];

      // Check if email already exists
      let subscriber = await Newsletter.findOne({ email });

      if (subscriber) {
        // If already subscribed and active
        if (subscriber.status === "active") {
          return res.status(200).json({
            success: true,
            message: "You're already subscribed to our newsletter!",
            data: { email: subscriber.email },
          });
        }

        // If previously unsubscribed, resubscribe
        if (subscriber.status === "unsubscribed") {
          await subscriber.resubscribe();

          // Send welcome back email
          try {
            await emailService.sendNewsletterWelcomeEmail(email);
          } catch (emailError) {
            console.error("Failed to send welcome back email:", emailError);
          }

          return res.status(200).json({
            success: true,
            message: "Welcome back! You've been resubscribed successfully.",
            data: { email: subscriber.email },
          });
        }
      }

      // Create new subscriber
      subscriber = await Newsletter.create({
        email,
        source,
        ipAddress,
        userAgent,
        status: "active",
      });

      // Send welcome email
      try {
        await emailService.sendNewsletterWelcomeEmail(email);
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
        // Don't fail the subscription if email fails
      }

      return res.status(201).json({
        success: true,
        message: "Successfully subscribed to our newsletter!",
        data: {
          email: subscriber.email,
          subscribedAt: subscriber.subscribedAt,
        },
      });
    } catch (error) {
      console.error("Newsletter subscription error:", error);

      // Handle duplicate email error
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "This email is already subscribed",
        });
      }

      // Handle validation errors
      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to subscribe. Please try again later.",
      });
    }
  }

  /**
   * Unsubscribe from newsletter
   * @route POST /api/newsletter/unsubscribe
   * @access Public
   */
  async unsubscribe(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      const subscriber = await Newsletter.findOne({ email });

      if (!subscriber) {
        return res.status(404).json({
          success: false,
          message: "Email not found in our newsletter list",
        });
      }

      if (subscriber.status === "unsubscribed") {
        return res.status(200).json({
          success: true,
          message: "You're already unsubscribed",
        });
      }

      await subscriber.unsubscribe();

      return res.status(200).json({
        success: true,
        message: "Successfully unsubscribed from newsletter",
        data: { email: subscriber.email },
      });
    } catch (error) {
      console.error("Newsletter unsubscribe error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to unsubscribe. Please try again later.",
      });
    }
  }

  /**
   * Get newsletter statistics (Admin only)
   * @route GET /api/newsletter/stats
   * @access Private/Admin
   */
  async getStats(req, res) {
    try {
      const [totalSubscribers, activeSubscribers, unsubscribed] =
        await Promise.all([
          Newsletter.countDocuments(),
          Newsletter.countDocuments({ status: "active" }),
          Newsletter.countDocuments({ status: "unsubscribed" }),
        ]);

      // Get recent subscribers (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentSubscribers = await Newsletter.countDocuments({
        subscribedAt: { $gte: thirtyDaysAgo },
        status: "active",
      });

      return res.status(200).json({
        success: true,
        data: {
          total: totalSubscribers,
          active: activeSubscribers,
          unsubscribed,
          recentSubscribers,
        },
      });
    } catch (error) {
      console.error("Newsletter stats error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch newsletter statistics",
      });
    }
  }

  /**
   * Get all subscribers (Admin only)
   * @route GET /api/newsletter/subscribers
   * @access Private/Admin
   */
  async getSubscribers(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        status = "all",
        sortBy = "createdAt",
        order = "desc",
      } = req.query;

      const query = {};
      if (status !== "all") {
        query.status = status;
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { [sortBy]: order === "desc" ? -1 : 1 },
      };

      const subscribers = await Newsletter.find(query)
        .sort(options.sort)
        .limit(options.limit)
        .skip((options.page - 1) * options.limit)
        .select("-__v");

      const total = await Newsletter.countDocuments(query);

      return res.status(200).json({
        success: true,
        data: {
          subscribers,
          pagination: {
            total,
            page: options.page,
            limit: options.limit,
            pages: Math.ceil(total / options.limit),
          },
        },
      });
    } catch (error) {
      console.error("Get subscribers error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch subscribers",
      });
    }
  }

  /**
   * Delete subscriber (Admin only)
   * @route DELETE /api/newsletter/subscribers/:id
   * @access Private/Admin
   */
  async deleteSubscriber(req, res) {
    try {
      const { id } = req.params;

      const subscriber = await Newsletter.findByIdAndDelete(id);

      if (!subscriber) {
        return res.status(404).json({
          success: false,
          message: "Subscriber not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Subscriber deleted successfully",
      });
    } catch (error) {
      console.error("Delete subscriber error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete subscriber",
      });
    }
  }
}

module.exports = new NewsletterController();
