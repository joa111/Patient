'use server';
/**
 * @fileOverview A flow for sending appointment notifications.
 *
 * - sendNotification: Sends a notification for a given appointment.
 * - SendNotificationInput: The input type for the sendNotification function.
 * - SendNotificationOutput: The return type for the sendNotification function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const SendNotificationInputSchema = z.object({
  // This can be a serviceRequestId or an appointmentId for backward compatibility
  requestId: z.string().describe('The ID of the service request or appointment document in Firestore.'),
  type: z.enum(['confirmation', 'en_route', 'new_offer', 'request_confirmed', 'request_declined' ]).describe('The type of notification to send.'),
  // userId can be a patientId or a nurseId depending on the notification type
  userId: z.string().describe('The ID of the user to notify.'),
});
export type SendNotificationInput = z.infer<typeof SendNotificationInputSchema>;

const SendNotificationOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type SendNotificationOutput = z.infer<typeof SendNotificationOutputSchema>;


export async function sendNotification(input: SendNotificationInput): Promise<SendNotificationOutput> {
  return sendNotificationFlow(input);
}


const sendNotificationFlow = ai.defineFlow(
  {
    name: 'sendNotificationFlow',
    inputSchema: SendNotificationInputSchema,
    outputSchema: SendNotificationOutputSchema,
  },
  async (input) => {
    try {
      // Determine the collection based on the type of notification
      const isServiceRequest = ['new_offer', 'request_confirmed', 'request_declined'].includes(input.type);
      const collectionName = isServiceRequest ? 'serviceRequests' : 'appointments';
      
      const requestRef = doc(db, collectionName, input.requestId);
      const requestSnap = await getDoc(requestRef);

      if (!requestSnap.exists()) {
        throw new Error(`Document with ID ${input.requestId} not found in ${collectionName}.`);
      }

      const requestData = requestSnap.data();
      
      // Determine recipient collection (patient or nurse)
      const isPatientNotification = ['confirmation', 'en_route', 'request_confirmed', 'request_declined'].includes(input.type);
      const userRef = doc(db, isPatientNotification ? 'patients' : 'nurses', input.userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        throw new Error(`User with ID ${input.userId} not found.`);
      }
      
      const user = userSnap.data();

      let title = '';
      let body = '';

      switch(input.type) {
        case 'confirmation':
          title = 'Appointment Confirmed!';
          body = `Your appointment with ${requestData.nurseName} for ${requestData.appointmentTime} is confirmed.`;
          break;
        case 'en_route':
          title = 'Your Nurse is On The Way!';
          body = `${requestData.nurseName} is en route to your location.`;
          break;
        case 'new_offer':
          title = 'New Service Request!';
          body = `You have a new service request from a patient. Please respond within 15 minutes.`;
          break;
        case 'request_confirmed':
           title = 'Your Request Was Accepted!';
           body = `Your service request has been confirmed by the nurse.`;
           break;
        case 'request_declined':
            title = 'Request Declined';
            body = `Unfortunately, your service request was declined. Please try another nurse.`;
            break;
      }

      // *****************************************************************
      // ** TODO: Implement actual Push Notification logic here (e.g., FCM)
      // *****************************************************************
      console.log('------------------------------------');
      console.log('SENDING PUSH NOTIFICATION');
      console.log('To:', user.email || user.contact); // Or a device token
      console.log('Title:', title);
      console.log('Body:', body);
      console.log('------------------------------------');

      // Update notification status in Firestore if applicable
      await updateDoc(requestRef, {
        notificationStatus: 'Sent',
        updatedAt: new Date(),
      });
      
      return {
        success: true,
        message: `Notification '${input.type}' sent successfully for request ${input.requestId}.`,
      };

    } catch (error: any) {
        console.error('Error in sendNotificationFlow:', error);
        return {
            success: false,
            message: error.message || 'An unexpected error occurred.',
        };
    }
  }
);

    