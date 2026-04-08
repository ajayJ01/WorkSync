const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { success, error } = require("../utils/response");
const { clearChatHistory } = require("../utils/aiAnalyst");

exports.registerUser = async (req, reply) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return error(reply, 400, "User already exists with this email");
    }

    const user = await User.create({ name, email, password, role });

    return success(reply, "User registered successfully", {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (err) {
    console.error("Registration Error:", err.message);
    return error(reply);
  }
};

exports.loginUser = async (req, reply) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      return success(reply, "Logged In Successfully", {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id, user.role),
      });
    } else {
      return error(reply, 401, "Invalid e mail or password");
    }
  } catch (err) {
    console.error("Login error:", err);
    return error(reply);
  }
};


exports.logoutUser = async (req, reply) => {
  clearChatHistory(req.user.id);
  return success(reply, "Logged out successfully");
};
