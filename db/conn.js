const mongoose = require("mongoose");
mongoose
  .connect(process.env.MONGODB_URL)
  .then((e) => {

  })
  .catch((e) => {

  });
