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
  appointmentId: z.string().describe('The ID of the appointment document in Firestore.'),
  type: z.enum(['confirmation', 'en_route']).describe('The type of notification to send.'),
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
      const appointmentRef = doc(db, 'appointments', input.appointmentId);
      const appointmentSnap = await getDoc(appointmentRef);

      if (!appointmentSnap.exists()) {
        throw new Error(`Appointment with ID ${input.appointmentId} not found.`);
      }

      const appointment = appointmentSnap.data();
      const patientRef = doc(db, 'patients', appointment.patientId);
      const patientSnap = await getDoc(patientRef);
      
      if (!patientSnap.exists()) {
        throw new Error(`Patient with ID ${appointment.patientId} not found.`);
      }
      
      const patient = patientSnap.data();

      let title = '';
      let body = '';

      if (input.type === 'confirmation') {
        title = 'Appointment Confirmed!';
        body = `Your appointment with ${appointment.nurseName} for ${appointment.appointmentTime} is confirmed.`;
      } else if (input.type === 'en_route') {
        title = 'Your Nurse is On The Way!';
        body = `${appointment.nurseName} is en route to your location.`;
      }

      // *****************************************************************
      // ** TODO: Implement actual Push Notification logic here (e.g., FCM)
      // *****************************************************************
      // For now, we'll just log to the console to simulate sending.
      console.log('------------------------------------');
      console.log('SENDING PUSH NOTIFICATION');
      console.log('To:', patient.email || patient.contact); // Or a device token
      console.log('Title:', title);
      console.log('Body:', body);
      console.log('------------------------------------');


      // Update notification status in Firestore
      await updateDoc(appointmentRef, {
        notificationStatus: 'Sent',
      });
      
      return {
        success: true,
        message: `Notification '${input.type}' sent successfully for appointment ${input.appointmentId}.`,
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
