import { useState, useCallback, useEffect, useMemo } from "react";
import { VideoPlayerContext } from "./videoPlayerContext.js";
import { selectVideosByKeywords } from "./videoSelector.js";
import { ALL_LESSONS } from "../courses/index.js";
import { getVideos, loadLesson } from "../courses/courseLoader.js";

function chapterNumOf(lesson) {
  const m = String(lesson?.chapterNumber ?? "").match(/-(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

export function VideoPlayerProvider({ children }) {
  // Closed until the learner opens it (the Video Player button, or a lesson's video link).
  // It used to start open-but-minimized, which put a player bar over every page on load.
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [lessonId, setLessonId] = useState(null);
  // The course index carries only titles and slugs, so a lesson's tags (what
  // its videos are matched on) come from the lesson file. On a lesson page it
  // is already loaded. Kept with its key so a previous lesson's tags are never
  // used for the next one.
  const [loadedTags, setLoadedTags] = useState({ key: null, tags: [] });
  useEffect(() => {
    if (!lessonId) return;
    let cancelled = false;
    const slash = lessonId.lastIndexOf("/");
    loadLesson(lessonId.slice(0, slash), lessonId.slice(slash + 1))
      .then((lesson) => {
        if (!cancelled) setLoadedTags({ key: lessonId, tags: Array.isArray(lesson?.tags) ? lesson.tags : [] });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [lessonId]);
  const lessonTags = loadedTags.key === lessonId ? loadedTags.tags : null;
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedVideos, setPinnedVideos] = useState(() => {
    const saved = localStorage.getItem("open-calc-pinned-videos");
    return saved ? JSON.parse(saved) : [];
  });
  const [customVideos, setCustomVideos] = useState(() => {
    const saved = localStorage.getItem("open-calc-custom-videos");
    return saved ? JSON.parse(saved) : {};
  });

  const openPlayer = useCallback((videoData, id = null) => {
    if (videoData) setCurrentVideo(videoData);
    if (id) setLessonId(id);
    setIsOpen(true);
    setIsMinimized(false);
  }, []);

  const closePlayer = useCallback(() => {
    setIsOpen(false);
    setCurrentVideo(null);
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  const selectVideo = useCallback((videoData) => {
    setCurrentVideo(videoData);
    setIsMinimized(false);
  }, []);

  // Unlike selectVideo, this never forces the player open or expanded — it's
  // used to line up the right video (e.g. background music) for whenever
  // the player is next opened, without popping it up just because the route
  // changed underneath the user.
  const setBackgroundVideo = useCallback((videoData) => {
    setCurrentVideo(videoData);
  }, []);

  const togglePin = useCallback((vidId) => {
    setPinnedVideos((prev) => {
      let updated;
      if (prev.includes(vidId)) {
        updated = prev.filter((id) => id !== vidId);
      } else {
        updated = [vidId, ...prev];
      }
      localStorage.setItem("open-calc-pinned-videos", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const addCustomVideo = useCallback(
    (url, title) => {
      if (!lessonId) return;

      // Simple YouTube embed converter
      let embedUrl = url;
      if (url.includes("youtube.com/watch?v=")) {
        embedUrl = url.replace("watch?v=", "embed/");
      } else if (url.includes("youtu.be/")) {
        embedUrl = url.replace("youtu.be/", "youtube.com/embed/");
      }

      const newVid = {
        id: `custom-${Date.now()}`,
        title: title || "Custom Video",
        url: embedUrl,
        source: "User Custom",
        isCustom: true,
      };

      setCustomVideos((prev) => {
        const updated = {
          ...prev,
          [lessonId]: [...(prev[lessonId] || []), newVid],
        };
        localStorage.setItem(
          "open-calc-custom-videos",
          JSON.stringify(updated),
        );
        return updated;
      });

      setCurrentVideo(newVid);
      setIsMinimized(false);
    },
    [lessonId],
  );

  // Sync current video from map when lessonId changes
  useEffect(() => {
    if (!lessonId) return;
    const custom = customVideos[lessonId] || [];
    if (custom.length > 0) {
      setCurrentVideo(custom[0]);
      return;
    }

    const lesson = ALL_LESSONS.find((l) => `${l.chapterNumber}/${l.slug}` === lessonId);
    const coursePool = lesson?.course ? getVideos(lesson.course) : [];

    // Prefer a video that actually belongs to this chapter before falling
    // back to fuzzy keyword search within the lesson's own course pool.
    const chNum = chapterNumOf(lesson);
    const fromChapter = chNum != null ? coursePool.find((v) => v.chapter === chNum) : null;
    if (fromChapter) {
      setCurrentVideo(fromChapter);
      return;
    }

    // Wait for the lesson's tags, or every lesson would get the same video.
    if (lessonTags === null) return;
    const courseWords = (lesson?.course ?? '').split('-').filter(Boolean);
    const keywords = [...new Set([...lessonTags, ...courseWords])];
    if (keywords.length > 0 && coursePool.length > 0) {
      const matched = selectVideosByKeywords({ keywords, limit: 1, pool: coursePool });
      if (matched[0]) {
        setCurrentVideo(matched[0]);
        return;
      }
    }

    setCurrentVideo(null);
  }, [lessonId, customVideos, lessonTags]);

  const value = useMemo(() => ({
    isOpen,
    isMinimized,
    currentVideo,
    lessonId,
    lessonTags,
    searchQuery,
    setSearchQuery,
    customVideos,
    openPlayer,
    closePlayer,
    toggleMinimize,
    selectVideo,
    setBackgroundVideo,
    setLessonId,
    togglePin,
    pinnedVideos,
    addCustomVideo,
  }), [
    isOpen, isMinimized, currentVideo, lessonId, lessonTags, searchQuery, setSearchQuery,
    customVideos, openPlayer, closePlayer, toggleMinimize, selectVideo,
    setBackgroundVideo, setLessonId, togglePin, pinnedVideos, addCustomVideo,
  ]);

  return (
    <VideoPlayerContext.Provider value={value}>
      {children}
    </VideoPlayerContext.Provider>
  );
}
