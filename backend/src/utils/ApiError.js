class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '', type = null, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.type = type;
    this.code = code;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

module.exports = ApiError;
