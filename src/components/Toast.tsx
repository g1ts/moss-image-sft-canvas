import { useEffect } from "react";
import { useStore } from "../store";

const TOAST_MS = 3000;

export default function Toast() {
  const toast = useStore(s => s.toast);
  const toastError = useStore(s => s.toastError);
  const toastId = useStore(s => s.toastId);
  const clearToast = useStore(s => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, TOAST_MS);
    return () => clearTimeout(t);
  }, [toast, toastId, clearToast]);

  if (!toast) return null;

  return (
    <div id="toast" title={toast} className={toastError ? "danger" : ""} key={toastId} role="status">
      {toast}
    </div>
  );
}
