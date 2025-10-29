import { Router } from 'express';
import mongoose from 'mongoose';
import Poll from '../models/Poll.js';

const router = Router();

// Create poll
router.post('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable, please try again shortly' });
    }
    const { question, options } = req.body;
    if (!question || !Array.isArray(options) || options.length < 2)
      return res.status(400).json({ error: 'Question and at least 2 options required' });

    const poll = await Poll.create({
      question,
      options: options.map((t) => ({ text: t }))
    });

    req.app.locals.broadcast('pollCreated', poll);
    res.status(201).json(poll);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

// List polls
router.get('/', async (_req, res) => {
  try {
    const polls = await Poll.find().sort({ createdAt: -1 });
    res.json(polls);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list polls' });
  }
});

// Get poll by id
router.get('/:id', async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ error: 'Not found' });
    res.json(poll);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch poll' });
  }
});

// Vote
router.post('/:id/vote', async (req, res) => {
  try {
    const { optionIndex } = req.body;
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ error: 'Not found' });
    if (typeof optionIndex !== 'number' || optionIndex < 0 || optionIndex >= poll.options.length)
      return res.status(400).json({ error: 'Invalid option index' });

    poll.options[optionIndex].votes += 1;
    await poll.save();

    req.app.locals.broadcast('pollUpdated', poll);
    res.json(poll);
  } catch (e) {
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// Like
router.post('/:id/like', async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ error: 'Not found' });

    poll.likes += 1;
    await poll.save();

    req.app.locals.broadcast('pollLiked', poll);
    res.json(poll);
  } catch (e) {
    res.status(500).json({ error: 'Failed to like' });
  }
});

export default router;
