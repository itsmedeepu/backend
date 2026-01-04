const Review = require("../models/ReviewModel");
const Order = require("../models/OrderModel");

exports.addReview = async (req, res) => {

  try {
    const { orderId, farmerId, rating, comment } = req.body;
    const userId = req.user.id;

    if (!orderId || !farmerId || !rating || !comment) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== "Delivered") {
      return res.status(400).json({ message: "You can only review delivered orders" });
    }

    if (String(order.user) !== userId) {
      return res.status(403).json({ message: "You did not place this order" });
    }

    if (String(order.farmer) !== farmerId) {
       return res.status(400).json({ message: "Order farmer does not match review farmer" });
    }

    const existingReview = await Review.findOne({ order: orderId, user: userId });
    if (existingReview) {
      return res.status(400).json({ message: "You have already reviewed this order" });
    }

    const review = await Review.create({
      user: userId,
      farmer: farmerId,
      order: orderId,
      rating,
      comment,
    });

    // Update farmer's average rating
    const stats = await Review.aggregate([
      { $match: { farmer: new (require('mongoose').Types.ObjectId)(farmerId) } },
      {
        $group: {
          _id: "$farmer",
          averageRating: { $avg: "$rating" },
          ratingCount: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      const User = require("../models/UserModel");
      await User.findByIdAndUpdate(farmerId, {
        averageRating: stats[0].averageRating,
        ratingCount: stats[0].ratingCount
      });
    }

    res.status(201).json({ message: "Review added successfully", review });
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getReviews = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const reviews = await Review.find({ farmer: farmerId })
      .populate("user", "name")
      .sort("-createdAt");
    
    res.json({ reviews });
  } catch (error) {
     console.error("Error fetching reviews:", error);
     res.status(500).json({ message: error.message });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("user", "name")
      .populate("farmer", "name farmDetails")
      .sort("-createdAt")
      .limit(10); 
    
    res.json({ reviews });
  } catch (error) {
     console.error("Error fetching all reviews:", error);
     res.status(500).json({ message: error.message });
  }
};
