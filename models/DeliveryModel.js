const mongoose = require("mongoose");

const deliverySchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    carrierName: { type: String, required: true },
    trackingId: { type: String },
    phone: { type: String }, // Delivery partner contact
    status: {
      type: String,
      enum: ["Pending", "Shipped", "Delivered"],
      default: "Pending",
    },
    shippedDate: { type: Date },
    deliveredDate: { type: Date },
    address: { type: String }, // Target shipping address
    customerContact: {
      phone: String,
      email: String,
      name: String
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Delivery", deliverySchema);
