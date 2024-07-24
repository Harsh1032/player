import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import { nanoid } from "nanoid";
import cors from "cors";
import path from "path";
import Papa from "papaparse";
import fs from "fs";

const app = express();

// Build the MongoDB URL with TLS/SSL options
const mongoURL = `${process.env.MONGO_URL}&tls=true&tlsAllowInvalidCertificates=true`;

// Enable Mongoose debugging
mongoose.set("debug", true);

// Database connection
mongoose
  .connect(mongoURL)
  .then(() => console.log("database connected"))
  .catch((err) => console.log("database not connected", err));

const __dirname = path.resolve();
const downloadsPath = path.join(__dirname, "../client/build", "downloads");

// Create the downloads directory if it does not exist
if (!fs.existsSync(downloadsPath)) {
  fs.mkdirSync(downloadsPath, { recursive: true });
}

// Now you can safely write the CSV file
const fileName = `generated_videos_${Date.now()}.csv`;
const filePath = path.join(downloadsPath, fileName);

const baseURL = process.env.BASE_URL;

app.use(express.json());
app.use(cors({ origin: baseURL }));

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

// Define CSV file schema
const csvFileSchema = new mongoose.Schema({
  fileName: String,
  numberOfPages: Number,
  generatedAt: { type: Date, default: Date.now },
  downloadLink: String,
});

const CsvFile = mongoose.model("CsvFile", csvFileSchema);

const Video = mongoose.model("Video", videoSchema);

app.get("/", (req, res) => {
  res.json("Hello");
});

app.get('/test-page', (req, res) => {
  const title = req.query.title || 'Default Title';
  const description = req.query.description || 'Default Description';

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <meta name="description" content="${description}">
        <!-- Other meta tags -->
      </head>
      <body>
        <h1>${title}</h1>
        <p>${description}</p>
      </body>
    </html>
  `);
});

// Generate unique video link
app.post("/generate", async (req, res) => {
  const { name, websiteUrl, videoUrl, timeFullScreen, videoDuration } =
    req.body;
  const newVideo = new Video({
    name,
    websiteUrl,
    videoUrl,
    timeFullScreen,
    videoDuration,
  });
  await newVideo.save();
  res.json({ link: `${baseURL}/video/${newVideo.id}` });
});

// Route to handle bulk generation
app.post("/generate-bulk", async (req, res) => {
  const { videos, originalFileName } = req.body;

  if (!videos || !Array.isArray(videos)) {
    return res
      .status(400)
      .json({ error: "Invalid request format. Expected an array of videos." });
  }
  const generatedLinks = await Promise.all(
    videos.map(async (video) => {
      const { name, websiteUrl, videoUrl, timeFullScreen, videoDuration } =
        video;
      const newVideo = new Video({
        name,
        websiteUrl,
        videoUrl,
        timeFullScreen,
        videoDuration,
      });
      await newVideo.save();
      return `${baseURL}/video/${newVideo.id}`;
    })
  );

  // Generate CSV file and save its information
  const csvData = videos.map((video, index) => ({
    ...video,
    link: generatedLinks[index],
  }));

  const csv = Papa.unparse(csvData);
  const fileName = originalFileName || `generated_videos_${Date.now()}.csv`;
  const filePath = path.join(
    __dirname,
    "../client/build",
    "downloads",
    fileName
  );

  // Create the directory if it doesn't exist
  const downloadsPath = path.dirname(filePath);
  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }

  // Write CSV data to file
  fs.writeFileSync(filePath, csv, "utf8");

  // Save CSV file information to the database
  const newCsvFile = new CsvFile({
    fileName,
    numberOfPages: videos.length,
    downloadLink: `/downloads/${fileName}`,
  });
  await newCsvFile.save();

  res.json({ links: generatedLinks });
});

// Retrieve video data by ID
app.get("/video/:id", async (req, res) => {
  const { id } = req.params;
  const video = await Video.findOne({ id });
  if (video) {
    res.json(video);
  } else {
    res.status(404).json({ error: "Video not found" });
  }
});

//router to get csv data
app.get("/csv-files", async (req, res) => {
  try {
    const csvFiles = await CsvFile.find();
    res.status(200).json(csvFiles);
  } catch (error) {
    console.error("Error fetching CSV files:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete video data by ID

app.delete("/video/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await Video.deleteOne({ id: id });
    if (result.deletedCount === 1) {
      res.status(200).json({ message: "Video deleted successfully" });
    } else {
      res.status(404).json({ error: "Video not found" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while deleting the video" });
  }
});

// Route to get all videos
app.get("/videos", async (req, res) => {
  try {
    const videos = await Video.find().sort({createdAt: -1});
    res.status(200).json(videos);
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, "../client/build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});

// Running the server on port 8000
const port = 8000;
app.listen(port, () => console.log(`Server is running on port ${port}`));
