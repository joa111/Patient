'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { LoaderCircle, KeyRound, Smartphone } from 'lucide-react';

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

function ContactStep({ onContactSubmit }: { onContactSubmit: (values: z.infer<typeof contactSchema>) => void; }) {
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { contact: '' },
  });

  const handleSubmit = async (values: z.infer<typeof contactSchema>) => {
    setIsLoading(true);
    await onContactSubmit(values);
    setIsLoading(false);
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="font-headline">Patient Login</CardTitle>
        <CardDescription>
          Enter your email or phone number to receive a one-time password (OTP).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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
              Send OTP
            </Button>
          </form>
        </Form>
      </CardContent>
    </>
  );
}

function OtpStep({ contactInfo, onOtpSubmit, onBack }: { contactInfo: string, onOtpSubmit: (values: z.infer<typeof otpSchema>) => void, onBack: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  const handleSubmit = async (values: z.infer<typeof otpSchema>) => {
    setIsLoading(true);
    await onOtpSubmit(values);
    setIsLoading(false);
  }

  return (
     <>
        <CardHeader>
          <CardTitle className="font-headline">Enter OTP</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to <span className="font-semibold text-primary">{contactInfo}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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


export function AuthForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<'contact' | 'otp'>('contact');
  const [contactInfo, setContactInfo] = useState('');

  async function handleContactSubmit(values: z.infer<typeof contactSchema>) {
    // Simulate API call to send OTP
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setContactInfo(values.contact);
    setStep('otp');
    toast({
      title: 'OTP Sent',
      description: `A 6-digit code has been sent to ${values.contact}. (Use 123456 to login)`,
    });
  }

  async function handleOtpSubmit(values: z.infer<typeof otpSchema>) {
    // Simulate API call to verify OTP
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (values.otp === '123456') { // Mock OTP
      toast({
        title: 'Login Successful',
        description: 'Redirecting to your profile...',
      });
      router.push('/profile');
    } else {
      toast({
        variant: 'destructive',
        title: 'Invalid OTP',
        description: 'The code you entered is incorrect. Please try again.',
      });
    }
  }

  return (
    <Card className="w-full shadow-lg border-primary/20">
      {step === 'contact' ? (
        <ContactStep onContactSubmit={handleContactSubmit} />
      ) : (
        <OtpStep 
          contactInfo={contactInfo}
          onOtpSubmit={handleOtpSubmit}
          onBack={() => setStep('contact')}
        />
      )}
    </Card>
  );
}