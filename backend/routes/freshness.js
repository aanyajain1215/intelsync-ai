const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const Alert = require('../models/Alert');
const { verifyToken, isAdmin } = require('../middleware/auth');
const axios = require('axios');

// POST /api/freshness/run — Admin only: manually trigger freshness check on stalest 10 records
router.post('/run', verifyToken, isAdmin, async (req, res) => {
  try {
    // Find 10 companies with the oldest enrichedAt dates (stalest records)
    const stalest = await Company.find({ enrichmentStatus: { $ne: 'minimal' } })
      .sort({ enrichedAt: 1 })
      .limit(10)
      .lean();

    if (!stalest.length) {
      return res.json({ success: true, message: 'No enriched records to refresh.', results: [] });
    }

    console.log(`\n🔄 FRESHNESS ENGINE: Processing ${stalest.length} stalest records...`);
    const results = [];

    for (const company of stalest) {
      const oldStatus = company.isActive;
      const oldCeo = company.currentCeo;

      try {
        // Call the Python enrichment pipeline
        await axios.post(process.env.PYTHON_API_URL || 'http://localhost:8000/enrich', {
          name: company.name,
          websiteUrl: company.websiteUrl,
          companyId: company._id
        }, { timeout: 180000 });

        // Re-fetch updated data
        const updated = await Company.findById(company._id);

        const changes = [];

        // Check for status change
        if (oldStatus === true && updated.isActive === false) {
          changes.push('DEFUNCT');
          await Alert.create({
            companyName: updated.name,
            companyId: updated._id,
            type: 'status_change',
            severity: 'critical',
            message: `Freshness Check: ${updated.name} appears to be defunct/closed.`
          });
        } else if (oldStatus === false && updated.isActive === true) {
          changes.push('REACTIVATED');
          await Alert.create({
            companyName: updated.name,
            companyId: updated._id,
            type: 'status_change',
            severity: 'warning',
            message: `Freshness Check: ${updated.name} appears to have reactivated.`
          });
        }

        // Check for leadership change
        if (updated.currentCeo && oldCeo && updated.currentCeo !== oldCeo) {
          changes.push('CEO_CHANGED');
          await Alert.create({
            companyName: updated.name,
            companyId: updated._id,
            type: 'leadership_change',
            severity: 'critical',
            message: `Freshness Check: CEO changed from ${oldCeo} to ${updated.currentCeo}`
          });
        }

        results.push({
          name: company.name,
          id: company._id,
          status: 'refreshed',
          isActive: updated.isActive,
          changes: changes.length ? changes : ['NO_CHANGE']
        });

        console.log(`  ✅ ${company.name} — ${changes.length ? changes.join(', ') : 'No changes'}`);
      } catch (err) {
        results.push({
          name: company.name,
          id: company._id,
          status: 'failed',
          error: err.message
        });
        console.log(`  ❌ ${company.name} — Failed: ${err.message}`);
      }
    }

    console.log(`\n✅ FRESHNESS ENGINE COMPLETE: ${results.filter(r => r.status === 'refreshed').length}/${stalest.length} refreshed`);

    res.json({
      success: true,
      message: `Freshness check completed for ${stalest.length} records.`,
      results
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/freshness/status — Get freshness overview
router.get('/status', verifyToken, async (req, res) => {
  try {
    const totalEnriched = await Company.countDocuments({ enrichmentStatus: 'full' });
    const staleCount = await Company.countDocuments({
      enrichedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      enrichmentStatus: 'full'
    });
    const freshCount = totalEnriched - staleCount;

    const oldestEnrichedDoc = await Company.findOne({ enrichmentStatus: 'full' })
      .sort({ enrichedAt: 1 })
      .select('name enrichedAt')
      .lean();

    res.json({
      success: true,
      data: {
        totalEnriched,
        staleCount,
        freshCount,
        oldestRecord: oldestEnrichedDoc ? {
          name: oldestEnrichedDoc.name,
          enrichedAt: oldestEnrichedDoc.enrichedAt
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
