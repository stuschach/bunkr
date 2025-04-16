// src/types/course.ts
export interface TeeBox {
    id?: string;
    name: string;
    color: string;
    rating: number;
    slope: number;
    yardage: number;
  }
  
  export interface HoleData {
    number: number;
    par: number;
    distance: number;
    handicapIndex: number;
  }
  
  export interface CourseLocation {
    city: string;
    state: string;
    formattedLocation: string;
    latitude?: number;
    longitude?: number;
  }
  
  export interface Course {
    id: string;
    name: string;
    par: number;
    location?: CourseLocation;
    isComplete: boolean;
    nameTokens?: string[];
    createdBy?: string;
    createdAt?: any;
    updatedAt?: any;
    teeBoxes: TeeBox[];
    holes: HoleData[];
  }