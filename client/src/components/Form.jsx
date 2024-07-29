import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FaTrashAlt, FaHistory } from "react-icons/fa";

const Form = () => {
  const baseURL = process.env.REACT_APP_BASE_URL;

  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [timeFullScreen, setTimeFullScreen] = useState("");
  const [image, setImage] = useState("");
  const [videoDuration, setVideoDuration] = useState(null);

  const [mode, setMode] = useState("single"); // State to manage form mode
  const [csvFile, setCsvFile] = useState(null); // State to manage CSV file

  const [csvFiles, setCsvFiles] = useState([]);
  const [showCsvDropdown, setShowCsvDropdown] = useState(false);

  const [videos, setVideos] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchVideos();
    fetchCsvFiles();
  }, []);

  const fetchCsvFiles = async () => {
    try {
      const response = await fetch(`${baseURL}/csv-files`);
      const data = await response.json();
      if (response.ok) {
        setCsvFiles(data);
      } else {
        console.error(data.error);
      }
    } catch (error) {
      console.error("Error fetching CSV files:", error);
    }
  };

  console.log(csvFiles);
  // for fetching videos
  const fetchVideos = async () => {
    try {
      const response = await fetch(`${baseURL}/videos`);
      const data = await response.json();
      if (response.ok) {
        setVideos(data);
      } else {
        console.error(data.error);
      }
    } catch (error) {
      console.error("Error fetching videos:", error);
    }
  };

  // for deleting videos
  const deleteVideo = async (id) => {
    try {
      const response = await fetch(`${baseURL}/video/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (response.ok) {
        toast.success("Video deleted successfully.");
        // Remove the deleted video from the local state
        setVideos((prevVideos) =>
          prevVideos.filter((video) => video.id !== id)
        );
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Error deleting video:", error);
      toast.error("An error occurred while deleting the video.");
    }
  };

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

          const validRows = results.data.filter(
            (row) =>
              row.name && row.websiteUrl && row.videoUrl && row.timeFullScreen && row.image
          );

          const videos = validRows.map((row) => ({
            name: row.name,
            websiteUrl: row.websiteUrl,
            videoUrl: row.videoUrl,
            timeFullScreen: parseInt(row.timeFullScreen, 10),
            image: row.image,
            videoDuration: null, // Will be set later
            
          }));

          // Extract video durations
          for (const video of videos) {
            video.videoDuration = await getVideoDuration(video.videoUrl);
          }

          console.log("Videos to Submit: ", videos); // Debugging line

          // Submit bulk data
          await submitBulkData(videos, csvFile.name);

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
      image,
    };

    try {
      const response = await fetch(`${baseURL}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formDataToSubmit),
      });

      const data = await response.json();
      if (response.ok) {
        const videoId = data.link.split("/").pop();
        navigate(`/video/${videoId}`);
        // Fetch videos after submission
        fetchVideos();
      } else {
        toast.error(`${data.error}`);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred while generating the video link.");
    }
  };

  const submitBulkData = async (videos, originalFileName) => {
    try {
      const response = await fetch(`${baseURL}/generate-bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videos, originalFileName }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success("Templates successfully generated");
        generateDownloadableFile(data.links, videos);
        // Fetch videos after submission
        fetchVideos();
        // Fetch CSV files after bulk submission
        fetchCsvFiles();
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
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "generated_videos.csv";
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
    console.log(
      `Switching mode from ${mode} to ${mode === "single" ? "bulk" : "single"}`
    );
    setMode(mode === "single" ? "bulk" : "single");
  };

  //deleting csvFiles
  const deleteCsvFile = async (id) => {
    try {
      const response = await fetch(`${baseURL}/csv-files/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (response.ok) {
        toast.success("CSV file and associated videos deleted successfully.");
        // Remove the deleted CSV file from the local state
        setCsvFiles((prevCsvFiles) =>
          prevCsvFiles.filter((file) => file._id !== id)
        );

        // Also remove the associated videos from the state
        const updatedVideos = videos.filter(
          (video) => video.csvFile !== id
        );
        setVideos(updatedVideos);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Error deleting CSV file:", error);
      toast.error("An error occurred while deleting the CSV file.");
    }
  };

  const renderVideos = (videoList) => {
    return videoList.map((video, index) => (
      <li key={video.id} className="flex items-center justify-between p-2">
        <span>{video.name}</span>
        <button
          onClick={() => deleteVideo(video.id)}
          className="p-1 bg-red-500 hover:bg-red-400 text-white rounded"
        >
          <FaTrashAlt />
        </button>
      </li>
    ));
  };

  const renderCsvFiles = (csvFileList) => {
    return csvFileList.map((file, index) => (
      <li key={file._id} className="flex items-center justify-between p-2">
        <span>{file.fileName}</span>
        <span>{file.numberOfPages}</span>
        <span>{new Date(file.generatedAt).toLocaleDateString()}</span>
        <a
          href={`${baseURL}${file.downloadLink}`}
          className="p-1 bg-blue-500 hover:bg-blue-400 text-white rounded"
          download
        >
          Download
        </a>
        <button
          onClick={() => deleteCsvFile(file._id)}
          className="p-1 bg-red-500 hover:bg-red-400 text-white rounded ml-2"
        >
          <FaTrashAlt />
        </button>
      </li>
    ));
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
            <input
              type="url"
              placeholder="Set Image URL"
              required
              className="lg:w-[50%] h-[10%] xs:w-[80%] rounded-lg p-2 bg-white text-center border border-black"
              value={image}
              onChange={(e) => setImage(e.target.value)}
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

      <div className="absolute top-4 right-4">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="relative z-10 p-2 bg-gray-600 hover:bg-gray-500 text-white rounded-full"
        >
          <FaTrashAlt />
        </button>
        <button
          onClick={() => setShowCsvDropdown(!showCsvDropdown)}
          className="relative z-10 p-2 bg-gray-600 hover:bg-gray-500 text-white rounded-full ml-2"
        >
          <FaHistory />
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-20 max-h-64 overflow-y-scroll no-scrollbar">
            <ul className="divide-y divide-gray-200">{renderVideos(videos)}</ul>
            {videos.length <= 0 && (
              <div className="flex justify-center p-2">
                <span className="text-xl font-semibold">
                  No video generated
                </span>
              </div>
            )}
          </div>
        )}

        {showCsvDropdown && (
          <div className="absolute right-0 mt-2 w-80 max-w-xs bg-white border border-gray-300 rounded-lg shadow-lg z-20 max-h-64 overflow-y-scroll no-scrollbar">
            <ul className="divide-y divide-gray-200">
              {renderCsvFiles(csvFiles)}
            </ul>
            {csvFiles.length <= 0 && (
              <div className="flex justify-center p-2">
                <span className="text-xl font-semibold">
                  No CSV files generated
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <video
        ref={videoRef}
        style={{ display: "none" }}
        onLoadedMetadata={(e) =>
          setVideoDuration(Math.floor(e.target.duration))
        }
      >
        <source src={videoUrl} />
      </video>
    </div>
  );
};

export default Form;
