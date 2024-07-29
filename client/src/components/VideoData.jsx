import React, { useContext, useEffect, useState, useRef } from "react";
import { Helmet } from "react-helmet";
import "./CustomVideoPlayer.css";
import Logo from "../assets/logo.png";
import Cal, { getCalApi } from "@calcom/embed-react";

const VideoData = ({
  name,
  websiteUrl,
  videoUrl,
  timeFullScreen,
  videoDuration,
  image,
}) => {
  const videoRef = useRef(null);
  const thumbnailImgRef = useRef(null);
  const videoContainerRef = useRef(null);
  const timelineContainerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1); // Initial volume set to max (1)
  const [isMuted, setIsMuted] = useState(false); // Track mute state
  const [previousVolume, setPreviousVolume] = useState(1); // Track previous volume level
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // Initial playback speed
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [wasPaused, setWasPaused] = useState(false);
  const [isVideoFull, setIsVideoFull] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(true); // Manage play button visibility
  const [totalTime, setTotalTime] = useState(videoDuration);
  const canvasRef = useRef(null);

  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    const overlayUrl = `http://localhost:8000/generate-image-overlay?imageUrl=${websiteUrl}&webcamImageUrl=${image}`;
    setImageUrl(overlayUrl);
  }, [websiteUrl, image]);
  
  useEffect(() => {
    (async function () {
      try {
        const cal = await getCalApi({});
        cal("ui", {
          styles: { branding: { brandColor: "#000000" } },
          hideEventTypeDetails: false,
          layout: "month_view",
        });
      } catch (error) {
        console.error("Error initializing Cal.com API:", error);
      }
    })();
  }, []);

  useEffect(() => {
    const convertToMinutesAndSeconds = (timeInSeconds) => {
      const minutes = Math.floor(timeInSeconds / 60);
      const seconds = timeInSeconds % 60;
      return { minutes, seconds };
    };
    const { minutes, seconds } = convertToMinutesAndSeconds(videoDuration);
    setMinutes(minutes);
    setSeconds(seconds);
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    const updateProgress = () => {
      if (video) {
        const currentTime = video.currentTime;
        const duration = video.duration;
        const progressPercent = (currentTime / duration) * 100;
        setProgress(progressPercent);

        // Update current time
        setCurrentTime(formatDuration(currentTime));
        // Update total time (only once)
        if (!isNaN(duration) && totalTime === "0:00") {
          setTotalTime(formatDuration(duration));
        }
        // Update CSS variable for progress
        timelineContainerRef.current.style.setProperty(
          "--progress-position",
          progressPercent / 100
        );

        if (currentTime >= timeFullScreen) {
          setIsVideoFull(true);
        } else {
          setIsVideoFull(false);
        }
      }
    };

    const handleTimeUpdate = () => {
      updateProgress();
    };

    const handlePlay = () => {
      setIsPlaying(true);
      videoContainerRef.current.classList.remove("paused");
      setShowPlayButton(false); // Hide play button when video starts playing
    };

    const handlePause = () => {
      setIsPlaying(false);
      videoContainerRef.current.classList.add("paused");
    };

    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement); // Update isFullScreen based on fullscreenElement
      videoContainerRef.current.classList.toggle(
        "full-screen",
        !!document.fullscreenElement
      ); // Toggle CSS class based on fullscreen state
    };

    if (video) {
      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);
      document.addEventListener("fullscreenchange", handleFullScreenChange); // Listen to fullscreenchange event
    }

    return () => {
      if (video) {
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
        document.removeEventListener(
          "fullscreenchange",
          handleFullScreenChange
        ); // Clean up event listener
      }
    };
  }, []);

  useEffect(() => {
    const handleDocumentMouseUp = (e) => {
      if (isScrubbing) toggleScrubbing(e);
    };

    const handleDocumentMouseMove = (e) => {
      if (isScrubbing) handleTimelineUpdate(e);
    };

    document.addEventListener("mouseup", handleDocumentMouseUp);
    document.addEventListener("mousemove", handleDocumentMouseMove);

    return () => {
      document.removeEventListener("mouseup", handleDocumentMouseUp);
      document.removeEventListener("mousemove", handleDocumentMouseMove);
    };
  }, [isScrubbing]);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  const toggleFullScreenMode = () => {
    const videoContainer = videoContainerRef.current;
    if (document.fullscreenElement === null) {
      if (videoContainer && videoContainer.requestFullscreen) {
        videoContainer.requestFullscreen();
      } else if (videoContainer && videoContainer.webkitRequestFullscreen) {
        /* Safari */
        videoContainer.webkitRequestFullscreen();
      } else if (videoContainer && videoContainer.msRequestFullscreen) {
        /* IE11 */
        videoContainer.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        /* Safari */
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        /* IE11 */
        document.msExitFullscreen();
      }
    }
  };

  const handleVolumeChange = (e) => {
    const value = parseFloat(e.target.value);
    setVolume(value);
    if (videoRef.current) {
      videoRef.current.volume = value;
      // Determine volume level and set data attribute
      setIsMuted(value === 0); // Update mute state

      let volumeLevel;
      if (value === 0) {
        volumeLevel = "muted";
      } else {
        volumeLevel = "high";
      }
      videoContainerRef.current.dataset.volumeLevel = volumeLevel;
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (video) {
      if (isMuted) {
        // Unmute
        console.log("Unmuting video"); // Debugging
        video.volume = previousVolume;
        setVolume(previousVolume);
        setIsMuted(false);
        videoContainerRef.current.dataset.volumeLevel = "high";
      } else {
        // Mute
        console.log("Muting video"); // Debugging
        setPreviousVolume(volume); // Save the current volume
        video.volume = 0;
        setVolume(0);
        setIsMuted(true);
        videoContainerRef.current.dataset.volumeLevel = "muted";
      }
    }
  };

  function formatDuration(time) {
    const seconds = Math.floor(time % 60);
    const minutes = Math.floor(time / 60) % 60;
    const hours = Math.floor(time / 3600);
    return hours === 0
      ? `${minutes}:${leadingZeroFormatter(seconds)}`
      : `${hours}:${leadingZeroFormatter(minutes)}:${leadingZeroFormatter(
          seconds
        )}`;
  }

  function leadingZeroFormatter(value) {
    return value < 10 ? `0${value}` : value;
  }

  const changePlaybackSpeed = () => {
    if (videoRef.current) {
      let newPlaybackRate = videoRef.current.playbackRate + 0.25;
      if (newPlaybackRate > 2) newPlaybackRate = 0.25;
      videoRef.current.playbackRate = newPlaybackRate;
      setPlaybackSpeed(newPlaybackRate); // Update the playback speed state
    }
  };

  const handleTimelineUpdate = (e) => {
    const rect = timelineContainerRef.current.getBoundingClientRect();
    const percent =
      Math.min(Math.max(0, e.clientX - rect.x), rect.width) / rect.width;
    if (isScrubbing) {
      videoRef.current.currentTime = percent * videoRef.current.duration;
      setProgress(percent * 100);
    }
  };

  const toggleScrubbing = (e) => {
    const rect = timelineContainerRef.current.getBoundingClientRect();
    const percent =
      Math.min(Math.max(0, e.clientX - rect.x), rect.width) / rect.width;
    const isCurrentlyScrubbing = (e.buttons & 1) === 1;
    setIsScrubbing(isCurrentlyScrubbing);
    videoContainerRef.current.classList.toggle(
      "scrubbing",
      isCurrentlyScrubbing
    );
    if (isCurrentlyScrubbing) {
      setWasPaused(videoRef.current.paused);
      videoRef.current.pause();
    } else {
      videoRef.current.currentTime = percent * videoRef.current.duration;
      if (!wasPaused) videoRef.current.play();
    }

    handleTimelineUpdate(e);
  };

  const handleClick = () => {
    window.location.href =
      "https://cal.com/gvald/appel?date=2024-07-15&month=2024-07";
  };

  return (
    <div className="flex flex-col w-full h-full bg-slate-400 justify-center items-center overflow-y-scroll no-scrollbar">
      <Helmet>
        <title>Video for {name}</title>
        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`Video for ${name}`}/>
        <meta property="twitter:url" content={window.location.href}/>
        <meta name="twitter:domain" content="agence-quasr.fr" />
        <meta name="twitter:description" content={`Check out this personalized video for ${name}.`}/>
        <meta name="twitter:image"  content={imageUrl}  />

        {/* Optional: Open Graph Meta Tags for better compatibility */}
        <meta property="og:title" content={`Video for ${name}`} />
        <meta
          property="og:description"
          content={`Check out this personalized video for ${name}.`}
        />
        <meta property="og:image" content={imageUrl}  />
        <meta property="og:url" content={window.location.href} />

      </Helmet>
      <div className="h-[10%] flex flex-col w-full text-center justify-end">
        <span className="xs:text-base md:text-2xl xl:text-4xl h-full xs:w-full font-bold pt-9 z-10">
          Vidéo à l'attention de Denis {name}
        </span>
      </div>
      <div className="flex xs:flex-col h-[90%] w-[90%] xs:mb-5 md:flex-row items-center justify-center">
        <div className="flex flex-col items-center justify-center md:w-[60%] md:h-[100%] xs:w-[100%] xs:h-[60%] bg-slate-400 xs:pt-2 md:ml-5">
          <div
            className={`video-container paused ${
              isFullScreen ? "full-screen" : ""
            }  xs:w-[100%] xl:w-[95%]`}
            data-volume-level="high"
            ref={videoContainerRef}
          >
            <img
              src={websiteUrl}
              className={`top-0 left-0 w-full h-full object-cover ${
                isFullScreen ? "full-screen-img" : "rounded-xl"
              }`}
              alt="Background"
            />
            <div
              id="video2"
              className={` ${
                isVideoFull
                  ? "full-video-container"
                  : "absolute xs:bottom-5 bottom-12 left-6 overflow-hidden border-2 border-white  rounded-full"
              }  ${
                isFullScreen
                  ? "  xs:w-[100px] xs:h-[100px] sm:w-[125px] sm:h-[125px] lg:w-[190px] lg:h-[190px] xl:w-[220px] xl:h-[220px]"
                  : "xs:w-[80px] xs:h-[80px] sm:w-[105px] sm:h-[105px] lg:w-[120px] lg:h-[120px] xl:w-[170px] xl:h-[170px]"
              }`}
            >
              <video
                ref={videoRef}
                className={` ${
                  isVideoFull
                    ? "full-video"
                    : "relative w-full h-full object-cover rounded-full"
                }`}
                onClick={togglePlayPause}
                controls={false}
                style={{ aspectRatio: "1 / 1", objectFit: "cover" }}
              >
                <source src={videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
            {showPlayButton && (
              <>
                <div
                  className="play-button-container"
                  onClick={togglePlayPause}
                >
                  <svg viewBox="0 0 24 24" className="play-button-icon">
                    <path fill="currentColor" d="M8 5v14l11-7z"></path>
                  </svg>
                </div>
                <div className="play-message xs:mt-3 md:mt-1">
                  <span className="font-medium">
                    Play {videoDuration} sec video
                  </span>
                </div>
              </>
            )}

            {!showPlayButton && (
              <>
                <img className="thumbnail-img" ref={thumbnailImgRef} />
                <div className="video-controls-container">
                  <div
                    className="timeline-container"
                    ref={timelineContainerRef}
                    onMouseMove={handleTimelineUpdate}
                    onMouseDown={toggleScrubbing}
                  >
                    <div className="timeline">
                      <div
                        className="thumb-indicator"
                        style={{ left: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="controls">
                    <button
                      className="play-pause-btn"
                      onClick={togglePlayPause}
                    >
                      {isPlaying ? (
                        <svg class="pause-icon" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M14,19H18V5H14M6,19H10V5H6V19Z"
                          />
                        </svg>
                      ) : (
                        <svg class="play-icon" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M8,5.14V19.14L19,12.14L8,5.14Z"
                          />
                        </svg>
                      )}
                    </button>
                    <div className="volume-container">
                      <button className="mute-btn" onClick={toggleMute}>
                        {isMuted ? (
                          <svg class="volume-muted-icon" viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z"
                            />
                          </svg>
                        ) : (
                          <svg class="volume-high-icon" viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"
                            />
                          </svg>
                        )}
                      </button>
                      <input
                        class="volume-slider"
                        type="range"
                        min="0"
                        max="1"
                        step="any"
                        value={volume}
                        onChange={handleVolumeChange}
                      ></input>
                    </div>
                    <div className="duration-container">
                      <div class="current-time">{currentTime}</div>/
                      <div class="total-time">{`${minutes}:${seconds}`}</div>
                    </div>
                    <button
                      className="speed-btn wide-btn"
                      onClick={changePlaybackSpeed}
                    >
                      {playbackSpeed}x
                    </button>
                    <button
                      className="full-screen-btn"
                      onClick={toggleFullScreenMode}
                    >
                      {isFullScreen ? (
                        <svg className="close" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"
                          />
                        </svg>
                      ) : (
                        <svg className="open" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center justify-center xs:w-[100%] md:w-[85%] xl:w-[95%] md:mt-[5%] xs:mt-3 z-1">
            <div className="md:w-[100%] flex justify-between items-center xs:w-[100%]">
              <img
                src={Logo}
                className="md:w-[25%] md:max-h-[20%] xl:max-h-[30%] xs:w-[80px] xs:h-[40px]"
              />
              <button
                onClick={handleClick}
                className="bg-black text-white xs:w-max-w-[50%] xs:h-[40px] p-1 rounded-xl  md:max-w-[60%] md:max-h-[25%] md:text-base xl:text-xl xs:text-sm"
              >
                Plannifier un appel gratuit
              </button>
            </div>
          </div>
        </div>
        <div className="xs:flex xs:items-center xs:justify-center xs:w-[100%] xs:mt-5 xs:h-[400px] md:h-[90%] md:w-[34%] xl:h-[95%] object-contain overflow-y-scroll no-scrollbar">
          <div className="md:w-[80%] xs:w-[100%] xs:h-[100%] overflow-y-scroll no-scrollbar xs:flex xs:items-center xs:justify-center">
            <Cal
              calLink="gvald/appel"
              style={{ width: "100%", height: "100%" }}
              config={{ layout: "month_view" }}
              className="overflow-y-scroll no-scrollbar object-cover"
            ></Cal>
          </div>
        </div>
      </div>
      <canvas
              ref={canvasRef}
              width="500"
              height="281"
              style={{ display: 'none' }}
            />
    </div>
  );
};
export default VideoData;
