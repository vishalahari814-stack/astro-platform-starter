const Post = require('../models/Post');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create Post
exports.createPost = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { caption, contentType, isPrivate, allowDownload, allowScreenshot, location, hashtags, mentions } = req.body;

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image or video',
      });
    }

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      resource_type: contentType === 'video' || contentType === 'reel' ? 'video' : 'image',
      folder: 'chatboot/posts',
    });

    // Create post
    const post = new Post({
      author: userId,
      caption,
      content: {
        type: contentType,
        url: uploadResult.secure_url,
        thumbnail: uploadResult.thumbnail_url,
        duration: uploadResult.duration,
      },
      isPrivate,
      allowDownload,
      allowScreenshot,
      location,
      hashtags: hashtags ? hashtags.split(',').map(tag => tag.trim()) : [],
      mentions,
    });

    await post.save();

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: await post.populate('author', 'username profilePicture'),
    });
  } catch (error) {
    console.error('Error in createPost:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// Get All Posts (Feed)
exports.getFeed = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const user = await User.findById(userId);
    const followingIds = user.following || [];

    // Get posts from following users and own posts
    const posts = await Post.find({
      $or: [
        { author: userId },
        { author: { $in: followingIds } },
      ],
      isDeleted: false,
      $or: [{ isPrivate: false }, { author: userId }],
    })
      .populate('author', 'username profilePicture gender')
      .populate('comments.user', 'username profilePicture')
      .populate('likes.user', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments({
      $or: [
        { author: userId },
        { author: { $in: followingIds } },
      ],
      isDeleted: false,
    });

    res.status(200).json({
      success: true,
      posts,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error in getFeed:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get User Posts
exports.getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const currentUserId = req.user?.id;

    const skip = (page - 1) * limit;

    const posts = await Post.find({
      author: userId,
      isDeleted: false,
      $or: [{ isPrivate: false }, { author: currentUserId }],
    })
      .populate('author', 'username profilePicture gender')
      .populate('comments.user', 'username profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments({
      author: userId,
      isDeleted: false,
    });

    res.status(200).json({
      success: true,
      posts,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error in getUserPosts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Like Post
exports.likePost = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check if already liked
    const alreadyLiked = post.likes.find(like => like.user.toString() === userId);

    if (alreadyLiked) {
      // Unlike post
      post.likes = post.likes.filter(like => like.user.toString() !== userId);
    } else {
      // Like post
      post.likes.push({ user: userId });
    }

    await post.save();

    res.status(200).json({
      success: true,
      message: alreadyLiked ? 'Post unliked' : 'Post liked',
      likesCount: post.likes.length,
    });
  } catch (error) {
    console.error('Error in likePost:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Comment on Post
exports.commentOnPost = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment text cannot be empty',
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    post.comments.push({
      user: userId,
      text,
    });

    await post.save();
    await post.populate('comments.user', 'username profilePicture');

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comments: post.comments,
    });
  } catch (error) {
    console.error('Error in commentOnPost:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Delete Comment
exports.deleteComment = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { postId, commentId } = req.params;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const comment = post.comments.id(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Check if user is comment author
    if (comment.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment',
      });
    }

    post.comments = post.comments.filter(c => c._id.toString() !== commentId);

    await post.save();

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Error in deleteComment:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Delete Post
exports.deletePost = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check if user is post author
    if (post.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post',
      });
    }

    post.isDeleted = true;
    await post.save();

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    console.error('Error in deletePost:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// View Post (Track views)
exports.viewPost = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check if already viewed
    const alreadyViewed = post.views.find(view => view.user.toString() === userId);

    if (!alreadyViewed) {
      post.views.push({ user: userId });
      await post.save();
    }

    res.status(200).json({
      success: true,
      viewsCount: post.views.length,
    });
  } catch (error) {
    console.error('Error in viewPost:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get Stories
exports.getStories = async (req, res) => {
  try {
    const userId = req.user?.id;

    const user = await User.findById(userId);
    const followingIds = user.following || [];

    const stories = await Post.find({
      author: { $in: [...followingIds, userId] },
      'content.type': 'story',
      storyExpiry: { $gt: new Date() },
      isDeleted: false,
    })
      .populate('author', 'username profilePicture')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      stories,
    });
  } catch (error) {
    console.error('Error in getStories:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
