'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { useAuth } from '@/hooks';
import { loginSchema, type LoginInput } from '@/lib/validations';
import { Eye, EyeOff } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';
  const { login } = useAuth();
  
  const [formData, setFormData] = useState<LoginInput>({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginInput, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear error when user starts typing
    if (errors[name as keyof LoginInput]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
    setServerError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setServerError('');

    // Validate form
    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof LoginInput, string>> = {};
      result.error.issues.forEach(issue => {
        const field = issue.path[0] as keyof LoginInput;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      setIsLoading(false);
      return;
    }

    try {
      await login(formData.email, formData.password);
      router.push(redirect);
    } catch (error) {
      setServerError(
        error instanceof Error 
          ? error.message 
          : 'Invalid email or password. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
        <p className="text-zinc-400">
          Sign in to continue to Evasion
        </p>
      </div>

      <Card variant="glass">
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {serverError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {serverError}
              </div>
            )}

            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              autoComplete="email"
            />

            <div className="relative">
              <Input
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-zinc-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500"
                />
                <span className="text-sm text-zinc-400">Remember me</span>
              </label>
              
              <Link 
                href="/forgot-password" 
                className="text-sm text-violet-500 hover:text-violet-400 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center mt-6 text-zinc-400">
        Don&apos;t have an account?{' '}
        <Link 
          href="/signup" 
          className="text-violet-500 hover:text-violet-400 font-medium transition-colors"
        >
          Create one
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
