import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import VideoData from './VideoData';

const Video = () => {
  const { id } = useParams();
  const [formData, setFormData] = useState(null);
  // const baseURL = process.env.REACT_APP_BASE_URL;
  
  useEffect(() => {
    const fetchVideoData = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BASE_URL}/video/${id}`);
        if (!response.ok) {
          throw new Error('Video not found');
        }
        const videoData = await response.json();
        setFormData(videoData);
      } catch (error) {
        console.error('Error fetching video:', error);
      }
    };

    fetchVideoData();
  }, [id]);

  return (
    <div>
      {formData ? (
        <div>
          <VideoData
            name={formData.name}
            websiteUrl={formData.websiteUrl}
            videoUrl={formData.videoUrl}
            timeFullScreen={formData.timeFullScreen}
            videoDuration = {formData.videoDuration}
          />
        </div>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
};

export default Video;
