const Message = require('../models/Message');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Send Message
exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user?.id;
    const { recipientId, text } = req.body;

    // Validate input
    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: 'Recipient ID is required',
      });
    }

    if (!text && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Message text or media file is required',
      });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found',
      });
    }

    // Check if sender is blocked by recipient
    if (recipient.blockedUsers.includes(senderId)) {
      return res.status(403).json({
        success: false,
        message: 'You are blocked by this user',
      });
    }

    let mediaData = null;

    // Handle file upload if present
    if (req.file) {
      const resourceType = req.file.mimetype.startsWith('video') ? 'video' : 'auto';
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        resource_type: resourceType,
        folder: 'chatboot/messages',
      });

      mediaData = {
        type: resourceType === 'video' ? 'video' : 'image',
        url: uploadResult.secure_url,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        duration: uploadResult.duration,
      };
    }

    // Create message
    const message = new Message({
      sender: senderId,
      recipient: recipientId,
      text: text || '',
      media: mediaData,
      deliveredAt: new Date(),
    });

    await message.save();
    await message.populate('sender', 'username profilePicture');
    await message.populate('recipient', 'username profilePicture');

    // Update recipient's last seen if online
    await User.findByIdAndUpdate(recipientId, { lastSeen: new Date() });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error) {
    console.error('Error in sendMessage:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// Get Chat History
exports.getChatHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { recipientId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (page - 1) * limit;

    // Get messages between two users
    const messages = await Message.find({
      $or: [
        { sender: userId, recipient: recipientId },
        { sender: recipientId, recipient: userId },
      ],
      isDeleted: false,
    })
      .populate('sender', 'username profilePicture')
      .populate('recipient', 'username profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Mark messages as read
    await Message.updateMany(
      {
        recipient: userId,
        sender: recipientId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    const total = await Message.countDocuments({
      $or: [
        { sender: userId, recipient: recipientId },
        { sender: recipientId, recipient: userId },
      ],
      isDeleted: false,
    });

    res.status(200).json({
      success: true,
      messages: messages.reverse(),
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error in getChatHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get Conversations List
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    // Get latest message from each conversation
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { recipient: userId }],
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', userId] },
              '$recipient',
              '$sender',
            ],
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$recipient', userId] },
                    { $eq: ['$isRead', false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { 'lastMessage.createdAt': -1 },
      },
      {
        $skip: skip,
      },
      {
        $limit: parseInt(limit),
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
    ]);

    const total = await Message.distinct('sender', {
      $or: [{ sender: userId }, { recipient: userId }],
      isDeleted: false,
    }).length;

    res.status(200).json({
      success: true,
      conversations,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error in getConversations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Mark as Read
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    if (message.recipient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to mark this message as read',
      });
    }

    message.isRead = true;
    message.readAt = new Date();

    await message.save();

    res.status(200).json({
      success: true,
      message: 'Message marked as read',
    });
  } catch (error) {
    console.error('Error in markAsRead:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Delete Message
exports.deleteMessage = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    if (message.sender.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message',
      });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();

    await message.save();

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    console.error('Error in deleteMessage:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Add Reaction to Message
exports.addReaction = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({
        success: false,
        message: 'Emoji is required',
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Check if already reacted
    const existingReaction = message.reactions.find(
      (r) => r.user.toString() === userId && r.emoji === emoji
    );

    if (existingReaction) {
      // Remove reaction
      message.reactions = message.reactions.filter(
        (r) => !(r.user.toString() === userId && r.emoji === emoji)
      );
    } else {
      // Add reaction
      message.reactions.push({
        user: userId,
        emoji,
      });
    }

    await message.save();

    res.status(200).json({
      success: true,
      message: 'Reaction updated',
      reactions: message.reactions,
    });
  } catch (error) {
    console.error('Error in addReaction:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Block User
exports.blockUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { blockUserId } = req.params;

    const user = await User.findById(userId);

    if (!user.blockedUsers.includes(blockUserId)) {
      user.blockedUsers.push(blockUserId);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User blocked successfully',
    });
  } catch (error) {
    console.error('Error in blockUser:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Unblock User
exports.unblockUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { blockUserId } = req.params;

    const user = await User.findById(userId);

    user.blockedUsers = user.blockedUsers.filter((id) => id.toString() !== blockUserId);

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User unblocked successfully',
    });
  } catch (error) {
    console.error('Error in unblockUser:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get Unread Count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id;

    const unreadCount = await Message.countDocuments({
      recipient: userId,
      isRead: false,
      isDeleted: false,
    });

    res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
