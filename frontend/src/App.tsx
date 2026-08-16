import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Web3Provider } from './contexts/Web3Context';
import AppShell from './components/layout/AppShell';
import CustomerDashboard from './pages/CustomerDashboard';
import WorkerTasks from './pages/WorkerTasks';
import TaskDetail from './pages/TaskDetail';

function App() {
  return (
    <Web3Provider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<CustomerDashboard />} />
            <Route path="/worker" element={<WorkerTasks />} />
            <Route path="/task/:taskId" element={<TaskDetail />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </Web3Provider>
  );
}

export default App;
