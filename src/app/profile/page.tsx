
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy, Timestamp, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User as AuthUser } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User, Heart, Droplets, Calendar, Mail, Phone, ShieldAlert, FileText, LoaderCircle, AlertTriangle, Search, Briefcase, Clock, MapPin, Bell, LayoutDashboard, FileClock, Info, Settings, UserCog, HeartPulse, SlidersHorizontal, CircleDollarSign } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs as ShadTabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FindNurse } from '@/components/find-nurse';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { Patient, ServiceRequest, MatchedNurse } from '@/types/service-request';
import { sendNotification } from '@/ai/flows/send-notification-flow';
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
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';


/**
 * Safely converts a Firestore Timestamp or a date-like object to a JavaScript Date.
 * @param dateValue The value to convert, which can be a Timestamp, a string, or an object with seconds/nanoseconds.
 * @returns A Date object or null if the input is invalid.
 */
function toSafeDate(dateValue: any): Date | null {
    if (!dateValue) {
        return null;
    }
    if (dateValue instanceof Date) {
        return dateValue;
    }
    // It's already a Firestore Timestamp
    if (dateValue.toDate) {
        return dateValue.toDate();
    }
    // It's a serialized object from Firestore (e.g., from server-side rendering)
    if (typeof dateValue === 'object' && dateValue.seconds !== undefined) {
        return new Date(dateValue.seconds * 1000);
    }
    // It's a string or a number (milliseconds)
    if (typeof dateValue === 'string' || typeof dateValue === 'number') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    return null;
}


function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType, label: string; value: string | undefined | string[] | number }) {
  if (!value && value !== 0) return null;
  const displayValue = Array.isArray(value) ? value.join(', ') : value;
  return (
    <div className="flex items-start space-x-4">
      <Icon className="h-5 w-5 mt-1 text-primary" />
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-md font-semibold">{displayValue}</p>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
    return (
        <Card className="overflow-hidden shadow-lg border-primary/10">
            <CardHeader className="bg-gradient-to-br from-primary/10 to-background p-6">
                <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:space-x-6">
                    <Skeleton className="h-24 w-24 rounded-full border-4 border-white" />
                    <div className="mt-4 sm:mt-0 space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <Skeleton className="h-10 w-full mb-6" />
                <div className="grid gap-8 md:grid-cols-2">
                    <div className="space-y-6">
                        <Skeleton className="h-6 w-1/2" />
                        <Separator />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                    <div className="space-y-6">
                        <Skeleton className="h-6 w-1/2" />
                        <Separator />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const patientId = searchParams.get('id');

  useEffect(() => {
    if (!patientId) {
      setError("No patient ID provided in the URL.");
      setLoading(false);
      return;
    }

    const patientRef = doc(db, 'patients', patientId);
    const unsubscribe = onSnapshot(patientRef, (docSnap) => {
      if (docSnap.exists()) {
        setPatient({ id: docSnap.id, ...docSnap.data() } as Patient);
        setError(null);
      } else {
        setError(`No patient record found for ID: ${patientId}. Your profile might be creating.`);
        setPatient(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setError("Failed to fetch patient data.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [patientId]);
  

  if (loading) return <ProfileSkeleton />;
  if (error) return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle /> Error
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p>{error}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Please check that a patient with the correct ID exists in your Firestore 'patients' collection and that your security rules allow read access.
        </p>
        <Button onClick={() => router.push('/login')} className="mt-4">Back to Login</Button>
      </CardContent>
    </Card>
  );
  if (!patient) return <ProfileSkeleton />;

  return (
      <PatientTabs patient={patient} />
  );
}


export default function ProfilePage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthUser(user);
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);


  const handleLogout = async () => {
    await auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Verifying session...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background shadow-sm sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center space-x-2">
            <Heart className="h-7 w-7 text-primary" />
            <span className="font-headline text-2xl font-bold text-primary">MegCare</span>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Log Out</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8">
        <Suspense fallback={<ProfileSkeleton />}>
          <ProfilePageContent />
        </Suspense>
      </main>
    </div>
  );
}

function PatientTabs({ patient }: { patient: Patient }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  return (
    <ShadTabs defaultValue="dashboard" className="w-full" onValueChange={setActiveTab}>
      <Card className="overflow-hidden shadow-xl border-primary/10">
        {activeTab === 'dashboard' ? (
          <CardHeader className="bg-gradient-to-br from-primary/10 to-background p-4 md:p-6">
            <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:space-x-6">
              <Avatar className="h-24 w-24 border-4 border-white shadow-md">
                <AvatarImage src={patient.avatarUrl} alt={`Patient ${patient.name}`} data-ai-hint="person portrait" />
                <AvatarFallback className="text-3xl">{patient.name?.charAt(0) ?? 'P'}</AvatarFallback>
              </Avatar>
              <div className="mt-4 sm:mt-0">
                <CardTitle className="font-headline text-2xl md:text-3xl text-primary">{patient.name}</CardTitle>
                <CardDescription className="mt-1">Patient ID: {patient.id}</CardDescription>
              </div>
            </div>
          </CardHeader>
        ) : (
            <CardHeader className="p-4 md:p-6">
                 <CardTitle className="font-headline text-2xl md:text-3xl text-primary capitalize">{activeTab.replace('-',' ')}</CardTitle>
            </CardHeader>
        )}
        <CardContent className="p-4 pb-20 md:p-6 md:pb-6">
           <TabsList className="md:flex md:flex-row md:h-10 md:bg-primary/10 fixed bottom-0 left-0 right-0 z-50 flex h-16 justify-around bg-background shadow-[0_-1px_3px_rgba(0,0,0,0.1)] md:relative md:justify-center md:shadow-none md:rounded-md">
            <TabsTrigger value="dashboard" className="flex-col px-2 h-full md:flex-row md:w-auto md:h-auto"><LayoutDashboard className="mr-0 md:mr-2 h-5 w-5" />Dashboard</TabsTrigger>
            <TabsTrigger value="overview" className="flex-col px-2 h-full md:flex-row md:w-auto md:h-auto"><User className="mr-0 md:mr-2 h-5 w-5" />Overview</TabsTrigger>
            <TabsTrigger value="new-request" className="flex-col px-2 h-full md:flex-row md:w-auto md:h-auto"><Search className="mr-0 md:mr-2 h-5 w-5" />New Request</TabsTrigger>
            <TabsTrigger value="history" className="flex-col px-2 h-full md:flex-row md:w-auto md:h-auto"><FileClock className="mr-0 md:mr-2 h-5 w-5" />History</TabsTrigger>
            <TabsTrigger value="settings" className="flex-col px-2 h-full md:flex-row md:w-auto md:h-auto"><Settings className="mr-0 md:mr-2 h-5 w-5" />Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-6">
            <DashboardTab patientId={patient.id} />
          </TabsContent>
          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-6">
                <h3 className="font-headline text-xl font-semibold">Personal Information</h3>
                <Separator />
                <InfoItem icon={Calendar} label="Date of Birth" value={patient.dob} />
                <InfoItem icon={Phone} label="Contact Number" value={patient.contact} />
                <InfoItem icon={Mail} label="Email Address" value={patient.email} />
              </div>
              <div className="space-y-6">
                <h3 className="font-headline text-xl font-semibold">Medical Details</h3>
                <Separator />
                <InfoItem icon={Droplets} label="Blood Type" value={patient.bloodType} />
                <InfoItem icon={ShieldAlert} label="Allergies" value={patient.allergies} />
                <InfoItem icon={User} label="Primary Physician" value={patient.primaryPhysician} />
              </div>
            </div>
          </TabsContent>
           <TabsContent value="new-request" className="mt-6">
            <FindNurse />
          </TabsContent>
          <TabsContent value="history" className="mt-6">
            <HistoryTab patientId={patient.id} />
          </TabsContent>
          <TabsContent value="settings" className="mt-6">
            <SettingsTab patient={patient} />
          </TabsContent>
        </CardContent>
      </Card>
    </ShadTabs>
  )
}


function useServiceRequests(patientId: string) {
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) {
        setLoading(false);
        return;
    };
    
    const q = query(
      collection(db, 'serviceRequests'),
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedRequests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as ServiceRequest[];
      setServiceRequests(fetchedRequests);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching service requests:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [patientId]);

  return { serviceRequests, loading };
}

function DashboardTab({ patientId }: { patientId: string }) {
  const { serviceRequests, loading } = useServiceRequests(patientId);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);

  const { upcoming, active } = serviceRequests.reduce((acc, req) => {
    const reqDate = toSafeDate(req.serviceDetails.scheduledDateTime);
    if (!reqDate) return acc;
    
    const now = new Date();
    
    if ((req.status === 'confirmed') && reqDate > now) {
        acc.upcoming.push(req);
    } else if (['finding-nurses', 'pending-response', 'in-progress'].includes(req.status)) {
        acc.active.push(req);
    }
    return acc;
  }, { upcoming: [] as ServiceRequest[], active: [] as ServiceRequest[] });


  if (loading) {
    return (
      <div className="space-y-8">
        {[...Array(2)].map((_, i) => (
          <div key={i}>
            <Skeleton className="h-8 w-48 mb-4" />
            <div className="space-y-4"><Skeleton className="h-24 w-full" /></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-headline text-2xl font-semibold mb-4 text-primary">Active Requests</h3>
        {active.length > 0 ? (
          <div className="space-y-4">
            {active.map(req => (<RequestCard key={req.id} request={req} onSelect={() => setSelectedRequest(req)} />))}
          </div>
        ) : (
          <p className="text-muted-foreground">You have no active service requests.</p>
        )}
      </div>
       <Separator />
      <div>
        <h3 className="font-headline text-2xl font-semibold my-4 text-primary">Upcoming Appointments</h3>
        {upcoming.length > 0 ? (
          <div className="space-y-4">
            {upcoming.map(req => (<RequestCard key={req.id} request={req} onSelect={() => setSelectedRequest(req)} />))}
          </div>
        ) : (
          <p className="text-muted-foreground">You have no upcoming appointments.</p>
        )}
      </div>
      {selectedRequest && (
        <RequestDetailsDialog 
          request={selectedRequest}
          onOpenChange={(isOpen) => !isOpen && setSelectedRequest(null)}
        />
      )}
    </div>
  );
}

function HistoryTab({ patientId }: { patientId: string }) {
  const { serviceRequests, loading } = useServiceRequests(patientId);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);

  const pastRequests = serviceRequests.filter(req => {
    return ['completed', 'cancelled', 'declined'].includes(req.status);
  });

  if (loading) {
    return (
        <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
    );
  }

  if (pastRequests.length === 0) {
      return <p className="text-muted-foreground text-center py-8">No past service requests found.</p>;
  }

  return (
      <div className="space-y-4">
          {pastRequests.map(req => <RequestCard key={req.id} request={req} onSelect={() => setSelectedRequest(req)} />)}
          {selectedRequest && (
            <RequestDetailsDialog 
              request={selectedRequest}
              onOpenChange={(isOpen) => !isOpen && setSelectedRequest(null)}
            />
           )}
      </div>
  );
}

function RequestCard({ request, onSelect }: { request: ServiceRequest, onSelect: () => void }) {
    const scheduledDate = toSafeDate(request.serviceDetails.scheduledDateTime);
    const scheduledTime = scheduledDate ? format(scheduledDate, "eee, MMM d, yyyy") : "Not scheduled";
    const statusColors = {
        'completed': 'bg-green-100 text-green-800 border-green-200',
        'cancelled': 'bg-red-100 text-red-800 border-red-200',
        'declined': 'bg-red-100 text-red-800 border-red-200',
        'confirmed': 'bg-blue-100 text-blue-800 border-blue-200',
        'pending-response': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        'finding-nurses': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        'in-progress': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    };
    const statusColor = statusColors[request.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800 border-gray-200';

    return (
        <Card className="hover:shadow-md transition-shadow border rounded-lg overflow-hidden">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                     <div className="flex flex-col items-center justify-center bg-muted/50 p-3 rounded-md h-16 w-16">
                         <span className="font-bold text-primary text-xl">{scheduledDate ? format(scheduledDate, 'd') : '--'}</span>
                         <span className="text-xs text-muted-foreground">{scheduledDate ? format(scheduledDate, 'MMM') : 'N/A'}</span>
                     </div>
                     <div className="flex-1">
                        <p className="font-semibold capitalize truncate">{request.serviceDetails.type.replace('-', ' ')}</p>
                        <p className="text-sm text-muted-foreground">{scheduledTime}</p>
                     </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusColor}`}>{request.status}</span>
                    <Button variant="outline" size="sm" onClick={onSelect}>
                        <Info className="mr-2 h-4 w-4" />Details
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function RequestDetailsDialog({ request, onOpenChange }: { request: ServiceRequest, onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();

    const nurseName = request.matching.selectedNurseId 
        ? request.matching.availableNurses.find(n => n.nurseId === request.matching.selectedNurseId)?.fullName
        : "Finding Nurse...";
    
    const onNotify = async (type: 'en_route') => {
        toast({ title: 'Sending notification...' });
        const result = await sendNotification({ 
            requestId: request.id, 
            type: type,
            userId: request.patientId,
        });
        if (result.success) {
            toast({ title: 'Notification Sent!', description: result.message });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
    };
    
    const scheduledDate = toSafeDate(request.serviceDetails.scheduledDateTime);
    const scheduledTime = scheduledDate ? format(scheduledDate, "EEEE, MMMM do, yyyy 'at' p") : "Not scheduled";

    return (
       <AlertDialog open={true} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-2xl">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-2xl capitalize">{request.serviceDetails.type.replace('-', ' ')}</AlertDialogTitle>
                    <AlertDialogDescription>{scheduledTime}</AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                           <h4 className="font-semibold text-primary">Details</h4>
                           <InfoItem icon={User} label="Assigned Nurse" value={nurseName} />
                           <InfoItem icon={MapPin} label="Location" value={request.serviceDetails.location.address} />
                           <InfoItem icon={Clock} label="Duration" value={`${request.serviceDetails.duration} hour(s)`} />
                           {request.serviceDetails.specialRequirements && <InfoItem icon={FileText} label="Special Requirements" value={request.serviceDetails.specialRequirements} />}
                        </div>
                         <div className="space-y-4">
                            <h4 className="font-semibold text-primary">Status & Actions</h4>
                            <InfoItem icon={Info} label="Status" value={request.status} />
                             {request.status === 'confirmed' && (
                                <Button variant="outline" size="sm" className="w-full" onClick={() => onNotify('en_route')}>
                                    <Bell className="mr-2 h-4 w-4" /> Notify Nurse I'm Ready
                                </Button>
                            )}
                             {request.status === 'pending-response' && (
                                 <div className="flex items-center text-amber-600 mt-2 text-sm font-medium p-3 bg-amber-50 rounded-md">
                                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>
                                    <span>Awaiting nurse response...</span>
                                 </div>
                            )}
                         </div>
                    </div>
                    <Separator />
                     <div className="space-y-4">
                        <h4 className="font-semibold text-primary">Payment</h4>
                        <InfoItem icon={Info} label="Estimated Cost" value={`₹${request.payment.nursePayment.amount.toFixed(2)}`} />
                        <InfoItem icon={Info} label="Platform Fee" value={`₹${request.payment.platformFee.toFixed(2)}`} />
                    </div>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Close</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

const settingsSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  contact: z.string().min(10, 'Enter a valid contact number.'),
  bloodType: z.string().optional(),
  allergies: z.string().optional(),
  primaryPhysician: z.string().optional(),
  preferences: z.object({
    maxDistance: z.number().min(1).max(50),
    priceRange: z.object({
      min: z.number(),
      max: z.number(),
    }).refine(data => data.min < data.max, {
      message: "Min price must be less than max price",
      path: ["min"],
    }),
    preferredSpecialties: z.array(z.string()),
  }),
});

function SettingsTab({ patient }: { patient: Patient }) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof settingsSchema>>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            name: patient.name,
            contact: patient.contact,
            bloodType: patient.bloodType,
            allergies: patient.allergies?.join(', '),
            primaryPhysician: patient.primaryPhysician,
            preferences: {
                maxDistance: patient.preferences?.maxDistance ?? 10,
                priceRange: patient.preferences?.priceRange ?? { min: 500, max: 2000 },
                preferredSpecialties: patient.preferences?.preferredSpecialties ?? [],
            },
        },
    });
    
    const onSubmit = async (values: z.infer<typeof settingsSchema>) => {
        setIsLoading(true);
        try {
            const patientRef = doc(db, 'patients', patient.id);
            const updatedData = {
                ...values,
                allergies: values.allergies?.split(',').map(s => s.trim()).filter(Boolean) || [],
            };
            await updateDoc(patientRef, updatedData);
            toast({ title: "Success!", description: "Your settings have been updated." });
        } catch (error: any) {
            console.error("Error updating settings:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not update settings. " + error.message });
        } finally {
            setIsLoading(false);
        }
    };
    
    const serviceTypes = ["general", "wound-care", "injection"];

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center"><UserCog className="mr-2 h-6 w-6 text-primary"/> Profile Information</CardTitle>
                    <CardDescription>Manage your personal and medical details.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                     <FormField control={form.control} name="name" render={({ field }) => (
                       <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="contact" render={({ field }) => (
                       <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid md:grid-cols-3 gap-6">
                        <FormField control={form.control} name="dob" render={({ field }) => (
                           <FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input {...field} value={patient.dob} disabled /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="bloodType" render={({ field }) => (
                           <FormItem><FormLabel>Blood Type</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                         <FormField control={form.control} name="primaryPhysician" render={({ field }) => (
                           <FormItem><FormLabel>Primary Physician</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                     <FormField control={form.control} name="allergies" render={({ field }) => (
                       <FormItem><FormLabel>Allergies (comma-separated)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center"><SlidersHorizontal className="mr-2 h-6 w-6 text-primary"/> Matching Preferences</CardTitle>
                    <CardDescription>Customize how we find the best nurses for you.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-6">
                    <FormField control={form.control} name="preferences.maxDistance" render={({ field }) => (
                       <FormItem>
                         <FormLabel>Max Distance: {field.value} km</FormLabel>
                         <FormControl><Slider min={1} max={50} step={1} value={[field.value]} onValueChange={(vals) => field.onChange(vals[0])} /></FormControl>
                       </FormItem>
                    )} />
                    
                    <Controller
                        name="preferences.priceRange"
                        control={form.control}
                        render={({ field: { value, onChange } }) => (
                            <FormItem>
                                <FormLabel>Price Range (per hour): ₹{value.min} - ₹{value.max}</FormLabel>
                                <FormControl>
                                    <Slider
                                        min={100} max={5000} step={100}
                                        value={[value.min, value.max]}
                                        onValueChange={([min, max]) => onChange({ min, max })}
                                        minStepsBetweenThumbs={1}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                     <FormField control={form.control} name="preferences.preferredSpecialties" render={() => (
                        <FormItem>
                             <FormLabel>Preferred Services</FormLabel>
                             <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                             {serviceTypes.map((item) => (
                                <FormField
                                    key={item}
                                    control={form.control}
                                    name="preferences.preferredSpecialties"
                                    render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                        <Checkbox
                                            checked={field.value?.includes(item)}
                                            onCheckedChange={(checked) => {
                                            return checked
                                                ? field.onChange([...field.value, item])
                                                : field.onChange(field.value?.filter((value) => value !== item)
                                                )
                                            }}
                                        />
                                        </FormControl>
                                        <FormLabel className="font-normal capitalize">{item.replace('-', ' ')}</FormLabel>
                                    </FormItem>
                                    )}
                                />
                                ))}
                             </div>
                             <FormMessage />
                        </FormItem>
                     )} />
                  </CardContent>
                </Card>

                <Button type="submit" className="w-full md:w-auto" disabled={isLoading}>
                    {isLoading ? <LoaderCircle className="animate-spin" /> : 'Save Settings'}
                </Button>
            </form>
        </Form>
    );
}
