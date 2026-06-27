"use client";

import { type ReactNode, useCallback, useRef, useState } from "react";

type ConfirmOptions = {
	message: string;
	confirmText?: string;
	cancelText?: string;
	danger?: boolean;
};

// useConfirm replaces window.confirm with an in-app dialog.
// Returns [element, confirm]: render `element` once in the component tree,
// and `await confirm("...")` resolves true/false on the user's choice.
export function useConfirm(): [
	ReactNode,
	(opts: string | ConfirmOptions) => Promise<boolean>,
] {
	const [state, setState] = useState<ConfirmOptions | null>(null);
	const resolver = useRef<((v: boolean) => void) | null>(null);

	const confirm = useCallback((opts: string | ConfirmOptions) => {
		setState(typeof opts === "string" ? { message: opts } : opts);
		return new Promise<boolean>((resolve) => {
			resolver.current = resolve;
		});
	}, []);

	const close = useCallback((v: boolean) => {
		resolver.current?.(v);
		resolver.current = null;
		setState(null);
	}, []);

	const element = state ? (
		<div
			className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
			onClick={() => close(false)}
		>
			<div
				role="dialog"
				aria-modal="true"
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
			>
				<p className="text-sm leading-relaxed text-gray-900">{state.message}</p>
				<div className="mt-5 flex gap-2">
					<button
						type="button"
						onClick={() => close(false)}
						className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
					>
						{state.cancelText ?? "取消"}
					</button>
					<button
						type="button"
						onClick={() => close(true)}
						className={`flex-1 rounded-xl py-2.5 text-sm font-medium text-white transition ${
							state.danger
								? "bg-red-600 hover:bg-red-700"
								: "bg-gray-900 hover:bg-gray-800"
						}`}
					>
						{state.confirmText ?? "確定"}
					</button>
				</div>
			</div>
		</div>
	) : null;

	return [element, confirm];
}
