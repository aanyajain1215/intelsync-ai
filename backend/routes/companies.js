const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const { verifyToken, isAdmin } = require('../middleware/auth');
const axios = require('axios');

// GET /api/companies/export — CSV export with filters
router.get('/export', verifyToken, async (req, res) => {
  try {
    const { q, domain, tier, isActive, enrichmentStatus } = req.query;
    let query = {};
    if (q) query.$text = { $search: q };
    if (domain && domain !== 'All') query.domain = domain;
    if (tier && tier !== 'All') query.tier = Number(tier);
    if (isActive && isActive !== 'All') query.isActive = isActive === 'true';
    if (enrichmentStatus && enrichmentStatus !== 'All') query.enrichmentStatus = enrichmentStatus;

    const companies = await Company.find(query).lean();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="SEPC_Companies_Export.csv"');

    const headers = ['name', 'domain', 'subCategory', 'isActive', 'tier', 'websiteUrl', 'linkedinUrl', 'officialEmail', 'emails', 'currentCeo', 'leadership', 'city', 'country', 'foundedYear', 'foundedBy', 'freshnessScore', 'enrichmentStatus', 'nirfRanking'];
    res.write(headers.join(',') + '\n');

    companies.forEach(company => {
      const row = headers.map(header => {
        let val = company[header] || '';
        
        // Format leadership array for CSV
        if (header === 'leadership' && Array.isArray(val)) {
          val = val.map(l => `${l.name} (${l.designation || 'Executive'}) [${l.linkedin || 'No LinkedIn'}]`).join('; ');
        } else if (Array.isArray(val)) {
          val = val.join('; ');
        }
        
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      });
      res.write(row.join(',') + '\n');
    });

    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/companies — paginated list with filters
router.get('/', async (req, res) => {
  try {
    const { q, domain, tier, isActive, enrichmentStatus, page = 1, limit = 20, sort } = req.query;
    let query = {};
    if (q) query.$text = { $search: q };
    if (domain && domain !== 'All') query.domain = domain;
    if (tier && tier !== 'All') query.tier = Number(tier);
    if (isActive !== undefined && isActive !== 'All') query.isActive = isActive === 'true';
    if (enrichmentStatus && enrichmentStatus !== 'All') query.enrichmentStatus = enrichmentStatus;

    const limitNum = Math.min(Number(limit), 100);
    const skip = (Number(page) - 1) * limitNum;

    let sortObj = { freshnessScore: -1 };
    if (sort === 'recentlyAudited') sortObj = { enrichedAt: -1 };
    else if (sort === 'recentlyAdded') sortObj = { _id: -1 };
    else if (sort === 'stalest') sortObj = { enrichedAt: 1 };

    const companies = await Company.find(query).skip(skip).limit(limitNum).sort(sortObj);
    const total = await Company.countDocuments(query);

    res.json({ success: true, data: { companies, total, page: Number(page), pages: Math.ceil(total / limitNum) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/companies/:id — single company
router.get('/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, data: company });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/companies — Admin only: discover/add a new company
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Company name is required.' });

    const existing = await Company.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Company already exists in the registry.', data: existing });
    }

    const company = new Company({ ...req.body, name: req.body.name.trim(), enrichmentStatus: 'minimal' });
    await company.save();
    res.status(201).json({ success: true, data: company });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/companies/:id — Admin only: update company
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, data: company });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/companies/:id — Admin only: delete company
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, data: { success: true } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/companies/:id/enrich — Both admin & staff can trigger re-enrichment
router.post('/:id/enrich', verifyToken, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const pythonUrl = process.env.PYTHON_API_URL || 'http://localhost:8000/enrich';

    // Fire-and-forget: kick off Railway pipeline without waiting.
    // Vercel functions have a 10s timeout — enrichment takes 2-5 minutes.
    // Railway updates MongoDB directly; the client refreshes to see results.
    const oldCeo = company.currentCeo;
    const oldStatus = company.isActive;

    axios.post(pythonUrl, {
      name: company.name,
      websiteUrl: company.websiteUrl,
      companyId: company._id
    }, { timeout: 320000 })
      .then(async () => {
        try {
          const updated = await Company.findById(company._id);
          const Alert = require('../models/Alert');
          if (updated.currentCeo && oldCeo && updated.currentCeo !== oldCeo) {
            await Alert.create({ companyName: updated.name, companyId: updated._id, type: 'leadership_change', severity: 'critical', message: `CEO changed from ${oldCeo} to ${updated.currentCeo}` });
          }
          if (oldStatus === true && updated.isActive === false) {
            await Alert.create({ companyName: updated.name, companyId: updated._id, type: 'status_change', severity: 'critical', message: `Status Alert: Company may be closed or dissolved.` });
          }
        } catch (alertErr) {
          console.error('Alert creation failed:', alertErr.message);
        }
      })
      .catch(err => {
        console.error(`Enrichment pipeline error for ${company.name}:`, err.message);
      });

    // Return immediately — Railway is running enrichment in the background
    res.json({
      success: true,
      async: true,
      message: `Enrichment started for ${company.name}. Data will update in 2–3 minutes — refresh the profile to see results.`,
      data: company
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// POST /api/companies/ingest — Admin only: manual paste
router.post('/ingest', verifyToken, isAdmin, async (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText || rawText.length < 50) return res.status(400).json({ success: false, message: 'Insufficient text.' });

    const pyResponse = await axios.post(process.env.PYTHON_API_URL.replace('/enrich', '/ingest') || 'http://localhost:8000/ingest', { rawText });

    if (pyResponse.data.success) {
      const parsedData = pyResponse.data.data;
      const Company = require('../models/Company');
      let company = await Company.findOneAndUpdate(
        { name: { $regex: new RegExp(`^${parsedData.name.trim()}$`, 'i') } },
        { ...parsedData, enrichmentStatus: 'partial' },
        { new: true, upsert: true }
      );
      res.json({ success: true, data: company });
    } else {
      res.status(500).json({ success: false, message: 'AI failed to parse.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
