
'use client';

import { useState, useEffect, useMemo } from 'react';
import { onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { LoaderCircle, MapPin, Briefcase, AlertTriangle, Star, CheckCircle, ArrowRight, CalendarIcon, ClockIcon, ClipboardPlus, User, Plus, Search, X } from 'lucide-react';
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
import { createServiceRequest, offerServiceToNurse, cancelServiceRequest } from '@/lib/matching-service';


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

  const [step, setStep] = useState<'request' | 'waiting' | 'confirmed' | 'failed'>('request');
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [serviceRequestInput, setServiceRequestInput] = useState<ServiceRequestInput | null>(null);
  const [serviceRequestId, setServiceRequestId] = useState<string | null>(null);
  const [bestMatch, setBestMatch] = useState<MatchedNurse | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

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

  const findAndRequestBestMatch = async (requestData: z.infer<typeof serviceRequestSchema>) => {
      if (!patient || !serviceRequestInput?.patientLocation) {
        setError("Patient data or location is missing.");
        return;
      }
      setLoading(true);
      setStep('waiting');

      const fullRequestInput: ServiceRequestInput = {
        ...requestData,
        patientLocation: serviceRequestInput.patientLocation
      };
      setServiceRequestInput(fullRequestInput);

      try {
        const { requestId, bestMatch } = await createServiceRequest(patient, fullRequestInput);
        
        if (!bestMatch) {
            setError("No available nurses found for your request at this time. Please try again later.");
            setStep('failed');
            setLoading(false);
            return;
        }
        
        setServiceRequestId(requestId);
        setBestMatch(bestMatch);

        await offerServiceToNurse(requestId, bestMatch.nurseId, bestMatch.estimatedCost);

        toast({
            title: "Offer Sent!",
            description: `We've sent your request to the best-matched nurse, ${bestMatch.fullName}. You will be notified of their response.`,
        });

      } catch (err: any) {
        console.error("Error in automatch process:", err);
        setError(`Failed to send request: ${err.message}. Please try again.`);
        setStep('failed'); 
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
                    description: `${bestMatch?.fullName || 'The nurse'} has accepted your request.`,
                    variant: 'default',
                });
                setStep('confirmed');
                setLoading(false);
            } else if (data.status === 'declined') {
                 toast({
                    variant: "destructive",
                    title: "Nurse Unavailable",
                    description: `Unfortunately, your request was not accepted. Please try again.`,
                });
                setError("The nurse was unavailable. Please try finding another match.");
                setStep('failed');
                setLoading(false);
            } else if (data.status === 'pending-response' && data.matching.responseDeadline) {
                const deadline = data.matching.responseDeadline.toDate();
                if (new Date() > deadline) {
                    toast({
                        variant: "destructive",
                        title: "Request Expired",
                        description: "The nurse did not respond in time. Please try making a new request.",
                    });
                    setError("The nurse did not respond in time. Please try finding another match.");
                    setStep('failed');
                    setLoading(false);
                }
            }
        }
    });

    return () => unsubscribe();
  }, [serviceRequestId, bestMatch, toast]);
  
  const handleCancelSearch = async () => {
    if (!serviceRequestId) return;
    setIsCancelling(true);
    try {
        await cancelServiceRequest(serviceRequestId);
        toast({
            title: "Search Cancelled",
            description: "Your service request has been cancelled.",
        });
        setStep('request');
        setServiceRequestId(null);
        setBestMatch(null);
        setError(null);
    } catch (err: any) {
        console.error("Failed to cancel search:", err);
        toast({
            variant: "destructive",
            title: "Cancellation Failed",
            description: err.message,
        });
    } finally {
        setIsCancelling(false);
    }
  };


  const renderContent = () => {
    if (loading && step === 'request') {
       return <div className="flex justify-center items-center h-48"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /><p className="ml-4">Loading your information...</p></div>;
    }
    if (error && step !== 'failed') {
        return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
    }

    switch (step) {
      case 'request':
        return (
          <Card className="border-0 shadow-none">
            <CardContent className="p-0">
                <Form {...form}>
                <form onSubmit={form.handleSubmit(findAndRequestBestMatch)} className="space-y-8">
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
                    {loading ? <LoaderCircle className="animate-spin" /> : <> <Search className="mr-2 h-5 w-5"/>Find Best Match</>}
                    </Button>
                </form>
                </Form>
            </CardContent>
          </Card>
        );
      
      case 'waiting':
        return (
            <div className="text-center py-12 flex flex-col items-center">
                <LoaderCircle className="h-12 w-12 text-primary animate-spin mx-auto"/>
                <h3 className="font-headline text-2xl font-semibold mt-6">Finding & Contacting Best Match</h3>
                <p className="text-muted-foreground mt-2 max-w-md">We've sent your request to {bestMatch?.fullName || 'the best available nurse'}. We'll notify you here as soon as they respond.</p>
                <Progress value={80} className="w-full max-w-sm mx-auto mt-8" />
                 <p className="text-sm text-muted-foreground mt-2">The request will expire in 15 minutes.</p>
                 <Button variant="ghost" className="mt-8" onClick={handleCancelSearch} disabled={isCancelling}>
                    {isCancelling ? <LoaderCircle className="animate-spin" /> : <><X className="mr-2 h-4 w-4"/>Cancel Search</>}
                 </Button>
            </div>
        );
      
      case 'confirmed':
        return (
             <div className="text-center py-12 flex flex-col items-center">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto"/>
                <h3 className="font-headline text-3xl font-semibold mt-6">Booking Confirmed!</h3>
                <p className="text-muted-foreground mt-2">{bestMatch?.fullName} is confirmed for your appointment.</p>
                <Button className="mt-8" onClick={() => window.location.reload()}>
                    View in Dashboard
                </Button>
            </div>
        );
        
      case 'failed':
         return (
            <div className="text-center py-12 flex flex-col items-center">
                <AlertTriangle className="h-16 w-16 text-destructive mx-auto"/>
                <h3 className="font-headline text-3xl font-semibold mt-6">Unable to Find Nurse</h3>
                <p className="text-muted-foreground mt-2 max-w-md">{error || "Something went wrong. Please try again."}</p>
                <Button variant="outline" className="mt-8" onClick={() => { setError(null); setStep('request'); }}>
                    Try Again
                </Button>
            </div>
        );
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      {renderContent()}
    </div>
  );
}

    
