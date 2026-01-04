const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    phone: { type: String, required: true },
    password: { type: String,required:true},
    googleId: { type: String },
    role: { type: String, enum: ["user", "farmer", "admin"], default: "user" },
    address: {
      doorNo: String,
      street: String,
      city: String,
      state: String,
      zip: String,
    },
    farmDetails: {
      farmName: String,
      location: String,
      description: String,
    },
    refreshToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    averageRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const UserModel = mongoose.model("User", userSchema);

module.exports = UserModel;
