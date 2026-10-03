import {it,expect} from 'vitest';
import {TRACKS,TRACK_KEYS,trackTitle} from './trackLoader.js';
import {studioSeries,nextSeriesLesson} from './series.js';
it('groups C++ topics into one ordered series while preserving all discovered lesson ids and unrelated series',()=>{
 const grouped=studioSeries(TRACKS,TRACK_KEYS,trackTitle);const cpp=grouped.find(item=>item.key==='cpp-mastery');
 expect(cpp.chapters.slice(0,3).map(item=>item.key)).toEqual(['cpp-foundations','cpp-language-basics','cpp-memory']);
 expect(cpp.chapters.some(item=>item.key==='cpp-generic')).toBe(true);
 expect(grouped.some(item=>item.key==='cpp-generic')).toBe(false);
 expect(grouped.slice(0,2).map(item=>item.key)).toEqual(['spreadsheet-build','pyside6-engine']);
 const original=TRACK_KEYS.flatMap(key=>TRACKS[key].map(lesson=>lesson.id)).sort();
 const after=grouped.flatMap(item=>item.chapters.flatMap(chapter=>TRACKS[chapter.key].map(lesson=>lesson.id))).sort();expect(after).toEqual(original);
 expect(cpp.planned).toContain('planned');
});
it('continues through lessons and then chapters without changing their project keys',()=>{
 const cpp=studioSeries(TRACKS,TRACK_KEYS,trackTitle).find(item=>item.key==='cpp-mastery');
 const tools=TRACKS['cpp-foundations'];
 expect(nextSeriesLesson(cpp,TRACKS,'cpp-foundations',tools[0].id)).toEqual({trackKey:'cpp-foundations',lesson:tools[1]});
 expect(nextSeriesLesson(cpp,TRACKS,'cpp-foundations',tools.at(-1).id)).toEqual({trackKey:'cpp-language-basics',lesson:TRACKS['cpp-language-basics'][0]});
 const last=cpp.chapters.at(-1).key;
 expect(nextSeriesLesson(cpp,TRACKS,last,TRACKS[last].at(-1).id)).toBeNull();
 const engines=cpp.chapters.findIndex(item=>item.key==='cpp-engines');
 expect(cpp.chapters.slice(engines-1,engines+2).map(item=>item.key)).toEqual(['cpp-graphics','cpp-engines','cpp-game']);
});
it('automatically keeps newly discovered C++ topics inside the C++ series',()=>{
 const tracks={...TRACKS,'cpp-audio':[{id:'cpp-audio/first'}]};
 const grouped=studioSeries(tracks,[...TRACK_KEYS,'cpp-audio'],trackTitle);
 expect(grouped.find(item=>item.key==='cpp-mastery').chapters.some(chapter=>chapter.key==='cpp-audio')).toBe(true);
 expect(grouped.some(item=>item.key==='cpp-audio')).toBe(false);
});
