import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import { nanoid } from "nanoid";
import cors from "cors";
import path from "path";
import Papa from "papaparse";
import fs from "fs";
import { createCanvas, loadImage } from "canvas";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

import axios from "axios";

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

ffmpeg.setFfmpegPath(ffmpegPath);
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
app.use(cors());

// Define video schema
const videoSchema = new mongoose.Schema({
  id: { type: String, default: () => nanoid(12) },
  name: String,
  websiteUrl: String,
  videoUrl: String,
  timeFullScreen: Number,
  videoDuration: Number,
  image: String,
  createdAt: { type: Date, default: Date.now },
});

// Define CSV file schema
const csvFileSchema = new mongoose.Schema({
  fileName: String,
  numberOfPages: Number,
  generatedAt: { type: Date, default: Date.now },
  downloadLink: String,
  videoIds: [{ type: String, ref: "Video" }],
});

const CsvFile = mongoose.model("CsvFile", csvFileSchema);

const Video = mongoose.model("Video", videoSchema);

app.get("/", (req, res) => {
  res.json("Hello");
});

// Generate unique video link
app.post("/generate", async (req, res) => {
  const { name, websiteUrl, videoUrl, timeFullScreen, videoDuration, image } =
    req.body;
  const newVideo = new Video({
    name,
    websiteUrl,
    videoUrl,
    timeFullScreen,
    videoDuration,
    image,
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

  // Save all videos and collect their IDs and generated links
  const savedVideos = await Promise.all(
    videos.map(async (video) => {
      const { name, websiteUrl, videoUrl, timeFullScreen, videoDuration, image } =
        video;
      const newVideo = new Video({
        name,
        websiteUrl,
        videoUrl,
        timeFullScreen,
        videoDuration,
        image,
      });
      await newVideo.save();
      return newVideo;
    })
  );

  const generatedLinks = savedVideos.map(
    (video) => `${baseURL}/video/${video.id}`
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
    videoIds: savedVideos.map((video) => video.id),
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
    const videos = await Video.find().sort({ createdAt: -1 });
    res.status(200).json(videos);
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/csv-files/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Find the CSV file document by ID
    const csvFile = await CsvFile.findById(id);
    if (!csvFile) {
      return res.status(404).json({ error: "CSV file not found" });
    }

    // Retrieve the list of associated video IDs
    const videoIds = csvFile.videoIds;

    // Delete the associated videos from the database
    await Video.deleteMany({ id: { $in: videoIds } });

    // Delete the CSV file document from the database
    await CsvFile.findByIdAndDelete(id);

    // Optionally, delete the CSV file from the filesystem
    const filePath = path.join(
      __dirname,
      "../client/build",
      csvFile.downloadLink
    );
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res
      .status(200)
      .json({ message: "CSV file and associated videos deleted successfully" });
  } catch (error) {
    console.error("Error deleting CSV file and associated videos:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/generate-image-overlay", async (req, res) => {
  const { imageUrl, webcamImageUrl } = req.query;

  if (!imageUrl || !webcamImageUrl) {
    return res.status(400).send("imageUrl is required");
  }

  try {
    const canvas = createCanvas(500, 281); // Size as per your requirements
    const ctx = canvas.getContext("2d");

    const baseImage = await loadImage(imageUrl);
    ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

    const overlayImage = await loadImage(
      "https://www.quasr.fr/wp-content/uploads/2024/07/overlay.png"
    );
    ctx.drawImage(overlayImage, 0, 0, canvas.width, canvas.height);

    // Draw the circular webcam image
    const webcamSize = 100;
    const margin = 10;
    const webcamX = margin;
    const webcamY = canvas.height - webcamSize - margin;
    // Create circular clipping path
    ctx.save();
    ctx.beginPath();
    ctx.arc(
      webcamX + webcamSize / 2,
      webcamY + webcamSize / 2,
      webcamSize / 2,
      0,
      Math.PI * 2
    );
    ctx.clip();

    // Draw the webcam image within the circular clipping path
    const webcamImage = await loadImage(webcamImageUrl);
    ctx.drawImage(webcamImage, webcamX, webcamY, webcamSize, webcamSize);
    ctx.restore(); // Restore the clipping path

    const buffer = canvas.toBuffer("image/png");
    res.set("Content-Type", "image/png");
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error generating image");
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
