import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import UsagePage from './pages/UsagePage';
import BlockedPage from './pages/BlockedPage';
import PathsPage from './pages/PathsPage';
import AudiencePage from './pages/AudiencePage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<UsagePage />} />
        <Route path="blocked" element={<BlockedPage />} />
        <Route path="paths" element={<PathsPage />} />
        <Route path="audience" element={<AudiencePage />} />
      </Route>
    </Routes>
  );
}
