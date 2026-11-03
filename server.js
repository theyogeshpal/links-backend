const app = require('./src/app');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/market_research';

// Start HTTP server immediately so Render / cloud health checks succeed
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Masked URI for safe diagnostic logging
const safeUri = MONGODB_URI.replace(/:([^:@]{2})[^:@]*@/, ':****@');
console.log(`Target MongoDB URI: ${safeUri}`);

const connectWithRetry = () => {
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('✓ Connected to MongoDB successfully');
    })
    .catch((err) => {
      console.error('✗ MongoDB connection error:', err.message || err);
      console.log('Will retry connection in 10 seconds...');
      setTimeout(connectWithRetry, 10000);
    });
};

connectWithRetry();
