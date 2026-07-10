import SystemSettings from '../../models/systemSettings.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { logSuperAdminAction } from '../../utils/superAdminAudit.js';

const DEFAULT_SETTINGS = {
  key: 'global',
  schoolYear: '2025-26',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  maintenanceMode: false,
  maintenanceMessage: 'System under maintenance. Please try again later.',
  emailTemplates: [
    { key: 'welcome', subject: 'Welcome to Scholify', body: 'Hello {{name}}, welcome aboard!' },
    { key: 'fee_reminder', subject: 'Fee payment reminder', body: 'Dear parent, fees are due on {{dueDate}}.' },
  ],
  smsTemplates: [
    { key: 'otp', body: 'Your Scholify OTP is {{otp}}. Valid for 10 minutes.' },
    { key: 'attendance', body: '{{student}} was marked {{status}} on {{date}}.' },
  ],
};

async function getOrCreateSettings() {
  let doc = await SystemSettings.findOne({ key: 'global' });
  if (!doc) doc = await SystemSettings.create(DEFAULT_SETTINGS);
  return doc;
}

export const getSettings = asyncHandler(async (_req, res) => {
  const settings = await getOrCreateSettings();
  res.json(settings);
});

export const updateSettings = asyncHandler(async (req, res) => {
  const allowed = [
    'schoolYear',
    'timezone',
    'currency',
    'maintenanceMode',
    'maintenanceMessage',
    'emailTemplates',
    'smsTemplates',
  ];
  const patch = {};
  for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
  const settings = await SystemSettings.findOneAndUpdate({ key: 'global' }, patch, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
  await logSuperAdminAction(req, { action: 'UPDATE', module: 'settings' });
  res.json(settings);
});

export const toggleMaintenance = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  settings.maintenanceMode = req.body?.enabled ?? !settings.maintenanceMode;
  if (req.body?.message) settings.maintenanceMessage = req.body.message;
  await settings.save();
  await logSuperAdminAction(req, {
    action: settings.maintenanceMode ? 'MAINTENANCE_ON' : 'MAINTENANCE_OFF',
    module: 'settings',
  });
  res.json({ maintenanceMode: settings.maintenanceMode, maintenanceMessage: settings.maintenanceMessage });
});
