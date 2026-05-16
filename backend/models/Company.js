const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  websiteUrl: { type: String },
  linkedinUrl: { type: String },
  officialEmail: { type: String },
  emails: { type: [String], default: [] },
  emailSource: { type: String },
  phones: { type: [String], default: [] },
  country: { type: String },
  city: { type: String },
  headquartersAddress: { type: String },
  description: { type: String },

  // Foundation
  foundedYear: { type: Number },
  foundedBy: { type: String },
  currentCeo: { type: String },
  ceoLinkedinUrl: { type: String },

  // Classification — 6 SEPC domains only
  domain: { type: String },
  subCategory: { type: String },
  domainConfidence: { type: Number },
  domainReason: { type: String },
  classifiedBy: { type: String },

  // Status — flagged FIRST
  isActive: { type: Boolean },
  websiteStatus: { type: String },
  closedYear: { type: Number },

  // Tier
  tier: { type: Number },
  tierJustification: { type: String },

  // Employee info
  employeeCount: { type: String },

  // Leadership
  leadership: [{
    name: String,
    designation: String,
    email: String,
    phone: String,
    linkedin: String
  }],
  persons: { type: [String], default: [] },

  // AI Summary
  aiSummary: {
    offerings: String,
    relevance: String,
    growthSignals: String,
    sectorPositioning: String,
    suggestedOutreach: String
  },

  // Recent News — each item is tagged with a category
  recentNews: [{
    title: String,
    source: String,
    publishedAt: String,
    url: String,
    description: String,
    newsCategory: { type: String, enum: ['financial', 'leadership', 'risk', 'expansion', 'product', 'general'] }
  }],

  // Documents & Reports — populated by Module 7 (verified direct links)
  documents: [{
    title:    String,
    url:      String,
    docType:  { type: String, enum: ['annual_report', 'audit', 'financial_statement',
                'regulatory_filing', 'investor_presentation', 'credit_rating',
                'prospectus', 'sustainability', 'other'] },
    year:     String,    // e.g. "2024"
    verified: Boolean,   // true = HEAD-checked URL confirmed alive
  }],

  // Structured Financial Signals
  financialSignals: {
    revenue:           String,   // e.g. "₹4,500 Cr (FY2024)"
    revenueGrowth:     String,   // e.g. "+12% YoY"
    profitLoss:        String,   // e.g. "Net Profit ₹320 Cr" or "Net Loss ₹45 Cr"
    profitTrend:       String,   // 'profit' | 'loss' | 'breakeven' | 'unknown'
    stockTicker:       String,   // e.g. "NSE: INFY"
    stockPrice:        String,   // e.g. "₹1,820 (Apr 2025)"
    marketCap:         String,   // e.g. "₹7.8L Cr"
    fundingStatus:     String,   // e.g. "Series C — $50M (2024)"
    lastFundingAmount: String,
    lastFundingDate:   String,
    valuation:         String,
  },

  // Risk Flags — populated by pipeline if closure/bankruptcy/layoff news found
  riskFlags: { type: [String], default: [] },  // e.g. ['layoffs', 'investigation', 'closure']
  riskLevel:  { type: String, enum: ['none', 'low', 'medium', 'high', 'critical'], default: 'none' },

  // Legacy flat financials (kept for backwards compat)
  revenue: { type: String },
  stockInfo: { type: String },
  fundingStatus: { type: String },


  // Education-specific
  nirfRanking: { type: Number },
  institutionType: { type: String },

  // Freshness
  freshnessScore: { type: Number, default: 0 },
  enrichedAt: { type: Date },
  lastScrapedAt: { type: Date },

  // Meta
  enrichmentStatus: { type: String, enum: ['full', 'partial', 'minimal'], default: 'minimal' },
  isVerified: { type: Boolean, default: false },
  dataSource: { type: String },
  statusMessage: { type: String },
  enrichmentWarning: { type: String },  // Set if entity is a product/brand, not a company
  activeSignals: { type: Object, default: {} },


  // KG
  wikiUrl: { type: String },
  kgFound: { type: Boolean },
  kgVerifiedAt: { type: Date },
}, { timestamps: true });

companySchema.index({ name: 'text', description: 'text' });
companySchema.index({ domain: 1 });
companySchema.index({ enrichmentStatus: 1 });
companySchema.index({ tier: 1 });
companySchema.index({ isActive: 1 });
companySchema.index({ freshnessScore: 1 });
companySchema.index({ enrichedAt: 1 });

module.exports = mongoose.model('Company', companySchema);
