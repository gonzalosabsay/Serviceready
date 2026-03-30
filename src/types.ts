export type UserRole = 'client' | 'professional';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: UserRole;
  avgRating?: number;
  numReviews?: number;
  specialties?: string[];
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
