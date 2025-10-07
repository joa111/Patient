/**
 * @fileOverview Firestore functions for managing service requests, running on the client-side.
 */

import { collection, addDoc, doc, updateDoc, Timestamp, GeoPoint, query, where, getDocs, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getDistance } from 'geolib';
import { db } from '@/lib/firebase';
import type { ServiceRequestInput, Nurse, Patient, ServiceRequest, MatchedNurse } from '@/types/service-request';
import { sanitizeDataForFirestore } from '@/lib/utils';


/**
 * Finds available nurses by querying the 'nurses' collection.
 * This runs on the client-side.
 * @returns A promise that resolves to an array of matched nurses.
 */
export async function findAvailableNurses(
  patientLocation?: { latitude: number; longitude: number },
  maxDistance?: number,
  priceRange?: { min: number; max: number },
  serviceType?: string,
  preferredSpecialties?: string[]
): Promise<MatchedNurse[]> {
  console.log('🔍 Finding nurses with params:', {
    patientLocation,
    maxDistance,
    priceRange,
    serviceType,
    preferredSpecialties
  });

  const nursesQuery = query(collection(db, 'nurses'), where("availability.isOnline", "==", true));
  const snapshot = await getDocs(nursesQuery);
  
  console.log(`📊 Found ${snapshot.size} online nurses in database`);
  
  if (snapshot.empty) {
    console.log('❌ No online nurses found');
    return [];
  }
  
  const nurses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Nurse));
  console.log('👥 All online nurses:', nurses);

  // Strict filtering
  const filteredNurses = nurses.filter(nurse => {
    console.log(`Checking nurse ${nurse.fullName}:`, {
      hasLocation: !!nurse.lastLocation,
      specialties: nurse.rates?.specialties,
      hourlyRate: nurse.rates?.hourlyRate
    });
    
    // Distance filter
    let distance = 0;
    if (patientLocation && nurse.lastLocation) {
      distance = getDistance(
        { latitude: patientLocation.latitude, longitude: patientLocation.longitude },
        { latitude: nurse.lastLocation.latitude, longitude: nurse.lastLocation.longitude }
      ) / 1000;
      console.log(`  Distance: ${distance}km, Max: ${maxDistance}km`);
      if (maxDistance !== undefined && distance > maxDistance) {
        console.log(`  ❌ Rejected: Too far`);
        return false;
      }
    }
    
    // Price filter
    const rate = nurse.rates?.hourlyRate || 0;
    if (priceRange && (rate < priceRange.min || rate > priceRange.max)) {
      console.log(`  ❌ Rejected: Price ${rate} outside range ${priceRange.min}-${priceRange.max}`);
      return false;
    }
    
    // Service type filter (use specialties under rates only)
// Service type filter (checks the top-level 'services' array)
if (serviceType && (!nurse.services || !nurse.services.includes(serviceType))) {
  console.log(`  ❌ Rejected: Doesn't have specialty ${serviceType}`);
  return false;
}
    
    console.log(`  ✅ Accepted`);
    return true;
  });

  console.log(`✅ Final filtered nurses: ${filteredNurses.length}`);
  // Weighted scoring
  return filteredNurses.map(nurse => {
    // Distance
    let distance = 0;
    if (patientLocation && nurse.lastLocation) {
      distance = getDistance(
        { latitude: patientLocation.latitude, longitude: patientLocation.longitude },
        { latitude: nurse.lastLocation.latitude, longitude: nurse.lastLocation.longitude }
      ) / 1000;
    }
    // Rating
    const rating = nurse.stats?.rating || 0;
    // Price
    const rate = nurse.rates?.hourlyRate || 0;
// Specialty bonus
let specialtyBonus = 0;
if (serviceType && nurse.services && nurse.services.includes(serviceType)) {
  specialtyBonus = 1;
}

    // Scoring
    // Distance: 40% (closer = higher score)
    // Rating: 30% (higher = better)
    // Price: 20% (lower = better)
    // Specialty: 10% (bonus)
    // Normalize values
    const maxDistanceScore = maxDistance || 10;
    const distanceScore = patientLocation && nurse.lastLocation ? (1 - Math.min(distance / maxDistanceScore, 1)) * 40 : 0;
    const ratingScore = (rating / 5) * 30;
    const priceScore = priceRange ? (1 - Math.min((rate - priceRange.min) / (priceRange.max - priceRange.min || 1), 1)) * 20 : 0;
    const specialtyScore = specialtyBonus * 10;
    const matchScore = Math.round(distanceScore + ratingScore + priceScore + specialtyScore);

    return {
      nurseId: nurse.id,
      fullName: nurse.fullName,
      avatarUrl: nurse.avatarUrl || `https://placehold.co/256x256.png`,
      district: nurse.district,
      matchScore,
      estimatedCost: rate * 1.5,
      distance: Math.round(distance * 10) / 10,
      rating,
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
}


/**
 * Creates a new service request and identifies the best-matched nurse.
 * This runs on the client.
 * @param patient - The patient creating the request.
 * @param requestInput - The data for the new service request.
 * @returns The ID of the newly created document and the best matched nurse.
 */
export async function createServiceRequest(patient: Patient, requestInput: ServiceRequestInput): Promise<{requestId: string; selectedNurses: MatchedNurse[]}> {
  if (!patient) throw new Error("Patient is required to create a service request");

  const availableNurses = await findAvailableNurses(
    requestInput.patientLocation,
    patient.preferences?.maxDistance,
    patient.preferences?.priceRange,
    requestInput.serviceType,
    patient.preferences?.preferredSpecialties
  );
  
  // Select top 4 best matched nurses
  const selectedNurses = availableNurses.slice(0, 4);

  const newRequest: Omit<ServiceRequest, 'id'> = {
    patientId: patient.id,
    patientName: patient.name,
    serviceDetails: {
      type: requestInput.serviceType,
      scheduledDateTime: Timestamp.fromDate(requestInput.scheduledDateTime),
      duration: requestInput.duration,
      location: {
        address: "User's current location", 
        coordinates: new GeoPoint(requestInput.patientLocation.latitude, requestInput.patientLocation.longitude),
      },
      specialRequirements: requestInput.specialRequirements || "",
      isUrgent: requestInput.isUrgent || false,
    },
    status: 'finding-nurses',
    matching: {
      availableNurses: availableNurses,
      pendingNurses: [], // Initialize as empty array
    },
    payment: {
      platformFee: 5,
      platformFeePaid: false,
      nursePayment: {
        amount: selectedNurses.length > 0 ? selectedNurses[0].estimatedCost : 0,
        paid: false,
      },
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  console.log('Attempting to create service request with this data:', newRequest);

  const sanitizedRequest = sanitizeDataForFirestore(newRequest);

  const docRef = await addDoc(collection(db, 'serviceRequests'), sanitizedRequest);
  
  // Send offers to all selected nurses
  for (const nurse of selectedNurses) {
    await offerServiceToNurse(docRef.id, nurse.nurseId, nurse.estimatedCost);
  }

  return { requestId: docRef.id, selectedNurses };
}


/**
 * Updates a service request to send an offer to a specific nurse.
 */
export async function offerServiceToNurse(requestId: string, nurseId: string, estimatedCost: number): Promise<void> {
  const requestRef = doc(db, 'serviceRequests', requestId);
  
  await updateDoc(requestRef, {
    status: 'pending-response',
    'matching.pendingNurses': arrayUnion(nurseId),
    'matching.selectedNurseIds': arrayUnion(nurseId),
    'matching.offerSentAt': Timestamp.now(),
    'matching.responseDeadline': Timestamp.fromMillis(Date.now() + 15 * 60 * 1000),
    updatedAt: Timestamp.now(),
  });
  
  console.log(`Offer sent to nurse ${nurseId} for request ${requestId}`);
}

/**
 * Cancels a service request.
 */
export async function cancelServiceRequest(requestId: string): Promise<void> {
  const requestRef = doc(db, 'serviceRequests', requestId);
  await updateDoc(requestRef, {
    status: 'cancelled',
    updatedAt: Timestamp.now(),
  });
  console.log(`Service request ${requestId} has been cancelled by the user.`);
}

/**
 * Marks a service request as completed by the patient.
 */
export async function completeServiceRequest(requestId: string): Promise<void> {
  const requestRef = doc(db, 'serviceRequests', requestId);
  await updateDoc(requestRef, {
    status: 'completed',
    updatedAt: Timestamp.now(),
  });
  console.log(`Service request ${requestId} has been marked as completed.`);
}

/**
 * Submits a rating and review for a completed service request.
 */
export async function submitReview(requestId: string, rating: number, review: string): Promise<void> {
  const requestRef = doc(db, 'serviceRequests', requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) {
    throw new Error("Service request not found.");
  }
  await updateDoc(requestRef, {
    'review.rating': rating,
    'review.comment': review,
    'review.submittedAt': Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log(`Review submitted for request ${requestId}.`);
}


/**
 * Handles the response from a nurse (accepted or declined).
 */
export async function handleNurseResponse(requestId: string, nurseId: string, accepted: boolean): Promise<void> {
  const requestRef = doc(db, 'serviceRequests', requestId);
  const requestSnap = await getDoc(requestRef);
  
  if (!requestSnap.exists()) {
     throw new Error("Service request not found.");
  }
  const requestData = requestSnap.data() as ServiceRequest;

  if (accepted) {
    await updateDoc(requestRef, {
      status: 'confirmed',
      'matching.selectedNurseId': nurseId,
      'matching.pendingNurses': [], // Clear all pending nurses
      updatedAt: Timestamp.now(),
    });
  } else {
    await updateDoc(requestRef, {
      'matching.pendingNurses': arrayRemove(nurseId),
      'matching.selectedNurseIds': arrayRemove(nurseId),
      updatedAt: Timestamp.now(),
    });
    
    const updatedDoc = await getDoc(requestRef);
    const updatedData = updatedDoc.data() as ServiceRequest;
    
    if (!updatedData.matching.pendingNurses || updatedData.matching.pendingNurses.length === 0) {
      await updateDoc(requestRef, {
        status: 'declined',
        updatedAt: Timestamp.now(),
      });
    }
  }
}
