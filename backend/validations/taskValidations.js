const MultipartTask = async (req, reply) => {
  const parts = req.parts();
  const formData = {};
  let filePart = null;

  for await (const part of parts) {
    if (part.file && part.fieldname === "file") {
      filePart = part;
    } else if (!part.file) {
      if (formData[part.fieldname]) {
        if (!Array.isArray(formData[part.fieldname])) {
          formData[part.fieldname] = [formData[part.fieldname]];
        }
        formData[part.fieldname].push(part.value);
      } else {
        formData[part.fieldname] = part.value;
      }
    }
  }

  // Validation
  const errors = {};
  if (!formData.title || formData.title.trim().length < 3) {
    errors.title = "Title must be at least 3 characters.";
  }

  if (!formData.description || formData.description.trim().length < 5) {
    errors.description = "Description must be at least 5 characters.";
  }

  if (!formData.dueDate) {
    errors.dueDate = "Due date is required.";
  } else {
    const dueDate = new Date(formData.dueDate);
    if (isNaN(dueDate.getTime())) {
      errors.dueDate = "Invalid date format.";
    }
  }

  const assigned = formData.assignedTo;
  if (!assigned || (Array.isArray(assigned) && assigned.length === 0)) {
    errors.assignedTo = "At least one assignee is required.";
  }

  if (Object.keys(errors).length > 0) {
    return reply.code(400).send({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  if (filePart && !allowedFileTypes.includes(filePart.mimetype)) {
    return reply.code(400).send({
      success: false,
      message: "Invalid file type. Allowed: PDF, PNG, JPEG, JPG, WEBP",
    });
  }

  req.body = formData;
  if (filePart) {
    req.file = filePart;
  }

  return;
};

const AdminTaskVerify = async (req, reply, done) => {
  const { status, remark } = req.body;

  const allowed = ["verified", "rejected"];
  if (!status || !allowed.includes(status)) {
    return reply.code(400).send({ message: "Status must be 'verified' or 'rejected'" });
  }

  // If rejected, remark is required
  if (status === "rejected" && (!remark || !remark.trim())) {
    return reply.code(400).send({ message: "Remark required when rejecting a submission." });
  }

  done();
};
