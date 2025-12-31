const User = require("../../models/UserModel");
const crypto = require("crypto");
const generateTokens = require("../../utils/jwt");
const { hashPassword, comparePassword } = require("../../utils/hash");

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Password Validation
    if (password.length <= 6) {
      return res
        .status(400)
        .json({ message: "Password must be more than 6 characters long" });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({
        message: "Password must contain at least one uppercase letter",
      });
    }
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({
        message: "Password must contain at least one lowercase letter",
      });
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return res.status(400).json({
        message: "Password must contain at least one special character",
      });
    }

    const hashedPassword = password ? await hashPassword(password) : undefined;

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "user",
      phone: phone || undefined,
    });

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const payload = {
      id: user._id,
      role: user.role,
    };

    const { accessToken, refreshToken } = generateTokens(payload);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
