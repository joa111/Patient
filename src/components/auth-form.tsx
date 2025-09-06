'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { LoaderCircle, KeyRound, User, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, doc, setDoc, getDoc, serverTimestamp } from '@/lib/firebase';
import type { Patient } from '@/types/service-request';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

const signUpSchema = z.object({
    name: z.string().min(2, 'Please enter your full name.'),
    email: z.string().email('Please enter a valid email address.'),
    password: z.string().min(6, 'Password must be at least 6 characters.'),
});

function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const handleSignIn = async (values: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      const patientRef = doc(db, 'patients', user.uid);
      const patientDoc = await getDoc(patientRef);

      if (!patientDoc.exists()) {
        await setDoc(patientRef, {
            name: user.displayName || 'New User',
            email: user.email,
            avatarUrl: user.photoURL || `https://placehold.co/256x256.png`,
            dob: '',
            contact: user.phoneNumber || '',
            bloodType: '',
            allergies: [],
            primaryPhysician: '',
            preferences: {
                maxDistance: 10,
                priceRange: { min: 20, max: 100 },
                preferredSpecialties: []
            },
            createdAt: serverTimestamp(),
            migratedUser: true
        });
        toast({ title: "Welcome!", description: "We've created a profile for you." });
      } else {
        toast({ title: 'Login Successful', description: 'Redirecting to your profile...' });
      }
      
      router.push(`/profile?id=${user.uid}`);
    } catch (error: any) {
      console.error("Sign in error:", error);
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSignIn)} className="space-y-6">
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <div className="relative"><Input placeholder="name@example.com" {...field} className="pl-10" /><div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground"><Mail className="h-5 w-5" /></div></div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl>
              <div className="relative"><Input type="password" {...field} className="pl-10" /><div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground"><KeyRound className="h-5 w-5" /></div></div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
          Login
        </Button>
      </form>
    </Form>
  );
}

function SignUpForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const handleSignUp = async (values: z.infer<typeof signUpSchema>) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      const newPatient: Omit<Patient, 'id'> = {
        name: values.name,
        email: user.email!,
        avatarUrl: `https://placehold.co/256x256.png`,
        dob: '',
        contact: '',
        bloodType: '',
        allergies: [],
        primaryPhysician: '',
        preferences: {
            maxDistance: 10,
            priceRange: { min: 20, max: 100 },
            preferredSpecialties: []
        },
      };

      await setDoc(doc(db, 'patients', user.uid), newPatient);
      
      toast({ title: 'Account Created!', description: 'Redirecting to your new profile...' });
      router.push(`/profile?id=${user.uid}`);
    } catch (error: any) {
      console.error("Sign up error:", error);
      toast({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSignUp)} className="space-y-6">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Full Name</FormLabel>
            <FormControl>
              <div className="relative"><Input placeholder="Jane Doe" {...field} className="pl-10" /><div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground"><User className="h-5 w-5" /></div></div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <div className="relative"><Input placeholder="name@example.com" {...field} className="pl-10" /><div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground"><Mail className="h-5 w-5" /></div></div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl>
              <div className="relative"><Input type="password" {...field} className="pl-10" /><div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground"><KeyRound className="h-5 w-5" /></div></div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
          Create Account & Login
        </Button>
      </form>
    </Form>
  );
}

export function AuthForm() {
  return (
    <Card className="w-full shadow-lg border-primary/20">
      <CardHeader>
        <CardTitle className="font-headline">Patient Portal</CardTitle>
        <CardDescription>Login or create an account to manage your health services.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="pt-6">
            <LoginForm />
          </TabsContent>
          <TabsContent value="signup" className="pt-6">
            <SignUpForm />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
