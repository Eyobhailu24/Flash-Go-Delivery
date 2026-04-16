'use client';

import { format } from 'date-fns';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  LayoutGridIcon,
  TableIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  postUser,
  useUsers,
  type User,
} from '@/app/admin/_hooks/use-users';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { postDriverProfile } from '@/lib/admin-driver-api';
import { AuthApiError } from '@/lib/auth-api';

const VIEW_STORAGE_KEY = 'admin-add-driver-view';
const PASSWORD_MIN = 8;

type FormState = {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  vehicleType: string;
  licenseNumber: string;
  rating: string;
  isAvailable: 'true' | 'false';
  joiningDate: string;
};

type SortField = 'name' | 'date';
type SortDir = 'asc' | 'desc';

const emptyForm = (): FormState => ({
  fullName: '',
  email: '',
  phoneNumber: '',
  password: '',
  vehicleType: '',
  licenseNumber: '',
  rating: '',
  isAvailable: 'true',
  joiningDate: '',
});

function driverUsersFrom(list: User[]): User[] {
  return list.filter((u) => u.role === 'driver');
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1)
    return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
}

function filterDriverUsers(
  list: User[],
  q: string,
): User[] {
  const s = q.trim().toLowerCase();
  if (!s) return list;
  return list.filter((u) => {
    const hay = [
      u.fullName,
      u.email,
      u.phoneNumber ?? '',
      u.status,
      'driver',
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(s);
  });
}

function sortDriverUsers(
  list: User[],
  field: SortField,
  dir: SortDir,
): User[] {
  const next = [...list];
  const cmpName = (a: User, b: User) =>
    a.fullName.localeCompare(b.fullName, undefined, {
      sensitivity: 'base',
    });
  const cmpDate = (a: User, b: User) =>
    new Date(a.createdAt).getTime() -
    new Date(b.createdAt).getTime();

  if (field === 'name') {
    return next.sort((a, b) =>
      dir === 'asc' ? cmpName(a, b) : cmpName(b, a),
    );
  }
  return next.sort((a, b) =>
    dir === 'asc' ? cmpDate(a, b) : cmpDate(b, a),
  );
}

export default function AdminAddDriverPage() {
  const { users, loading, error, refetch } = useUsers({
    limit: 200,
    offset: 0,
  });
  const driverUsers = useMemo(
    () => driverUsersFrom(users),
    [users],
  );

  const [search, setSearch] = useState('');
  const [sortField, setSortField] =
    useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [viewMode, setViewMode] = useState<
    'table' | 'cards'
  >('table');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitError, setSubmitError] = useState<
    string | null
  >(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(
      VIEW_STORAGE_KEY,
    );
    if (raw === 'table' || raw === 'cards') {
      queueMicrotask(() => setViewMode(raw));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const processed = useMemo(
    () =>
      sortDriverUsers(
        filterDriverUsers(driverUsers, search),
        sortField,
        sortDir,
      ),
    [driverUsers, search, sortField, sortDir],
  );

  const updateField = (
    key: keyof FormState,
    value: string,
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetModal = () => {
    setForm(emptyForm());
    setSubmitError(null);
  };

  const handleOpenChange = (open: boolean) => {
    setModalOpen(open);
    if (!open) resetModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const fullName = form.fullName.trim();
    const email = form.email.trim();
    const phoneTrim = form.phoneNumber.trim();
    const password = form.password;
    const ratingTrim = form.rating.trim();
    const rating =
      ratingTrim.length > 0
        ? Number.parseFloat(ratingTrim)
        : undefined;

    if (fullName.length < 2) {
      setSubmitError(
        'Full name must be at least 2 characters.',
      );
      return;
    }
    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      setSubmitError('Enter a valid email address.');
      return;
    }
    if (phoneTrim && phoneTrim.length < 8) {
      setSubmitError(
        'Phone number must be at least 8 characters if provided.',
      );
      return;
    }
    if (password.length < PASSWORD_MIN) {
      setSubmitError(
        `Password must be at least ${PASSWORD_MIN} characters.`,
      );
      return;
    }
    if (
      rating !== undefined &&
      (!Number.isFinite(rating) ||
        Number.isNaN(rating) ||
        rating < 0)
    ) {
      setSubmitError(
        'Rating must be a valid non-negative number.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const created = await postUser({
        fullName,
        email,
        password,
        role: 'driver',
        ...(phoneTrim ? { phoneNumber: phoneTrim } : {}),
      });

      await postDriverProfile({
        userId: created.id,
        vehicleType: form.vehicleType.trim() || undefined,
        licenseNumber:
          form.licenseNumber.trim() || undefined,
        rating,
        isAvailable: form.isAvailable === 'true',
        joiningDate: form.joiningDate || undefined,
      });

      await refetch();
      setModalOpen(false);
      resetModal();
    } catch (err) {
      const msg =
        err instanceof AuthApiError
          ? err.message
          : 'Something went wrong. Try again.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Driver accounts
          </h1>
          <p className="text-sm text-muted-foreground">
            Search and sort driver users. Use Add driver to
            create an account and driver profile.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 sm:mt-0.5"
          onClick={() => void refetch()}
        >
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load users</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-4 pt-4 md:p-6">
          <div className="flex w-full min-w-0 flex-nowrap items-center gap-4 overflow-x-auto">
            <div className="relative min-w-56 w-[58%] max-w-2xl shrink-0">
              <Input
                id="add-driver-search"
                placeholder="Search name, email, phone, status..."
                className="h-9 w-full px-3"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search driver users"
              />
            </div>
            <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => setModalOpen(true)}
              >
                Add driver
              </Button>
              <Select
                value={sortField}
                onValueChange={(v) =>
                  setSortField(v as SortField)
                }
              >
                <SelectTrigger
                  className="h-9 w-38 shrink-0 sm:w-40"
                  aria-label="Sort by field"
                >
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="date">
                    Date joined
                  </SelectItem>
                </SelectContent>
              </Select>
              <div
                className="flex shrink-0 overflow-hidden rounded-md border border-input"
                role="group"
                aria-label="Sort direction"
              >
                <Button
                  type="button"
                  variant={
                    sortDir === 'asc'
                      ? 'secondary'
                      : 'ghost'
                  }
                  size="icon-sm"
                  className="size-9 rounded-none border-0 shadow-none"
                  onClick={() => setSortDir('asc')}
                  aria-label="Sort ascending"
                >
                  <ArrowUpIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant={
                    sortDir === 'desc'
                      ? 'secondary'
                      : 'ghost'
                  }
                  size="icon-sm"
                  className="size-9 rounded-none border-0 border-l border-input shadow-none"
                  onClick={() => setSortDir('desc')}
                  aria-label="Sort descending"
                >
                  <ArrowDownIcon className="size-4" />
                </Button>
              </div>
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(v) => {
                  if (v === 'table' || v === 'cards')
                    setViewMode(v);
                }}
                variant="outline"
                spacing={0}
                className="shrink-0"
                aria-label="View mode"
              >
                <ToggleGroupItem
                  value="table"
                  aria-label="Table view"
                >
                  <TableIcon className="size-4" />
                  <span className="hidden sm:inline">
                    Table
                  </span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="cards"
                  aria-label="Card view"
                >
                  <LayoutGridIcon className="size-4" />
                  <span className="hidden sm:inline">
                    Cards
                  </span>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <Separator />

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : driverUsers.length === 0 ? (
            <Empty className="min-h-[200px] border border-dashed">
              <EmptyHeader>
                <EmptyTitle>No driver users yet</EmptyTitle>
                <EmptyDescription>
                  Use Add driver to create the first account
                  and driver profile.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : processed.length === 0 ? (
            <Empty className="min-h-[200px] border border-dashed">
              <EmptyHeader>
                <EmptyTitle>No drivers match</EmptyTitle>
                <EmptyDescription>
                  Try another search term or refresh the
                  list.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : viewMode === 'table' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Phone
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Joined
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processed.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          {u.fullName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {u.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        driver
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="outline">
                          {u.status}
                        </Badge>
                        {u.isVerified ? (
                          <Badge className="bg-primary/15 text-primary-foreground hover:bg-primary/20">
                            Verified
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {u.phoneNumber ?? '—'}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {format(
                        new Date(u.createdAt),
                        'MMM d, yyyy',
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {processed.map((u) => (
                <li key={u.id}>
                  <Card className="h-full shadow-none transition-colors hover:bg-accent/30">
                    <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                      <Avatar className="size-10">
                        <AvatarFallback className="bg-primary/15 text-primary-foreground">
                          {initials(u.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-base leading-tight">
                          {u.fullName}
                        </CardTitle>
                        <CardDescription className="truncate">
                          {u.email}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 pt-0">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary">
                          driver
                        </Badge>
                        <Badge variant="outline">
                          {u.status}
                        </Badge>
                        {u.isVerified ? (
                          <Badge className="bg-primary/15 text-primary-foreground hover:bg-primary/20">
                            Verified
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {u.phoneNumber ?? 'No phone'} ·{' '}
                        {format(
                          new Date(u.createdAt),
                          'MMM d, yyyy',
                        )}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={modalOpen}
        onOpenChange={handleOpenChange}
      >
        <DialogContent
          className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col gap-0 p-0 sm:max-w-lg"
          showCloseButton
        >
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="flex max-h-[min(90vh,720px)] flex-col"
          >
            <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
              <DialogTitle>Add driver</DialogTitle>
              <DialogDescription>
                Creates a user with role{' '}
                <span className="font-medium text-foreground">
                  driver
                </span>{' '}
                and a driver profile.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4">
                {submitError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                      {submitError}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Account
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="ad-fullName">
                      Full name
                    </Label>
                    <Input
                      id="ad-fullName"
                      autoComplete="name"
                      value={form.fullName}
                      onChange={(e) =>
                        updateField(
                          'fullName',
                          e.target.value,
                        )
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ad-email">Email</Label>
                    <Input
                      id="ad-email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) =>
                        updateField('email', e.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ad-phone">
                      Phone (optional)
                    </Label>
                    <Input
                      id="ad-phone"
                      type="tel"
                      autoComplete="tel"
                      value={form.phoneNumber}
                      onChange={(e) =>
                        updateField(
                          'phoneNumber',
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ad-password">
                      Password
                    </Label>
                    <Input
                      id="ad-password"
                      type="password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) =>
                        updateField(
                          'password',
                          e.target.value,
                        )
                      }
                      required
                      minLength={PASSWORD_MIN}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Driver profile
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="ad-vehicleType">
                      Vehicle type
                    </Label>
                    <Input
                      id="ad-vehicleType"
                      placeholder="e.g. Bike, Car"
                      value={form.vehicleType}
                      onChange={(e) =>
                        updateField(
                          'vehicleType',
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ad-license">
                      License number
                    </Label>
                    <Input
                      id="ad-license"
                      value={form.licenseNumber}
                      onChange={(e) =>
                        updateField(
                          'licenseNumber',
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ad-rating">
                        Rating (optional)
                      </Label>
                      <Input
                        id="ad-rating"
                        type="number"
                        min={0}
                        step="0.1"
                        value={form.rating}
                        onChange={(e) =>
                          updateField(
                            'rating',
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ad-availability">
                        Availability
                      </Label>
                      <Select
                        value={form.isAvailable}
                        onValueChange={(value) =>
                          updateField('isAvailable', value)
                        }
                      >
                        <SelectTrigger id="ad-availability">
                          <SelectValue placeholder="Availability" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">
                            Available
                          </SelectItem>
                          <SelectItem value="false">
                            Unavailable
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ad-joiningDate">
                      Joining date (optional)
                    </Label>
                    <Input
                      id="ad-joiningDate"
                      type="date"
                      value={form.joiningDate}
                      onChange={(e) =>
                        updateField(
                          'joiningDate',
                          e.target.value,
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="shrink-0 border-t bg-muted/40 px-4 py-4 sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : 'Create driver'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
