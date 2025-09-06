'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, GeoPoint, addDoc, doc, getDoc, Timestamp, query, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { LoaderCircle, MapPin, Briefcase, Clock, AlertTriangle, Star, CheckCircle, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
} from "@/components/ui/alert-dialog";
import { useSearchParams } from 'next/navigation';
import { sendNotification } from '@/ai/flows/send-notification-flow';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Progress } from '@/components/ui/progress';
import type { Nurse, Patient, ServiceRequest, MatchedNurse, ServiceRequestInput } from '@/types/service-request';

const serviceRequestSchema = z.object({
    serviceType: z.string().min(1, "Please select a service type."),
    scheduledDateTime: z.date({
        required_error: "A date and time is required.",
    }),
    duration: z.number().min(1, "Duration must be at least 1 hour."),
    specialRequirements: z.string().optional(),
    isUrgent: z.boolean().default(false),
});


async function calculateMatchScore(
  nurse: Nurse,
  request: ServiceRequestInput,
  patient: Patient
): Promise<number> {
  let score = 0;

  if (!nurse.location || !request.patientLocation) return 0;
  if (!patient.preferences) return 0;

  // Distance factor (40% weight)
  const distance = getDistance(
    { latitude: request.patientLocation.latitude, longitude: request.patientLocation.longitude },
    { latitude: nurse.location.latitude, longitude: nurse.location.longitude }
  ) / 1000; // convert to km
  
  if (distance <= (nurse.availability?.serviceRadius ?? patient.preferences.maxDistance)) {
    score += (40 * (1 - distance / (nurse.availability?.serviceRadius ?? patient.preferences.maxDistance)));
  }
  
  // Rating factor (25% weight)
  if(nurse.stats?.rating) {
    score += (25 * (nurse.stats.rating / 5));
  }
  
  // Availability factor (20% weight)
  if (nurse.availability?.isOnline) score += 20;
  
  // Specialty match (10% weight)
  if (nurse.rates?.specialties?.some(s => s.name === request.serviceType)) {
    score += 10;
  }
  
  // Response time factor (5% weight)
  if (nurse.stats?.averageResponseTime) {
    score += (5 * Math.max(0, 1 - nurse.stats.averageResponseTime / 60));
  }
  
  return Math.min(100, score);
}


export function FindNurse() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('id');

  const [step, setStep] = useState<'request' | 'selecting' | 'confirming' | 'waiting'>('request');
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [serviceRequest, setServiceRequest] = useState<ServiceRequestInput | null>(null);
  const [serviceRequestId, setServiceRequestId] = useState<string | null>(null);
  
  const [availableNurses, setAvailableNurses] = useState<MatchedNurse[]>([]);
  const [selectedNurse, setSelectedNurse] = useState<MatchedNurse | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof serviceRequestSchema>>({
    resolver: zodResolver(serviceRequestSchema),
    defaultValues: {
      duration: 1,
      isUrgent: false,
      specialRequirements: "",
    },
  });

  useEffect(() => {
    async function fetchInitialData() {
        if (!patientId) {
            setError("No patient ID provided.");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const patientRef = doc(db, 'patients', patientId);
            const patientSnap = await getDoc(patientRef);
            if (patientSnap.exists()) {
                setPatient({ id: patientSnap.id, ...patientSnap.data() } as Patient);
            } else {
                setError("Patient not found.");
            }

            // For now, we get user location via browser. In a real app, this might be saved in the patient's profile.
             if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                       if (!serviceRequest) {
                         setServiceRequest(prev => ({
                            ...prev,
                            patientLocation: { latitude: position.coords.latitude, longitude: position.coords.longitude }
                         } as ServiceRequestInput));
                       }
                    },
                    (geoError) => {
                        console.error("Geolocation error:", geoError);
                        setError('Could not get your location. Please enable location services.');
                    }
                );
            } else {
                setError('Geolocation is not supported by your browser.');
            }

        } catch (err) {
            console.error(err);
            setError("Failed to load initial data.");
        } finally {
            setLoading(false);
        }
    }
    fetchInitialData();
  }, [patientId, serviceRequest]);

  const findMatchingNurses = async (request: ServiceRequestInput) => {
      if (!patient) {
        setError("Patient data is missing.");
        return;
      }
      setLoading(true);
      setServiceRequest(request);

      try {
        const nursesRef = collection(db, 'nurses');
        // More complex query can be built here, e.g., filtering by specialty at DB level if needed
        const q = query(nursesRef, where("availability.isOnline", "==", true));
        const querySnapshot = await getDocs(q);
        
        const allNurses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Nurse));

        const matchedNursesPromises = allNurses.map(async (nurse) => {
            const matchScore = await calculateMatchScore(nurse, request, patient);
            if (matchScore > 0) { // Only consider nurses with a positive match score
                const distance = getDistance(
                    request.patientLocation,
                    { latitude: nurse.location.latitude, longitude: nurse.location.longitude }
                ) / 1000;
                const specialtyRate = nurse.rates?.specialties?.find(s => s.name === request.serviceType)?.rate || nurse.rates?.hourlyRate || 50;
                const estimatedCost = specialtyRate * request.duration;

                return {
                    nurseId: nurse.id,
                    nurseName: nurse.name,
                    avatarUrl: nurse.avatarUrl,
                    qualification: nurse.qualification,
                    matchScore: Math.round(matchScore),
                    estimatedCost,
                    distance: parseFloat(distance.toFixed(1)),
                    rating: nurse.stats?.rating || 0,
                };
            }
            return null;
        });

        const resolvedNurses = (await Promise.all(matchedNursesPromises))
            .filter((n): n is MatchedNurse => n !== null)
            .sort((a, b) => b.matchScore - a.matchScore);

        setAvailableNurses(resolvedNurses);
        
        // Create serviceRequest document
        const requestDoc: Omit<ServiceRequest, 'id'> = {
            patientId: patient.id,
            patientName: patient.name,
            serviceDetails: {
                type: request.serviceType,
                scheduledDateTime: Timestamp.fromDate(request.scheduledDateTime),
                duration: request.duration,
                location: {
                    address: "User's current location", // This would be improved with a geocoding API
                    coordinates: new GeoPoint(request.patientLocation.latitude, request.patientLocation.longitude),
                },
                specialRequirements: request.specialRequirements,
                isUrgent: request.isUrgent,
            },
            status: 'finding-nurses',
            matching: {
                availableNurses: resolvedNurses.map(n => ({
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

        const docRef = await addDoc(collection(db, 'serviceRequests'), requestDoc);
        setServiceRequestId(docRef.id);
        
        setStep('selecting');

      } catch (err) {
        console.error("Error finding nurses:", err);
        setError("Failed to find matching nurses. Please try again.");
      } finally {
        setLoading(false);
      }
  };

  const handleSelectNurse = (nurse: MatchedNurse) => {
    setSelectedNurse(nurse);
    setStep('confirming');
  };

  const handleConfirmBooking = async () => {
    if (!selectedNurse || !serviceRequestId) {
        setError("Something went wrong. No nurse or service request selected.");
        return;
    }
    setLoading(true);
    try {
        const requestRef = doc(db, 'serviceRequests', serviceRequestId);
        await updateDoc(requestRef, {
            'status': 'pending-response',
            'matching.selectedNurseId': selectedNurse.nurseId,
            'matching.offerSentAt': Timestamp.now(),
            'matching.responseDeadline': Timestamp.fromMillis(Timestamp.now().toMillis() + 15 * 60 * 1000), // 15 min deadline
            'payment.nursePayment.amount': selectedNurse.estimatedCost,
            'updatedAt': Timestamp.now(),
        });

        // This would be the point to call a new, more detailed Genkit flow
        // For now, we simulate the notification
        console.log(`Sending offer to ${selectedNurse.nurseName}...`);
        toast({
            title: "Offer Sent!",
            description: `We've sent your request to ${selectedNurse.nurseName}. You will be notified of their response.`,
        });

        setStep('waiting');

    } catch (err) {
        console.error("Error confirming booking:", err);
        setError("Could not send your request. Please try again.");
    } finally {
        setLoading(false);
    }
  };

  // Real-time listener for the service request
  useEffect(() => {
    if (!serviceRequestId) return;

    const unsubscribe = onSnapshot(doc(db, "serviceRequests", serviceRequestId), (doc) => {
        const data = doc.data();
        if (data) {
            const currentStatus = data.status;
            if (currentStatus === 'confirmed') {
                toast({
                    title: "Appointment Confirmed!",
                    description: `${data.matching.selectedNurseName} has accepted your request.`,
                });
                setStep('confirmed');
            } else if (currentStatus === 'cancelled' || currentStatus === 'declined') {
                 toast({
                    variant: "destructive",
                    title: "Request Declined",
                    description: `Unfortunately, the request was not accepted. Please try another nurse.`,
                });
                setStep('selecting'); // Go back to selection
            }
        }
    });

    return () => unsubscribe();
  }, [serviceRequestId, toast]);


  const renderContent = () => {
    if (loading && step === 'request') {
       return <div className="text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin" /><p>Loading...</p></div>;
    }
    if (error) {
        return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
    }

    switch (step) {
      case 'request':
        return (
          <div>
            <h3 className="font-headline text-xl font-semibold mb-4">Request a Service</h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(findMatchingNurses)} className="space-y-8">
                <FormField control={form.control} name="serviceType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="general">General Check-up</SelectItem>
                        <SelectItem value="wound-care">Wound Care</SelectItem>
                        <SelectItem value="injection">Injection</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="scheduledDateTime" render={({ field }) => (
                   <FormItem className="flex flex-col">
                    <FormLabel>Appointment Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"}>
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
                 <FormField control={form.control} name="duration" render={({ field }) => (
                   <FormItem>
                    <FormLabel>Duration (hours)</FormLabel>
                    <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="specialRequirements" render={({ field }) => (
                   <FormItem>
                    <FormLabel>Special Requirements</FormLabel>
                    <FormControl>
                        <Textarea placeholder="Anything the nurse should know..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <LoaderCircle className="animate-spin" /> : 'Find Nurses'}
                </Button>
              </form>
            </Form>
          </div>
        );
      
      case 'selecting':
        return (
          <div>
            <h3 className="font-headline text-xl font-semibold mb-4">Select a Nurse</h3>
            {loading ? <p>Finding matches...</p> : availableNurses.length > 0 ? (
                 <div className="space-y-4">
                    {availableNurses.map((nurse) => (
                        <Card key={nurse.nurseId} className="hover:bg-muted/50 transition-colors">
                            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                                <Avatar className="h-16 w-16 border">
                                    <AvatarImage src={nurse.avatarUrl} alt={nurse.nurseName} data-ai-hint="person nurse" />
                                    <AvatarFallback>{nurse.nurseName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-grow">
                                    <p className="font-bold text-lg text-primary">{nurse.nurseName}</p>
                                    <p className="flex items-center text-sm text-muted-foreground"><Briefcase className="mr-2 h-4 w-4" /> {nurse.qualification}</p>
                                    <div className="flex items-center text-sm text-muted-foreground mt-1 space-x-4">
                                        <p className="flex items-center"><MapPin className="mr-2 h-4 w-4" /> {nurse.distance} km away</p>
                                        <p className="flex items-center"><Star className="mr-2 h-4 w-4 text-amber-400" /> {nurse.rating} / 5</p>
                                    </div>
                                    <p className="text-lg font-semibold mt-2">${nurse.estimatedCost.toFixed(2)} (est)</p>
                                </div>
                                <div className="w-full sm:w-auto text-right flex flex-col items-end">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium">Match Score</p>
                                      <Progress value={nurse.matchScore} className="w-24 h-2" />
                                      <span className="font-semibold text-primary">{nurse.matchScore}%</span>
                                    </div>
                                    <Button size="sm" className="mt-2" onClick={() => handleSelectNurse(nurse)}>Select & Continue</Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                 </div>
            ) : <p>No nurses found for your request. Try adjusting your criteria.</p>}
             <Button variant="outline" className="mt-4" onClick={() => setStep('request')}>Back to Request</Button>
          </div>
        );

      case 'confirming':
         if (!selectedNurse) return <p>Error: No nurse selected.</p>;
         return (
            <div>
                <h3 className="font-headline text-xl font-semibold mb-4">Confirm Booking</h3>
                <Card>
                    <CardHeader>
                        <CardTitle>Request Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center space-x-4">
                             <Avatar className="h-16 w-16 border">
                                <AvatarImage src={selectedNurse.avatarUrl} alt={selectedNurse.nurseName} />
                                <AvatarFallback>{selectedNurse.nurseName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold text-lg">{selectedNurse.nurseName}</p>
                                <p className="text-muted-foreground">{selectedNurse.qualification}</p>
                            </div>
                        </div>
                        <p><strong>Service:</strong> {serviceRequest?.serviceType}</p>
                        <p><strong>When:</strong> {format(serviceRequest?.scheduledDateTime!, 'PPP p')}</p>
                        <p className="text-2xl font-bold text-right">Estimated Total: ${selectedNurse.estimatedCost.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground text-right">You will not be charged until the service is confirmed by the nurse.</p>
                        
                        <div className="flex gap-4 mt-6">
                           <Button variant="outline" className="w-full" onClick={() => setStep('selecting')}>Back to List</Button>
                           <Button className="w-full" onClick={handleConfirmBooking} disabled={loading}>
                               {loading ? <LoaderCircle className="animate-spin" /> : 'Send Request to Nurse'}
                           </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
         );

      case 'waiting':
        return (
            <div className="text-center py-12">
                <LoaderCircle className="h-12 w-12 text-primary animate-spin mx-auto"/>
                <h3 className="font-headline text-2xl font-semibold mt-6">Waiting for Confirmation</h3>
                <p className="text-muted-foreground mt-2">We've sent your request to {selectedNurse?.nurseName}.</p>
                <p className="text-muted-foreground">We'll notify you as soon as they respond.</p>
                <Progress value={(15 * 60 - 1) / (15 * 60) * 100} className="w-full max-w-sm mx-auto mt-8" />
                 <p className="text-sm text-muted-foreground mt-2">The request will expire in 15 minutes.</p>
            </div>
        );
      
      case 'confirmed':
        return (
             <div className="text-center py-12">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto"/>
                <h3 className="font-headline text-2xl font-semibold mt-6">Booking Confirmed!</h3>
                <p className="text-muted-foreground mt-2">{selectedNurse?.nurseName} is confirmed for your appointment.</p>
                <Button className="mt-6" onClick={() => window.location.reload()}>
                    Done
                </Button>
            </div>
        )
    }
  };
  
  return (
    <div>
      {renderContent()}
    </div>
  );
}
