import type { Timestamp, GeoPoint } from 'firebase/firestore';

export interface Patient {
  id: string;
  name: string;
  dob: string;
  contact: string;
  email: string;
  bloodType: string;
  allergies: string[];
  primaryPhysician: string;
  avatarUrl: string;
  preferences?: {
    maxDistance: number; // default 10km
    priceRange: { min: number; max: number };
    preferredSpecialties: string[];
  };
}

export interface Nurse {
  id: string;
  name: string;
  qualification: string;
  avatarUrl: string;
  location: GeoPoint;
  nextAvailable: string;
  availability: {
    isOnline: boolean;
    schedule: Array<{
      day: string; // 'monday', 'tuesday', etc.
      slots: Array<{ start: string; end: string }>;
    }>;
    serviceRadius: number; // km
  };
  rates: {
    hourlyRate: number;
    emergencyRate?: number;
    specialties: Array<{
      name: string; // 'wound-care', 'injection', 'general'
      rate: number;
    }>;
  };
  stats: {
    rating: number;
    totalBookings: number;
    averageResponseTime: number; // minutes
    completionRate: number;
  };
}

export interface ServiceRequest {
  id: string;
  patientId: string;
  patientName: string;
  serviceDetails: {
    type: string; // 'general', 'wound-care', 'injection'
    scheduledDateTime: Timestamp;
    duration: number; // hours
    location: {
      address: string;
      coordinates: GeoPoint;
    };
    specialRequirements?: string;
    isUrgent: boolean;
  };
  status: 'creating' | 'finding-nurses' | 'pending-response' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'declined';
  matching: {
    availableNurses: Array<{
      nurseId: string,
      nurseName: string,
      matchScore: number,
      estimatedCost: number,
      distance: number,
      rating: number
    }>;
    selectedNurseId?: string;
    offerSentAt?: Timestamp;
    responseDeadline?: Timestamp;
  };
  payment: {
    platformFee: number;
    platformFeePaid: boolean;
    nursePayment: {
      amount: number;
      paid: boolean;
    };
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Interface for the form/state object before it becomes a Firestore document
export interface ServiceRequestInput {
    serviceType: string;
    scheduledDateTime: Date;
    duration: number;
    specialRequirements?: string;
    isUrgent: boolean;
    patientLocation: { latitude: number; longitude: number };
}

// Interface for a nurse after being matched
export interface MatchedNurse {
    nurseId: string;
    nurseName: string;
    avatarUrl: string;
    qualification: string;
ma    matchScore: number;
    estimatedCost: number;
    distance: number;
    rating: number;
}
