// frontend/src/app/settings/page.tsx

'use client'

import { useState } from 'react'
import AnimatedPage from '@/components/AnimatedPage'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Link2,
  Shield,
} from 'lucide-react'

const timezoneOptions = [
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'Europe/London', label: 'London (GMT)' },
]

const languageOptions = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
]

const integrations = [
  {
    name: 'Greenhouse ATS',
    description: 'Sync interview outcomes and candidate notes automatically.',
    status: 'connected',
    badge: 'Live sync',
  },
  {
    name: 'Google Calendar',
    description: 'Push candidate invites directly to your calendar.',
    status: 'ready',
    badge: 'OAuth',
  },
  {
    name: 'Slack Notifications',
    description: 'Share interview recaps in your hiring channel.',
    status: 'disconnected',
    badge: 'Coming soon',
  },
]

const notificationBlueprint = [
  {
    key: 'recapEmails',
    title: 'Interview recap emails',
    description: 'Receive a summary after each session is completed.',
  },
  {
    key: 'candidateDigest',
    title: 'Weekly candidate digest',
    description: 'Every Monday at 8:00 AM in your timezone.',
  },
  {
    key: 'productUpdates',
    title: 'Product announcements',
    description: 'Occasional feature releases and best-practice guides.',
  },
] as const

export default function SettingsPage() {
  const [profile, setProfile] = useState({
    name: 'Avery Patel',
    title: 'Head of Talent Intelligence',
    timezone: 'America/Los_Angeles',
    location: 'San Francisco, CA',
    bio: 'Building modern, candidate-centric hiring experiences with automation and thoughtful analytics.',
  })

  const [notifications, setNotifications] = useState({
    recapEmails: true,
    candidateDigest: true,
    productUpdates: false,
  })

  const [interviewDefaults, setInterviewDefaults] = useState({
    language: 'en-US',
    duration: 30,
    autoShare: true,
    recordingRetention: '90',
  })

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <AnimatedPage>
      <header className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Control Center
            </p>
            <h1 className="text-3xl font-bold text-foreground">Account Settings</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Profile verified
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3.5 w-3.5 text-sky-500" />
              SSO enforced
            </Badge>
          </div>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Configure the experience your hiring teams see across the platform.
          Everything below is local to this demo – no backend changes are required.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile & Identity</CardTitle>
            <CardDescription>Showcase who you are when collaborating with teams and candidates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {profile.name
                  .split(' ')
                  .map((word) => word[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Profile photo</p>
                <p className="text-sm text-muted-foreground">
                  Displayed on interview scorecards, nudges, and stakeholder dashboards.
                </p>
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm">
                  Upload
                </Button>
                <Button variant="ghost" size="sm">
                  Remove
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={(event) =>
                    setProfile((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Role / Title</Label>
                <Input
                  id="title"
                  value={profile.title}
                  onChange={(event) =>
                    setProfile((prev) => ({ ...prev, title: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={profile.timezone}
                  onValueChange={(value) =>
                    setProfile((prev) => ({ ...prev, timezone: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezoneOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={profile.location}
                  onChange={(event) =>
                    setProfile((prev) => ({ ...prev, location: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Public bio</Label>
              <Textarea
                id="bio"
                rows={4}
                value={profile.bio}
                onChange={(event) =>
                  setProfile((prev) => ({ ...prev, bio: event.target.value }))
                }
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3 border-t">
            <Button variant="ghost">Reset</Button>
            <Button>Save profile</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security & Access</CardTitle>
            <CardDescription>Rotate credentials, enable MFA, and manage session policies.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Label htmlFor="current-password">Current password</Label>
              <Input id="current-password" type="password" placeholder="••••••••" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" placeholder="At least 12 characters" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input id="confirm-password" type="password" placeholder="Repeat new password" />
            </div>
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <Shield className="mr-2 inline h-4 w-4 text-primary" />
              SSO is active via Google Workspace. Local passwords act as a fallback only.
            </div>
          </CardContent>
          <CardFooter className="flex justify-end border-t">
            <Button>Update password</Button>
          </CardFooter>
        </Card>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notification Preferences
            </CardTitle>
            <CardDescription>Pick the signals you want to receive from AIVA.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {notificationBlueprint.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleNotification(item.key)}
                className={cn(
                  'w-full rounded-xl border px-4 py-3 text-left transition',
                  notifications[item.key]
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-muted-foreground/40'
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <span
                    className={cn(
                      'text-sm font-medium',
                      notifications[item.key] ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {notifications[item.key] ? 'Enabled' : 'Muted'}
                  </span>
                </div>
              </button>
            ))}
          </CardContent>
          <CardFooter className="flex justify-end border-t">
            <Button variant="outline">Digest schedule</Button>
            <Button className="ml-2">Save preferences</Button>
          </CardFooter>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Interview Defaults
              </CardTitle>
              <CardDescription>Used whenever a new session is created.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select
                  value={interviewDefaults.language}
                  onValueChange={(value) =>
                    setInterviewDefaults((prev) => ({ ...prev, language: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="range"
                    min={15}
                    max={60}
                    step={5}
                    value={interviewDefaults.duration}
                    onChange={(event) =>
                      setInterviewDefaults((prev) => ({
                        ...prev,
                        duration: Number(event.target.value),
                      }))
                    }
                  />
                  <span className="w-10 text-right text-sm font-medium">
                    {interviewDefaults.duration}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Recording retention (days)</Label>
                <Input
                  type="number"
                  min={30}
                  max={365}
                  value={interviewDefaults.recordingRetention}
                  onChange={(event) =>
                    setInterviewDefaults((prev) => ({
                      ...prev,
                      recordingRetention: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Interviews recorded via AIVA are encrypted at rest. Auto-share can
                be enabled on a per-role basis.
              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t">
              <Button variant="ghost">Revert</Button>
              <Button className="ml-2">Update defaults</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Connected Services
              </CardTitle>
              <CardDescription>Bring your favorite ATS and collaboration tools with you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {integrations.map((integration) => (
                <div
                  key={integration.name}
                  className="rounded-xl border p-4 shadow-xs transition hover:border-primary/60"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{integration.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {integration.description}
                      </p>
                    </div>
                    <Badge
                      variant={integration.status === 'connected' ? 'default' : 'outline'}
                    >
                      {integration.badge}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost">
                      View details
                    </Button>
                    <Button
                      size="sm"
                      variant={integration.status === 'connected' ? 'outline' : 'default'}
                    >
                      {integration.status === 'connected' ? 'Disconnect' : 'Connect'}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </AnimatedPage>
  )
}

