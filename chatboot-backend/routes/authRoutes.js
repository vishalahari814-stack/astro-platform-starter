const express = require('express');
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

const router = express.Router();

// Public Routes
router.post('/request-otp', authController.requestOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/send-app-lock-otp', authController.sendAppLockOTP);
router.post('/verify-app-lock-otp', authController.verifyAppLockOTP);

// Protected Routes
router.post('/logout', auth, authController.logout);
router.get('/profile', auth, authController.getUserProfile);
router.put('/profile', auth, authController.updateUserProfile);

module.exports = router;
