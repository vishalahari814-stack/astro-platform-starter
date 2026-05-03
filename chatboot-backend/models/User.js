const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      immutable: true, // Username cannot be changed
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true,
      immutable: true, // Gender cannot be changed after creation
    },
    profilePicture: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: 500,
      default: '',
    },
    age: {
      type: Number,
      default: null,
    },
    location: {
      city: String,
      state: String,
      country: String,
    },
    phoneNumber: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otpToken: {
      type: String,
      default: null,
    },
    otpExpiry: {
      type: Date,
      default: null,
    },
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    matchedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    accountLocked: {
      type: Boolean,
      default: false,
    },
    appLockOtp: {
      type: String,
      default: null,
    },
    appLockOtpExpiry: {
      type: Date,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: null,
    },
    screenRecordingBlocked: {
      type: Boolean,
      default: true,
    },
    privacySettings: {
      allowScreenshots: {
        type: Boolean,
        default: false,
      },
      allowScreenRecording: {
        type: Boolean,
        default: false,
      },
      showLastSeen: {
        type: Boolean,
        default: true,
      },
      showOnlineStatus: {
        type: Boolean,
        default: true,
      },
    },
    subscriptionStatus: {
      isPremium: {
        type: Boolean,
        default: false,
      },
      subscriptionType: {
        type: String,
        enum: ['free', 'basic', 'premium'],
        default: 'free',
      },
      subscriptionExpiry: {
        type: Date,
        default: null,
      },
      matchesUsedToday: {
        type: Number,
        default: 0,
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Auto-detect username from email
userSchema.pre('save', function (next) {
  if (!this.username && this.email) {
    this.username = this.email.split('@')[0];
  }
  next();
});

// Auto-detect gender from email pattern (example: name+m@, name+f@)
userSchema.pre('save', function (next) {
  if (!this.gender && this.email) {
    const genderMarker = this.email.match(/\+([mf])/);
    if (genderMarker) {
      this.gender = genderMarker[1] === 'm' ? 'male' : 'female';
    } else {
      this.gender = 'other';
    }
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
