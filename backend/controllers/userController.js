const User = require("../models/User");
const { success, error } = require("../utils/response");

exports.getProfile = async (req, reply) => {
  try {
    reply.send({ message: "Profile fetched", user: req.user });
  } catch (err) {
    reply.code(500).send({ message: "Server Error" });
  }
};

exports.getAllNormalUsers = async (req, reply) => {
  try {
    // All accounts (except password) so admins can assign tasks to any teammate,
    // including when no separate "user" role rows exist yet.
    const users = await User.find({}).select("-password").sort({ name: 1 }).lean();
    return success(reply, "Users fetched successfully", users);
  } catch (err) {
    console.error("Get Users Error:", err.message);
    return error(reply);
  }
};
