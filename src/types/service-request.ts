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
    maxDistance: number; 
    priceRange: { min: number; max: number };
    preferredSpecialties: string[];
  };
}

export interface Nurse {
  id: string;
  uid: string;
  fullName: string;
  email: string;
  district: string;
  licenseNumber: string;
  licenseState: string;
  licenseExpiryDate: string;
  services: string[];
  lastLocation?: { latitude: number; longitude: number };
  avatarUrl?: string;
  profileStatus: 'pending_verification' | 'verified' | 'rejected';
  createdAt: Timestamp;
  availability: {
    isOnline: boolean;
    schedule: Array<{
      day: string;
      slots: Array<{ start: string; end: string }>;
    }>;
    serviceRadius: number; // km
    lastSeen: Timestamp;
  };
  rates: {
    hourlyRate: number;
    emergencyRate?: number;
    specialties: Array<{
      name: string;
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
  status: 
    | 'creating' 
    | 'finding-nurses' 
    | 'pending-response' 
    | 'confirmed' 
    | 'in-progress' 
    | 'completed' 
    | 'cancelled' 
    | 'declined';
  matching: {
    availableNurses: MatchedNurse[];
    selectedNurseId?: string;
    pendingNurses: string[];
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
  review?: {
    rating: number;
    comment: string;
    submittedAt: Timestamp;
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
  fullName: string;
  avatarUrl?: string;
  district: string;
  matchScore: number;
  estimatedCost: number;
  distance: number;
  rating: number;
}
