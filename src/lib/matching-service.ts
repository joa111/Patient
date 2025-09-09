/**
 * @fileOverview Firestore functions for managing service requests, running on the client-side.
 */

import { collection, addDoc, doc, updateDoc, Timestamp, GeoPoint, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ServiceRequestInput, Nurse, Patient, ServiceRequest, MatchedNurse } from '@/types/service-request';
import { sanitizeDataForFirestore } from '@/lib/utils';


/**
 * Finds available nurses by querying the 'nurses' collection.
 * This runs on the client-side.
 * @returns A promise that resolves to an array of matched nurses.
 */
export async function findAvailableNurses(): Promise<MatchedNurse[]> {
    const nursesQuery = query(collection(db, 'nurses'), where("availability.isOnline", "==", true));
    const snapshot = await getDocs(nursesQuery);
    if (snapshot.empty) {
        return [];
    }
    const nurses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Nurse));

    // Mock scoring and matching logic
    return nurses.map(nurse => ({
        nurseId: nurse.id,
        fullName: nurse.fullName,
        avatarUrl: `https://placehold.co/256x256.png`, // Placeholder, assuming no avatar in nurse doc
        district: nurse.district,
        matchScore: Math.floor(Math.random() * (98 - 85 + 1)) + 85, // Random score between 85-98
        estimatedCost: (nurse.rates?.hourlyRate || 0) * 1.5,
        distance: Math.round(Math.random() * 10 * 10) / 10, // Random distance 0-10km
        rating: nurse.stats.rating,
    })).sort((a, b) => b.matchScore - a.matchScore);
}


/**
 * Creates a new service request and identifies the best-matched nurse.
 * This runs on the client.
 * @param patient - The patient creating the request.
 * @param requestInput - The data for the new service request.
 * @returns The ID of the newly created document and the best matched nurse.
 */
export async function createServiceRequest(patient: Patient, requestInput: ServiceRequestInput): Promise<{requestId: string; bestMatch: MatchedNurse | null}> {
  if (!patient) throw new Error("Patient is required to create a service request");

  const availableNurses = await findAvailableNurses();
  const bestMatch = availableNurses.length > 0 ? availableNurses[0] : null;

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
      // The selected nurse will be added by offerServiceToNurse
    },
    payment: {
      platformFee: 5,
      platformFeePaid: false,
      nursePayment: {
        amount: bestMatch ? bestMatch.estimatedCost : 0,
        paid: false,
      },
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  // 1. Debugging: Log the object to see what's being sent.
  console.log('Attempting to create service request with this data:', newRequest);

  // 2. Sanitization: Remove any undefined fields before sending to Firestore.
  const sanitizedRequest = sanitizeDataForFirestore(newRequest);

  const docRef = await addDoc(collection(db, 'serviceRequests'), sanitizedRequest);
  return { requestId: docRef.id, bestMatch: bestMatch };
}


/**
 * Updates a service request to send an offer to a specific nurse.
 * This runs on the client.
 * @param requestId - The ID of the service request.
 * @param nurseId - The ID of the nurse to receive the offer.
 * @param estimatedCost - The estimated cost of the service.
 * @returns A promise that resolves when the update is complete.
 */
export async function offerServiceToNurse(requestId: string, nurseId: string, estimatedCost: number): Promise<void> {
  const requestRef = doc(db, 'serviceRequests', requestId);
  
  await updateDoc(requestRef, {
    status: 'pending-response',
    'matching.selectedNurseId': nurseId,
    'matching.offerSentAt': Timestamp.now(),
    'matching.responseDeadline': Timestamp.fromMillis(Date.now() + 15 * 60 * 1000), // 15 minutes
    'payment.nursePayment.amount': estimatedCost,
    updatedAt: Timestamp.now(),
  });
  
  console.log(`Offer sent to nurse ${nurseId} for request ${requestId}`);
}


/**
 * Handles the response from a nurse (accepted or declined).
 * This function would typically be called by the Nurse's application backend.
 * @param requestId - The ID of the service request.
 * @param accepted - Boolean indicating if the nurse accepted the request.
 */
export async function handleNurseResponse(requestId: string, accepted: boolean): Promise<void> {
  const requestRef = doc(db, 'serviceRequests', requestId);
  const requestSnap = await getDoc(requestRef);
  
  if (!requestSnap.exists()) {
     throw new Error("Service request not found.");
  }
  const requestData = requestSnap.data() as ServiceRequest;


  if (accepted) {
    await updateDoc(requestRef, {
      status: 'confirmed',
      updatedAt: Timestamp.now(),
    });
  } else {
    // If declined, we could implement logic to offer to the next best nurse.
    // For now, we just mark it as declined.
    await updateDoc(requestRef, {
      status: 'declined', 
      'matching.selectedNurseId': '', // Clear the selected nurse
      updatedAt: Timestamp.now(),
    });
  }
}
