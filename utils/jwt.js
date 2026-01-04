const jwt = require("jsonwebtoken");

const generateTokens = (payload) => ({
  accessToken: jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" }),
  refreshToken: jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  }),
});

module.exports = generateTokens;
