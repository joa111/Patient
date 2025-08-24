'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, GeoPoint, addDoc, serverTimestamp, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { LoaderCircle, MapPin, Briefcase, Clock, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getDistance } from 'geolib';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSearchParams } from 'next/navigation';
import { sendNotification } from '@/ai/flows/send-notification-flow';

interface Nurse {
  id: string;
  name: string;
  qualification: string;
  avatarUrl: string;
  location: GeoPoint;
  nextAvailable: string;
  distance?: number;
}

const SEARCH_RADIUS_KM = 10;

export function FindNurse() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const patientId = searchParams.get('id');

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Geolocation error:", error);
          setError('Could not get your location. Please ensure you have enabled location services in your browser and try again.');
          toast({
            variant: 'destructive',
            title: 'Location Access Denied',
            description: 'Please enable location permissions in your browser settings.',
          });
          setLoading(false);
        }
      );
    } else {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!userLocation) return;

    const fetchAndFilterNurses = async () => {
      setLoading(true);
      setError(null);
      try {
        const nursesRef = collection(db, 'nurses');
        const querySnapshot = await getDocs(nursesRef);
        const allNurses: Nurse[] = [];
        querySnapshot.forEach((doc) => {
          allNurses.push({ id: doc.id, ...doc.data() } as Nurse);
        });

        const nearbyNurses = allNurses
          .map((nurse) => {
            const distanceInMeters = getDistance(userLocation, {
              latitude: nurse.location.latitude,
              longitude: nurse.location.longitude,
            });
            const distanceInKm = distanceInMeters / 1000;
            return { ...nurse, distance: distanceInKm };
          })
          .filter((nurse) => nurse.distance <= SEARCH_RADIUS_KM)
          .sort((a, b) => a.distance - b.distance);
        
        setNurses(nearbyNurses);

      } catch (err) {
        console.error("Firestore Error fetching nurses:", err);
        setError('Failed to fetch nurse data. Please try again later.');
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not fetch available nurses from the database.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAndFilterNurses();
  }, [userLocation, toast]);
  
  const handleBooking = async (nurse: Nurse) => {
    if (!patientId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Patient ID not found. Cannot book appointment.',
      });
      return;
    }
    setBooking(true);
    try {
      // Fetch patient details
      const patientRef = doc(db, 'patients', patientId);
      const patientSnap = await getDoc(patientRef);

      if (!patientSnap.exists()) {
        throw new Error("Patient record not found.");
      }
      const patientName = patientSnap.data().name;
      
      const appointmentsRef = collection(db, 'appointments');
      const newAppointment = {
        patientId: patientId,
        patientName: patientName,
        nurseId: nurse.id,
        nurseName: nurse.name,
        appointmentTime: nurse.nextAvailable,
        status: 'Booked',
        notificationStatus: 'Pending',
        createdAt: Timestamp.now(),
      };
      const docRef = await addDoc(appointmentsRef, newAppointment);

      toast({
        title: 'Booking Confirmed!',
        description: `Your appointment with ${nurse.name} has been successfully booked.`,
      });

      // Send notification
      const notificationResult = await sendNotification({
        appointmentId: docRef.id,
        type: 'confirmation'
      });
      
      console.log('Notification flow result:', notificationResult);

      toast({
          title: 'Notification Sent',
          description: 'A confirmation notification has been dispatched.',
      });


    } catch (err) {
      console.error("Error booking appointment: ", err);
      toast({
        variant: 'destructive',
        title: 'Booking Failed',
        description: 'Could not book the appointment. Please try again.',
      });
    } finally {
      setBooking(false);
    }
  };

  if (loading && !error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
         <div className="flex items-center space-x-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <h3 className="font-headline text-xl font-semibold mb-4">Nurses Near You</h3>
      {nurses.length > 0 ? (
        <div className="space-y-4">
          {nurses.map((nurse) => (
            <Card key={nurse.id} className="hover:bg-muted/50 transition-colors">
              <CardContent className="p-4 flex items-center space-x-4">
                <Avatar className="h-16 w-16 border">
                  <AvatarImage src={nurse.avatarUrl} alt={nurse.name} data-ai-hint="person nurse" />
                  <AvatarFallback>{nurse.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-grow">
                  <p className="font-bold text-lg text-primary">{nurse.name}</p>
                  <p className="flex items-center text-sm text-muted-foreground">
                    <Briefcase className="mr-2 h-4 w-4" /> {nurse.qualification}
                  </p>
                  <p className="flex items-center text-sm text-muted-foreground mt-1">
                    <MapPin className="mr-2 h-4 w-4" /> {nurse.distance?.toFixed(1)} km away
                  </p>
                </div>
                <div className="text-right">
                    <p className="flex items-center text-sm font-semibold">
                       <Clock className="mr-2 h-4 w-4 text-primary" /> Next Available
                    </p>
                    <p className="text-md pl-6">{nurse.nextAvailable}</p>
                     <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" className="mt-2" disabled={booking}>
                          {booking ? <LoaderCircle className="animate-spin" /> : 'Book Now'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm Appointment</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to book an appointment with <span className="font-semibold text-primary">{nurse.name}</span> for <span className="font-semibold text-primary">{nurse.nextAvailable}</span>?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleBooking(nurse)} disabled={booking}>
                             {booking && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No nurses found within a {SEARCH_RADIUS_KM}km radius. Please try again later.</p>
      )}
    </div>
  );
}
