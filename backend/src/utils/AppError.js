/**
 * Lỗi nghiệp vụ có mã HTTP – được error handler trả thẳng message cho client.
 */
class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.isAppError = true;
  }
}

module.exports = AppError;
