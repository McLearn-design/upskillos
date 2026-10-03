// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import StudioPanes from './StudioPanes.jsx';
it('resizes the lesson with keyboard controls, remembers widths, and hides explorer without losing editor content',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 const view=visible=><StudioPanes explorerVisible={visible} explorer={<p>Files</p>} editor={<textarea defaultValue="learner code"/>} lesson={<p>Lesson</p>} C={{}}/>;
 try {
  await act(async()=>root.render(view(true)));
  const divider=host.querySelector('[aria-label="Resize lesson"]');
  const width=Number(divider.getAttribute('aria-valuenow'));
  await act(async()=>divider.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));
  expect(Number(divider.getAttribute('aria-valuenow'))).toBe(width+20);
  expect(localStorage.getItem('project-studio:lesson-width')).toBe(String(width+20));
  await act(async()=>root.render(view(false)));
  expect(host.querySelector('[data-pane="explorer"]')).toBeNull();
  expect(host.querySelector('textarea').value).toBe('learner code');
  await act(async()=>root.render(view(true)));
  expect(host.querySelector('[data-pane="explorer"]')).not.toBeNull();
  expect(host.querySelector('textarea').value).toBe('learner code');
 }finally{await act(async()=>root.unmount());host.remove();delete globalThis.IS_REACT_ACT_ENVIRONMENT;localStorage.clear();}
});
