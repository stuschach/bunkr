// src/lib/utils/logger.ts
/**
 * Enhanced logger service with production-ready features:
 * - Configurable log levels
 * - Structured logging
 * - Browser and server-side compatibility
 * - Error tracking integration
 * - Performance tracking
 */

// Determine environment
const isBrowser = typeof window !== 'undefined';
const isProduction = process.env.NODE_ENV === 'production';

// Log levels
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
  SILENT = 6
}

// Log entry structure
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  tags?: string[];
  context?: Record<string, any>;
  error?: Error;
}

// Logger configuration
export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  consoleOptions?: {
    colors: boolean;
    timestamps: boolean;
    levelPrefix: boolean;
  };
  errorTracking?: {
    enabled: boolean;
    sampleRate?: number; // 0-1, percentage of errors to track
    ignorePatterns?: RegExp[];
  };
  additionalTransports?: Array<(entry: LogEntry) => void>;
}

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: isProduction ? LogLevel.INFO : LogLevel.DEBUG,
  enableConsole: true,
  consoleOptions: {
    colors: !isProduction,
    timestamps: true,
    levelPrefix: true
  },
  errorTracking: {
    enabled: isProduction,
    sampleRate: 1.0,
    ignorePatterns: []
  }
};

// Color codes for console output
const COLORS = {
  reset: '\x1b[0m',
  trace: '\x1b[90m', // Gray
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  fatal: '\x1b[35m'  // Magenta
};

// Level names for display
const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.TRACE]: 'TRACE',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
  [LogLevel.SILENT]: 'SILENT'
};

// Logger instance
class Logger {
  private config: LoggerConfig;
  private context: Record<string, any> = {};
  private errorClient: any = null;
  private performanceMarks: Record<string, number> = {};

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initErrorTracking();
  }

  /**
   * Initialize error tracking service if configured
   */
  private initErrorTracking(): void {
    if (isBrowser && this.config.errorTracking?.enabled) {
      // Initialize error tracking service
      try {
        // This would typically be an integration with a service like Sentry
        // For this implementation, we'll just create a placeholder
        this.errorClient = {
          captureException: (error: Error, context?: any) => {
            // In a real implementation, this would send to an error tracking service
            console.error('[ERROR TRACKING]', error, context);
          },
          captureMessage: (message: string, level: string, context?: any) => {
            console.error(`[ERROR TRACKING] [${level}]`, message, context);
          }
        };
      } catch (e) {
        console.error('Failed to initialize error tracking:', e);
      }
    }
  }

  /**
   * Set global context values that will be included with all log entries
   */
  setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear specific context keys or all context if no keys provided
   */
  clearContext(keys?: string[]): void {
    if (!keys) {
      this.context = {};
      return;
    }

    keys.forEach(key => {
      delete this.context[key];
    });
  }

  /**
   * Create a formatted log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    data?: any,
    tags?: string[],
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      tags,
      context: { ...this.context },
      error
    };
  }

  /**
   * Process a log entry through all configured outputs
   */
  private processLogEntry(entry: LogEntry): void {
    // Skip if below minimum level
    if (entry.level < this.config.minLevel) {
      return;
    }

    // Console output
    if (this.config.enableConsole) {
      this.writeToConsole(entry);
    }

    // Error tracking for errors and fatal logs
    if (this.errorClient && entry.level >= LogLevel.ERROR && this.config.errorTracking?.enabled) {
      this.sendToErrorTracking(entry);
    }

    // Additional transports
    if (this.config.additionalTransports) {
      for (const transport of this.config.additionalTransports) {
        try {
          transport(entry);
        } catch (e) {
          // Don't let transport errors affect the application
          console.error('Error in log transport:', e);
        }
      }
    }
  }

  /**
   * Write a log entry to the console with formatting
   */
  private writeToConsole(entry: LogEntry): void {
    const { consoleOptions } = this.config;
    const levelName = LEVEL_NAMES[entry.level];
    
    // Determine console method
    let consoleMethod: 'log' | 'info' | 'warn' | 'error' | 'debug' = 'log';
    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        consoleMethod = 'debug';
        break;
      case LogLevel.INFO:
        consoleMethod = 'info';
        break;
      case LogLevel.WARN:
        consoleMethod = 'warn';
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        consoleMethod = 'error';
        break;
    }

    // Format message
    let formattedMessage = '';
    
    // Add timestamp if enabled
    if (consoleOptions?.timestamps) {
      const timestamp = entry.timestamp.split('T')[1].split('.')[0]; // HH:MM:SS format
      formattedMessage += `[${timestamp}] `;
    }
    
    // Add level prefix if enabled
    if (consoleOptions?.levelPrefix) {
      if (consoleOptions.colors && !isBrowser) {
        // Add colors in Node environment
        const colorCode = this.getLevelColor(entry.level);
        formattedMessage += `${colorCode}[${levelName}]${COLORS.reset} `;
      } else {
        formattedMessage += `[${levelName}] `;
      }
    }
    
    // Add message
    formattedMessage += entry.message;
    
    // Add tags if present
    if (entry.tags && entry.tags.length > 0) {
      formattedMessage += ` [${entry.tags.join(', ')}]`;
    }

    // Log to console
    if (entry.data && entry.error) {
      console[consoleMethod](formattedMessage, entry.data, entry.error);
    } else if (entry.data) {
      console[consoleMethod](formattedMessage, entry.data);
    } else if (entry.error) {
      console[consoleMethod](formattedMessage, entry.error);
    } else {
      console[consoleMethod](formattedMessage);
    }

    // Log context as a separate line if present and not empty
    if (entry.context && Object.keys(entry.context).length > 0) {
      console[consoleMethod]('Context:', entry.context);
    }
  }

  /**
   * Get color code for a log level
   */
  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.TRACE: return COLORS.trace;
      case LogLevel.DEBUG: return COLORS.debug;
      case LogLevel.INFO: return COLORS.info;
      case LogLevel.WARN: return COLORS.warn;
      case LogLevel.ERROR: return COLORS.error;
      case LogLevel.FATAL: return COLORS.fatal;
      default: return COLORS.reset;
    }
  }

  /**
   * Send a log entry to the error tracking service
   */
  private sendToErrorTracking(entry: LogEntry): void {
    if (!this.errorClient || !this.config.errorTracking?.enabled) return;

    // Apply sampling rate
    const sampleRate = this.config.errorTracking?.sampleRate || 1.0;
    if (Math.random() > sampleRate) return;

    // Check ignore patterns
    const ignorePatterns = this.config.errorTracking?.ignorePatterns || [];
    for (const pattern of ignorePatterns) {
      if (pattern.test(entry.message)) return;
    }

    // Prepare context
    const errorContext = {
      level: LEVEL_NAMES[entry.level],
      ...entry.context,
      tags: entry.tags,
      data: entry.data
    };

    // Send to error tracking service
    if (entry.error) {
      this.errorClient.captureException(entry.error, { extra: errorContext });
    } else {
      this.errorClient.captureMessage(
        entry.message,
        LEVEL_NAMES[entry.level].toLowerCase(),
        { extra: errorContext }
      );
    }
  }

  /**
   * Start a performance measurement
   */
  startMeasure(label: string): void {
    this.performanceMarks[label] = performance.now();
  }

  /**
   * End a performance measurement and log the result
   */
  endMeasure(label: string, level: LogLevel = LogLevel.DEBUG): number | null {
    if (!this.performanceMarks[label]) return null;

    const startTime = this.performanceMarks[label];
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Log the performance measurement
    this.log(
      level,
      `Performance: ${label} completed in ${duration.toFixed(2)}ms`,
      { duration },
      ['performance']
    );
    
    // Remove the mark
    delete this.performanceMarks[label];
    
    return duration;
  }

  /**
   * Generic log method
   */
  log(level: LogLevel, message: string, data?: any, tags?: string[], error?: Error): void {
    const entry = this.createLogEntry(level, message, data, tags, error);
    this.processLogEntry(entry);
  }

  /**
   * Log with TRACE level
   */
  trace(message: string, data?: any, tags?: string[]): void {
    this.log(LogLevel.TRACE, message, data, tags);
  }

  /**
   * Log with DEBUG level
   */
  debug(message: string, data?: any, tags?: string[]): void {
    this.log(LogLevel.DEBUG, message, data, tags);
  }

  /**
   * Log with INFO level
   */
  info(message: string, data?: any, tags?: string[]): void {
    this.log(LogLevel.INFO, message, data, tags);
  }

  /**
   * Log with WARN level
   */
  warn(message: string, data?: any, tags?: string[], error?: Error): void {
    this.log(LogLevel.WARN, message, data, tags, error);
  }

  /**
   * Log with ERROR level
   */
  error(message: string, errorOrData?: Error | any, data?: any, tags?: string[]): void {
    let actualError: Error | undefined;
    let actualData: any;

    // Handle different parameter scenarios
    if (errorOrData instanceof Error) {
      actualError = errorOrData;
      actualData = data;
    } else {
      actualData = errorOrData;
    }

    this.log(LogLevel.ERROR, message, actualData, tags, actualError);
  }

  /**
   * Log with FATAL level
   */
  fatal(message: string, error?: Error, data?: any, tags?: string[]): void {
    this.log(LogLevel.FATAL, message, data, tags, error);
  }
}

// Create and export the default logger instance
export const logger = new Logger();

// Export a factory function to create custom loggers
export function createLogger(config: Partial<LoggerConfig> = {}): Logger {
  return new Logger(config);
}

export default logger;