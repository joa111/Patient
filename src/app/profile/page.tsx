

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy, Timestamp, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User as AuthUser } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User, Heart, Droplets, Calendar, Mail, Phone, ShieldAlert, FileText, LoaderCircle, AlertTriangle, Search, Briefcase, Clock, MapPin, Bell, LayoutDashboard } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs as ShadTabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FindNurse } from '@/components/find-nurse';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { Patient, ServiceRequest, MatchedNurse } from '@/types/service-request';
import { sendNotification } from '@/ai/flows/send-notification-flow';

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


function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType, label: string; value: string | undefined | string[] }) {
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
    <Card className="overflow-hidden shadow-xl border-primary/10">
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

      <CardContent className="p-4 md:p-6">
        <PatientTabs patient={patient} />
      </CardContent>
    </Card>
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
  return (
    <ShadTabs defaultValue="dashboard" className="w-full">
      <TabsList className="flex flex-col h-auto sm:flex-row sm:h-10 bg-primary/10">
        <TabsTrigger value="dashboard"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</TabsTrigger>
        <TabsTrigger value="overview"><User className="mr-2 h-4 w-4" />Overview</TabsTrigger>
        <TabsTrigger value="find-nurse"><Search className="mr-2 h-4 w-4" />New Request</TabsTrigger>
        <TabsTrigger value="history"><Calendar className="mr-2 h-4 w-4" />History</TabsTrigger>
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
       <TabsContent value="find-nurse" className="mt-6">
        <FindNurse />
      </TabsContent>
      <TabsContent value="history" className="mt-6">
        <HistoryTab patientId={patient.id} />
      </TabsContent>
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
          <div className="grid gap-4 md:grid-cols-2">
            {active.map(req => (<RequestCard key={req.id} request={req} />))}
          </div>
        ) : (
          <p className="text-muted-foreground">You have no active service requests.</p>
        )}
      </div>
       <Separator />
      <div>
        <h3 className="font-headline text-2xl font-semibold mb-4 text-primary">Upcoming Appointments</h3>
        {upcoming.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map(req => (<RequestCard key={req.id} request={req} />))}
          </div>
        ) : (
          <p className="text-muted-foreground">You have no upcoming appointments.</p>
        )}
      </div>
    </div>
  );
}

function HistoryTab({ patientId }: { patientId: string }) {
  const { serviceRequests, loading } = useServiceRequests(patientId);

  const pastRequests = serviceRequests.filter(req => {
    const reqDate = toSafeDate(req.serviceDetails.scheduledDateTime);
    if (!reqDate) return false;
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
          {pastRequests.map(req => <RequestCard key={req.id} request={req} />)}
      </div>
  );
}

function RequestCard({ request }: { request: ServiceRequest }) {
    const { toast } = useToast();

    const nurseName = request.matching.selectedNurseId 
        ? request.matching.availableNurses.find(n => n.nurseId === request.matching.selectedNurseId)?.fullName
        : "Finding Nurse...";
    
    const onNotify = async (type: 'confirmation' | 'en_route') => {
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
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="p-4">
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xl">{request.serviceDetails.type}</span>
                    <span className={`text-sm font-medium px-3 py-1 rounded-full bg-accent/20 text-accent-foreground`}>{request.status}</span>
                </CardTitle>
                <CardDescription>{scheduledTime}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="flex items-center text-muted-foreground mt-2">
                    <User className="mr-2 h-4 w-4" />
                    <span>{nurseName}</span>
                </div>
                 <div className="flex items-center text-muted-foreground mt-2">
                    <MapPin className="mr-2 h-4 w-4" />
                    <span>{request.serviceDetails.location.address}</span>
                </div>
                {request.status === 'confirmed' && (
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => onNotify('en_route')}>
                        <Bell className="mr-2 h-4 w-4" /> Notify Nurse I'm Ready
                    </Button>
                )}
                 {request.status === 'pending-response' && (
                     <div className="flex items-center text-amber-600 mt-4">
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>
                        <span>Waiting for nurse to respond...</span>
                     </div>
                )}
            </CardContent>
        </Card>
    )
}
