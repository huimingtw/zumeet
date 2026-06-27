import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { adminApi } from "@/features/admin/api";

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError(true);
      return;
    }

    adminApi
      .get(`/auth/callback?token=${encodeURIComponent(token)}`, { maxRedirects: 0 })
      .then(() => navigate("/reports", { replace: true }))
      .catch((err) => {
        if (err.response?.status === 302 || err.response?.status === 301) {
          navigate("/reports", { replace: true });
        } else if (err.response?.status === 401) {
          setError(true);
        } else {
          navigate("/reports", { replace: true });
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="card w-full max-w-sm p-8 text-center space-y-4">
          <p className="text-sm text-danger-600 font-medium">連結無效或已過期</p>
          <a href="/login" className="text-sm text-primary-600 hover:underline">
            重新取得登入連結
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <p className="text-sm text-ink-500">驗證中…</p>
    </div>
  );
}
