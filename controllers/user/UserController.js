const User = require("../../models/UserModel.js");
const { comparePassword, hashPassword } = require("../../utils/hash.js");
const jwt = require("jsonwebtoken");
const generateTokens = require("../../utils/jwt");

exports.GetUserDetails = async (req, res) => {
  let user;

  if (req.user.role === "user") {
    user = await User.findById(req.user.id).select("-password");
  } else if (req.user.role === "farmer") {
    user = await User.findById(req.user.id);
  }

  if (!user) return res.status(404).json({ message: "User not found" });

  res.json(user);
};

exports.refreshAccessToken = async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    console.log("REFRESH FAIL: No token in cookies");
    return res.status(401).json({ message: "refresh token not found" });
  }

  const user = await User.findOne({ refreshToken: token });
  if (!user) {
    console.log("REFRESH FAIL: Token not found in DB or mismatch for token:", token.substring(0, 10) + "...");
    return res.status(403).json({ message: "refresh token invalid" });
  }

  jwt.verify(token, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
    if (err) {
      console.log("REFRESH FAIL: Verification failed:", err.message);
      return res.status(403).json({ message: "refresh token expired" });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens({
       id: user._id, 
       role: user.role 
    });

    // Update DB
    user.refreshToken = newRefreshToken;
    await user.save();

    // Set new cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ 
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        farmName: user.farmDetails?.farmName,
        location: user.farmDetails?.location,
        farmDescription: user.farmDetails?.description,
      }
    });
  });
};

exports.getFarms = async (req, res) => {
  try {
    const farmers = await User.find({ role: "farmer" }).select(
      "farmDetails name photoUrl"
    );
    const list = farmers.map((f) => ({
      id: f._id,
      name: f.farmDetails?.farmName || f.name,
      story: f.farmDetails?.description || "",
      photoUrl: f.photoUrl || null,
      location: f.farmDetails?.location || null,
      rating: f.rating || 0,
    }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateUserDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, address, phone } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        ...(name && { name }),
        ...(email && { email }),
        ...(address && { address }),
        ...(phone && { phone }),
      },
      { new: true, runValidators: true }
    ).select("-password -refreshToken");

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    res.json({
      message: "User details updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldpassword: oldPassword, newpassword: newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Old and new password required" });
    }

    const user = await User.findById(userId);
    if (!user || !user.password) {
      return res.status(400).json({ message: "Password reset not allowed" });
    }

    const isMatch = await comparePassword(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }

    user.password = await hashPassword(newPassword);
    user.refreshToken = null; // invalidate sessions
    await user.save();

    res.json({ message: "Password updated successfully. Please login again." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateFarmDetails = async (req, res) => {
  try {
    if (req.user.role !== "farmer") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { farmName, location, description } = req.body;

    const farmer = await User.findByIdAndUpdate(
      req.user.id,
      {
        farmDetails: {
          ...(farmName && { farmName }),
          ...(location && { location }),
          ...(description && { description }),
        },
      },
      { new: true }
    ).select("-password -refreshToken");

    if (!farmer) return res.status(404).json({ message: "Farmer not found" });

    res.json({
      message: "Farm details updated successfully",
      farmDetails: farmer.farmDetails,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
