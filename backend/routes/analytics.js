const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const Alert = require('../models/Alert');
const { verifyToken } = require('../middleware/auth');

// GET /api/analytics/overview
router.get('/overview', verifyToken, async (req, res) => {
  try {
    const totalCompanies = await Company.countDocuments();
    const activeCompanies = await Company.countDocuments({ isActive: true });
    const fullyEnriched = await Company.countDocuments({ enrichmentStatus: 'full' });

    const avgFreshnessRes = await Company.aggregate([
      { $group: { _id: null, avg: { $avg: '$freshnessScore' } } }
    ]);
    const avgFreshnessScore = avgFreshnessRes.length > 0 ? avgFreshnessRes[0].avg : 0;

    const domainBreakdown = await Company.aggregate([
      { $group: { _id: '$domain', count: { $sum: 1 } } },
      { $project: { domain: '$_id', count: 1, _id: 0 } }
    ]);

    const tierBreakdown = await Company.aggregate([
      { $group: { _id: '$tier', count: { $sum: 1 } } },
      { $project: { tier: '$_id', count: 1, _id: 0 } }
    ]);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentlyEnriched = await Company.countDocuments({ enrichedAt: { $gte: sevenDaysAgo } });

    const unresolvedAlerts = await Alert.countDocuments({ status: 'unresolved' });

    const inactiveCompanies = await Company.countDocuments({ isActive: false });

    res.json({
      success: true, data: {
        totalCompanies,
        activeCompanies,
        inactiveCompanies,
        fullyEnriched,
        avgFreshnessScore: Math.round(avgFreshnessScore),
        domainBreakdown,
        tierBreakdown,
        recentlyEnriched,
        unresolvedAlerts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
