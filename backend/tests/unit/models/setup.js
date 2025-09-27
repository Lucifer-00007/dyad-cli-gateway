// Mock environment for unit tests
process.env.NODE_ENV = 'test';
process.env.MONGODB_URL = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_EXPIRATION_MINUTES = '30';
process.env.JWT_REFRESH_EXPIRATION_DAYS = '30';
process.env.JWT_RESET_PASSWORD_EXPIRATION_MINUTES = '10';
process.env.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES = '10';
process.env.SMTP_HOST = 'smtp.test.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USERNAME = 'test@test.com';
process.env.SMTP_PASSWORD = 'test-password';
process.env.EMAIL_FROM = 'test@test.com';