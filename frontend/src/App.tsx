import { RouteAnnouncer } from "./components/layout/RouteAnnouncer";
import { PageError } from "./components/ui/PageState";
import { Link } from "react-router-dom";
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Web3Provider } from './contexts/Web3Context';
import AppShell from './components/layout/AppShell';
import LandingPage from './pages/LandingPage';
import CustomerDashboard from './pages/CustomerDashboard';
import WorkerTasks from './pages/WorkerTasks';
import TaskDetail from './pages/TaskDetail';
import SecurityPage from './pages/SecurityPage';
import WorkerProfile from './pages/WorkerProfile';
import AdminDashboard from './pages/AdminDashboard';
import CreatorDashboard from './pages/creator/CreatorDashboard';

function App() {
  return (
    <Web3Provider>
      <BrowserRouter>
        <RouteAnnouncer />
        <Routes>
          {/* Public landing page — no sidebar */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/security" element={<SecurityPage />} />

          {/* App routes — wrapped in sidebar shell */}
          <Route path="/app" element={<AppShell><CustomerDashboard /></AppShell>} />
          <Route path="/worker" element={<AppShell><WorkerTasks /></AppShell>} />
          <Route path="/worker/explore" element={<AppShell><WorkerTasks /></AppShell>} />
          <Route path="/worker/:address" element={<AppShell><WorkerProfile /></AppShell>} />
          <Route path="/task/:taskId" element={<AppShell><TaskDetail /></AppShell>} />
          <Route path="/workspace/:taskId" element={<AppShell><TaskDetail /></AppShell>} />
          <Route path="/admin" element={<AppShell><AdminDashboard /></AppShell>} />

          {/* High-contrast technical dashboard — standalone shell, no sidebar theme */}
          <Route path="/creator/dashboard" element={<AppShell><CreatorDashboard /></AppShell>} />
          <Route path="/creator/new" element={<AppShell><CustomerDashboard /></AppShell>} />
          <Route path="*" element={<AppShell><PageError title="This page has moved off course" message="The link may be incomplete. Return to your workspace to pick up where you left off."><Link className="btn btn-primary" to="/creator/dashboard">Open workspace</Link></PageError></AppShell>} />
        </Routes>
      </BrowserRouter>
    </Web3Provider>
  );
}

export default App;
