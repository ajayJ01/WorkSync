const mongoose = require("mongoose");
const User = require("./models/User");
require("dotenv").config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const email = "admin@worksync.com";

    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log("⚠️ Admin already exists");
      process.exit(0);
    }

    const admin = await User.create({
      name: "Ajay",
      email,
      password: "admin@workSync",
      role: "admin",
    });

    console.log("✅ Admin created successfully");
    console.log({
      id: admin._id,
      email: admin.email,
      role: admin.role,
    });

    process.exit(0);
  } catch (err) {
    console.error("❌ Admin creation error:", err.message);
    process.exit(1);
  }
};

createAdmin();