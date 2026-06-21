import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import FilterBar from './FilterBar';
import ParticleGrid from './ParticleGrid';

export default function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <ParticleGrid />
      <Sidebar />
      <main style={{
        flex: 1,
        padding: 24,
        overflowY: 'auto',
        maxHeight: '100vh',
      }}>
        <FilterBar />
        <Outlet />
      </main>
    </div>
  );
}
