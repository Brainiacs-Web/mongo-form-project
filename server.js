// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// ── MIDDLEWARE ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── MONGOOSE SETUP ──────────────────────────────────────────────────────────
const mongoUri = process.env.MONGODB_URI || '<YOUR_MONGODB_URI>';
mongoose
  .connect(mongoUri)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ── SCHEMAS & MODELS ─────────────────────────────────────────────────────────

// 1) Batch: { name, createdAt }
const batchSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});
const Batch = mongoose.model('Batch', batchSchema);

// 2) TestSeries (formerly "Questions" top‐level): { testName, batch, testDuration, subjects, scheduledAt, published, createdAt }
const testSeriesSchema = new mongoose.Schema({
  testName: { type: String, required: true, unique: true },
  batch: { type: String, required: true },
  testDuration: { type: Number, required: true },
  subjects: [String],              // e.g. ["Physics","Chemistry","Biology"]
  scheduledAt: Date,               // date/time to schedule
  published: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const TestSeries = mongoose.model('TestSeries', testSeriesSchema);

// 3) Question: each question belongs to a series, subject, and batch
const questionSchema = new mongoose.Schema({
  questionId: { type: String, required: true, unique: true }, // use Mongoose’s ObjectId or a generated ID
  series: { type: String, required: true },
  batch: { type: String, required: true },
  subject: { type: String, required: true },
  question: String,
  questionImage: String,
  questionType: { type: String, enum: ['MCQ', 'Integer'], required: true },
  // If MCQ:
  options: [String],               // ["optA","optB","optC","optD"]
  correctAnswer: String,           // "A" / "B" / ...
  // If Integer:
  answer: String,
  solution: String,
  solutionImage: String,
  addedAt: { type: Date, default: Date.now }
});
const Question = mongoose.model('Question', questionSchema);

// 4) Chapter: for each series>subject, keep an array of chapter names
const chapterSchema = new mongoose.Schema({
  series: { type: String, required: true },
  subject: { type: String, required: true },
  chapters: [String]               // ["Chapter1Name", "Chapter2Name", …]
});
chapterSchema.index({ series: 1, subject: 1 }, { unique: true });
const Chapter = mongoose.model('Chapter', chapterSchema);

// 5) AnswerMap: { batch, answersMap: { subject: { questionId: answer } } }
const answerMapSchema = new mongoose.Schema({
  batch: { type: String, required: true, unique: true },
  answersMap: { type: Map, of: Object, default: {} } 
  // e.g. { Physics: { qid1: "A", qid2: "B" }, Chemistry: { ... } }
});
const AnswerMap = mongoose.model('AnswerMap', answerMapSchema);

// ── ROUTES ───────────────────────────────────────────────────────────────────
// Note: All endpoints are prefixed with /api for clarity.

// • BATCH ENDPOINTS
// GET all batches
app.get('/api/batches', async (req, res) => {
  try {
    const batches = await Batch.find().sort({ createdAt: 1 });
    res.json(batches);
  } catch (err) {
    console.error('Error fetching batches:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST new batch
app.post('/api/batches', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Batch name is required' });
    const newBatch = new Batch({ name });
    await newBatch.save();
    res.status(201).json(newBatch);
  } catch (err) {
    console.error('Error adding batch:', err);
    res.status(err.code === 11000 ? 400 : 500).json({ message: 'Could not add batch' });
  }
});

// • TEST SERIES ENDPOINTS
// GET all test series
app.get('/api/tests', async (req, res) => {
  try {
    const tests = await TestSeries.find().sort({ createdAt: -1 });
    res.json(tests);
  } catch (err) {
    console.error('Error fetching tests:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST create a new test
app.post('/api/tests', async (req, res) => {
  try {
    const { testName, batch, testDuration, subjects, scheduledAt } = req.body;
    if (!testName || !batch || !testDuration || !subjects || !Array.isArray(subjects)) {
      return res.status(400).json({ message: 'All test fields are required' });
    }
    const newTest = new TestSeries({ testName, batch, testDuration, subjects, scheduledAt, published: false });
    await newTest.save();
    res.status(201).json(newTest);
  } catch (err) {
    console.error('Error creating test:', err);
    res.status(err.code === 11000 ? 400 : 500).json({ message: 'Could not create test' });
  }
});

// PUT publish a test (send test)
app.put('/api/tests/:testName/publish', async (req, res) => {
  try {
    const { testName } = req.params;
    const updated = await TestSeries.findOneAndUpdate(
      { testName },
      { published: true, publishedAt: new Date() },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Test not found' });
    res.json(updated);
  } catch (err) {
    console.error('Error publishing test:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE a test
app.delete('/api/tests/:testName', async (req, res) => {
  try {
    const { testName } = req.params;
    const deleted = await TestSeries.findOneAndDelete({ testName });
    if (!deleted) return res.status(404).json({ message: 'Test not found' });
    res.json({ message: 'Test deleted' });
  } catch (err) {
    console.error('Error deleting test:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// • QUESTION ENDPOINTS
// POST add a question
app.post('/api/questions', async (req, res) => {
  try {
    const {
      series,
      batch,
      subject,
      question,
      questionImage,
      questionType,
      options,            // array if MCQ
      correctAnswer,      // string if MCQ
      answer,             // string if Integer
      solution,
      solutionImage
    } = req.body;

    if (!series || !batch || !subject || !questionType) {
      return res.status(400).json({ message: 'series, batch, subject, and questionType are required' });
    }

    // Generate a questionId using default ObjectId
    const qId = new mongoose.Types.ObjectId().toString();

    const newQuestion = new Question({
      questionId: qId,
      series,
      batch,
      subject,
      question,
      questionImage,
      questionType,
      options: questionType === 'MCQ' ? options : [],
      correctAnswer: questionType === 'MCQ' ? correctAnswer : null,
      answer: questionType === 'Integer' ? answer : null,
      solution,
      solutionImage
    });

    await newQuestion.save();

    // Update AnswerMap: either insert or merge
    const map = await AnswerMap.findOne({ batch });
    const ansValue = questionType === 'MCQ' ? correctAnswer : answer;
    if (map) {
      // merge into existing
      const subjectMap = map.answersMap.get(subject) || {};
      subjectMap[qId] = ansValue;
      map.answersMap.set(subject, subjectMap);
      await map.save();
    } else {
      // create new
      const newMap = new AnswerMap({
        batch,
        answersMap: { [subject]: { [qId]: ansValue } }
      });
      await newMap.save();
    }

    res.status(201).json(newQuestion);
  } catch (err) {
    console.error('Error adding question:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET questions for a given series (optionally filter by batch/subject)
app.get('/api/questions', async (req, res) => {
  try {
    const { series, subject } = req.query; 
    // e.g. /api/questions?series=Test1&subject=Physics
    const filter = {};
    if (series) filter.series = series;
    if (subject) filter.subject = subject;

    const qs = await Question.find(filter).sort({ addedAt: -1 });
    res.json(qs);
  } catch (err) {
    console.error('Error fetching questions:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// • CHAPTER ENDPOINTS
// POST add a chapter (series + subject + chapterName)
app.post('/api/chapters', async (req, res) => {
  try {
    const { series, subject, chapterName } = req.body;
    if (!series || !subject || !chapterName) {
      return res.status(400).json({ message: 'series, subject, and chapterName are required' });
    }
    const existing = await Chapter.findOne({ series, subject });
    if (existing) {
      if (!existing.chapters.includes(chapterName)) {
        existing.chapters.push(chapterName);
        await existing.save();
      }
      return res.json(existing);
    }
    const newChap = new Chapter({ series, subject, chapters: [chapterName] });
    await newChap.save();
    res.status(201).json(newChap);
  } catch (err) {
    console.error('Error adding chapter:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET chapters for a specific series+subject
app.get('/api/chapters', async (req, res) => {
  try {
    const { series, subject } = req.query; // /api/chapters?series=Test1&subject=Physics
    if (!series || !subject) {
      return res.status(400).json({ message: 'series and subject query params are required' });
    }
    const chap = await Chapter.findOne({ series, subject });
    if (!chap) return res.json({ chapters: [] });
    res.json({ chapters: chap.chapters });
  } catch (err) {
    console.error('Error fetching chapters:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// • ANSWER MAP ENDPOINTS (Optional: if you need to fetch the entire map)
// GET answer map for a batch
app.get('/api/answer-map', async (req, res) => {
  try {
    const { batch } = req.query; // /api/answer-map?batch=Batch1
    if (!batch) return res.status(400).json({ message: 'batch query param is required' });
    const map = await AnswerMap.findOne({ batch });
    if (!map) return res.json({ answersMap: {} });
    // Convert Mongoose Map to plain object
    const result = {};
    for (let [subject, obj] of map.answersMap.entries()) {
      result[subject] = obj;
    }
    res.json({ answersMap: result });
  } catch (err) {
    console.error('Error fetching answer map:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── FALLBACK & STARTUP ───────────────────────────────────────────────────────
// Serve index.html on any unknown route (for direct browser navigation in production)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
