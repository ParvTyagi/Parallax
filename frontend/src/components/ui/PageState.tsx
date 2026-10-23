import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

export function PageLoading({ label }: { label: string }) {
  return <div role="status" aria-live="polite" className="page-loading"><span className="eyebrow">Just a moment</span><p>{label}</p><div aria-hidden="true" className="loading-layout"><div className="skeleton skeleton-heading" /><div className="loading-cards">{[0, 1, 2].map(i => <div key={i} className="skeleton skeleton-card" />)}</div><div className="skeleton skeleton-body" /></div></div>;
}
export function PageError({ title, message, onRetry, children }: { title: string; message: string; onRetry?: () => void; children?: ReactNode }) {
  return <div className="page-error" role="alert"><span className="state-icon"><AlertCircle size={26} aria-hidden="true" /></span><h1>{title}</h1><p>{message}</p><div className="state-actions">{onRetry && <button className="btn btn-primary" onClick={onRetry}>Try again</button>}{children}</div></div>;
}
