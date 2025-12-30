const mongoose = require("mongoose");
mongoose
  .connect(process.env.MONGODB_URL)
  .then((e) => {
    console.log("✅ database connected sucessfully");
  })
  .catch((e) => {
    console.log(`${e} CONNECTION FAILED`);
  });
