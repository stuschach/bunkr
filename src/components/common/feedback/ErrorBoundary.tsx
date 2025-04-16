// src/components/common/ErrorBoundary.tsx
import React, { Component, ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches JavaScript errors in its child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to the console
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    
    // Update state with error info
    this.setState({
      error,
      errorInfo
    });
    
    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Report to error tracking service (optional)
    this.reportErrorToService(error, errorInfo);
  }

  /**
   * Report the error to an error tracking service like Sentry
   */
  private reportErrorToService(error: Error, errorInfo: ErrorInfo): void {
    // Implementation would depend on the error tracking service being used
    // Example with a hypothetical error tracking service:
    // ErrorTrackingService.captureException(error, { extra: errorInfo });
    
    // For now, just log to console in production with more context
    if (process.env.NODE_ENV === 'production') {
      console.error(
        'Error occurred in production:',
        {
          error: error.toString(),
          componentStack: errorInfo.componentStack,
          url: window.location.href,
          userAgent: navigator.userAgent
        }
      );
    }
  }

  /**
   * Reset the error state to allow recovery
   */
  resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Render the fallback UI
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function' && this.state.error && this.state.errorInfo) {
          return this.props.fallback(this.state.error, this.state.errorInfo);
        } else {
          return this.props.fallback;
        }
      }
      
      // Default fallback UI
      return (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-md text-red-600 dark:text-red-300">
          <h3 className="text-lg font-medium mb-2">Something went wrong</h3>
          <p className="mb-4">An error occurred while rendering this component.</p>
          <button
            onClick={this.resetErrorBoundary}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <div className="mt-4">
              <p className="font-medium">Error details:</p>
              <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto text-sm">
                {this.state.error.toString()}
              </pre>
              {this.state.errorInfo && (
                <div className="mt-2">
                  <p className="font-medium">Component stack:</p>
                  <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto text-xs">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // When there's no error, render children normally
    return this.props.children;
  }
}

/**
 * ErrorBoundary with retry functionality
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const displayName = Component.displayName || Component.name || 'Component';
  
  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
  
  WrappedComponent.displayName = `withErrorBoundary(${displayName})`;
  
  return WrappedComponent;
}