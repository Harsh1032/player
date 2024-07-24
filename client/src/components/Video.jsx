import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import VideoData from "./VideoData";

const Video = () => {
  const { id } = useParams();
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const baseURL = process.env.REACT_APP_BASE_URL;

  useEffect(() => {
    const fetchVideoData = async () => {
      try {
        const response = await fetch(`${baseURL}/video/${id}`);
        if (!response.ok) {
          throw new Error("Video not found");
        }
        const videoData = await response.json();
        setFormData(videoData);
      } catch (error) {
        console.error("Error fetching video:", error);
        window.location.href = 'https://www.quasr.fr/'; // Navigate to the specific site if an error occurs
      } finally {
        setLoading(false); // Data fetching is complete, set loading to false
      }
    };

    fetchVideoData();
  }, [id, baseURL]);

  useEffect(() => {
    if (!loading && formData === null) {
      window.location.href = 'https://www.quasr.fr/'; // Navigate to the specific site if formData is null after loading
    }
  }, [loading, formData]);

  if (loading) {
    return (
      <div className="flex justify-center items-center w-full h-full">
        <div
          className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
          role="status"
        >
          <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      {formData ? (
        <VideoData
          name={formData.name}
          websiteUrl={formData.websiteUrl}
          videoUrl={formData.videoUrl}
          timeFullScreen={formData.timeFullScreen}
          videoDuration={formData.videoDuration}
        />
      ) : (
        <div className="flex justify-center items-center w-full h-full">
           <div className="flex justify-center items-center w-full h-full">
        <div
          className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
          role="status"
        >
          <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
            Loading...
          </span>
        </div>
      </div>
        </div>
      )}
    </div>
  );
};

export default Video;
