import { useEffect, useState } from 'react';
import EnvironmentBanner from '../../components/notebooks/shared/EnvironmentBanner.jsx';

const PHASES = { 'downloading-cpp': 'Downloading C++ compiler…', 'extracting-cpp': 'Unpacking C++ compiler…' };

export default function CppProjectRuntime({ C }) {
  const [status, setStatus] = useState('checking');
  const [compiler, setCompiler] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  async function refresh() {
    const result = await window.openCalcDesktop.getRuntimeStatus('cpp');
    if (!result?.ok) throw new Error(result?.reason || 'Could not check the C++ compiler.');
    setCompiler(result.status);
    setStatus(result.status?.installed ? 'ready' : 'needs-install');
  }

  useEffect(() => {
    let active = true;
    window.openCalcDesktop.getRuntimeStatus('cpp').then((result) => {
      if (!active) return;
      setCompiler(result.status);
      setStatus(result?.ok && result.status?.installed ? 'ready' : 'needs-install');
      if (!result?.ok) setError(result?.reason || 'Could not check the C++ compiler.');
    }).catch((failure) => {
      if (active) { setStatus('needs-install'); setError(failure.message); }
    });
    const unsubscribe = window.openCalcDesktop.onRuntimeProgress((event) => {
      if (event.runtime === 'cpp' && active) setProgress(event);
    });
    return () => { active = false; unsubscribe?.(); };
  }, []);

  async function install() {
    setInstalling(true);
    setError(null);
    setProgress({ phase: 'downloading-cpp', percent: 0 });
    try {
      const result = await window.openCalcDesktop.installRuntime('cpp');
      if (!result?.ok) throw new Error(result?.reason || 'C++ installation failed.');
      await refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div>
      <EnvironmentBanner status={status} installing={installing} progress={progress} onInstall={install}
        C={C} title="C++ compiler" phaseLabels={PHASES}
        description="Pong needs a native C++ compiler. Install an app-managed compiler here if no working compiler is available." />
      {compiler?.installed && (
        <div style={{ padding: '3px 16px', fontSize: 11, color: C.hint }}>
          {compiler.source === 'system' ? 'Using your installed compiler' : 'Using the app-managed compiler'}: {compiler.version}
        </div>
      )}
      {compiler && compiler.projectSupported !== true && (
        <div role="alert" style={{ padding: '6px 16px', fontSize: 12, color: C.amber }}>
          This desktop process has not confirmed C++ project support. Save your work and fully restart the updated desktop app. An older installed build needs an updated desktop build; refreshing this page does not update its runner.
        </div>
      )}
      {error && <div role="alert" style={{ padding: '6px 16px', fontSize: 12, color: C.amber }}>{error}</div>}
    </div>
  );
}
