export type UserRole = 'client' | 'professional';

export interface UserProfile {
  uid: string;
  displayName: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  photoURL?: string;
  birthDate: string;
  phoneNumber: string;
  role: UserRole;
  avgRating?: number;
  numReviews?: number;
  specialties?: string[];
  professionalDescription?: string;
  licenseNumber?: string;
  isProfessionalProfileComplete?: boolean;
  isAdmin?: boolean;
}

export type JobStatus = 'Open' | 'Assigned' | 'Completed';

export interface Job {
  id: string;
  clientId: string;
  category: string;
  title: string;
  description: string;
  status: JobStatus;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  photos?: string[];
  assignedProfessionalId?: string;
  isUrgent?: boolean;
  createdAt: string;
}

export interface Bid {
  id: string;
  jobId: string;
  clientId: string;
  professionalId: string;
  proposedPrice: number;
  message: string;
  createdAt: string;
  job?: Job;
  lastMessage?: string;
  lastMessageAt?: string;
}

export interface Message {
  id: string;
  bidId: string;
  senderId: string;
  recipientId: string;
  text: string;
  timestamp: string;
  read: boolean;
}

export interface Review {
  id: string;
  reviewerId: string;
  reviewedId: string;
  jobId: string;
  stars: number;
  comment: string;
  createdAt: string;
}

export type AppointmentStatus = 'Proposed' | 'Accepted' | 'Rejected' | 'Cancelled' | 'Completed';

export interface Appointment {
  id: string;
  jobId: string;
  bidId: string;
  clientId: string;
  professionalId: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  proposedBy: string;
  createdAt: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
