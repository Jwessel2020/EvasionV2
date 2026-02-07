'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { useAuth } from '@/hooks';
import { signupSchema, type SignupInput } from '@/lib/validations';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  
  const [formData, setFormData] = useState<SignupInput>({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    displayName: '',
    dateOfBirth: '',
    agreeToTerms: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SignupInput, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear error when user starts typing
    if (errors[name as keyof SignupInput]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
    setServerError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setServerError('');

    // Validate form
    const result = signupSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof SignupInput, string>> = {};
      result.error.issues.forEach(issue => {
        const field = issue.path[0] as keyof SignupInput;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      });
      setErrors(fieldErrors);
      setIsLoading(false);
      return;
    }

    try {
      await signup(formData.email, formData.password, {
        username: formData.username,
        displayName: formData.displayName,
        dateOfBirth: formData.dateOfBirth,
      });
      setSuccess(true);
    } catch (error) {
      setServerError(
        error instanceof Error 
          ? error.message 
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <div className="mb-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Check your email</h2>
          <p className="text-zinc-400">
            We&apos;ve sent a verification link to <strong className="text-white">{formData.email}</strong>
          </p>
        </div>

        <Card variant="glass">
          <CardContent className="text-center">
            <p className="text-zinc-400 mb-4">
              Click the link in your email to verify your account and start exploring Evasion.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Back to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">Create your account</h2>
        <p className="text-zinc-400">
          Join the automotive community
        </p>
      </div>

      {/* Age Warning */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-violet-500/10 border border-violet-500/20 mb-6">
        <AlertTriangle className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-violet-200">
          You must be <strong>16 years or older</strong> to create an Evasion account. 
          By signing up, you confirm you meet this age requirement.
        </p>
      </div>

      <Card variant="glass">
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {serverError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {serverError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Username"
                name="username"
                placeholder="gearhead42"
                value={formData.username}
                onChange={handleChange}
                error={errors.username}
                autoComplete="username"
              />

              <Input
                label="Display Name"
                name="displayName"
                placeholder="John Doe"
                value={formData.displayName}
                onChange={handleChange}
                error={errors.displayName}
                autoComplete="name"
              />
            </div>

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

            <Input
              label="Date of Birth"
              name="dateOfBirth"
              type="date"
              value={formData.dateOfBirth}
              onChange={handleChange}
              error={errors.dateOfBirth}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 16)).toISOString().split('T')[0]}
            />

            <div className="relative">
              <Input
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-zinc-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <Input
              label="Confirm Password"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="agreeToTerms"
                checked={formData.agreeToTerms}
                onChange={handleChange}
                className="w-4 h-4 mt-1 rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500"
              />
              <span className="text-sm text-zinc-400">
                I agree to the{' '}
                <Link href="/terms" className="text-violet-500 hover:text-violet-400">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-violet-500 hover:text-violet-400">
                  Privacy Policy
                </Link>
              </span>
            </label>
            {errors.agreeToTerms && (
              <p className="text-sm text-red-500 -mt-2">{errors.agreeToTerms}</p>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              isLoading={isLoading}
            >
              Create Account
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center mt-6 text-zinc-400">
        Already have an account?{' '}
        <Link 
          href="/login" 
          className="text-violet-500 hover:text-violet-400 font-medium transition-colors"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
