"use client";

import * as React from "react";

import { ErrorState } from "@/components/common/error-state";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-level error boundary — catches render-time errors so a broken panel can't blank
 * the whole shell. Route-level errors are handled by Next `error.tsx`; this covers
 * client component subtrees (e.g. the content area).
 */
export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  reset = () => this.setState({ error: null });

  override render() {
    if (this.state.error) {
      return this.props.fallback ?? <ErrorState error={this.state.error} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}
