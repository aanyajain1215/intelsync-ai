const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  companyName: { type: String },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  type: { type: String, enum: ['leadership_change', 'negative_news', 'inactive_company', 'freshness_check', 'status_change'] },
  severity: { type: String, enum: ['critical', 'warning', 'routine'], default: 'routine' },
  message: { type: String },
  status: { type: String, enum: ['unresolved', 'resolved'], default: 'unresolved' },
  resolvedAt: { type: Date },
}, { timestamps: true });

alertSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
