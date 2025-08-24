'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LoaderCircle, KeyRound, Smartphone, User, Calendar } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const contactSchema = z.object({
  contact: z.string().min(1, 'Please enter your email or phone number.').refine(
    (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      return emailRegex.test(value) || phoneRegex.test(value);
    },
    {
      message: 'Please enter a valid email or phone number (e.g., +1... for phone).',
    }
  ),
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits.'),
});

const signUpSchema = z.object({
    name: z.string().min(2, 'Please enter your full name.'),
    dob: z.string().refine((val) => /^\d{4}-\d{2}-\d{2}$/.test(val), {
        message: "Please use YYYY-MM-DD format for date of birth.",
    }),
});


function ContactStep({ onContactSubmit, isLoading }: { onContactSubmit: (values: z.infer<typeof contactSchema>) => void; isLoading: boolean; }) {
  const form = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { contact: '' },
  });

  return (
    <>
      <CardHeader>
        <CardTitle className="font-headline">Patient Login or Sign Up</CardTitle>
        <CardDescription>
          Enter your email or phone number to begin. We'll check if you have an account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onContactSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email or Phone Number</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input placeholder="e.g., name@example.com or +15551234567" {...field} className="pl-10" />
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                        <Smartphone className="h-5 w-5" />
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading} style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
              {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </form>
        </Form>
      </CardContent>
    </>
  );
}

function OtpStep({ contactInfo, onOtpSubmit, onBack, isLoading }: { contactInfo: string, onOtpSubmit: (values: z.infer<typeof otpSchema>) => void, onBack: () => void, isLoading: boolean }) {
  const form = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  return (
     <>
        <CardHeader>
          <CardTitle className="font-headline">Enter OTP</CardTitle>
          <CardDescription>
            A 6-digit code was sent to <span className="font-semibold text-primary">{contactInfo}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onOtpSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>One-Time Password</FormLabel>
                    <FormControl>
                     <div className="relative">
                        <Input placeholder="_ _ _ _ _ _" {...field} className="pl-10 text-lg tracking-[0.5em] text-center" maxLength={6} />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                          <KeyRound className="h-5 w-5" />
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                Verify & Login
              </Button>
               <Button variant="link" size="sm" className="w-full" onClick={onBack}>
                Use a different email or phone number
              </Button>
            </form>
          </Form>
        </CardContent>
      </>
  );
}

function SignUpStep({ contactInfo, onSignUpSubmit, onBack, isLoading }: { contactInfo: string, onSignUpSubmit: (values: z.infer<typeof signUpSchema>) => void, onBack: () => void, isLoading: boolean }) {
    const form = useForm<z.infer<typeof signUpSchema>>({
        resolver: zodResolver(signUpSchema),
        defaultValues: { name: '', dob: '' },
    });

    return (
        <>
            <CardHeader>
                <CardTitle className="font-headline">Create Your Account</CardTitle>
                <CardDescription>
                    We don't have a record for <span className="font-semibold text-primary">{contactInfo}</span>. Please complete your profile.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSignUpSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input placeholder="e.g., Jane Doe" {...field} className="pl-10" />
                                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                                                <User className="h-5 w-5" />
                                            </div>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="dob"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Date of Birth</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input placeholder="YYYY-MM-DD" {...field} className="pl-10" />
                                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                                                <Calendar className="h-5 w-5" />
                                            </div>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            Create Account & Login
                        </Button>
                        <Button variant="link" size="sm" className="w-full" onClick={onBack}>
                            Back
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </>
    );
}


export function AuthForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<'contact' | 'otp' | 'signup'>('contact');
  const [contactInfo, setContactInfo] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleContactSubmit(values: z.infer<typeof contactSchema>) {
    setIsLoading(true);
    const contactValue = values.contact;
    setContactInfo(contactValue);
    const isEmail = contactValue.includes('@');

    const patientsRef = collection(db, 'patients');
    const q = query(patientsRef, where(isEmail ? 'email' : 'contact', '==', contactValue));

    try {
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setStep('signup');
      } else {
        const patientDoc = querySnapshot.docs[0];
        setPatientId(patientDoc.id);
        setStep('otp');
        toast({
          title: 'OTP Sent',
          description: `A 6-digit code has been sent to ${values.contact}. (Use 123456 to login)`,
        });
      }
    } catch (error) {
      console.error("Error fetching patient:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to verify patient. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOtpSubmit(values: z.infer<typeof otpSchema>) {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (values.otp === '123456' && patientId) {
      toast({
        title: 'Login Successful',
        description: 'Redirecting to your profile...',
      });
      router.push(`/profile?id=${patientId}`);
    } else {
      toast({
        variant: 'destructive',
        title: 'Invalid OTP',
        description: 'The code you entered is incorrect. Please try again.',
      });
    }
    setIsLoading(false);
  }

  async function handleSignUpSubmit(values: z.infer<typeof signUpSchema>) {
    setIsLoading(true);
    const isEmail = contactInfo.includes('@');

    try {
        const newPatientData = {
            name: values.name,
            dob: values.dob,
            email: isEmail ? contactInfo : '',
            contact: !isEmail ? contactInfo : '',
            bloodType: '',
            allergies: [],
            primaryPhysician: '',
            avatarUrl: `https://placehold.co/256x256.png`,
            appointments: [],
        };
        
        const docRef = await addDoc(collection(db, 'patients'), newPatientData);

        toast({
            title: 'Account Created!',
            description: 'Redirecting to your new profile...',
        });
        
        router.push(`/profile?id=${docRef.id}`);

    } catch (error) {
        console.error("Error creating patient:", error);
        toast({
            variant: 'destructive',
            title: 'Sign Up Failed',
            description: 'Could not create your account. Please try again.',
        });
    } finally {
        setIsLoading(false);
    }
  }

  const goBack = () => {
    setStep('contact');
    setIsLoading(false);
  }

  return (
    <Card className="w-full shadow-lg border-primary/20">
      {step === 'contact' && (
        <ContactStep onContactSubmit={handleContactSubmit} isLoading={isLoading} />
      )}
      {step === 'otp' && (
        <OtpStep 
          contactInfo={contactInfo}
          onOtpSubmit={handleOtpSubmit}
          onBack={goBack}
          isLoading={isLoading}
        />
      )}
      {step === 'signup' && (
        <SignUpStep
          contactInfo={contactInfo}
          onSignUpSubmit={handleSignUpSubmit}
          onBack={goBack}
          isLoading={isLoading}
        />
      )}
    </Card>
  );
}
