import { useNavigate } from 'react-router-dom';
import Shell from './Shell.jsx';

export default function MusicLabPage() {
  const navigate = useNavigate();
  return <Shell onBack={() => navigate('/')} />;
}
