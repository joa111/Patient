/**
 * @fileOverview Firestore functions for managing service requests, running on the client-side.
 */

import { collection, addDoc, doc, updateDoc, Timestamp, GeoPoint, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ServiceRequestInput, Nurse, Patient, ServiceRequest, MatchedNurse } from '@/types/service-request';


/**
 * A mock function to simulate finding available nurses based on a request.
 * In a real application, this would be a complex backend process.
 * This now runs on the client-side.
 * @param request - The service request details.
 * @returns A promise that resolves to an array of matched nurses.
 */
export async function getMockAvailableNurses(): Promise<MatchedNurse[]> {
    const nursesQuery = query(collection(db, 'nurses'), where("availability.isOnline", "==", true));
    const snapshot = await getDocs(nursesQuery);
    const nurses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Nurse));

    // Mock scoring and matching logic
    return nurses.map(nurse => ({
        nurseId: nurse.id,
        nurseName: nurse.name,
        avatarUrl: nurse.avatarUrl,
        qualification: nurse.qualification,
        matchScore: Math.floor(Math.random() * (98 - 85 + 1)) + 85, // Random score between 85-98
        estimatedCost: nurse.rates.hourlyRate * 1.5, // Mock cost
        distance: Math.round(Math.random() * 10 * 10) / 10, // Random distance 0-10km
        rating: nurse.stats.rating,
    })).sort((a, b) => b.matchScore - a.matchScore);
}


/**
 * Creates a new service request document in the 'serviceRequests' collection.
 * The availableNurses array is populated by a mock function.
 * This runs on the client.
 * @param patient - The patient creating the request.
 * @param requestInput - The data for the new service request.
 * @returns The ID of the newly created document.
 */
export async function createServiceRequest(patient: Patient, requestInput: ServiceRequestInput): Promise<string> {
  if (!patient) throw new Error("Patient is required to create a service request");

  // Since this runs on the client, we can call our mock search function directly
  const availableNurses = await getMockAvailableNurses();

  const newRequest: Omit<ServiceRequest, 'id'> = {
    patientId: patient.id,
    patientName: patient.name,
    serviceDetails: {
      type: requestInput.serviceType,
      scheduledDateTime: Timestamp.fromDate(requestInput.scheduledDateTime),
      duration: requestInput.duration,
      location: {
        address: "User's current location", // This would be improved with a geocoding API
        coordinates: new GeoPoint(requestInput.patientLocation.latitude, requestInput.patientLocation.longitude),
      },
      specialRequirements: requestInput.specialRequirements,
      isUrgent: requestInput.isUrgent,
    },
    status: 'finding-nurses',
    matching: {
      availableNurses: availableNurses,
    },
    payment: {
      platformFee: 5, // Example fee
      platformFeePaid: false,
      nursePayment: {
        amount: 0, // Will be set upon confirmation
        paid: false,
      },
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, 'serviceRequests'), newRequest);
  return docRef.id;
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
    'matching.responseDeadline': Timestamp.fromMillis(Date.now() + 15 * 60 * 1000), // 15-minute deadline
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
    await updateDoc(requestRef, {
      status: 'declined', 
      'matching.selectedNurseId': '', 
      updatedAt: Timestamp.now(),
    });
  }
}