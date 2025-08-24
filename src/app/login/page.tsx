import { AuthForm } from '@/components/auth-form';
import { HeartPulse } from 'lucide-react';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <HeartPulse className="h-16 w-16 text-primary" />
          </div>
          <h1 className="mt-6 font-headline text-4xl font-bold text-primary">MediPass</h1>
          <p className="mt-2 text-muted-foreground">Your secure health companion.</p>
        </div>
        <AuthForm />
      </div>
    </main>
  );
}
