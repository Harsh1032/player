import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Form = () => {
  const baseURL = process.env.REACT_APP_BASE_URL;

  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [timeFullScreen, setTimeFullScreen] = useState("");
  const [videoDuration, setVideoDuration] = useState(null);

  const [mode, setMode] = useState("single"); // State to manage form mode
  const [csvFile, setCsvFile] = useState(null); // State to manage CSV file

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleSubmission = async (e) => {
    e.preventDefault();

    if (mode === "bulk") {
      if (!csvFile) {
        alert("Please upload a CSV file.");
        return;
      }

      Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true, // Skip empty rows
        complete: async (results) => {
          console.log("CSV Parsed Results: ", results); // Debugging line

          const validRows = results.data.filter(row => 
            row.name && row.websiteUrl && row.videoUrl && row.timeFullScreen
          );

          const videos = validRows.map((row) => ({
            name: row.name,
            websiteUrl: row.websiteUrl,
            videoUrl: row.videoUrl,
            timeFullScreen: parseInt(row.timeFullScreen, 10),
            videoDuration: null, // Will be set later
          }));

          // Extract video durations
          for (const video of videos) {
            video.videoDuration = await getVideoDuration(video.videoUrl);
          }

          console.log("Videos to Submit: ", videos); // Debugging line

          // Submit bulk data
          await submitBulkData(videos);

          setCsvFile(null); // Clear the csvFile state
          if (fileInputRef.current) {
            fileInputRef.current.value = null; // Clear the file input
          }
        },
        error: (error) => {
          console.error("Error parsing CSV: ", error); // Debugging line
        },
      });
    } else {
      if (videoRef.current && videoDuration === null) {
        videoRef.current.load();
        videoRef.current.onloadedmetadata = async () => {
          setVideoDuration(Math.floor(videoRef.current.duration));
          await submitFormData(Math.floor(videoRef.current.duration));
        };
      } else {
        await submitFormData(videoDuration);
      }
    }
  };

  const submitFormData = async (duration) => {
    const formDataToSubmit = {
      name,
      websiteUrl,
      videoUrl,
      timeFullScreen,
      videoDuration: duration,
    };

    try {
      const response = await fetch(`${baseURL}/generate` , {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formDataToSubmit),
      });

      const data = await response.json();
      if (response.ok) {
        const videoId = data.link.split('/').pop();
        navigate(`/video/${videoId}`);
      } else {
        toast.error(`${data.error}`);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred while generating the video link.");
    }
  };

  const submitBulkData = async (videos) => {
    try {
      const response = await fetch(`${baseURL}/generate-bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videos }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success("Templates successfully generated");
        generateDownloadableFile(data.links, videos);
      } else {
        toast.error(`${data.error}`);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred while generating the bulk video links.");
    }
  };

  const getVideoDuration = (url) => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.src = url;
      video.onloadedmetadata = () => {
        resolve(Math.floor(video.duration));
      };
    });
  };

  const generateDownloadableFile = (links, videos) => {
    const rows = videos.map((video, index) => ({
      ...video,
      link: links[index],
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated_videos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVideoUrlChange = (e) => {
    setVideoUrl(e.target.value);
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  const handleModeSwitch = () => {
    console.log(`Switching mode from ${mode} to ${mode === "single" ? "bulk" : "single"}`);
    setMode(mode === "single" ? "bulk" : "single");
  };

  return (
    <div className="w-full h-full flex flex-col justify-center items-center">
      <button
        type="button"
        className="w-[200px] h-[40px] rounded-lg p-2 mb-5 bg-gray-600 hover:bg-gray-500 text-white"
        onClick={handleModeSwitch}
      >
        {mode === "single" ? "Switch to Bulk Mode" : "Switch to Single Form"}
      </button>

      <form
        className="xs:w-[90%] lg:w-[40%] h-[70%] flex flex-col gap-4 items-center justify-center rounded-lg p-2 bg-white"
        onSubmit={handleSubmission}
      >
        {mode === "single" ? (
          <>
            <input
              type="text"
              placeholder="Name"
              required
              className="lg:w-[50%] h-[10%] xs:w-[80%] rounded-lg p-2 bg-white text-center border border-black block whitespace-nowrap overflow-hidden text-ellipsis"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="url"
              placeholder="Website URL"
              required
              className="lg:w-[50%] h-[10%] xs:w-[80%] rounded-lg p-2 bg-white text-center border border-black"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
            <input
              type="url"
              placeholder="Video URL"
              required
              className="lg:w-[50%] h-[10%] xs:w-[80%] rounded-lg p-2 bg-white text-center border border-black"
              value={videoUrl}
              onChange={handleVideoUrlChange}
            />
            <input
              type="number"
              placeholder="Time to go full screen"
              required
              className="lg:w-[50%] h-[10%] xs:w-[80%] rounded-lg p-2 bg-white text-center border border-black"
              value={timeFullScreen}
              onChange={(e) => setTimeFullScreen(e.target.value)}
            />
            <button
              type="submit"
              className="w-[100px] h-[40px] rounded-lg p-2 mt-5 bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Submit
            </button>
          </>
        ) : (
          <>
            <input
              type="file"
              accept=".csv"
              required
              className="lg:w-[50%] h-[10%] xs:w-[80%] rounded-lg p-2 bg-white text-center border border-black"
              ref={fileInputRef} // Attach the ref here
              onChange={(e) => setCsvFile(e.target.files[0])}
            />
            <button
              type="submit"
              className="w-[100px] h-[40px] rounded-lg p-2 mt-5 bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Upload CSV
            </button>
          </>
        )}
        
      <ToastContainer />
      </form>
      <video
        ref={videoRef}
        style={{ display: "none" }}
        onLoadedMetadata={(e) => setVideoDuration(Math.floor(e.target.duration))}
      >
        <source src={videoUrl} />
      </video>
    </div>
  );
};

export default Form;
