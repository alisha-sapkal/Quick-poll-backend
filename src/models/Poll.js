import mongoose from 'mongoose';

const OptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  votes: { type: Number, default: 0 }
}, { _id: false });

const PollSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: { type: [OptionSchema], validate: v => Array.isArray(v) && v.length >= 2 },
  likes: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('Poll', PollSchema);
