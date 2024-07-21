import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import cors from 'cors';

const app = express();

// Build the MongoDB URL with TLS/SSL options
const mongoURL = `${process.env.MONGO_URL}&tls=true&tlsAllowInvalidCertificates=true`;

// Enable Mongoose debugging
mongoose.set('debug', true);

// Database connection
mongoose.connect(mongoURL)
  .then(() => console.log("database connected"))
  .catch((err) => console.log('database not connected', err));

app.use(express.json());
app.use(cors());

// Define video schema
const videoSchema = new mongoose.Schema({
    id: { type: String, default: () => nanoid(12) }, 
    name: String,
    websiteUrl: String,
    videoUrl: String,
    timeFullScreen: Number,
    videoDuration: Number,
    createdAt: { type: Date, default: Date.now },
});

const Video = mongoose.model('Video', videoSchema);

app.get('/', (req, res) => {
    res.json("Hello");
});

// Generate unique video link
app.post('/generate', async (req, res) => {
    const { name, websiteUrl, videoUrl, timeFullScreen, videoDuration } = req.body;
    const newVideo = new Video({ name, websiteUrl, videoUrl, timeFullScreen, videoDuration });
    await newVideo.save();
    res.json({ link: `https://player-fronten.onrender.com/video/${newVideo.id}` });
});

// Route to handle bulk generation
app.post('/generate-bulk', async (req, res) => {
    const { videos } = req.body;

    if (!videos || !Array.isArray(videos)) {
        return res.status(400).json({ error: 'Invalid request format. Expected an array of videos.' });
    }
    const generatedLinks = await Promise.all(videos.map(async (video) => {
        const { name, websiteUrl, videoUrl, timeFullScreen, videoDuration } = video;
        const newVideo = new Video({ name, websiteUrl, videoUrl, timeFullScreen, videoDuration });
        await newVideo.save();
        return `https://player-fronten.onrender.com/video/${newVideo.id}`;
    }));

    res.json({ links: generatedLinks });
});

//https://player-fronten.onrender.com

// Retrieve video data by ID
app.get('/video/:id', async (req, res) => {
    const { id } = req.params;
    const video = await Video.findOne({ id });
    if (video) {
        res.json(video);
    } else {
        res.status(404).json({ error: 'Video not found' });
    }
});

// Running the server on port 8000
const port = 8000;
app.listen(port, () => console.log(`Server is running on port ${port}`));
