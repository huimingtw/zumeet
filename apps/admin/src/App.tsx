import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryProvider } from "@/components/QueryProvider";
import { AdminGuard } from "@/features/admin/components/AdminGuard";
import { AdminShell } from "@/features/admin/components/AdminShell";
import Login from "./pages/Login";
import Callback from "./pages/Callback";
import Reports from "./pages/Reports";
import UserDetail from "./pages/UserDetail";
import Actions from "./pages/Actions";

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
    </AdminGuard>
  );
}

export default function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<Callback />} />
          <Route path="/reports" element={<Protected><Reports /></Protected>} />
          <Route path="/users/:userId" element={<Protected><UserDetail /></Protected>} />
          <Route path="/actions" element={<Protected><Actions /></Protected>} />
          <Route path="*" element={<Navigate to="/reports" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryProvider>
  );
}
