
'use client';

import { useState, useEffect, useMemo } from 'react';
import { onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { LoaderCircle, MapPin, Briefcase, AlertTriangle, Star, CheckCircle, ArrowRight, CalendarIcon, ClockIcon, ClipboardPlus, User, Plus, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
import type { Patient, ServiceRequest, MatchedNurse, ServiceRequestInput } from '@/types/service-request';
import { createServiceRequest, offerServiceToNurse } from '@/lib/matching-service';


const serviceRequestSchema = z.object({
    serviceType: z.string().min(1, "Please select a service type."),
    scheduledDateTime: z.date({
        required_error: "A date and time is required.",
    }),
    duration: z.coerce.number().min(1, "Duration must be at least 1 hour."),
    specialRequirements: z.string().optional(),
    isUrgent: z.boolean().default(false),
});


export function FindNurse() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('id');

  const [step, setStep] = useState<'request' | 'selecting' | 'confirming' | 'waiting' | 'confirmed'>('request');
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [serviceRequestInput, setServiceRequestInput] = useState<ServiceRequestInput | null>(null);
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

             if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                       setServiceRequestInput(prev => ({
                          ...prev,
                          patientLocation: { latitude: position.coords.latitude, longitude: position.coords.longitude }
                       } as ServiceRequestInput));
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
  }, [patientId]);

  const findMatchingNurses = async (requestData: z.infer<typeof serviceRequestSchema>) => {
      if (!patient || !serviceRequestInput?.patientLocation) {
        setError("Patient data or location is missing.");
        return;
      }
      setLoading(true);
      setStep('selecting');

      const fullRequestInput: ServiceRequestInput = {
        ...requestData,
        patientLocation: serviceRequestInput.patientLocation
      };
      setServiceRequestInput(fullRequestInput);

      try {
        const docId = await createServiceRequest(patient, fullRequestInput);
        setServiceRequestId(docId);
        
        const requestRef = doc(db, 'serviceRequests', docId);
        const unsubscribe = onSnapshot(requestRef, (docSnap) => {
            if (docSnap.exists()) {
                const reqData = docSnap.data() as ServiceRequest;
                if (reqData.matching.availableNurses && reqData.matching.availableNurses.length > 0) {
                     setAvailableNurses(reqData.matching.availableNurses);
                     setLoading(false);
                     unsubscribe(); 
                }
            }
        }, (err) => {
            console.error("Error listening to service request:", err);
            setError(`Failed to retrieve nurse matches: ${err.message}.`);
            setLoading(false);
        });

      } catch (err: any) {
        console.error("Error finding nurses:", err);
        setError(`Failed to find matching nurses: ${err.message}. Please try again.`);
        setStep('request'); 
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
        await offerServiceToNurse(serviceRequestId, selectedNurse.nurseId, selectedNurse.estimatedCost);

        console.log(`Sending offer to ${selectedNurse.fullName}...`);
        toast({
            title: "Offer Sent!",
            description: `We've sent your request to ${selectedNurse.fullName}. You will be notified of their response.`,
        });

        setStep('waiting');

    } catch (err: any) {
        console.error("Error confirming booking:", err);
        setError(`Could not send your request: ${err.message}. Please try again.`);
    } finally {
        setLoading(false);
    }
  };

  // Real-time listener for the service request status changes
  useEffect(() => {
    if (!serviceRequestId) return;

    const unsubscribe = onSnapshot(doc(db, "serviceRequests", serviceRequestId), (doc) => {
        const data = doc.data() as ServiceRequest;
        if (data) {
            if (data.status === 'confirmed') {
                toast({
                    title: "Appointment Confirmed!",
                    description: `${selectedNurse?.fullName || 'The nurse'} has accepted your request.`,
                    variant: 'default',
                });
                setStep('confirmed');
            } else if (data.status === 'cancelled' || data.status === 'declined') {
                 toast({
                    variant: "destructive",
                    title: "Request Declined",
                    description: `Unfortunately, the request was not accepted. Please try another nurse.`,
                });
                setAvailableNurses([]); // Clear old list
                setStep('selecting'); // Go back to selection
            }
        }
    });

    return () => unsubscribe();
  }, [serviceRequestId, selectedNurse, toast]);


  const renderContent = () => {
    if (loading && step === 'request') {
       return <div className="flex justify-center items-center h-48"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /><p className="ml-4">Loading your information...</p></div>;
    }
    if (error) {
        return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
    }

    switch (step) {
      case 'request':
        return (
          <Card className="border-0 shadow-none">
            <CardContent className="p-0">
                <Form {...form}>
                <form onSubmit={form.handleSubmit(findMatchingNurses)} className="space-y-8">
                    <FormField control={form.control} name="serviceType" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-base">What service do you need?</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <div className="relative">
                                <ClipboardPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <SelectTrigger className="pl-10 h-12 text-base"><SelectValue placeholder="Select a service" /></SelectTrigger>
                            </div>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="general">General Check-up</SelectItem>
                            <SelectItem value="wound-care">Wound Care</SelectItem>
                            <SelectItem value="injection">Injection Administration</SelectItem>
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FormField control={form.control} name="scheduledDateTime" render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel className="text-base">When do you need it?</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button variant={"outline"} className="h-12 text-base justify-start font-normal text-left pl-10 relative">
                                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                    {field.value ? format(field.value, "PP") : <span>Pick a date</span>}
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
                        <FormField control={form.control} name="scheduledDateTime" render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel className="text-base">At what time?</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <ClockIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                        <Input
                                            type="time"
                                            className="h-12 text-base pl-10"
                                            onChange={(e) => {
                                                const newDate = field.value ? new Date(field.value) : new Date();
                                                const [hours, minutes] = e.target.value.split(':');
                                                newDate.setHours(parseInt(hours, 10), parseInt(minutes, 10));
                                                field.onChange(newDate);
                                            }}
                                            value={field.value ? format(field.value, "HH:mm") : ""}
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                     <FormField control={form.control} name="duration" render={({ field }) => (
                       <FormItem>
                        <FormLabel className="text-base">Estimated Duration</FormLabel>
                        <FormControl>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input type="number" min="1" {...field} className="h-12 text-base pl-10" placeholder="e.g., 2 hours"/>
                            </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="specialRequirements" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-base">Any special notes?</FormLabel>
                        <FormControl>
                             <div className="relative">
                                <Plus className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                                <Textarea placeholder="e.g., 'Patient is hard of hearing', 'Free parking available'" {...field} className="pl-10 text-base" rows={3}/>
                            </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )} />
                    <Button type="submit" className="w-full text-lg py-7" disabled={loading}>
                    {loading ? <LoaderCircle className="animate-spin" /> : <> <Search className="mr-2 h-5 w-5"/>Find Matching Nurses</>}
                    </Button>
                </form>
                </Form>
            </CardContent>
          </Card>
        );
      
      case 'selecting':
        return (
          <div>
            <h3 className="font-headline text-xl font-semibold mb-4">Select a Nurse</h3>
            {loading ? <div className="flex justify-center items-center h-48"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /><p className="ml-4">Finding best matches for you...</p></div> : availableNurses.length > 0 ? (
                 <div className="space-y-4">
                    {availableNurses.map((nurse) => (
                        <Card key={nurse.nurseId} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleSelectNurse(nurse)}>
                            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                                <Avatar className="h-16 w-16 border-2 border-primary/20">
                                    <AvatarImage src={nurse.avatarUrl} alt={nurse.fullName} data-ai-hint="person nurse" />
                                    <AvatarFallback>{nurse.fullName ? nurse.fullName.charAt(0) : 'N'}</AvatarFallback>
                                </Avatar>
                                <div className="flex-grow">
                                    <p className="font-bold text-lg text-primary">{nurse.fullName}</p>
                                    <p className="flex items-center text-sm text-muted-foreground"><Briefcase className="mr-2 h-4 w-4" /> {nurse.district}</p>
                                    <div className="flex items-center text-sm text-muted-foreground mt-1 space-x-4">
                                        <p className="flex items-center"><MapPin className="mr-2 h-4 w-4" /> {nurse.distance} km away</p>
                                        <p className="flex items-center"><Star className="mr-2 h-4 w-4 text-amber-400" /> {nurse.rating} / 5</p>
                                    </div>
                                </div>
                                <div className="w-full sm:w-auto text-right flex flex-col items-end gap-2">
                                    <p className="text-xl font-semibold">₹{nurse.estimatedCost.toFixed(2)}<span className="text-sm font-normal text-muted-foreground"> (est.)</span></p>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium text-muted-foreground">Match Score</p>
                                      <Progress value={nurse.matchScore} className="w-24 h-2" />
                                      <span className="font-semibold text-primary">{nurse.matchScore}%</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                 </div>
            ) : <p className="text-center text-muted-foreground py-12">No available nurses found for your request. Please try adjusting your criteria.</p>}
             <Button variant="outline" className="mt-6" onClick={() => setStep('request')}>Back to Request Details</Button>
          </div>
        );

      case 'confirming':
         if (!selectedNurse || !serviceRequestInput) return <p>Error: No nurse or service request details selected.</p>;
         return (
            <div>
                <h3 className="font-headline text-xl font-semibold mb-4">Confirm Booking</h3>
                <Card className="shadow-lg">
                    <CardHeader>
                        <div className="flex items-center space-x-4">
                             <Avatar className="h-20 w-20 border-2 border-primary">
                                <AvatarImage src={selectedNurse.avatarUrl} alt={selectedNurse.fullName} />
                                <AvatarFallback>{selectedNurse.fullName ? selectedNurse.fullName.charAt(0) : 'N'}</AvatarFallback>
                            </Avatar>
                            <div>
                                <CardTitle className="text-2xl text-primary">{selectedNurse.fullName}</CardTitle>
                                <CardDescription>{selectedNurse.district}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                        <div className="border-t border-dashed pt-4">
                            <p><strong>Service:</strong> {serviceRequestInput.serviceType}</p>
                            <p><strong>When:</strong> {format(serviceRequestInput.scheduledDateTime, 'PPP p')}</p>
                            <p><strong>Duration:</strong> {serviceRequestInput.duration} hour(s)</p>
                        </div>
                        <div className="text-right border-t border-dashed pt-4">
                            <p className="text-sm text-muted-foreground">Estimated Total</p>
                            <p className="text-3xl font-bold text-primary">₹{selectedNurse.estimatedCost.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground mt-1">You will not be charged until the service is confirmed by the nurse.</p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                           <Button variant="outline" className="w-full" onClick={() => setStep('selecting')}>Back to List</Button>
                           <Button className="w-full" onClick={handleConfirmBooking} disabled={loading}>
                               {loading ? <LoaderCircle className="animate-spin" /> : 'Send Request to Nurse'} <ArrowRight className="ml-2 h-5 w-5"/>
                           </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
         );

      case 'waiting':
        return (
            <div className="text-center py-12 flex flex-col items-center">
                <LoaderCircle className="h-12 w-12 text-primary animate-spin mx-auto"/>
                <h3 className="font-headline text-2xl font-semibold mt-6">Waiting for Confirmation</h3>
                <p className="text-muted-foreground mt-2 max-w-md">We've sent your request to {selectedNurse?.fullName}. We'll notify you here as soon as they respond.</p>
                <Progress value={80} className="w-full max-w-sm mx-auto mt-8" />
                 <p className="text-sm text-muted-foreground mt-2">The request will expire in 15 minutes.</p>
            </div>
        );
      
      case 'confirmed':
        return (
             <div className="text-center py-12 flex flex-col items-center">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto"/>
                <h3 className="font-headline text-3xl font-semibold mt-6">Booking Confirmed!</h3>
                <p className="text-muted-foreground mt-2">{selectedNurse?.fullName} is confirmed for your appointment.</p>
                <Button className="mt-8" onClick={() => window.location.reload()}>
                    View in Dashboard
                </Button>
            </div>
        )
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      {renderContent()}
    </div>
  );
}
