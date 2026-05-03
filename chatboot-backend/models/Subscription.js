const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    subscriptionType: {
      type: String,
      enum: ['free', 'basic', 'premium', 'vip'],
      default: 'free',
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'debit_card', 'upi', 'paypal', 'apple_pay', 'google_pay'],
      default: null,
    },
    transactionId: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    features: {
      unlimitedMatches: {
        type: Boolean,
        default: false,
      },
      unlimitedMessages: {
        type: Boolean,
        default: false,
      },
      unlimitedCalls: {
        type: Boolean,
        default: false,
      },
      prioritySupport: {
        type: Boolean,
        default: false,
      },
      adFree: {
        type: Boolean,
        default: false,
      },
      premiumBadge: {
        type: Boolean,
        default: false,
      },
      verifiedCheckmark: {
        type: Boolean,
        default: false,
      },
      hideLastSeen: {
        type: Boolean,
        default: false,
      },
      incognitoMode: {
        type: Boolean,
        default: false,
      },
      rewindMatches: {
        type: Boolean,
        default: false,
      },
      superLike: {
        type: Number,
        default: 0, // Number of super likes per day
      },
      boosts: {
        type: Number,
        default: 0, // Number of profile boosts per month
      },
      voiceCallMinutes: {
        type: Number,
        default: 0, // Unlimited if premium
      },
      videoCallMinutes: {
        type: Number,
        default: 0, // Unlimited if premium
      },
    },
    usageStats: {
      matchesUsedToday: {
        type: Number,
        default: 0,
      },
      matchesLimitToday: {
        type: Number,
        default: 10, // Free users can see 10 matches per day
      },
      messagesUsedToday: {
        type: Number,
        default: 0,
      },
      messagesLimitToday: {
        type: Number,
        default: 50, // Free users can send 50 messages per day
      },
      callsUsedThisMonth: {
        type: Number,
        default: 0,
      },
      callsLimitThisMonth: {
        type: Number,
        default: 60, // 5 mins voice + 2 mins video per match
      },
      superLikesUsedToday: {
        type: Number,
        default: 0,
      },
      boostsUsedThisMonth: {
        type: Number,
        default: 0,
      },
      lastResetDate: {
        type: Date,
        default: Date.now,
      },
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly'],
      default: 'monthly',
    },
    pricePerCycle: {
      basic: {
        monthly: 99,
        quarterly: 249,
        yearly: 799,
      },
      premium: {
        monthly: 299,
        quarterly: 749,
        yearly: 2399,
      },
      vip: {
        monthly: 499,
        quarterly: 1249,
        yearly: 3999,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: null,
    },
    nextBillingDate: {
      type: Date,
      default: null,
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

// Auto-calculate next billing date
subscriptionSchema.pre('save', function (next) {
  if (this.subscriptionType !== 'free' && this.startDate) {
    const startDate = new Date(this.startDate);
    if (this.billingCycle === 'monthly') {
      this.nextBillingDate = new Date(startDate.setMonth(startDate.getMonth() + 1));
    } else if (this.billingCycle === 'quarterly') {
      this.nextBillingDate = new Date(startDate.setMonth(startDate.getMonth() + 3));
    } else if (this.billingCycle === 'yearly') {
      this.nextBillingDate = new Date(startDate.setFullYear(startDate.getFullYear() + 1));
    }
  }
  next();
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
