'use client';

import { useAuth } from '@/hooks';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import Link from 'next/link';
import {
  Map,
  Route,
  Calendar,
  Users,
  TrendingUp,
  MapPin,
  Clock,
  ChevronRight,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  const quickActions = [
    {
      title: 'Open Map',
      description: 'See who\'s driving nearby',
      href: '/map',
      icon: Map,
      color: 'bg-blue-500/20 text-blue-500',
    },
    {
      title: 'Discover Routes',
      description: 'Find your next adventure',
      href: '/routes',
      icon: Route,
      color: 'bg-green-500/20 text-green-500',
    },
    {
      title: 'Upcoming Events',
      description: 'Join community drives',
      href: '/events',
      icon: Calendar,
      color: 'bg-purple-500/20 text-purple-500',
    },
    {
      title: 'My Garage',
      description: 'Manage your vehicles',
      href: '/garage',
      icon: Users,
      color: 'bg-violet-500/20 text-violet-500',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome back, {user?.displayName?.split(' ')[0] || 'Driver'}!
        </h1>
        <p className="text-zinc-400">
          Here&apos;s what&apos;s happening in the Evasion community today.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Link key={action.title} href={action.href}>
            <Card className="h-full hover:border-zinc-700 transition-colors cursor-pointer">
              <CardContent className="pt-6">
                <div className={`w-12 h-12 rounded-lg ${action.color} flex items-center justify-center mb-4`}>
                  <action.icon size={24} />
                </div>
                <h3 className="font-semibold text-white mb-1">{action.title}</h3>
                <p className="text-sm text-zinc-400">{action.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Stats Row */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Active Drivers</p>
                <p className="text-2xl font-bold text-white">--</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Popular Routes</p>
                <p className="text-2xl font-bold text-white">--</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Upcoming Events</p>
                <p className="text-2xl font-bold text-white">--</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Routes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Popular Routes</CardTitle>
                <CardDescription>Top routes this week</CardDescription>
              </div>
              <Link href="/routes" className="text-violet-500 hover:text-violet-400 text-sm flex items-center gap-1">
                View all <ChevronRight size={16} />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-zinc-500">
              <Route className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No routes yet</p>
              <p className="text-sm">Be the first to share a route!</p>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Upcoming Events</CardTitle>
                <CardDescription>Events in your area</CardDescription>
              </div>
              <Link href="/events" className="text-violet-500 hover:text-violet-400 text-sm flex items-center gap-1">
                View all <ChevronRight size={16} />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-zinc-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No upcoming events</p>
              <p className="text-sm">Create or join an event!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
