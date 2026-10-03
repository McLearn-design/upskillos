// @vitest-environment happy-dom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {useProjectFs} from './useProjectFs.js';
it('changes roots with the track, scopes every request, and rejects stale responses', async () => {
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const bridge={};for(const name of ['pick','read','write','create','mkdir','remove','rename','run','check'])bridge[name]=vi.fn(async()=>({ok:true,content:''}));
 bridge.get=vi.fn(async scope=>({root:scope==='pong'?'/pong':null,scope}));
 let resolveOld;
 bridge.tree=vi.fn(scope=>scope==='pong'?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve({ok:true,root:'/sheet',entries:[]}));
 window.openCalcDesktop={project:bridge};
 const host=document.createElement('div');const root=createRoot(host);let hook;
 function Probe({scope}){hook=useProjectFs(scope);return null;}
 try {
  await act(async()=>root.render(<Probe scope="pong"/>));
  const oldApi=hook.api;
  await act(async()=>root.render(<Probe scope="sheet"/>));
  expect(hook.root).toBeNull();
  await act(async()=>resolveOld({ok:true,root:'/pong',entries:[{name:'main.cpp'}]}));
  expect(hook.root).toBeNull(); expect(hook.entries).toEqual([]);
  await hook.writeFile('main.py','sheet');expect(bridge.write).toHaveBeenLastCalledWith('main.py','sheet','sheet');
  await oldApi.write('main.cpp','pong');expect(bridge.write).toHaveBeenLastCalledWith('main.cpp','pong','pong');
  await hook.run('python','main.py');expect(bridge.run).toHaveBeenCalledWith('python','main.py','sheet');
  await hook.api.check(['file main.py']);expect(bridge.check).toHaveBeenCalledWith(['file main.py'],'sheet');
  await hook.api.create('new.py');expect(bridge.create).toHaveBeenCalledWith('new.py','sheet');
 } finally {await act(async()=>root.unmount());delete window.openCalcDesktop;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
