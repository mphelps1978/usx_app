const jwt = require('jsonwebtoken');

// Generate a JWT token for testing
const payload = {
  userId: 1,
  email: 'phelpscdl@gmail.com'
};

const token = jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
  expiresIn: '24h'
});

console.log('Test JWT Token:', token);
