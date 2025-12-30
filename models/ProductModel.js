const mongoose = require("mongoose");
const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  category: {
    type: String,
    enum: ["veggies", "fruits", "seeds"],
    default: "veggies",
  },
  unit: String,
  image: String,
  description: String,
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  available: { type: Boolean, default: true },
});

const ProductModel = mongoose.model("Product", ProductSchema);

module.exports = ProductModel;
