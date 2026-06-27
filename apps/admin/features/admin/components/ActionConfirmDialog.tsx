
import { useCallback, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

type Level = 1 | 2 | 3;

interface ActionConfirmOptions {
  level: Level;
  title: string;
  message: string;
  confirmLabel?: string;
  matchValue?: string; // level 3: user must type this to confirm
}

type Result = false | { note: string };

export function useActionConfirm(): [
  React.ReactNode,
  (opts: ActionConfirmOptions) => Promise<Result>,
] {
  const [state, setState] = useState<ActionConfirmOptions | null>(null);
  const [note, setNote] = useState("");
  const [matchInput, setMatchInput] = useState("");
  const resolver = useRef<((v: Result) => void) | null>(null);

  const confirm = useCallback((opts: ActionConfirmOptions) => {
    setState(opts);
    setNote("");
    setMatchInput("");
    return new Promise<Result>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function close(result: Result) {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  }

  const canConfirm =
    !state ||
    (state.level === 1) ||
    (state.level === 2 && note.trim().length > 0) ||
    (state.level === 3 && note.trim().length > 0 && matchInput === state.matchValue);

  const element = (
    <Modal open={!!state} onClose={() => close(false)} className="z-[60] max-w-md p-6">
      {state && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-ink-900">{state.title}</h3>
            <p className="mt-1 text-sm text-ink-500 leading-relaxed">{state.message}</p>
          </div>

          {state.level >= 2 && (
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1">
                原因備註{state.level === 2 && <span className="text-danger-600 ml-1">*</span>}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="請輸入處理原因..."
                className="input w-full resize-none"
                autoFocus
              />
            </div>
          )}

          {state.level === 3 && (
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1">
                請輸入 <code className="bg-gray-100 px-1 rounded font-mono text-xs">{state.matchValue}</code> 以確認
              </label>
              <input
                type="text"
                value={matchInput}
                onChange={(e) => setMatchInput(e.target.value)}
                placeholder={state.matchValue}
                className="input w-full font-mono text-sm"
              />
              <p className="mt-1 text-xs text-danger-600">此操作無法復原。稽核記錄將永久保留。</p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => close(false)}>
              取消
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!canConfirm}
              onClick={() => close({ note })}
            >
              {state.confirmLabel ?? "確認"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );

  return [element, confirm];
}
