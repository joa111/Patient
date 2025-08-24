'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User, Heart, Droplets, Calendar, Mail, Phone, ShieldAlert, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType, label: string; value: string }) {
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

export default function ProfilePage() {
  const router = useRouter();

  const handleLogout = () => {
    // In a real app, you would clear session/token here
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-muted/30">
        <header className="bg-background shadow-sm">
            <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
                <div className="flex items-center space-x-2">
                    <Heart className="h-7 w-7 text-primary" />
                    <span className="font-headline text-2xl font-bold text-primary">MediPass</span>
                </div>
                <Button variant="ghost" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log Out
                </Button>
            </div>
        </header>

      <main className="container mx-auto p-4 md:p-8">
        <Card className="overflow-hidden shadow-lg border-primary/10">
            <CardHeader className="bg-gradient-to-br from-primary/10 to-background p-6">
                <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:space-x-6">
                    <Avatar className="h-24 w-24 border-4 border-white shadow-md">
                        <AvatarImage src="https://placehold.co/150x150.png" alt="Patient Jane Doe" data-ai-hint="person portrait"/>
                        <AvatarFallback className="text-3xl">JD</AvatarFallback>
                    </Avatar>
                    <div className="mt-4 sm:mt-0">
                        <CardTitle className="font-headline text-3xl text-primary">Jane Doe</CardTitle>
                        <CardDescription className="mt-1">Patient ID: MP-12345678</CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-6">
              <Tabs />
            </CardContent>
        </Card>
      </main>
    </div>
  );
}

import { Tabs as ShadTabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function Tabs() {
  return (
    <ShadTabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-2 bg-muted">
        <TabsTrigger value="overview">
            <User className="mr-2 h-4 w-4" />
            Overview
        </TabsTrigger>
        <TabsTrigger value="records">
            <FileText className="mr-2 h-4 w-4" />
            Medical Records
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-6">
        <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-6">
                <h3 className="font-headline text-xl font-semibold">Personal Information</h3>
                <Separator />
                <InfoItem icon={Calendar} label="Date of Birth" value="January 1, 1985" />
                <InfoItem icon={Phone} label="Contact Number" value="+1 (555) 123-4567" />
                <InfoItem icon={Mail} label="Email Address" value="jane.doe@example.com" />
            </div>
            <div className="space-y-6">
                <h3 className="font-headline text-xl font-semibold">Medical Details</h3>
                <Separator />
                <InfoItem icon={Droplets} label="Blood Type" value="O+" />
                <InfoItem icon={ShieldAlert} label="Allergies" value="Peanuts, Penicillin" />
                <InfoItem icon={User} label="Primary Physician" value="Dr. Emily Carter" />
            </div>
        </div>
      </TabsContent>
      <TabsContent value="records" className="mt-6">
         <h3 className="font-headline text-xl font-semibold mb-4">Recent Appointments</h3>
         <div className="space-y-4">
            <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <p className="font-semibold">Annual Check-up with Dr. Carter</p>
                <p className="text-sm text-muted-foreground">Date: July 15, 2024</p>
                <p className="text-sm mt-2">Status: Completed. Notes available.</p>
            </div>
            <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <p className="font-semibold">Dental Cleaning</p>
                <p className="text-sm text-muted-foreground">Date: May 20, 2024</p>
                <p className="text-sm mt-2">Status: Completed. No issues reported.</p>
            </div>
         </div>
      </TabsContent>
    </ShadTabs>
  )
}
