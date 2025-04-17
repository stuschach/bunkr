// src/lib/services/JobQueueService.ts
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

/**
 * Priority levels for job processing
 */
export enum JobPriority {
  CRITICAL = 0,  // Must be processed immediately
  HIGH = 1,      // Process as soon as possible
  NORMAL = 2,    // Standard priority
  LOW = 3,       // Background tasks
  MAINTENANCE = 4 // Non-essential maintenance tasks
}

/**
 * Job status for tracking
 */
export enum JobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRY = 'retry'
}

/**
 * Retry strategy for failed jobs
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // milliseconds
  backoffFactor: number; // multiplier for each retry
  maxDelay?: number; // maximum delay in milliseconds
}

/**
 * Job configuration options
 */
export interface JobOptions {
  priority?: JobPriority;
  timeout?: number; // milliseconds
  retry?: RetryConfig;
  jobId?: string; // custom ID or auto-generated
  sequenceGroup?: string; // for jobs that need to be processed in sequence
  throttleKey?: string; // for rate limiting certain operations
  throttleLimit?: number; // max number of jobs with the same throttleKey to process concurrently
  context?: Record<string, any>; // additional context data
}

/**
 * Core Job interface representing a task to be executed
 */
export interface Job<T = any> {
  id: string;
  execute: () => Promise<T>;
  priority: JobPriority;
  status: JobStatus;
  timeAdded: number;
  timeStarted?: number;
  timeCompleted?: number;
  attempts: number;
  error?: Error;
  result?: T;
  options: JobOptions;
  abortController?: AbortController;
  sequenceGroup?: string;
  throttleKey?: string;
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  backoffFactor: 2,
  maxDelay: 30000 // 30 seconds
};

/**
 * Job Queue Service
 * 
 * Responsible for managing and executing jobs with priority, rate limiting,
 * retries, and concurrency control
 */
export class JobQueueService {
  private static instance: JobQueueService;
  private jobs: Map<string, Job> = new Map();
  private runningJobs: Set<string> = new Set();
  private sequenceGroups: Map<string, Set<string>> = new Map();
  private throttleGroups: Map<string, Set<string>> = new Map();
  
  private maxConcurrentJobs: number;
  private eventEmitter: EventEmitter;
  private isProcessing: boolean = false;
  private shutdownRequested: boolean = false;
  private defaultOptions: JobOptions;

  /**
   * Get singleton instance of JobQueueService
   */
  public static getInstance(): JobQueueService {
    if (!JobQueueService.instance) {
      JobQueueService.instance = new JobQueueService();
    }
    return JobQueueService.instance;
  }

  /**
   * Constructor with configuration options
   */
  private constructor(options?: {
    maxConcurrentJobs?: number;
    defaultOptions?: JobOptions;
  }) {
    this.maxConcurrentJobs = options?.maxConcurrentJobs ?? 10;
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(100); // Avoid warnings for many listeners
    this.defaultOptions = options?.defaultOptions ?? {
      priority: JobPriority.NORMAL,
      retry: DEFAULT_RETRY_CONFIG
    };
    
    // Set up event listeners
    this.eventEmitter.on('jobCompleted', () => this.processQueue());
    this.eventEmitter.on('jobFailed', (jobId: string, error: Error) => {
      this.handleJobFailure(jobId, error);
    });
    
    // Start processing the queue
    setTimeout(() => this.processQueue(), 0);
  }

  /**
   * Add a job to the queue
   */
  public async enqueue<T>(
    execute: () => Promise<T>,
    options?: JobOptions
  ): Promise<{ jobId: string; resultPromise: Promise<T> }> {
    if (this.shutdownRequested) {
      throw new Error('Job queue is shutting down, no new jobs accepted');
    }
    
    // Merge with default options
    const mergedOptions: JobOptions = {
      ...this.defaultOptions,
      ...options
    };
    
    // Generate a job ID if not provided
    const jobId = mergedOptions.jobId ?? this.generateJobId();
    
    // Return early if we already have this job
    if (this.jobs.has(jobId)) {
      const existingJob = this.jobs.get(jobId) as Job<T>;
      return {
        jobId,
        resultPromise: this.createResultPromise(existingJob)
      };
    }
    
    // Create a promise that will be resolved when the job completes
    let resolvePromise: (value: T) => void;
    let rejectPromise: (reason: any) => void;
    
    const resultPromise = new Promise<T>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    
    // Create abort controller for timeout handling
    const abortController = new AbortController();
    
    // Create the job
    const job: Job<T> = {
      id: jobId,
      execute,
      priority: mergedOptions.priority ?? JobPriority.NORMAL,
      status: JobStatus.QUEUED,
      timeAdded: Date.now(),
      attempts: 0,
      options: mergedOptions,
      abortController,
      sequenceGroup: mergedOptions.sequenceGroup,
      throttleKey: mergedOptions.throttleKey
    };
    
    // Store the job
    this.jobs.set(jobId, job);
    
    // Add to sequence group if specified
    if (job.sequenceGroup) {
      if (!this.sequenceGroups.has(job.sequenceGroup)) {
        this.sequenceGroups.set(job.sequenceGroup, new Set());
      }
      this.sequenceGroups.get(job.sequenceGroup)?.add(jobId);
    }
    
    // Add to throttle group if specified
    if (job.throttleKey) {
      if (!this.throttleGroups.has(job.throttleKey)) {
        this.throttleGroups.set(job.throttleKey, new Set());
      }
      this.throttleGroups.get(job.throttleKey)?.add(jobId);
    }
    
    // Set up the promise resolver for when the job completes
    this.eventEmitter.once(`jobResult:${jobId}`, (result: T | Error) => {
      if (result instanceof Error) {
        rejectPromise(result);
      } else {
        resolvePromise(result);
      }
    });
    
    // Trigger queue processing
    setTimeout(() => this.processQueue(), 0);
    
    return { jobId, resultPromise };
  }

  /**
   * Get a job by ID
   */
  public getJob<T>(jobId: string): Job<T> | undefined {
    return this.jobs.get(jobId) as Job<T> | undefined;
  }

  /**
   * Cancel a job by ID
   */
  public cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    
    // Can only cancel jobs that are queued or running
    if (job.status !== JobStatus.QUEUED && job.status !== JobStatus.RUNNING) {
      return false;
    }
    
    if (job.status === JobStatus.RUNNING) {
      // Signal abortion
      job.abortController?.abort();
      
      // Remove from running jobs
      this.runningJobs.delete(jobId);
    }
    
    // Update job status
    job.status = JobStatus.CANCELLED;
    job.timeCompleted = Date.now();
    
    // Clean up
    this.cleanupJob(jobId);
    
    // Emit event
    this.eventEmitter.emit(`jobResult:${jobId}`, new Error('Job cancelled'));
    
    // Trigger queue processing
    setTimeout(() => this.processQueue(), 0);
    
    return true;
  }

  /**
   * Process the queue, executing jobs based on priority
   */
  private async processQueue(): Promise<void> {
    // Avoid concurrent processing of the queue
    if (this.isProcessing || this.shutdownRequested) return;
    
    this.isProcessing = true;
    
    try {
      // Skip if we're at max capacity
      if (this.runningJobs.size >= this.maxConcurrentJobs) {
        return;
      }
      
      // Get all queued jobs
      const queuedJobs = Array.from(this.jobs.values())
        .filter(job => job.status === JobStatus.QUEUED);
      
      if (queuedJobs.length === 0) {
        return;
      }
      
      // Sort by priority and time added
      queuedJobs.sort((a, b) => {
        // First by priority (lower number = higher priority)
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        // Then by time added (older first)
        return a.timeAdded - b.timeAdded;
      });
      
      // Go through sorted jobs to find eligible ones
      for (const job of queuedJobs) {
        // Skip if we're at max capacity
        if (this.runningJobs.size >= this.maxConcurrentJobs) {
          break;
        }
        
        // Check if job can be executed based on sequence group
        if (job.sequenceGroup && this.hasRunningJobsInSequence(job.sequenceGroup, job.id)) {
          continue; // Skip if there are other jobs from this sequence running
        }
        
        // Check if job can be executed based on throttle limits
        if (job.throttleKey && this.isThrottleGroupFull(job.throttleKey, job.options.throttleLimit)) {
          continue; // Skip if throttle group is at capacity
        }
        
        // Execute the job
        await this.executeJob(job);
      }
    } catch (error) {
      logger.error('Error processing job queue:', error);
    } finally {
      this.isProcessing = false;
      
      // If there are still jobs in the queue, trigger another round
      if (this.hasQueuedJobs() && !this.shutdownRequested) {
        setTimeout(() => this.processQueue(), 0);
      }
      
      // If shutdown is requested and no more running jobs, emit the shutdown completed event
      if (this.shutdownRequested && this.runningJobs.size === 0) {
        this.eventEmitter.emit('shutdownCompleted');
      }
    }
  }

  /**
   * Execute a job
   */
  private async executeJob(job: Job): Promise<void> {
    // Mark job as running
    job.status = JobStatus.RUNNING;
    job.timeStarted = Date.now();
    job.attempts++;
    
    // Add to running jobs set
    this.runningJobs.add(job.id);
    
    // Handle timeout if specified
    let timeoutId: NodeJS.Timeout | undefined;
    if (job.options.timeout) {
      timeoutId = setTimeout(() => {
        job.abortController?.abort();
        this.eventEmitter.emit('jobFailed', job.id, new Error('Job timed out'));
      }, job.options.timeout);
    }
    
    try {
      // Execute the job
      const result = await job.execute();
      
      // Clear timeout
      if (timeoutId) clearTimeout(timeoutId);
      
      // Only process completed result if job wasn't cancelled
      if (job.status === JobStatus.RUNNING) {
        job.status = JobStatus.COMPLETED;
        job.timeCompleted = Date.now();
        job.result = result;
        
        // Remove from running jobs
        this.runningJobs.delete(job.id);
        
        // Emit result event
        this.eventEmitter.emit(`jobResult:${job.id}`, result);
        
        // Clean up
        this.cleanupJob(job.id);
        
        // Emit completed event for queue processing
        this.eventEmitter.emit('jobCompleted');
      }
    } catch (error) {
      // Clear timeout
      if (timeoutId) clearTimeout(timeoutId);
      
      // Only process failure if job wasn't cancelled
      if (job.status === JobStatus.RUNNING) {
        job.error = error instanceof Error ? error : new Error(String(error));
        
        // Remove from running jobs
        this.runningJobs.delete(job.id);
        
        // Emit failed event
        this.eventEmitter.emit('jobFailed', job.id, job.error);
      }
    }
  }

  /**
   * Handle job failure including retries
   */
  private handleJobFailure(jobId: string, error: Error): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    // Check retry configuration
    const retryConfig = job.options.retry;
    
    if (retryConfig && job.attempts < retryConfig.maxRetries) {
      // Calculate retry delay
      const retryDelay = Math.min(
        retryConfig.initialDelay * Math.pow(retryConfig.backoffFactor, job.attempts - 1),
        retryConfig.maxDelay || Number.MAX_SAFE_INTEGER
      );
      
      // Mark for retry
      job.status = JobStatus.RETRY;
      
      // Schedule retry after delay
      setTimeout(() => {
        if (this.jobs.has(jobId) && this.jobs.get(jobId)?.status === JobStatus.RETRY) {
          // Reset to queued state
          job.status = JobStatus.QUEUED;
          
          // Trigger queue processing
          this.processQueue();
        }
      }, retryDelay);
      
      logger.info(`Job ${jobId} failed, scheduled for retry ${job.attempts}/${retryConfig.maxRetries} after ${retryDelay}ms`);
    } else {
      // Mark as failed
      job.status = JobStatus.FAILED;
      job.timeCompleted = Date.now();
      
      // Emit result event with error
      this.eventEmitter.emit(`jobResult:${jobId}`, error);
      
      // Clean up
      this.cleanupJob(jobId);
      
      // Trigger queue processing
      this.eventEmitter.emit('jobCompleted');
      
      logger.error(`Job ${jobId} failed permanently:`, error);
    }
  }

  /**
   * Check if a sequence group has running jobs other than the specified job
   */
  private hasRunningJobsInSequence(sequenceGroup: string, currentJobId: string): boolean {
    const groupJobs = this.sequenceGroups.get(sequenceGroup);
    if (!groupJobs) return false;
    
    // Check if there are any running jobs in this sequence
    for (const jobId of groupJobs) {
      if (jobId === currentJobId) continue;
      
      const job = this.jobs.get(jobId);
      if (job && job.status === JobStatus.RUNNING) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if a throttle group is at capacity
   */
  private isThrottleGroupFull(throttleKey: string, limit?: number): boolean {
    const groupJobs = this.throttleGroups.get(throttleKey);
    if (!groupJobs) return false;
    
    // Count running jobs in this throttle group
    let runningCount = 0;
    for (const jobId of groupJobs) {
      const job = this.jobs.get(jobId);
      if (job && job.status === JobStatus.RUNNING) {
        runningCount++;
      }
    }
    
    // Use provided limit or default to 1
    const throttleLimit = limit ?? 1;
    
    return runningCount >= throttleLimit;
  }

  /**
   * Clean up job references
   */
  private cleanupJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    // Remove from sequence group
    if (job.sequenceGroup) {
      const group = this.sequenceGroups.get(job.sequenceGroup);
      if (group) {
        group.delete(jobId);
        if (group.size === 0) {
          this.sequenceGroups.delete(job.sequenceGroup);
        }
      }
    }
    
    // Remove from throttle group
    if (job.throttleKey) {
      const group = this.throttleGroups.get(job.throttleKey);
      if (group) {
        group.delete(jobId);
        if (group.size === 0) {
          this.throttleGroups.delete(job.throttleKey);
        }
      }
    }
    
    // Keep completed/failed jobs in the map for a brief time for result retrieval
    setTimeout(() => {
      this.jobs.delete(jobId);
    }, 60000); // Keep for 1 minute
  }

  /**
   * Check if there are any queued jobs
   */
  private hasQueuedJobs(): boolean {
    return Array.from(this.jobs.values()).some(job => job.status === JobStatus.QUEUED);
  }

  /**
   * Create a promise for retrieving job results
   */
  private createResultPromise<T>(job: Job<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // If job is already completed, resolve immediately
      if (job.status === JobStatus.COMPLETED && job.result !== undefined) {
        resolve(job.result as T);
        return;
      }
      
      // If job is already failed, reject immediately
      if (job.status === JobStatus.FAILED && job.error !== undefined) {
        reject(job.error);
        return;
      }
      
      // Otherwise, set up listener for completion
      this.eventEmitter.once(`jobResult:${job.id}`, (result: T | Error) => {
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start a graceful shutdown
   */
  public async shutdown(timeoutMs: number = 30000): Promise<void> {
    this.shutdownRequested = true;
    
    // Return early if no running jobs
    if (this.runningJobs.size === 0) {
      return Promise.resolve();
    }
    
    // Create a promise that resolves when shutdown is complete
    return new Promise<void>((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        // Force abort all running jobs
        for (const jobId of this.runningJobs) {
          const job = this.jobs.get(jobId);
          if (job) {
            job.abortController?.abort();
          }
        }
        
        reject(new Error(`Shutdown timed out after ${timeoutMs}ms with ${this.runningJobs.size} jobs still running`));
      }, timeoutMs);
      
      // Wait for shutdown completed event
      this.eventEmitter.once('shutdownCompleted', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /**
   * Get current job queue stats
   */
  public getStats(): {
    totalJobs: number;
    queuedJobs: number;
    runningJobs: number;
    completedJobs: number;
    failedJobs: number;
    cancelledJobs: number;
  } {
    const jobs = Array.from(this.jobs.values());
    
    return {
      totalJobs: jobs.length,
      queuedJobs: jobs.filter(job => job.status === JobStatus.QUEUED).length,
      runningJobs: jobs.filter(job => job.status === JobStatus.RUNNING).length,
      completedJobs: jobs.filter(job => job.status === JobStatus.COMPLETED).length,
      failedJobs: jobs.filter(job => job.status === JobStatus.FAILED).length,
      cancelledJobs: jobs.filter(job => job.status === JobStatus.CANCELLED).length,
    };
  }
}

// Export a singleton instance
export const jobQueue = JobQueueService.getInstance();

// Export types and enums
export default JobQueueService;