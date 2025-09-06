'use server';
/**
 * @fileOverview Firestore functions for managing service requests.
 */

import { collection, addDoc, doc, updateDoc, Timestamp, GeoPoint, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ServiceRequestInput, Nurse, Patient, ServiceRequest, MatchedNurse } from '@/types/service-request';

/**
 * Creates a new service request document in the 'serviceRequests' collection.
 * The availableNurses array is initialized as empty, assuming a backend process will populate it.
 * @param patient - The patient creating the request.
 * @param requestInput - The data for the new service request.
 * @returns The ID of the newly created document.
 */
export async function createServiceRequest(patient: Patient, requestInput: ServiceRequestInput): Promise<string> {
  if (!patient) throw new Error("Patient is required to create a service request");

  // This is a placeholder for a real backend matching function.
  // In a real app, you would have a Cloud Function that triggers on create,
  // finds nurses, and updates this document with the matches.
  // For this simulation, we'll find some nurses and attach them directly.
  const mockAvailableNurses = await getMockAvailableNurses(requestInput);

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
      availableNurses: mockAvailableNurses, // Initialize with mock nurses for simulation
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
 * MOCK FUNCTION: Simulates finding available nurses.
 * In a real application, this logic would live in a secure backend environment (e.g., Cloud Function).
 * It queries the nurses collection, which is insecure to do from the client.
 * We are only doing this here to provide data for the simulation.
 * @param requestInput 
 * @returns 
 */
async function getMockAvailableNurses(requestInput: ServiceRequestInput): Promise<MatchedNurse[]> {
  try {
    const nursesQuery = query(collection(db, 'nurses'), where("availability.isOnline", "==", true));
    const snapshot = await getDocs(nursesQuery);
    
    if (snapshot.empty) {
      console.log("No online nurses found for mock matching.");
      return [];
    }

    const nurses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Nurse));
    
    // Simulate scoring and matching
    const matchedNurses = nurses.map(nurse => ({
      nurseId: nurse.id,
      nurseName: nurse.name,
      avatarUrl: nurse.avatarUrl,
      qualification: nurse.qualification,
      matchScore: Math.floor(Math.random() * (98 - 75 + 1) + 75), // Random score between 75-98
      estimatedCost: (nurse.rates.specialties.find(s => s.name === requestInput.serviceType)?.rate || nurse.rates.hourlyRate) * requestInput.duration,
      distance: 5, // Mock distance
      rating: nurse.stats.rating,
    }));

    return matchedNurses;
  } catch (error) {
    console.error("Error in getMockAvailableNurses (this is expected on client-side):", error);
    // Return empty array on permission error, because this is insecure from client.
    // In a real app, this function doesn't exist on the client.
    return [];
  }
}


/**
 * Updates a service request to send an offer to a specific nurse.
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
  
  // Here you would trigger the actual notification to the nurse
  // e.g., using a Genkit flow: await sendNotification({ type: 'new_offer', userId: nurseId, requestId });
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
    // Notify patient of confirmation
    // e.g., await sendNotification({ type: 'request_confirmed', userId: requestData.patientId, requestId });
  } else {
    // If declined, logic to offer to the next-best nurse could be implemented here.
    // For now, we'll just mark it as cancelled.
    await updateDoc(requestRef, {
      status: 'declined', 
      'matching.selectedNurseId': '', 
      updatedAt: Timestamp.now(),
    });
     // Notify patient of decline
    // e.g., await sendNotification({ type: 'request_declined', userId: requestData.patientId, requestId });
  }
}
