const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const http = require("http");
const { Server } = require("socket.io");
const Chat = require("./models/ChatModel");

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:4000",
      "http://localhost:5173",
      "https://agridirect-frontend.onrender.com",
      process.env.FRONTEND_URL
    ].filter(Boolean),
    methods: ["GET", "POST"]
  }
});

const onlineUsers = new Map(); // userId -> socketId

io.on("connection", (socket) => {


  socket.on("register_user", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("user_online", userId);

  });

  socket.on("join_room", (data) => {
    socket.join(data);

  });

  socket.on("send_message", async (data) => {
    const { room, authorId, receiverId, message, time } = data;

    try {
      const newChat = new Chat({
        orderId: room,
        senderId: authorId,
        receiverId,
        message,
        timestamp: new Date()
      });
      await newChat.save();

      
      socket.to(data.room).emit("receive_message", data);

    } catch (err) {
      console.error("[Socket] Error saving chat:", err);
    }
  });

  socket.on("typing", (room) => {
    socket.to(room).emit("typing", room);
  });

  socket.on("stop_typing", (room) => {
    socket.to(room).emit("stop_typing", room);
  });

  socket.on("check_online", (userId) => {
    const isOnline = onlineUsers.has(userId);
    socket.emit("is_online_response", { userId, isOnline });
  });

  socket.on("disconnect", () => {

    let disconnectedUserId;
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        disconnectedUserId = userId;
        onlineUsers.delete(userId);
        break;
      }
    }
    if (disconnectedUserId) {
      io.emit("user_offline", disconnectedUserId);
    }
  });
});


// Trust proxy for secure cookies on Render/Heroku
app.set("trust proxy", 1);

//database
require("./db/conn");

//require Routes

const UserRoutes = require("./routes/UserRoutes");
const ProductRoutes = require("./routes/ProductRoutes");
const OrderRoutes = require("./routes/OrderRoutes");
const TransactionRoutes = require("./routes/TransactionRoute");
const ReviewRoutes = require("./routes/ReviewRoutes");
const ChatRoutes = require("./routes/ChatRoutes");

//middlewares

app.use(
  cors({
    origin: [
      "http://localhost:4000",
      "http://localhost:5173",
      "https://agridirect-frontend.onrender.com",
      process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true,
  })
);
app.use(express.json({}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// serve uploaded files (Legacy support for local images)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/v1/agridirect/user", UserRoutes);
app.use("/api/v1/agridirect/product", ProductRoutes);
app.use("/api/v1/agridirect/order", OrderRoutes);
app.use("/api/v1/agridirect/transaction", TransactionRoutes);

app.use("/api/v1/agridirect/review", ReviewRoutes);
app.use("/api/v1/agridirect/chat", ChatRoutes);

app.use((err, req, res, next) => {

  return res.status(500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
});

app.get("/", (req, res) => {
  res.send({ message: "Hii from the server" });
});
//start the server
server.listen(port, () => {

});
