const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "in_progress",
        "submitted",
        "verified",
        "cancelled",
        "rejected",
        "due",
      ],
      default: "pending",
    },
    dueDate: { type: Date, required: true },
    completedAt: { type: Date },
    fileUrl: { type: String, default: null },
    // Submission fields (by user)
    submissionNotes: { type: String, default: '' },
    submissionFileUrl: { type: String, default: null },
    submittedMarks: { type: Number, default: null },
    // Verification/remark fields (by admin)
    remark: { type: String, default: "" },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
