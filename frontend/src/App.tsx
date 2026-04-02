import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Layout from './components/Layout';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminStudents from './pages/admin/Students';
import AdminStudentDetail from './pages/admin/StudentDetail';
import AdminInstructors from './pages/admin/Instructors';
import AdminTicketTypes from './pages/admin/TicketTypes';
import AdminIssueTicket from './pages/admin/IssueTicket';
import AdminLessonRecords from './pages/admin/LessonRecords';
import AdminRewards from './pages/admin/Rewards';
import AdminAuditLogs from './pages/admin/AuditLogs';

// Instructor pages
import InstructorHome from './pages/instructor/Home';
import InstructorLessonHistory from './pages/instructor/LessonHistory';
import InstructorMyStudents from './pages/instructor/MyStudents';
import InstructorMyRewards from './pages/instructor/MyRewards';

// Student pages
import StudentMyPage from './pages/student/MyPage';
import StudentLessonHistory from './pages/student/LessonHistory';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <PrivateRoute roles={['admin']}>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="students/:id" element={<AdminStudentDetail />} />
            <Route path="instructors" element={<AdminInstructors />} />
            <Route path="ticket-types" element={<AdminTicketTypes />} />
            <Route path="issue-ticket" element={<AdminIssueTicket />} />
            <Route path="lesson-records" element={<AdminLessonRecords />} />
            <Route path="rewards" element={<AdminRewards />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
          </Route>

          {/* Instructor routes */}
          <Route
            path="/instructor"
            element={
              <PrivateRoute roles={['instructor']}>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<InstructorHome />} />
            <Route path="lesson-history" element={<InstructorLessonHistory />} />
            <Route path="my-students" element={<InstructorMyStudents />} />
            <Route path="my-rewards" element={<InstructorMyRewards />} />
          </Route>

          {/* Student routes */}
          <Route
            path="/student"
            element={
              <PrivateRoute roles={['student']}>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<StudentMyPage />} />
            <Route path="lesson-history" element={<StudentLessonHistory />} />
          </Route>

          {/* Redirect root based on role */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
