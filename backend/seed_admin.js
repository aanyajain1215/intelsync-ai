const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lead_verification';

async function seedAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const existing = await User.findOne({ email: 'admin@sepc.in' });
    if (existing) {
      console.log('⚠️  Admin user already exists. Skipping seed.');
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin@SEPC2026', salt);

    await User.create({
      name: 'SEPC Admin',
      email: 'admin@sepc.in',
      password: hashedPassword,
      designation: 'Director General',
      role: 'admin'
    });

    console.log('✅ Admin user created successfully!');
    console.log('   Email:    admin@sepc.in');
    console.log('   Password: Admin@SEPC2026');
    console.log('   Role:     admin');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

seedAdmin();
