'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import { 
  MapPin, 
  Users, 
  Route, 
  Shield, 
  Zap,
  Car
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
        <div className="absolute inset-0 road-pattern opacity-30" />
        
        {/* Navigation */}
        <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center">
              <Car className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Evasion</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Log In</Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary">Get Started</Button>
            </Link>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 md:py-32">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Drive Together.
              <span className="text-violet-500"> Explore More.</span>
            </h1>
            <p className="text-xl text-zinc-400 mb-8 max-w-2xl">
              The social navigation network for automotive enthusiasts. 
              Connect with drivers, discover epic routes, join community rides, 
              and stay informed on the road.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto">
                  Join the Community
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Decorative car silhouette */}
        <div className="absolute bottom-0 right-0 w-1/2 h-64 opacity-5">
          <svg viewBox="0 0 640 480" fill="currentColor" className="w-full h-full">
            <path d="M544 224l-128-64c-35.35 0-64 28.65-64 64v96H96c-53.02 0-96-42.98-96-96v-32c0-53.02 42.98-96 96-96h224l64-64h160c53.02 0 96 42.98 96 96v96c0 17.67-14.33 32-32 32h-64z"/>
          </svg>
        </div>
      </header>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-zinc-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Everything You Need on the Road
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              From real-time tracking to community events, Evasion has all the features 
              to enhance your driving experience.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 hover:border-violet-500/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-violet-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Live Location</h3>
              <p className="text-zinc-400">
                See friends on the map in real-time. Know who&apos;s driving nearby and connect instantly.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 hover:border-violet-500/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center mb-4">
                <Route className="w-6 h-6 text-violet-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Route Discovery</h3>
              <p className="text-zinc-400">
                Find the best driving roads shared by the community. From canyon runs to scenic highways.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 hover:border-violet-500/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-violet-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Community Events</h3>
              <p className="text-zinc-400">
                Join car meets, group drives, and track days. Never miss an event in your area.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 hover:border-violet-500/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-violet-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Road Alerts</h3>
              <p className="text-zinc-400">
                Real-time alerts for police activity, road hazards, and traffic conditions from the community.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 hover:border-violet-500/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center mb-4">
                <Car className="w-6 h-6 text-violet-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Your Garage</h3>
              <p className="text-zinc-400">
                Showcase your vehicles with photos and specs. Track mods and share your build journey.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 hover:border-violet-500/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-violet-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Car Spotting</h3>
              <p className="text-zinc-400">
                Spot and share interesting cars you see. Build your spotting collection and earn recognition.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-gradient-to-br from-violet-600 to-violet-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Hit the Road?
          </h2>
          <p className="text-violet-100 mb-8 text-lg">
            Join thousands of car enthusiasts already using Evasion. 
            Must be 16 or older to create an account.
          </p>
          <Link href="/signup">
            <Button 
              size="lg" 
              className="bg-white text-violet-600 hover:bg-zinc-100"
            >
              Create Your Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-950 border-t border-zinc-800 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center">
                <Car className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Evasion</span>
            </div>
            
            <div className="flex gap-8 text-zinc-400 text-sm">
              <Link href="/about" className="hover:text-white transition-colors">About</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>
            
            <p className="text-zinc-500 text-sm">
              © 2026 Evasion. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
