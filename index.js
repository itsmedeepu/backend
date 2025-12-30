const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

//database
require("./db/conn");

//require Routes

const UserRoutes = require("./routes/UserRoutes");
const ProductRoutes = require("./routes/ProductRoutes");
const OrderRoutes = require("./routes/OrderRoutes");
const TransactionRoutes = require("./routes/TransactionRoute");
const ReviewRoutes = require("./routes/ReviewRoutes");

//middlewares

app.use(
  cors({
    origin: ["http://localhost:4000", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json({}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/v1/agridirect/user", UserRoutes);
app.use("/api/v1/agridirect/product", ProductRoutes);
app.use("/api/v1/agridirect/order", OrderRoutes);
app.use("/api/v1/agridirect/transaction", TransactionRoutes);
console.log("Loading Review Routes...");
app.use("/api/v1/agridirect/review", ReviewRoutes);

app.use((err, req, res, next) => {
  console.log(err.stack);
  return res.status(500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
});

app.get("/", (req, res) => {
  res.send({ message: "Hii from the server" });
});
//start the server
app.listen(port, () => {
  console.log(`server running at port http://localhost:${port}`);
});
