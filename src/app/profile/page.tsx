'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User, Heart, Droplets, Calendar, Mail, Phone, ShieldAlert, FileText, LoaderCircle, AlertTriangle, Search, Briefcase, Clock, MapPin } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs as ShadTabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FindNurse } from '@/components/find-nurse';

interface PatientData {
  id: string;
  name: string;
  dob: string;
  contact: string;
  email: string;
  bloodType: string;
  allergies: string[];
  primaryPhysician: string;
  avatarUrl: string;
}

interface AppointmentData {
    id: string;
    nurseName: string;
    appointmentTime: string;
    status: string;
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType, label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start space-x-4">
      <Icon className="h-5 w-5 mt-1 text-primary" />
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-md font-semibold">{value}</p>
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
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const patientId = searchParams.get('id');

  useEffect(() => {
    async function fetchPatientData() {
      if (!patientId) {
        setError("No patient ID provided in the URL.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const patientRef = doc(db, 'patients', patientId);
        const patientSnap = await getDoc(patientRef);

        if (patientSnap.exists()) {
          setPatient({ id: patientSnap.id, ...patientSnap.data() } as PatientData);
        } else {
          setError(`No patient record found for ID: ${patientId}.`);
        }
      } catch (err) {
        console.error("Firestore Error:", err);
        setError("Failed to fetch patient data. Make sure Firestore is set up correctly and security rules allow access.");
      } finally {
        setLoading(false);
      }
    }

    fetchPatientData();
  }, [patientId, router]);

  const handleLogout = () => {
    router.push('/login');
  };

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
  if (!patient) return null;

  return (
    <Card className="overflow-hidden shadow-lg border-primary/10">
      <CardHeader className="bg-gradient-to-br from-primary/10 to-background p-6">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:space-x-6">
          <Avatar className="h-24 w-24 border-4 border-white shadow-md">
            <AvatarImage src={patient.avatarUrl} alt={`Patient ${patient.name}`} data-ai-hint="person portrait" />
            <AvatarFallback className="text-3xl">{patient.name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="mt-4 sm:mt-0">
            <CardTitle className="font-headline text-3xl text-primary">{patient.name}</CardTitle>
            <CardDescription className="mt-1">Patient ID: {patient.id}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <PatientTabs patient={patient} />
      </CardContent>
    </Card>
  );
}


export default function ProfilePage() {
  const router = useRouter();

  const handleLogout = () => {
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center space-x-2">
            <Heart className="h-7 w-7 text-primary" />
            <span className="font-headline text-2xl font-bold text-primary">MegCare</span>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
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

function PatientTabs({ patient }: { patient: PatientData }) {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);

  useEffect(() => {
    async function fetchAppointments() {
      try {
        setLoadingAppointments(true);
        const q = query(
          collection(db, 'appointments'),
          where('patientId', '==', patient.id),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const fetchedAppointments = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as AppointmentData[];
        setAppointments(fetchedAppointments);
      } catch (error) {
        console.error("Error fetching appointments:", error);
        // Handle error, e.g., show a toast message
      } finally {
        setLoadingAppointments(false);
      }
    }

    fetchAppointments();
  }, [patient.id]);

  return (
    <ShadTabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-3 bg-muted">
        <TabsTrigger value="overview">
          <User className="mr-2 h-4 w-4" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="records">
          <Calendar className="mr-2 h-4 w-4" />
          Past Appointments
        </TabsTrigger>
         <TabsTrigger value="find-nurse">
          <Search className="mr-2 h-4 w-4" />
          Find a Nurse
        </TabsTrigger>
      </TabsList>
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
            <InfoItem icon={ShieldAlert} label="Allergies" value={patient.allergies?.join(', ')} />
            <InfoItem icon={User} label="Primary Physician" value={patient.primaryPhysician} />
          </div>
        </div>
      </TabsContent>
      <TabsContent value="records" className="mt-6">
        <h3 className="font-headline text-xl font-semibold mb-4">Your Booked Appointments</h3>
        <div className="space-y-4">
          {loadingAppointments ? (
             <div className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                </div>
            </div>
          ) : appointments.length > 0 ? (
            appointments.map((appt) => (
              <div key={appt.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors flex items-center space-x-4">
                 <div className="p-3 bg-primary/10 rounded-full">
                    <Briefcase className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <p className="font-semibold text-primary">Appointment with {appt.nurseName}</p>
                    <p className="text-sm text-muted-foreground flex items-center mt-1">
                        <Clock className="mr-2 h-4 w-4" />
                        {appt.appointmentTime}
                    </p>
                    <p className="text-sm mt-1">Status: <span className="font-medium text-accent-foreground">{appt.status}</span></p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">You have not booked any appointments yet.</p>
          )}
        </div>
      </TabsContent>
       <TabsContent value="find-nurse" className="mt-6">
        <FindNurse />
      </TabsContent>
    </ShadTabs>
  )
}
