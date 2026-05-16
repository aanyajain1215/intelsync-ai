const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { verifyToken, isAdmin } = require('../middleware/auth');

// POST /api/auth/register — restricted to @sepc.in
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, designation, role } = req.body;

    // Strict domain check
    if (!email.toLowerCase().endsWith('@sepc.in')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized email domain. Registration is restricted to SEPC officials (@sepc.in).' 
      });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Staff by default; only seed script creates admins
    const assignedRole = role === 'admin' ? 'admin' : 'staff';

    user = new User({ name, email, password: hashedPassword, designation, role: assignedRole });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'leadverify_sepc_secret_2026', { expiresIn: '1d' });
    res.status(201).json({ success: true, data: { token, user: { _id: user._id, name, email, role: user.role, designation } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'leadverify_sepc_secret_2026', { expiresIn: '1d' });
    res.json({ success: true, data: { token, user: { _id: user._id, name: user.name, email, role: user.role, designation: user.designation } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  res.json({ success: true, data: req.user });
});

module.exports = router;
