// src/lib/hooks/useCourse.ts
import { useState, useEffect, useCallback } from 'react';
import { CourseService, CourseError, CourseErrorType } from '@/lib/services/CourseService';
import { Course, TeeBox, HoleData } from '@/types/course';

interface UseCourseOptions {
  loadTeeBoxes?: boolean;
  loadHoles?: boolean;
}

interface UseCourseReturn {
  course: Course | null;
  teeBoxes: TeeBox[];
  holes: HoleData[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for accessing course data in React components
 */
export function useCourse(
  courseId: string | null | undefined,
  options: UseCourseOptions = {}
): UseCourseReturn {
  const [course, setCourse] = useState<Course | null>(null);
  const [teeBoxes, setTeeBoxes] = useState<TeeBox[]>([]);
  const [holes, setHoles] = useState<HoleData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const loadCourse = useCallback(async () => {
    if (!courseId) {
      setCourse(null);
      setTeeBoxes([]);
      setHoles([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (options.loadTeeBoxes && options.loadHoles) {
        // Load everything in one go for efficiency
        const completeCourse = await CourseService.getCompleteCourse(courseId);
        setCourse(completeCourse);
        setTeeBoxes(completeCourse.teeBoxes);
        setHoles(completeCourse.holes);
      } else {
        // Load basic course info
        const courseData = await CourseService.getCourse(courseId);
        setCourse(courseData);

        // Load tee boxes if needed
        if (options.loadTeeBoxes) {
          const teeBoxData = await CourseService.getCourseTeeBoxes(courseId);
          setTeeBoxes(teeBoxData);
        }

        // Load holes if needed
        if (options.loadHoles) {
          const holeData = await CourseService.getCourseHoles(courseId);
          setHoles(holeData);
        }
      }
    } catch (err) {
      console.error('Error loading course data:', err);
      setError(err as Error);
      
      // Set empty arrays to prevent undefined errors
      if (options.loadTeeBoxes) setTeeBoxes([]);
      if (options.loadHoles) setHoles([]);
    } finally {
      setIsLoading(false);
    }
  }, [courseId, options.loadTeeBoxes, options.loadHoles]);

  // Load course data when courseId changes
  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  // Refresh function for manual reloading
  const refresh = useCallback(async () => {
    await loadCourse();
  }, [loadCourse]);

  return {
    course,
    teeBoxes,
    holes,
    isLoading,
    error,
    refresh
  };
}

/**
 * Hook specifically for accessing course tee boxes
 */
export function useCourseTeeBoxes(courseId: string | null | undefined): {
  teeBoxes: TeeBox[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
} {
  const [teeBoxes, setTeeBoxes] = useState<TeeBox[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const loadTeeBoxes = useCallback(async () => {
    if (!courseId) {
      setTeeBoxes([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const teeBoxData = await CourseService.getCourseTeeBoxes(courseId);
      setTeeBoxes(teeBoxData);
    } catch (err) {
      console.error('Error loading tee boxes:', err);
      setError(err as Error);
      setTeeBoxes([]);
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  // Load tee boxes when courseId changes
  useEffect(() => {
    loadTeeBoxes();
  }, [loadTeeBoxes]);

  // Refresh function for manual reloading
  const refresh = useCallback(async () => {
    await loadTeeBoxes();
  }, [loadTeeBoxes]);

  return {
    teeBoxes,
    isLoading,
    error,
    refresh
  };
}

/**
 * Hook specifically for accessing course holes
 */
export function useCourseHoles(courseId: string | null | undefined): {
  holes: HoleData[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
} {
  const [holes, setHoles] = useState<HoleData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const loadHoles = useCallback(async () => {
    if (!courseId) {
      setHoles([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const holeData = await CourseService.getCourseHoles(courseId);
      setHoles(holeData);
    } catch (err) {
      console.error('Error loading holes:', err);
      setError(err as Error);
      setHoles([]);
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  // Load holes when courseId changes
  useEffect(() => {
    loadHoles();
  }, [loadHoles]);

  // Refresh function for manual reloading
  const refresh = useCallback(async () => {
    await loadHoles();
  }, [loadHoles]);

  return {
    holes,
    isLoading,
    error,
    refresh
  };
}