"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "./button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-xl shadow-lg p-8 text-center flex flex-col items-center">
            <div className="h-16 w-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="h-8 w-8" />
            </div>
            
            <h1 className="text-2xl font-bold mb-2 tracking-tight">Something went wrong</h1>
            <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
              We&apos;re sorry, but an unexpected error occurred. Our team has been notified. 
              Please try refreshing the page.
            </p>
            
            <Button onClick={this.handleReset} className="w-full sm:w-auto flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Refresh Page
            </Button>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-8 text-left w-full max-h-48 overflow-y-auto rounded-md bg-secondary p-4 text-xs font-mono text-secondary-foreground">
                <p className="font-bold mb-1">{this.state.error.name}: {this.state.error.message}</p>
                <pre className="whitespace-pre-wrap opacity-70">
                  {this.state.error.stack}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
