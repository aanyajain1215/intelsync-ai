const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from any localhost port (5173, 5174, etc.) and no origin (Postman/curl)
    if (!origin || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies');
const alertRoutes = require('./routes/alerts');
const analyticsRoutes = require('./routes/analytics');
const userRoutes = require('./routes/users');
const freshnessRoutes = require('./routes/freshness');

app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/freshness', freshnessRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
});

// Database Connection & Server Start
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lead_verification';

mongoose.connect(MONGO_URI)
  .then(() => {
    const dbName = mongoose.connection.name;
    console.log(`✅ Connected to MongoDB Database: ${dbName}`);
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
  });
