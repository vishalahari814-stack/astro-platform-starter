const admin = require('firebase-admin');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Initialize Firebase Admin (configure this with your firebase credentials)
// const serviceAccount = require('../config/firebase-key.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via Firebase
const sendOTPViaFirebase = async (email, otp) => {
  try {
    // For demo purposes, we'll use nodemailer instead
    // In production, you can use Firebase Authentication sendSignInLinkToEmail
    console.log(`OTP for ${email}: ${otp}`);
    return true;
  } catch (error) {
    console.error('Error sending OTP:', error);
    return false;
  }
};

// Send OTP via Email (Nodemailer)
const sendOTPViaEmail = async (email, otp) => {
  try {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'your-app-password',
      },
    });

    const mailOptions = {
      from: 'noreply@chatboot.com',
      to: email,
      subject: 'Your Chatboot Login OTP',
      html: `
        <h2>Welcome to Chatboot! 🎉</h2>
        <p>Your 6-digit OTP is:</p>
        <h1 style="color: #FF6B6B; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
        <p>This OTP will expire in 5 minutes.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

// Request OTP
exports.requestOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP hash in database
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user (will be completed after OTP verification)
      user = new User({
        email,
        otpToken: otpHash,
        otpExpiry,
      });
    } else {
      // Update OTP for existing user
      user.otpToken = otpHash;
      user.otpExpiry = otpExpiry;
    }

    // Save user with OTP
    await user.save();

    // Send OTP via Email
    const emailSent = await sendOTPViaEmail(email, otp);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP. Please try again.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email address. Valid for 5 minutes.',
      email,
    });
  } catch (error) {
    console.error('Error in requestOTP:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// Verify OTP and Create/Login User
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate input
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
      });
    }

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please request OTP first.',
      });
    }

    // Check OTP expiry
    if (new Date() > user.otpExpiry) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });
    }

    // Verify OTP
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    if (user.otpToken !== otpHash) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.',
      });
    }

    // OTP verified successfully
    user.isVerified = true;
    user.otpToken = null;
    user.otpExpiry = null;
    user.lastLogin = new Date();
    user.isOnline = true;

    await user.save();

    // Generate JWT Token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        gender: user.gender,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error('Error in verifyOTP:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// Send App Lock OTP
exports.sendAppLockOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const appLockOtp = generateOTP();
    const appLockOtpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    user.appLockOtp = appLockOtp;
    user.appLockOtpExpiry = appLockOtpExpiry;

    await user.save();

    // Send OTP via Email
    await sendOTPViaEmail(email, appLockOtp);

    res.status(200).json({
      success: true,
      message: 'App unlock OTP sent to your email',
    });
  } catch (error) {
    console.error('Error in sendAppLockOTP:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Verify App Lock OTP
exports.verifyAppLockOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (new Date() > user.appLockOtpExpiry) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired',
      });
    }

    if (user.appLockOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
      });
    }

    user.accountLocked = false;
    user.appLockOtp = null;
    user.appLockOtpExpiry = null;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'App unlocked successfully',
    });
  } catch (error) {
    console.error('Error in verifyAppLockOTP:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    const userId = req.user?.id;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isOnline: false,
        lastSeen: new Date(),
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Error in logout:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get User Profile
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user?.id;

    const user = await User.findById(userId)
      .select('-otpToken -otpExpiry -appLockOtp -appLockOtpExpiry')
      .populate('followers')
      .populate('following');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update User Profile (excluding username and gender)
exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { bio, age, location, profilePicture } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        bio,
        age,
        location,
        profilePicture,
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
