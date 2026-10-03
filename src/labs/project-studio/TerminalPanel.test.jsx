// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
vi.mock('@xterm/xterm',()=>({Terminal:class {cols=80;rows=24;loadAddon(){}open(){}onData(){return {dispose(){}}}onResize(){return {dispose(){}}}dispose(){}reset(){}write(){}focus(){}}}));
vi.mock('@xterm/addon-fit',()=>({FitAddon:class {fit(){}}}));
import TerminalPanel from './TerminalPanel.jsx';
it('starts the shell for the selected track and closes the previous shell on switching',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const bridge={start:vi.fn(async opts=>({ok:true,id:opts.projectKey,shell:'pwsh'})),kill:vi.fn(),write:vi.fn(),resize:vi.fn(),onData:()=>()=>{},onExit:()=>()=>{}};
 window.openCalcDesktop={terminal:bridge};
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(<TerminalPanel root="/pong" projectKey="cpp-game" visible={false} C={{}}/>));
  expect(bridge.start).toHaveBeenLastCalledWith({cols:80,rows:24,projectKey:'cpp-game'});
  await act(async()=>root.render(<TerminalPanel root="/sheet" projectKey="spreadsheet" visible={false} C={{}}/>));
  expect(bridge.kill).toHaveBeenCalledWith('cpp-game');
  expect(bridge.start).toHaveBeenLastCalledWith({cols:80,rows:24,projectKey:'spreadsheet'});
 }finally{await act(async()=>root.unmount());host.remove();delete window.openCalcDesktop;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
