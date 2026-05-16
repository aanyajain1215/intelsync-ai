const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const { verifyToken } = require('../middleware/auth');

// GET /api/alerts — list alerts
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let query = {};
    if (status && status !== 'all') query.status = status;

    const limitNum = Math.min(Number(limit), 100);
    const skip = (Number(page) - 1) * limitNum;

    const alerts = await Alert.find(query).skip(skip).limit(limitNum).sort({ createdAt: -1 });
    const total = await Alert.countDocuments(query);

    res.json({ success: true, data: { alerts, total, page: Number(page), pages: Math.ceil(total / limitNum) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/alerts/:id/resolve
router.patch('/:id/resolve', verifyToken, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved', resolvedAt: new Date() },
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
