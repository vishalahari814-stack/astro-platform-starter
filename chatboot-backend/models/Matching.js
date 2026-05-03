const mongoose = require('mongoose');

const matchingSchema = new mongoose.Schema(
  {
    user1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    user2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    matchStatus: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'blocked'],
      default: 'pending',
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isMatched: {
      type: Boolean,
      default: false,
    },
    matchedAt: {
      type: Date,
      default: null,
    },
    chatAllowed: {
      type: Boolean,
      default: false,
    },
    voiceCallMinutes: {
      type: Number,
      default: 0, // Free 5 minutes per match
    },
    videoCallMinutes: {
      type: Number,
      default: 0, // Free 2 minutes per match
    },
    voiceCallUsed: {
      type: Number,
      default: 0,
    },
    videoCallUsed: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      maxlength: 500,
      default: '',
    },
    mutualFollowers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    compatibility: {
      type: Number,
      default: 0, // 0-100 percentage
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

// Ensure unique pairs of users (no duplicate matches)
matchingSchema.index({ user1: 1, user2: 1 }, { unique: true });
matchingSchema.index({ user1: 1, matchStatus: 1 });
matchingSchema.index({ user2: 1, matchStatus: 1 });

module.exports = mongoose.model('Matching', matchingSchema);
