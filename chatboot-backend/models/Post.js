const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    caption: {
      type: String,
      maxlength: 2000,
      default: '',
    },
    content: {
      type: {
        type: String,
        enum: ['image', 'video', 'reel', 'story'],
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
      thumbnail: String,
      duration: Number, // For videos and reels in seconds
    },
    likes: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        text: {
          type: String,
          required: true,
          maxlength: 500,
        },
        likes: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
          },
        ],
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    shares: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isPrivate: {
      type: Boolean,
      default: false,
    },
    allowDownload: {
      type: Boolean,
      default: true,
    },
    allowScreenshot: {
      type: Boolean,
      default: false,
    },
    views: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    storyExpiry: {
      type: Date,
      default: null, // Stories expire after 24 hours
    },
    musicUsed: {
      songId: String,
      songName: String,
      artist: String,
    },
    filters: [String], // Array of filter names applied
    location: {
      city: String,
      state: String,
      country: String,
    },
    hashtags: [String],
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
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

// Auto-set story expiry to 24 hours for stories
postSchema.pre('save', function (next) {
  if (this.content.type === 'story' && !this.storyExpiry) {
    this.storyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  next();
});

// Index for faster queries
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ 'content.type': 1 });
postSchema.index({ storyExpiry: 1 }, { sparse: true });

module.exports = mongoose.model('Post', postSchema);
