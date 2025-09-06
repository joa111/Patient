'use server';
/**
 * @fileOverview Firestore functions for managing service requests.
 */

import { collection, addDoc, doc, updateDoc, Timestamp, GeoPoint, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ServiceRequestInput, Nurse, Patient, ServiceRequest } from '@/types/service-request';

/**
 * Creates a new service request document in the 'serviceRequests' collection.
 * @param requestData - The data for the new service request.
 * @returns The ID of the newly created document.
 */
export async function createServiceRequest(patient: Patient, requestInput: ServiceRequestInput, availableNurses: any[]): Promise<string> {
  if (!patient) throw new Error("Patient is required to create a service request");

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
      availableNurses: availableNurses.map(n => ({
        nurseId: n.nurseId,
        nurseName: n.nurseName,
        matchScore: n.matchScore,
        estimatedCost: n.estimatedCost,
        distance: n.distance,
        rating: n.rating,
      })),
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
 * Finds available nurses based on the service request criteria.
 * This is a simplified version. A real implementation might use more complex queries or a dedicated search service.
 * @param request - The service request details.
 * @returns A promise that resolves to an array of available nurses.
 */
export async function findAvailableNurses(request: ServiceRequestInput): Promise<Nurse[]> {
  const nursesRef = collection(db, 'nurses');
  
  // For this version, we are querying all online nurses and then filtering them in the component.
  // A more advanced implementation might use more complex queries here, possibly with geohashing for location.
  const q = query(nursesRef, where('availability.isOnline', '==', true));
  
  const querySnapshot = await getDocs(q);
  const nurses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Nurse));
  
  return nurses;
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
  const requestSnap = await getDocs(query(collection(db, 'serviceRequests'), where('id', '==', requestId)));
  
  if (requestSnap.empty) {
     throw new Error("Service request not found.");
  }
  const requestData = requestSnap.docs[0].data() as ServiceRequest;


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
