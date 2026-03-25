export const validateFile = (file) => {
    const validTypes = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
    ];
    const maxSizeMB = 5;

    if (!file) {
        return { valid: false, message: "No file selected." };
    }

    if (!validTypes.includes(file.type)) {
        const allowed = ["PDF", "PNG", "JPEG", "JPG", "WEBP"].join(", ");
        return { valid: false, message: `Invalid file type. Allowed types: ${allowed}` };
    }

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
        return { valid: false, message: `File too large. Max allowed size is ${maxSizeMB}MB.` };
    }

    return { valid: true };
};
