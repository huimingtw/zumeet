import { useState } from "react";
import { adminApi } from "@/features/admin/api";
import { Button } from "@/components/ui/Button";

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await adminApi.post<{ message: string; dev_magic_link?: string }>(
        "/login",
        { email },
      );
      if (res.data.dev_magic_link) setDevLink(res.data.dev_magic_link);
    } catch {
      // always show same UI regardless of error (enumeration prevention)
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="card w-full max-w-sm p-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Zumeet Admin</h1>
          <p className="mt-1 text-sm text-ink-500">請輸入管理員信箱以取得登入連結</p>
        </div>

        {sent ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700">
              若此信箱為管理員帳號，登入連結已寄出，請查收信件。
            </p>
            {devLink && (
              <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 space-y-1">
                <p className="text-xs font-medium text-warning-800">DEV 模式 — 直接點擊登入：</p>
                <a
                  href={devLink}
                  className="block break-all text-xs text-primary-600 hover:underline"
                >
                  {devLink}
                </a>
              </div>
            )}
            <button
              type="button"
              onClick={() => { setSent(false); setDevLink(null); setEmail(""); }}
              className="text-xs text-ink-400 hover:text-ink-600"
            >
              重新發送
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-900 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@zumeet.tw"
                className="input w-full"
                autoFocus
              />
            </div>
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? "傳送中…" : "取得登入連結"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
