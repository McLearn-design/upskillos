// Curriculum navigation groups discovered tracks without changing lesson ids,
// discovery paths, or the project key used to remember each chapter's folder.
const CPP_CHAPTERS = [
  ['cpp-foundations', 'Tools of the Trade'],
  ['cpp-language-basics', 'Language Foundations'],
  ['cpp-memory', 'Memory, Lifetime and Ownership'],
  ['cpp-classes', 'Classes and Abstraction'],
  ['cpp-generic', 'Generic Programming'],
  ['cpp-dsa', 'Data Structures and Algorithms'],
  ['cpp-engineering', 'Software Engineering'],
  ['cpp-systems', 'Systems Programming'],
  ['cpp-networking', 'Networking'],
  ['cpp-graphics', 'Graphics from First Principles'],
  ['cpp-engines', 'Games and Engines'],
  ['cpp-game', 'Game Project: Pong'],
  ['cpp-advanced', 'Mastery: Advanced C++'],
];

export function studioSeries(tracks, keys, title) {
  const chapters = CPP_CHAPTERS.filter(([key]) => tracks[key]?.length).map(([key, label]) => ({ key, label }));
  const known = new Set(CPP_CHAPTERS.map(([key]) => key));
  const additional = keys.filter(key => key.startsWith('cpp-') && !known.has(key)).map(key => ({ key, label: title(key) }));
  const gameIndex = chapters.findIndex(chapter => chapter.key === 'cpp-game');
  chapters.splice(gameIndex < 0 ? chapters.length : gameIndex, 0, ...additional);
  const cppKeys = new Set(chapters.map(chapter => chapter.key));
  const result = keys.filter(key => !cppKeys.has(key)).map(key => ({ key, label: title(key), chapters: [{ key, label: title(key) }] }));
  if (chapters.length) result.splice(Math.min(2, result.length), 0, {
    key: 'cpp-mastery', label: 'C++ — From Zero to Mastery', chapters,
    planned: 'Chapters on OpenGL and Vulkan are planned.',
  });
  return result;
}

export function nextSeriesLesson(series, tracks, trackKey, lessonId) {
  const chapter = series.chapters.findIndex(item => item.key === trackKey);
  const lessons = tracks[trackKey] || [];
  const index = lessons.findIndex(lesson => lesson.id === lessonId);
  if (index < 0 || chapter < 0) return null;
  if (index + 1 < lessons.length) return { trackKey, lesson: lessons[index + 1] };
  const next = series.chapters[chapter + 1];
  return next ? { trackKey: next.key, lesson: tracks[next.key][0] } : null;
}
