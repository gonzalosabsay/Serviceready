/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  deleteUser,
  reauthenticateWithPopup,
  updateProfile,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  getDocFromServer,
  deleteDoc,
  getDocs,
  writeBatch,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { Tutorial } from './components/Tutorial';
import { Button } from './components/ui/button';
import { 
  UserProfile, 
  Job, 
  Bid, 
  Message, 
  Appointment,
  AppointmentStatus,
  JobStatus,
  OperationType, 
  FirestoreErrorInfo 
} from './types';
import { cn } from './lib/utils';
import { 
  Search, 
  Plus, 
  MessageSquare, 
  User as UserIcon, 
  MapPin, 
  Star, 
  Briefcase, 
  LogOut, 
  Send, 
  ChevronLeft, 
  Camera,
  Filter,
  Clock,
  Map as MapIcon,
  List as ListIcon,
  Trash2,
  Navigation,
  CheckCircle,
  ChevronRight,
  Phone,
  Calendar,
  X,
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  formatDistanceToNow, 
  format, 
  addHours, 
  isWithinInterval, 
  parseISO, 
  startOfDay, 
  endOfDay, 
  differenceInHours,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths
} from 'date-fns';
import { es } from 'date-fns/locale';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix for Leaflet default icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// --- Error Handling ---
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// --- Components ---

const LocationPicker = ({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const MapController = ({ center, zoom, displayMode }: { center: [number, number], zoom?: number, displayMode?: string }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 300);
    return () => clearTimeout(timer);
  }, [map, displayMode]);

  return null;
};

const CATEGORIES = [
  { group: "Mantenimiento Técnico", name: "Plomería y Fontanería" },
  { group: "Energía y Clima", name: "Electricidad Residencial" },
  { group: "Remodelación y Estética", name: "Pintura e Impermeabilización" },
  { group: "Construcción Estructural", name: "Albañilería y Obra Civil" },
  { group: "Seguridad y Cerramientos", name: "Cerrajería de Emergencia" },
  { group: "Carpintería y Acabados", name: "Carpintería de Madera" },
  { group: "Espacios Exteriores", name: "Jardinería y Paisajismo" },
  { group: "Limpieza y Desinfección", name: "Limpieza Especializada" },
];

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    className={cn(
      'flex h-12 w-full px-4 py-3 rounded-xl border border-input bg-white text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all', 
      className
    )} 
    {...props} 
  />
);

const TextArea = ({ className, maxLength, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => {
  const [count, setCount] = React.useState(String(props.value || props.defaultValue || '').length);
  
  return (
    <div className="relative w-full">
      <textarea 
        className={cn(
          'flex min-h-[80px] w-full px-4 py-3 rounded-xl border border-input bg-white text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all resize-none', 
          className
        )} 
        maxLength={maxLength}
        onChange={(e) => {
          setCount(e.target.value.length);
          if (props.onChange) props.onChange(e);
        }}
        {...props} 
      />
      {maxLength && (
        <div className="absolute bottom-2 right-3 text-[10px] font-bold text-stone-400 bg-white/80 px-1 rounded">
          {count}/{maxLength}
        </div>
      )}
    </div>
  );
};

const Badge = ({ children, className, variant = 'default', ...props }: { children: React.ReactNode, className?: string, variant?: 'default' | 'success' | 'warning' | 'info' | 'danger' } & React.HTMLAttributes<HTMLSpanElement>) => {
  const variants = {
    default: 'bg-stone-100 text-stone-600 border-stone-200',
    success: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-orange-50 text-orange-700 border-orange-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span 
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border', 
        variants[variant], 
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

const Modal = ({ isOpen, onClose, title, children, disabled }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, disabled?: boolean }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl"
      >
        <h3 className="text-xl font-bold mb-4">{title}</h3>
        {children}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={disabled}>Cerrar</Button>
        </div>
      </motion.div>
    </div>
  );
};

const UserProfileModal = ({ profile, isOpen, onClose }: { profile: UserProfile | null, isOpen: boolean, onClose: () => void }) => {
  if (!isOpen || !profile) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex justify-center items-start p-4 bg-black/60 backdrop-blur-md overflow-y-auto py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="w-full max-w-lg shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] overflow-hidden relative flex flex-col max-h-none h-fit rounded-[3rem]"
      >
        <Button 
          variant="ghost" 
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white flex items-center justify-center p-0 shadow-md z-[50]"
        >
          <X className="w-5 h-5 text-stone-600" />
        </Button>

        <div className="h-32 bg-[#f3e8e2] flex-shrink-0 relative z-10">
        </div>

        <div className="flex-1 bg-white relative z-20">
          <div className="px-8 pb-8 -mt-16 relative">
          <div className="w-32 h-32 rounded-[2rem] border-4 border-white overflow-hidden shadow-xl mb-6 bg-stone-200">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400">
                <UserIcon className="w-12 h-12" />
              </div>
            )}
          </div>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-3xl font-black text-stone-900">{profile.displayName}</h2>
              <Badge variant={profile.role === 'professional' ? 'success' : 'info'} className="text-[10px] uppercase tracking-widest font-black">
                {profile.role === 'professional' ? 'Profesional' : 'Cliente'}
              </Badge>
            </div>
            <p className="text-stone-400 font-bold text-sm">@{profile.username}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1">Miembro desde</span>
              <p className="text-sm font-bold text-stone-700">Recientemente</p>
            </div>
            {profile.role === 'professional' && (
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest block mb-1">Calificación</span>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-primary fill-primary" />
                  <p className="text-sm font-bold text-primary">{profile.avgRating?.toFixed(1) || 'N/A'}</p>
                </div>
              </div>
            )}
          </div>

          {profile.role === 'professional' && profile.specialties && profile.specialties.length > 0 && (
            <div className="mb-8">
              <h4 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4">Especialidades</h4>
              <div className="flex flex-wrap gap-2">
                {profile.specialties.map(s => (
                  <Badge key={s} variant="default" className="bg-stone-100 border-stone-200 text-stone-600 font-bold px-3 py-1">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {profile.role === 'professional' && profile.professionalDescription && (
            <div className="mb-8">
              <h4 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4">Sobre mí</h4>
              <p className="text-sm text-stone-600 leading-relaxed bg-stone-50 p-5 rounded-2xl border border-stone-100">
                {profile.professionalDescription}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4">Información de contacto</h4>
            <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-100">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <Phone className="w-5 h-5 text-stone-400" />
              </div>
              <div>
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">Teléfono</span>
                <p className="text-sm font-bold text-stone-700">{profile.phoneNumber || 'No disponible'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  </div>
  );
};

// --- Main App ---

const BUENOS_AIRES_CENTER: [number, number] = [-34.6037, -58.3816];
const ADMIN_EMAILS = ['gonzalo.sabsay@gmail.com', 'gonzalo.sabsay@hotmail.com'];

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'home' | 'jobs' | 'messages' | 'profile' | 'create-job' | 'job-details' | 'chat' | 'agenda'>('home');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedBid, setSelectedBid] = useState<any | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingAppointment, setRatingAppointment] = useState<Appointment | null>(null);

  const activeAppointment = useMemo(() => {
    return appointments.find(a => a.bidId === selectedBid?.id && 
      (a.status === 'Proposed' || a.status === 'Accepted' || 
       (a.status === 'Completed' && (profile?.role === 'client' ? !a.clientRated : !a.professionalRated)))
    );
  }, [appointments, selectedBid, profile]);

  const [displayMode, setDisplayMode] = useState<'list' | 'map'>('list');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showAccountDeleteConfirm, setShowAccountDeleteConfirm] = useState(false);
  const [bidToDelete, setBidToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [tempLocation, setTempLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-34.6037, -58.3816]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [imageOption, setImageOption] = useState<'url' | 'file'>('url');
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showProfRegistration, setShowProfRegistration] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
  const [profSpecialties, setProfSpecialties] = useState<string[]>([]);
  const [profDescription, setProfDescription] = useState('');
  const [profLicense, setProfLicense] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadBidsCount, setUnreadBidsCount] = useState(0);
  const [unreadContactedCount, setUnreadContactedCount] = useState(0);
  const [unreadBidIds, setUnreadBidIds] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const jobRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const hasTriggeredTutorial = useRef<{ [key: string]: boolean }>({});

  // Auto-trigger tutorial
  useEffect(() => {
    if (profile && !loading && !isCompletingProfile && !showProfRegistration && !showTutorial) {
      const roleKey = `${profile.uid}-${profile.role}`;
      if (hasTriggeredTutorial.current[roleKey]) return;

      if (profile.role === 'client' && !profile.hasSeenTutorial) {
        setShowTutorial(true);
        hasTriggeredTutorial.current[roleKey] = true;
      } else if (profile.role === 'professional' && !profile.hasSeenProfTutorial && profile.isProfessionalProfileComplete) {
        setShowTutorial(true);
        hasTriggeredTutorial.current[roleKey] = true;
      }
    }
  }, [profile, loading, isCompletingProfile, showProfRegistration, showTutorial]);

  // Refs for registration data to avoid stale closures in onAuthStateChanged
  const registrationData = useRef({
    firstName: '',
    lastName: '',
    username: '',
    birthDate: '',
    phoneNumber: '',
    photoURL: ''
  });

  useEffect(() => {
    registrationData.current = {
      firstName,
      lastName,
      username,
      birthDate,
      phoneNumber,
      photoURL
    };
  }, [firstName, lastName, username, birthDate, phoneNumber, photoURL]);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesRef.current) {
      const scrollAmount = 200;
      categoriesRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const scrollToJob = (jobId: string) => {
    setHighlightedJobId(jobId);
    const element = jobRefs.current[jobId];
    if (element && element.offsetParent !== null) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const filteredJobs = useMemo(() => {
    if (selectedCategory === 'Todas') return jobs;
    return jobs.filter(j => j.category === selectedCategory);
  }, [jobs, selectedCategory]);

  // Auth & Profile Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setUser(u);
      if (u) {
        try {
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            const shouldBeAdmin = u.email ? ADMIN_EMAILS.includes(u.email) : false;
            
            // Check if profile is complete
            const isComplete = !!(data.firstName && data.lastName && data.username && data.birthDate && data.phoneNumber);
            
            if (!isComplete) {
              setIsCompletingProfile(true);
              // Pre-fill what we can from Auth/Firestore if not already in state (e.g. from signup form)
              setFirstName(prev => prev || data.firstName || u.displayName?.split(' ')[0] || '');
              setLastName(prev => prev || data.lastName || u.displayName?.split(' ').slice(1).join(' ') || '');
              setUsername(prev => prev || data.username || u.email?.split('@')[0] || '');
              setPhotoURL(prev => prev || data.photoURL || u.photoURL || '');
            } else {
              setIsCompletingProfile(false);
            }

            if (shouldBeAdmin && !data.isAdmin) {
              const updatedProfile = { ...data, isAdmin: true };
              await updateDoc(docRef, { isAdmin: true });
              setProfile(updatedProfile);
            } else {
              setProfile(data);
            }
          } else {
            // Profile doesn't exist at all
            setIsCompletingProfile(true);
            setFirstName(prev => prev || u.displayName?.split(' ')[0] || '');
            setLastName(prev => prev || u.displayName?.split(' ').slice(1).join(' ') || '');
            setUsername(prev => prev || u.email?.split('@')[0] || '');
            setPhotoURL(prev => prev || u.photoURL || '');
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${u.uid}`);
        }
      } else {
        setProfile(null);
        setIsCompletingProfile(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Connection Test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
          setError("Error de conexión con Firebase.");
        }
      }
    }
    testConnection();
  }, []);

  // Jobs Listener
  useEffect(() => {
    if (!profile) return;
    
    let q;
    if (profile.role === 'client') {
      q = query(collection(db, 'jobs'), where('clientId', '==', profile.uid), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'jobs'), where('status', '==', 'Open'), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const j = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
      
      // Filter out jobs that the professional has already bid on
      if (profile.role === 'professional') {
        const bidJobIds = new Set(myBids.map(b => b.jobId));
        setJobs(j.filter(job => !bidJobIds.has(job.id)));
      } else {
        setJobs(j);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'jobs');
    });

    return unsubscribe;
  }, [profile, myBids.length]); // Only re-run if number of bids changes

  // My Bids Listener (for professionals)
  useEffect(() => {
    if (!profile || profile.role !== 'professional') {
      setMyBids([]);
      return;
    }
    
    const q = query(collection(db, 'bids'), where('professionalId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const b = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bid));
      setMyBids(b);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'bids');
    });

    return unsubscribe;
  }, [profile]);

  // Appointments Listener
  useEffect(() => {
    if (!profile) return;
    
    const q = query(
      collection(db, 'appointments'), 
      where(profile.role === 'client' ? 'clientId' : 'professionalId', '==', profile.uid)
    );
    
    const jobCache = new Map<string, Job>();
    const userCache = new Map<string, UserProfile>();

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const appts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      
      const enriched = await Promise.all(appts.map(async (appt) => {
        let job = jobCache.get(appt.jobId);
        if (!job) {
          try {
            const jobDoc = await getDoc(doc(db, 'jobs', appt.jobId));
            if (jobDoc.exists()) {
              job = { id: jobDoc.id, ...jobDoc.data() } as Job;
              jobCache.set(appt.jobId, job);
            }
          } catch (e) {
            console.error('Error fetching job for appointment:', e);
          }
        }

        const otherUserId = profile.role === 'client' ? appt.professionalId : appt.clientId;
        let otherUser = userCache.get(otherUserId);
        if (!otherUser) {
          try {
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            if (userDoc.exists()) {
              otherUser = { uid: userDoc.id, ...userDoc.data() } as UserProfile;
              userCache.set(otherUserId, otherUser);
            }
          } catch (e) {
            console.error('Error fetching user for appointment:', e);
          }
        }

        return { ...appt, job, otherUser };
      }));

      setAppointments(enriched);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'appointments');
    });

    return unsubscribe;
  }, [profile]);

  // Messages Listener
  useEffect(() => {
    if (!selectedBid || view !== 'chat') return;
    
    const q = query(collection(db, 'messages'), where('bidId', '==', selectedBid.id), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const m = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(m);

      // Mark as read if I am the recipient
      if (profile) {
        const unread = snapshot.docs.filter(doc => {
          const data = doc.data();
          return data.recipientId === profile.uid && data.read === false;
        });
        
        if (unread.length > 0) {
          try {
            const batch = writeBatch(db);
            unread.forEach(doc => {
              batch.update(doc.ref, { read: true });
            });
            await batch.commit();
          } catch (err) {
            console.error('Error marking messages as read in listener:', err);
          }
        }
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'messages');
    });

    return unsubscribe;
  }, [selectedBid, view, profile]);

  // Unread Messages Listener
  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'messages'), where('recipientId', '==', profile.uid), where('read', '==', false));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      const bidIds = Array.from(new Set(messages.map(m => m.bidId)));
      
      if (bidIds.length === 0) {
        setUnreadCount(0);
        setUnreadBidIds(new Set());
        return;
      }

      // Filter by isContacted
      try {
        const contactedBidIds = new Set<string>();
        await Promise.all(bidIds.map(async (id) => {
          try {
            const bidSnap = await getDoc(doc(db, 'bids', id));
            if (bidSnap.exists() && (bidSnap.data() as Bid).isContacted === true) {
              contactedBidIds.add(id);
            }
          } catch (err) {
            console.error(`Error fetching bid ${id} for unread check:`, err);
            // If we can't read the bid, we assume it's not contacted or we don't have access
          }
        }));

        const filteredMessages = messages.filter(m => contactedBidIds.has(m.bidId));
        setUnreadCount(filteredMessages.length);
        setUnreadBidIds(contactedBidIds);
      } catch (err) {
        console.error("Error filtering unread messages:", err);
        setUnreadCount(snapshot.size); // Fallback
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'messages');
    });
    return unsubscribe;
  }, [profile]);

  // Unread Bids Listener (for Clients)
  useEffect(() => {
    if (!profile || profile.role !== 'client') {
      setUnreadBidsCount(0);
      return;
    }
    const q = query(collection(db, 'bids'), where('clientId', '==', profile.uid), where('isReadByClient', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadBidsCount(snapshot.size);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'bids');
    });
    return unsubscribe;
  }, [profile]);

  // Unread Contacted Bids Listener (for Professionals)
  useEffect(() => {
    if (!profile || profile.role !== 'professional') {
      setUnreadContactedCount(0);
      return;
    }
    const q = query(collection(db, 'bids'), 
      where('professionalId', '==', profile.uid), 
      where('isContacted', '==', true),
      where('isReadByProfessional', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadContactedCount(snapshot.size);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'bids');
    });
    return unsubscribe;
  }, [profile]);

  // Address Autocomplete
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.length < 3) {
        setSuggestions([]);
        return;
      }
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`);
        const data = await response.json();
        setSuggestions(data);
      } catch (err) {
        console.error('Autocomplete error:', err);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = () => setShowSuggestions(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) {
        setError("La imagen es demasiado grande. Por favor elige una de menos de 800KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const newProfile: UserProfile = {
        uid: user.uid,
        displayName: `${firstName} ${lastName}`,
        firstName,
        lastName,
        username,
        email: user.email || '',
        photoURL: photoURL || user.photoURL || '',
        birthDate,
        phoneNumber,
        role: 'client',
        avgRating: 0,
        numReviews: 0,
        isProfessionalProfileComplete: false,
        isAdmin: user.email ? ADMIN_EMAILS.includes(user.email) : false
      };
      
      await setDoc(doc(db, 'users', user.uid), newProfile);
      
      // Sync Auth profile
      try {
        await updateProfile(user, {
          displayName: newProfile.displayName,
          photoURL: newProfile.photoURL
        });
      } catch (authUpdateErr) {
        console.error("Error updating auth profile:", authUpdateErr);
      }

      setProfile(newProfile);
      setIsCompletingProfile(false);
    } catch (err) {
      console.error("Error completing profile:", err);
      setError("Error al completar el perfil. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      console.error(err);
      setAuthError("Error al iniciar sesión con Google.");
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') setAuthError("El email ya está en uso.");
      else if (err.code === 'auth/weak-password') setAuthError("La contraseña es muy débil.");
      else if (err.code === 'auth/invalid-email') setAuthError("Email inválido.");
      else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') setAuthError("Email o contraseña incorrectos.");
      else setAuthError("Ocurrió un error en la autenticación.");
    }
  };

  const openChat = async (bid: any) => {
    // If job details are missing, fetch them
    let enrichedBid = { ...bid };
    
    // If not contacted yet and current user is the client, mark as contacted
    if (!enrichedBid.isContacted && profile && enrichedBid.clientId === profile.uid) {
      try {
        await updateDoc(doc(db, 'bids', enrichedBid.id), { 
          isContacted: true,
          isReadByProfessional: false 
        });
        enrichedBid.isContacted = true;
        enrichedBid.isReadByProfessional = false;
      } catch (err) {
        console.error('Error marking bid as contacted:', err);
      }
    }

    // If professional is opening a contacted bid that is unread, mark as read
    if (enrichedBid.isContacted && profile && enrichedBid.professionalId === profile.uid && enrichedBid.isReadByProfessional === false) {
      try {
        await updateDoc(doc(db, 'bids', enrichedBid.id), { isReadByProfessional: true });
        enrichedBid.isReadByProfessional = true;
      } catch (err) {
        console.error('Error marking bid as read by professional:', err);
      }
    }

    // Ensure otherUser is populated for the chat view
    if (!enrichedBid.otherUser) {
      if (enrichedBid.professional) {
        enrichedBid.otherUser = enrichedBid.professional;
      } else if (profile) {
        const otherUserId = enrichedBid.professionalId === profile.uid ? enrichedBid.clientId : enrichedBid.professionalId;
        try {
          const userSnap = await getDoc(doc(db, 'users', otherUserId));
          if (userSnap.exists()) {
            enrichedBid.otherUser = { uid: userSnap.id, ...userSnap.data() } as UserProfile;
          }
        } catch (err) {
          console.error('Error fetching other user for chat:', err);
        }
      }
    }

    if (!enrichedBid.job && enrichedBid.jobId) {
      try {
        const jobSnap = await getDoc(doc(db, 'jobs', enrichedBid.jobId));
        if (jobSnap.exists()) {
          enrichedBid.job = { id: jobSnap.id, ...jobSnap.data() } as Job;
        }
      } catch (err) {
        console.error('Error fetching job for chat:', err);
      }
    }

    setSelectedBid(enrichedBid);
    setView('chat');
    
    if (profile) {
      try {
        const q = query(
          collection(db, 'messages'), 
          where('bidId', '==', bid.id), 
          where('recipientId', '==', profile.uid), 
          where('read', '==', false)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { read: true });
          });
          await batch.commit();
        }
      } catch (err) {
        console.error('Error marking messages as read:', err);
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setView('home');
    setShowTutorial(false);
  };

  const toggleRole = async () => {
    if (!profile) return;
    
    // If switching to professional and profile is not complete, show registration
    if (profile.role === 'client' && !profile.isProfessionalProfileComplete) {
      setShowProfRegistration(true);
      return;
    }

    const newRole = profile.role === 'client' ? 'professional' : 'client';
    try {
      await updateDoc(doc(db, 'users', profile.uid), { role: newRole });
      setProfile({ ...profile, role: newRole });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const completeTutorial = async () => {
    setShowTutorial(false);
    if (!profile) return;

    if (profile.role === 'client' && !profile.hasSeenTutorial) {
      try {
        await updateDoc(doc(db, 'users', profile.uid), { hasSeenTutorial: true });
        setProfile({ ...profile, hasSeenTutorial: true });
      } catch (err) {
        console.error('Error updating tutorial status:', err);
      }
    } else if (profile.role === 'professional' && !profile.hasSeenProfTutorial) {
      try {
        await updateDoc(doc(db, 'users', profile.uid), { hasSeenProfTutorial: true });
        setProfile({ ...profile, hasSeenProfTutorial: true });
      } catch (err) {
        console.error('Error updating professional tutorial status:', err);
      }
    }
  };

  const handleEditProfile = () => {
    if (!profile) return;
    setFirstName(profile.firstName || '');
    setLastName(profile.lastName || '');
    setUsername(profile.username || '');
    setBirthDate(profile.birthDate || '');
    setPhoneNumber(profile.phoneNumber || '');
    setPhotoURL(profile.photoURL || '');
    setProfSpecialties(profile.specialties || []);
    setProfDescription(profile.professionalDescription || '');
    setProfLicense(profile.licenseNumber || '');
    setShowEditProfile(true);
  };

  const updateProfileData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    setIsCompletingProfile(true);
    try {
      const updatedData: Partial<UserProfile> = {
        firstName,
        lastName,
        username,
        birthDate,
        phoneNumber,
        photoURL,
      };

      if (profile.role === 'professional') {
        updatedData.specialties = profSpecialties;
        updatedData.professionalDescription = profDescription;
        updatedData.licenseNumber = profLicense;
        updatedData.isProfessionalProfileComplete = true;
      }

      await updateDoc(doc(db, 'users', user.uid), updatedData);
      setProfile({ ...profile, ...updatedData });
      setShowEditProfile(false);
      setError("Perfil actualizado con éxito.");
    } catch (err) {
      console.error("Error updating profile:", err);
      setError("Error al actualizar el perfil.");
    } finally {
      setIsCompletingProfile(false);
    }
  };

  const completeProfessionalProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (profSpecialties.length === 0) {
      setError("Por favor selecciona al menos una categoría.");
      return;
    }
    if (profDescription.length < 20) {
      setError("La descripción debe tener al menos 20 caracteres.");
      return;
    }

    setIsDeleting(true); // Reusing isDeleting as a generic loading state
    try {
      const updatedData = {
        specialties: profSpecialties,
        professionalDescription: profDescription,
        licenseNumber: profLicense,
        isProfessionalProfileComplete: true,
        role: 'professional' as const
      };
      await updateDoc(doc(db, 'users', profile.uid), updatedData);
      const updatedProfile = { ...profile, ...updatedData };
      setProfile(updatedProfile);
      setShowProfRegistration(false);
      setView('home');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
      setError("No se pudo completar el perfil. Intenta de nuevo.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGeocode = async () => {
    if (!searchQuery) return;
    setIsGeocoding(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const newLat = parseFloat(lat);
        const newLng = parseFloat(lon);
        setTempLocation({ lat: newLat, lng: newLng });
        setMapCenter([newLat, newLng]);
        setShowSuggestions(false);
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSelectSuggestion = (suggestion: any) => {
    const { lat, lon, display_name } = suggestion;
    const newLat = parseFloat(lat);
    const newLng = parseFloat(lon);
    setTempLocation({ lat: newLat, lng: newLng });
    setMapCenter([newLat, newLng]);
    setSearchQuery(display_name);
    setShowSuggestions(false);
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        setTempLocation({ lat: latitude, lng: longitude });
        setMapCenter([latitude, longitude]);
        
        // Try to get address automatically
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          if (data.display_name) {
            setSearchQuery(data.display_name);
          }
        } catch (err) {
          console.error('Reverse geocoding error:', err);
        }
      }, (error) => {
        console.error('Geolocation error:', error);
      });
    }
  };

  // Auto-location for job creation
  useEffect(() => {
    if (view === 'create-job') {
      handleGetCurrentLocation();
    }
  }, [view]);

  const createJob = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;
    const formData = new FormData(e.currentTarget);
    const newJob = {
      clientId: profile.uid,
      title: formData.get('title') as string,
      category: formData.get('category') as string,
      description: formData.get('description') as string,
      status: 'Open' as JobStatus,
      isUrgent: formData.get('isUrgent') === 'on',
      location: {
        lat: tempLocation?.lat || -34.6037,
        lng: tempLocation?.lng || -58.3816,
        address: formData.get('address') as string,
      },
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, 'jobs'), newJob);
      setView('home');
      setTempLocation(null);
      setSearchQuery('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'jobs');
    }
  };

  const submitBid = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile || !selectedJob) return;
    
    if (selectedJob.clientId === profile.uid) {
      return;
    }

    const formData = new FormData(e.currentTarget);
    const newBid = {
      jobId: selectedJob.id,
      clientId: selectedJob.clientId,
      professionalId: profile.uid,
      proposedPrice: Number(formData.get('price')),
      message: formData.get('message') as string,
      createdAt: new Date().toISOString(),
      lastMessage: formData.get('message') as string,
      lastMessageAt: new Date().toISOString(),
      isContacted: false,
      isReadByClient: false,
      isReadByProfessional: true,
    };

    try {
      const batch = writeBatch(db);
      const bidRef = doc(collection(db, 'bids'));
      const msgRef = doc(collection(db, 'messages'));
      
      batch.set(bidRef, newBid);
      batch.set(msgRef, {
        bidId: bidRef.id,
        senderId: profile.uid,
        recipientId: selectedJob.clientId,
        text: newBid.message,
        timestamp: newBid.createdAt,
        read: false
      });

      await batch.commit();

      // Set the selected bid so the chat view can open it
      setSelectedBid({ id: bidRef.id, ...newBid } as Bid);
      setView('home');
      setSelectedJob(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'bids');
      setError('Error al enviar la postulación. Por favor, intenta de nuevo.');
    }
  };

  const [isSending, setIsSending] = useState(false);

  const sendSystemMessage = async (bidId: string, text: string, senderId: string, recipientId: string) => {
    const timestamp = new Date().toISOString();
    try {
      const batch = writeBatch(db);
      const msgRef = doc(collection(db, 'messages'));
      batch.set(msgRef, {
        bidId,
        senderId,
        recipientId,
        text,
        timestamp,
        read: false,
        isSystem: true
      });
      batch.update(doc(db, 'bids', bidId), {
        lastMessage: text,
        lastMessageAt: timestamp
      });
      await batch.commit();
    } catch (err) {
      console.error("Error sending system message:", err);
    }
  };

  const sendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile || !selectedBid || isSending) return;
    const input = e.currentTarget.elements.namedItem('message') as HTMLInputElement;
    const text = input.value;
    if (!text.trim()) return;

    setIsSending(true);
    const recipientId = selectedBid.professionalId === profile.uid ? selectedBid.clientId : selectedBid.professionalId;
    const timestamp = new Date().toISOString();
    const newMessage = {
      bidId: selectedBid.id,
      senderId: profile.uid,
      recipientId,
      text,
      timestamp,
      read: false
    };

    try {
      const batch = writeBatch(db);
      const msgRef = doc(collection(db, 'messages'));
      
      batch.set(msgRef, newMessage);
      batch.update(doc(db, 'bids', selectedBid.id), {
        lastMessage: text,
        lastMessageAt: timestamp
      });

      await batch.commit();
      input.value = '';
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
      setError('Error al enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  };

  const submitRating = async (stars: number, comment: string) => {
    if (!profile || !ratingAppointment) return;
    try {
      const reviewerId = profile.uid;
      const reviewedId = profile.role === 'client' ? ratingAppointment.professionalId : ratingAppointment.clientId;
      const jobId = ratingAppointment.jobId;

      // 1. Create review
      await addDoc(collection(db, 'reviews'), {
        reviewerId,
        reviewedId,
        jobId,
        stars,
        comment,
        createdAt: new Date().toISOString()
      });

      // 2. Update user profile (avgRating, numReviews)
      const reviewedRef = doc(db, 'users', reviewedId);
      const reviewedSnap = await getDoc(reviewedRef);
      if (reviewedSnap.exists()) {
        const reviewedData = reviewedSnap.data() as UserProfile;
        const oldAvg = reviewedData.avgRating || 0;
        const oldNum = reviewedData.numReviews || 0;
        const newNum = oldNum + 1;
        const newAvg = ((oldAvg * oldNum) + stars) / newNum;
        
        await updateDoc(reviewedRef, {
          avgRating: newAvg,
          numReviews: newNum
        });
      }

      // 3. Update appointment (clientRated or professionalRated)
      const apptRef = doc(db, 'appointments', ratingAppointment.id);
      if (profile.role === 'client') {
        await updateDoc(apptRef, { clientRated: true });
      } else {
        await updateDoc(apptRef, { professionalRated: true });
      }

      // 4. Send system message
      const systemMsg = `⭐ ${profile.displayName} ha calificado el encuentro con ${stars} estrellas.`;
      await sendSystemMessage(
        ratingAppointment.bidId,
        systemMsg,
        profile.uid,
        reviewedId
      );

      setShowRatingModal(false);
      setRatingAppointment(null);
    } catch (err) {
      console.error("Error submitting rating:", err);
      setError("Error al enviar la calificación.");
    }
  };

  const handleUpdateAppointmentStatus = async (apptId: string, status: AppointmentStatus) => {
    if (!profile) return;
    try {
      const appt = appointments.find(a => a.id === apptId);
      if (!appt) return;

      if (status === 'Cancelled') {
        if (appt.status === 'Accepted') {
          const now = new Date();
          const startTime = parseISO(appt.startTime);
          if (differenceInHours(startTime, now) < 48) {
            setError("No se puede cancelar un encuentro confirmado con menos de 48 horas de anticipación.");
            return;
          }
        }
        await updateDoc(doc(db, 'appointments', apptId), { status });
      } else if (status === 'Completed') {
        const updateData: any = {};
        if (profile.role === 'client') {
          updateData.clientConfirmedCompletion = true;
        } else {
          updateData.professionalConfirmedCompletion = true;
        }

        const isClientConfirmed = profile.role === 'client' ? true : !!appt.clientConfirmedCompletion;
        const isProfConfirmed = profile.role === 'professional' ? true : !!appt.professionalConfirmedCompletion;

        if (isClientConfirmed && isProfConfirmed) {
          updateData.status = 'Completed';
        }

        await updateDoc(doc(db, 'appointments', apptId), updateData);

        const otherUserId = profile.uid === appt.clientId ? appt.professionalId : appt.clientId;
        const systemMsg = `✅ ${profile.displayName} ha confirmado que se realizó la visita.`;
        await sendSystemMessage(appt.bidId, systemMsg, profile.uid, otherUserId);

        if (isClientConfirmed && isProfConfirmed) {
          const closureMsg = `ℹ️ Ambos han confirmado la visita. El encuentro ha sido marcado como realizado. Esta conversación se cerrará automáticamente en 1 hora. ¡No olviden calificar la experiencia!`;
          await sendSystemMessage(appt.bidId, closureMsg, profile.uid, otherUserId);
        }
        return;
      } else {
        await updateDoc(doc(db, 'appointments', apptId), { status });
      }

      // Send automatic message if cancelled
      if (status === 'Cancelled') {
        const otherUserId = profile.uid === appt.clientId ? appt.professionalId : appt.clientId;
        const systemMsg = `🚫 El encuentro programado para el ${format(parseISO(appt.startTime), "d 'de' MMM, HH:mm", { locale: es })} ha sido cancelado.`;
        await sendSystemMessage(appt.bidId, systemMsg, profile.uid, otherUserId);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${apptId}`);
    }
  };

  const deleteJob = async () => {
    if (!selectedJob) return;
    console.log("Deleting job:", selectedJob.id);
    setIsDeleting(true);
    try {
      // Delete associated bids and messages first
      const bidsQuery = query(
        collection(db, 'bids'), 
        where('jobId', '==', selectedJob.id)
      );
      const bidsSnap = await getDocs(bidsQuery);
      
      const batch = writeBatch(db);
      for (const bidDoc of bidsSnap.docs) {
        const msgsQuery = query(collection(db, 'messages'), where('bidId', '==', bidDoc.id));
        const msgsSnap = await getDocs(msgsQuery);
        msgsSnap.docs.forEach(m => batch.delete(m.ref));
        batch.delete(bidDoc.ref);
      }
      
      batch.delete(doc(db, 'jobs', selectedJob.id));
      await batch.commit();

      setView('home');
      setSelectedJob(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error("Error deleting job:", err);
      setError("No se pudo eliminar la publicación. Por favor, intenta de nuevo.");
      handleFirestoreError(err, OperationType.DELETE, `jobs/${selectedJob.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteChat = async () => {
    if (!bidToDelete) return;

    // Check for appointments
    const relevantAppointments = appointments.filter(a => 
      a.bidId === bidToDelete && 
      (a.status === 'Accepted' || a.status === 'Proposed')
    );
    
    const now = new Date();
    const hasUpcomingAppointment = relevantAppointments.some(a => {
      const startTime = parseISO(a.startTime);
      // Only block if it's an Accepted appointment in the FUTURE and within 48 hours
      return a.status === 'Accepted' && startTime > now && differenceInHours(startTime, now) < 48;
    });

    if (hasUpcomingAppointment) {
      setError("No puedes cerrar el chat porque tienes un encuentro confirmado en menos de 48 horas.");
      setBidToDelete(null);
      setIsDeleting(false);
      return;
    }

    console.log("Deleting chat:", bidToDelete);
    setIsDeleting(true);
    try {
      // Delete associated messages first to clear notifications
      const msgsQuery = query(collection(db, 'messages'), where('bidId', '==', bidToDelete));
      const msgsSnap = await getDocs(msgsQuery);
      
      const batch = writeBatch(db);
      msgsSnap.docs.forEach(m => batch.delete(m.ref));

      // Cancel associated appointments
      relevantAppointments.forEach(a => {
        batch.update(doc(db, 'appointments', a.id), { status: 'Cancelled' });
      });

      // Mark bid as cancelled and not contacted
      batch.update(doc(db, 'bids', bidToDelete), { 
        isCancelled: true, 
        isContacted: false,
        isReadByClient: true,
        isReadByProfessional: true
      });
      
      await batch.commit();

      setBidToDelete(null);
      if (selectedBid?.id === bidToDelete) {
        setSelectedBid(null);
        setView('messages');
      }
    } catch (err) {
      console.error("Error deleting chat:", err);
      setError("No se pudo eliminar la conversación. Por favor, intenta de nuevo.");
      handleFirestoreError(err, OperationType.DELETE, `bids/${bidToDelete}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const generateTestData = async () => {
    setIsDeleting(true);
    try {
      const testUserId = "test-client-" + Math.random().toString(36).substring(7);
      const testUser: UserProfile = {
        uid: testUserId,
        displayName: "Usuario de Prueba (CABA)",
        firstName: "Usuario",
        lastName: "Prueba",
        username: "testuser_" + testUserId.slice(0, 4),
        email: "test@example.com",
        photoURL: `https://picsum.photos/seed/${testUserId}/200`,
        birthDate: "1990-01-01",
        phoneNumber: "+54 9 11 1234-5678",
        role: 'client',
        avgRating: 5,
        numReviews: 10,
        isProfessionalProfileComplete: false
      };

      await setDoc(doc(db, 'users', testUserId), testUser);

      const batch = writeBatch(db);
      
      CATEGORIES.forEach((cat, index) => {
        // Random coords in CABA (approx bounds)
        const lat = -34.65 + (Math.random() * 0.1);
        const lng = -58.50 + (Math.random() * 0.14);
        
        const jobRef = doc(collection(db, 'jobs'));
        batch.set(jobRef, {
          clientId: testUserId,
          title: `Necesito ${cat.name}${index % 3 === 0 ? ' URGENTE' : ''}`,
          category: cat.name,
          isUrgent: index % 3 === 0,
          description: `Esta es una demanda de prueba para la categoría ${cat.name}. Se requiere un profesional con experiencia para realizar tareas de mantenimiento en la zona de Buenos Aires.`,
          status: 'Open',
          location: {
            lat,
            lng,
            address: `Calle de Prueba ${100 + index}, CABA, Argentina`
          },
          createdAt: new Date(Date.now() - index * 3600000).toISOString()
        });
      });

      await batch.commit();
      setError("¡Datos de prueba generados con éxito!");
      setView('home');
    } catch (err) {
      console.error("Error generating test data:", err);
      setError("Error al generar datos de prueba.");
    } finally {
      setIsDeleting(false);
    }
  };

  const resetDatabase = async () => {
    if (!profile?.isAdmin) return;
    setIsResetting(true);
    try {
      const collections = ['users', 'jobs', 'bids', 'messages', 'reviews'];
      for (const colName of collections) {
        const snapshot = await getDocs(collection(db, colName));
        const batch = writeBatch(db);
        let count = 0;
        
        snapshot.docs.forEach((doc) => {
          // Don't delete the current admin user
          if (colName === 'users' && doc.id === user?.uid) return;
          
          batch.delete(doc.ref);
          count++;
          
          // Firestore batches have a 500 limit
          if (count === 499) {
            console.log(`Committing partial batch for ${colName}`);
          }
        });
        
        if (count > 0) {
          await batch.commit();
        }
      }
      
      setError("Base de datos (Firestore) reseteada con éxito. Recuerda borrar los usuarios en la Consola de Firebase.");
      setView('home');
      setShowResetConfirm(false);
    } catch (err) {
      console.error("Error resetting database:", err);
      setError("Error al resetear la base de datos.");
    } finally {
      setIsResetting(false);
    }
  };

  const deleteMyAccount = async () => {
    if (!user) return;

    setIsDeleting(true);
    try {
      // 1. Re-authenticate if it's a Google user (to avoid requires-recent-login)
      const isGoogleUser = user.providerData.some(p => p.providerId === 'google.com');
      if (isGoogleUser) {
        const provider = new GoogleAuthProvider();
        try {
          await reauthenticateWithPopup(user, provider);
        } catch (reauthErr: any) {
          console.error("Re-authentication failed:", reauthErr);
          if (reauthErr.code === 'auth/popup-closed-by-user') {
            setError("Debes completar la autenticación para eliminar tu cuenta.");
            setIsDeleting(false);
            return;
          }
          throw reauthErr;
        }
      }

      // 2. Delete Firestore profile
      await deleteDoc(doc(db, 'users', user.uid));
      
      // 3. Delete Auth account
      await deleteUser(user);
      
      setUser(null);
      setProfile(null);
      setView('home');
      setShowAccountDeleteConfirm(false);
      setError("Tu cuenta ha sido eliminada con éxito.");
    } catch (err: any) {
      console.error("Error deleting account:", err);
      if (err.code === 'auth/requires-recent-login') {
        setError("Por seguridad, debes haber iniciado sesión recientemente para eliminar tu cuenta. Por favor, vuelve a intentarlo.");
      } else {
        setError("Error al eliminar la cuenta. Inténtalo de nuevo.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-50">
        <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 font-medium animate-pulse">ServiceReady está cargando...</p>
      </div>
    );
  }

  if (user && isCompletingProfile) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white p-6 overflow-y-auto">
        <div className="max-w-md w-full text-center py-8">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <UserIcon className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-2 tracking-tight">Completa tu Perfil</h1>
          <p className="text-zinc-500 mb-8 text-sm">Necesitamos unos datos adicionales para que puedas empezar.</p>
          
          <form onSubmit={handleCompleteProfile} className="space-y-4 mb-6 text-left">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Nombre</label>
                <Input 
                  value={firstName} 
                  onChange={(e) => setFirstName(e.target.value)} 
                  placeholder="Juan" 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Apellido</label>
                <Input 
                  value={lastName} 
                  onChange={(e) => setLastName(e.target.value)} 
                  placeholder="Pérez" 
                  required 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Usuario</label>
                <Input 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="juanperez" 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Nacimiento</label>
                <Input 
                  type="date"
                  value={birthDate} 
                  onChange={(e) => setBirthDate(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Celular</label>
              <Input 
                type="tel"
                value={phoneNumber} 
                onChange={(e) => setPhoneNumber(e.target.value)} 
                placeholder="+54 9 11 ..." 
                required 
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-2">
                <button 
                  type="button"
                  onClick={() => { setImageOption('url'); }}
                  className={cn("text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full transition-all", imageOption === 'url' ? "bg-primary text-white" : "bg-zinc-100 text-zinc-500")}
                >
                  URL de Imagen
                </button>
                <button 
                  type="button"
                  onClick={() => { setImageOption('file'); }}
                  className={cn("text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full transition-all", imageOption === 'file' ? "bg-primary text-white" : "bg-zinc-100 text-zinc-500")}
                >
                  Subir Archivo
                </button>
              </div>

              {imageOption === 'url' ? (
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">URL Foto Perfil</label>
                  <Input 
                    type="url"
                    value={photoURL} 
                    onChange={(e) => setPhotoURL(e.target.value)} 
                    placeholder="https://..." 
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Adjuntar Foto Perfil</label>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange}
                      className="hidden" 
                      id="profile-upload-complete"
                    />
                    <label 
                      htmlFor="profile-upload-complete" 
                      className="flex items-center justify-center w-full py-3 border-2 border-dashed border-zinc-200 rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      {photoURL ? (
                        <div className="flex items-center gap-2">
                          <img src={photoURL} className="w-8 h-8 rounded-full object-cover" alt="Preview" />
                          <span className="text-xs font-bold text-primary">Imagen seleccionada</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-zinc-400">
                          <Plus className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">Seleccionar Imagen</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full py-4 text-sm font-black uppercase tracking-widest shadow-lg shadow-primary/20">
              Guardar y Continuar
            </Button>
          </form>
          
          <Button variant="ghost" onClick={() => signOut(auth)} className="text-zinc-400 text-xs uppercase tracking-widest font-bold">
            Cerrar Sesión
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white p-6 overflow-y-auto">
        <div className="max-w-md w-full text-center py-8">
          <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <Briefcase className="w-10 h-10 text-orange-600" />
          </div>
          <h1 className="text-4xl font-bold text-zinc-900 mb-2 tracking-tight">ServiceReady</h1>
          <p className="text-zinc-500 mb-8 text-lg">Conecta con los mejores profesionales de oficios en tu zona.</p>
          
          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6 text-left">
            {isSignUp && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Nombre</label>
                  <Input 
                    value={firstName} 
                    onChange={(e) => setFirstName(e.target.value)} 
                    placeholder="Juan" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Apellido</label>
                  <Input 
                    value={lastName} 
                    onChange={(e) => setLastName(e.target.value)} 
                    placeholder="Pérez" 
                    required 
                  />
                </div>
              </div>
            )}
            
            {isSignUp && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Usuario</label>
                  <Input 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    placeholder="juanperez" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Nacimiento</label>
                  <Input 
                    type="date"
                    value={birthDate} 
                    onChange={(e) => setBirthDate(e.target.value)} 
                    required 
                  />
                </div>
              </div>
            )}

            {isSignUp && (
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Celular</label>
                <Input 
                  type="tel"
                  value={phoneNumber} 
                  onChange={(e) => setPhoneNumber(e.target.value)} 
                  placeholder="+54 9 11 ..." 
                  required 
                />
              </div>
            )}

            {isSignUp && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-2">
                  <button 
                    type="button"
                    onClick={() => { setImageOption('url'); setPhotoURL(''); }}
                    className={cn("text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full transition-all", imageOption === 'url' ? "bg-primary text-white" : "bg-zinc-100 text-zinc-500")}
                  >
                    URL de Imagen
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setImageOption('file'); setPhotoURL(''); }}
                    className={cn("text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full transition-all", imageOption === 'file' ? "bg-primary text-white" : "bg-zinc-100 text-zinc-500")}
                  >
                    Subir Archivo
                  </button>
                </div>

                {imageOption === 'url' ? (
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">URL Foto Perfil</label>
                    <Input 
                      type="url"
                      value={photoURL} 
                      onChange={(e) => setPhotoURL(e.target.value)} 
                      placeholder="https://..." 
                      required 
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Adjuntar Foto Perfil</label>
                    <div className="relative">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange}
                        className="hidden" 
                        id="profile-upload"
                        required={!photoURL}
                      />
                      <label 
                        htmlFor="profile-upload" 
                        className="flex items-center justify-center w-full py-3 border-2 border-dashed border-zinc-200 rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                      >
                        {photoURL ? (
                          <div className="flex items-center gap-2">
                            <img src={photoURL} className="w-8 h-8 rounded-full object-cover" alt="Preview" />
                            <span className="text-xs font-bold text-primary">Imagen seleccionada</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-zinc-400">
                            <Plus className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">Seleccionar Imagen</span>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Email</label>
              <Input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="tu@email.com" 
                required 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Contraseña</label>
              <Input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••" 
                required 
              />
            </div>
            {authError && <p className="text-red-500 text-xs mt-1 font-bold">{authError}</p>}
            <Button type="submit" className="w-full py-4 text-sm font-black uppercase tracking-widest shadow-lg shadow-primary/20">
              {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
            </Button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200"></div></div>
            <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-zinc-500 uppercase">O continuar con</span></div>
          </div>

          <Button variant="outline" onClick={handleLogin} className="w-full py-3 flex items-center justify-center gap-3 mb-6">
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Google
          </Button>

          <p className="text-zinc-500 text-sm">
            {isSignUp ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'} 
            <button 
              onClick={() => { setIsSignUp(!isSignUp); setAuthError(null); }} 
              className="ml-1 text-orange-600 font-bold hover:underline"
            >
              {isSignUp ? 'Inicia Sesión' : 'Regístrate'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-zinc-50 flex flex-col overflow-hidden font-sans text-zinc-900">
      <header className="glass sticky top-0 z-[1001] px-3 py-2 lg:px-10 lg:py-6 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2 lg:gap-4 cursor-pointer group shrink-0" onClick={() => setView('home')}>
          <div className="w-9 h-9 lg:w-16 lg:h-16 bg-primary rounded-xl lg:rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
            <Briefcase className="w-4.5 h-4.5 lg:w-9 lg:h-9 text-white" />
          </div>
          <h1 className="text-lg lg:text-3xl font-black tracking-tight text-stone-900">ServiceReady</h1>
        </div>
        <div className="flex items-center gap-2 lg:gap-8 min-w-0">
          <div className="flex items-center gap-2 lg:gap-6 bg-stone-100/50 p-1.5 lg:p-3 rounded-2xl border border-stone-200/60 min-w-0">
            <div className="flex flex-col items-end px-1 lg:px-2 min-w-0">
              <div className="hidden sm:flex items-center gap-3 mb-1">
                {profile?.isAdmin && <Badge variant="danger" className="text-[9px] px-2 py-0.5 shadow-sm">Admin</Badge>}
                <span className="text-[10px] lg:text-[12px] uppercase tracking-wider text-stone-400 font-black">Modo</span>
                <span className="text-[11px] lg:text-[13px] font-black text-primary uppercase bg-white px-3 py-1 rounded-lg shadow-sm border border-primary/10">
                  {profile ? (profile.role === 'client' ? 'Cliente' : 'Profesional') : 'Cargando...'}
                </span>
              </div>
              <div className="sm:hidden flex items-center gap-1.5 mb-1">
                {profile?.isAdmin && <Badge variant="danger" className="text-[7px] px-1 py-0">Admin</Badge>}
                <span className="text-[9px] font-black text-primary uppercase bg-white px-1.5 py-0.5 rounded-md shadow-sm border border-primary/10 whitespace-nowrap">
                  {profile ? (profile.role === 'client' ? 'Cliente' : 'Profesional') : '...'}
                </span>
              </div>
              <Button 
                id="role-switch-button"
                variant="ghost" 
                onClick={toggleRole} 
                className="text-[9px] lg:text-[11px] uppercase tracking-widest font-black h-6 lg:h-8 px-2 lg:px-3 rounded-lg text-stone-500 hover:text-primary hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-stone-200"
              >
                <span className="hidden sm:inline">Cambiar a {profile ? (profile.role === 'client' ? 'Profesional' : 'Cliente') : '...'}</span>
                <span className="sm:hidden inline">Cambiar</span>
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setShowTutorial(true)}
                className="text-[9px] lg:text-[11px] uppercase tracking-widest font-black h-6 lg:h-8 px-2 lg:px-3 rounded-lg text-stone-500 hover:text-primary hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-stone-200 flex items-center gap-1.5"
                title="Ver Tutorial"
              >
                <HelpCircle className="w-4 h-4 lg:w-5 lg:h-5" />
                <span>Ayuda</span>
              </Button>
            </div>
            <div 
              className="w-9 h-9 lg:w-16 lg:h-16 rounded-xl lg:rounded-2xl overflow-hidden border-2 border-white cursor-pointer hover:border-primary transition-all shadow-md active:scale-95 flex-shrink-0"
              onClick={() => setView('profile')}
            >
              <img src={profile?.photoURL || user.photoURL || ''} alt="Profile" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn("p-6 mx-auto w-full", profile?.role === 'professional' ? "max-w-7xl" : "max-w-4xl")}
              id="main-content"
            >
              {profile?.role === 'professional' && !profile.isProfessionalProfileComplete ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-stone-200 shadow-sm text-center px-6">
                  <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-6">
                    <UserIcon className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-2xl font-black text-stone-900 mb-3 uppercase tracking-tight">¡Casi listo!</h3>
                  <p className="text-stone-500 max-w-md mb-8 leading-relaxed">
                    Para ver los trabajos disponibles y empezar a postularte, necesitamos que completes tu perfil profesional.
                  </p>
                  <Button 
                    onClick={() => setShowProfRegistration(true)}
                    className="px-10 py-4 text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                  >
                    Completar Perfil Profesional
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-stone-900">
                        {profile?.role === 'professional' ? 'Trabajos Disponibles' : 'Mis Pedidos'}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {profile?.role === 'professional' ? 'Encuentra nuevas oportunidades de trabajo' : 'Gestiona tus solicitudes de servicio'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {profile?.role === 'professional' && (
                        <div className="flex lg:hidden bg-white rounded-xl border border-border p-1 shadow-sm">
                          <button 
                            onClick={() => setDisplayMode('list')}
                            aria-label="Vista de lista"
                            className={cn('p-2 rounded-lg transition-all', displayMode === 'list' ? 'bg-primary/10 text-primary' : 'text-stone-400 hover:text-stone-600')}
                          >
                            <ListIcon className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => setDisplayMode('map')}
                            aria-label="Vista de mapa"
                            className={cn('p-2 rounded-lg transition-all', displayMode === 'map' ? 'bg-primary/10 text-primary' : 'text-stone-400 hover:text-stone-600')}
                          >
                            <MapIcon className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                      {profile?.role === 'client' && (
                        <Button id="new-job-button" onClick={() => setView('create-job')} className="flex items-center gap-2">
                          <Plus className="w-5 h-5" /> Nuevo Trabajo
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {profile?.role === 'professional' && (
                <div className="relative group mb-6 lg:mb-10 -mx-4 px-4">
                  <div 
                    ref={categoriesRef}
                    className="flex gap-2 lg:gap-4 overflow-x-auto py-2 lg:py-3 px-10 lg:px-16 no-scrollbar scroll-smooth"
                  >
                    <button
                      onClick={() => setSelectedCategory('Todas')}
                      className={cn(
                        "px-4 lg:px-8 py-2 lg:py-3.5 rounded-full text-[10px] lg:text-xs font-bold uppercase tracking-[0.1em] transition-all border shadow-sm shrink-0",
                        selectedCategory === 'Todas' 
                          ? "bg-primary text-primary-foreground border-primary shadow-xl shadow-primary/20 scale-105" 
                          : "bg-white border-border text-stone-600 hover:border-primary/40 hover:bg-stone-50"
                      )}
                    >
                      Todas
                    </button>
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.name}
                        onClick={() => setSelectedCategory(cat.name)}
                        className={cn(
                          "px-4 lg:px-8 py-2 lg:py-3.5 rounded-full text-[10px] lg:text-xs font-bold uppercase tracking-[0.1em] transition-all border shadow-sm whitespace-nowrap shrink-0",
                          selectedCategory === cat.name 
                            ? "bg-primary text-primary-foreground border-primary shadow-xl shadow-primary/20 scale-105" 
                            : "bg-white border-border text-stone-600 hover:border-primary/40 hover:bg-stone-50"
                        )}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                  
                  {/* Navigation Arrows with Improved Aesthetics */}
                  <div className="absolute left-0 top-0 bottom-0 w-12 lg:w-24 bg-gradient-to-r from-stone-50 via-stone-50/90 to-transparent pointer-events-none z-10" />
                  <div className="absolute right-0 top-0 bottom-0 w-12 lg:w-24 bg-gradient-to-l from-stone-50 via-stone-50/90 to-transparent pointer-events-none z-10" />

                  <div className="absolute top-1/2 -translate-y-1/2 left-4 z-20 opacity-0 group-hover:opacity-100 transition-all duration-500 hidden md:block">
                    <button 
                      onClick={() => scrollCategories('left')}
                      className="w-14 h-14 bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-stone-100 flex items-center justify-center text-stone-600 hover:text-primary hover:border-primary hover:scale-110 transition-all active:scale-95"
                    >
                      <ChevronLeft className="w-7 h-7" />
                    </button>
                  </div>
                  <div className="absolute top-1/2 -translate-y-1/2 right-4 z-20 opacity-0 group-hover:opacity-100 transition-all duration-500 hidden md:block">
                    <button 
                      onClick={() => scrollCategories('right')}
                      className="w-14 h-14 bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-stone-100 flex items-center justify-center text-stone-600 hover:text-primary hover:border-primary hover:scale-110 transition-all active:scale-95"
                    >
                      <ChevronRight className="w-7 h-7" />
                    </button>
                  </div>
                </div>
              )}

              <div className={cn(
                "grid gap-8",
                profile?.role === 'professional' ? "lg:grid-cols-[1.2fr_1fr] lg:h-[calc(100vh-280px)]" : "grid-cols-1"
              )}>
                {/* List Column */}
                <div 
                  id="jobs-list"
                  className={cn(
                    "grid gap-8",
                    profile?.role === 'professional' && displayMode === 'map' ? "hidden lg:grid" : "grid",
                    profile?.role === 'professional' && "lg:overflow-y-auto lg:px-8 lg:pb-12 no-scrollbar"
                  )}
                >
                  {filteredJobs.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-border flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mb-4">
                        <Search className="w-8 h-8 text-stone-300" />
                      </div>
                      <h3 className="text-lg font-bold text-stone-900 mb-1">Sin resultados</h3>
                      <p className="text-muted-foreground text-sm max-w-[250px]">No encontramos trabajos que coincidan con tu búsqueda en este momento.</p>
                    </div>
                  ) : (
                    filteredJobs.map(job => (
                      <motion.div 
                        key={job.id}
                        ref={el => jobRefs.current[job.id] = el}
                        whileHover={{ y: -4 }}
                        animate={highlightedJobId === job.id ? { scale: 1.02, borderColor: 'var(--color-primary)' } : { scale: 1, borderColor: 'var(--color-border)' }}
                        className={cn(
                          "bg-white py-6 lg:py-28 px-4 lg:px-12 rounded-2xl border shadow-lg cursor-pointer card-hover group relative overflow-hidden transition-all duration-500 flex flex-col items-center text-center justify-center min-h-[160px] lg:min-h-[380px]",
                          highlightedJobId === job.id ? "border-primary ring-4 ring-primary/10 bg-primary/[0.01] shadow-2xl shadow-primary/5" : "border-border"
                        )}
                        onClick={() => {
                          setSelectedJob(job);
                          setView('job-details');
                          setHighlightedJobId(job.id);
                        }}
                      >
                        {/* Left Orange Illumination */}
                        {highlightedJobId === job.id && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 lg:w-2 bg-primary shadow-[10px_0_30px_rgba(249,115,22,0.3)] z-20" />
                        )}
                        
                        <div className="absolute top-0 right-0 w-24 lg:w-48 h-24 lg:h-48 bg-primary/5 rounded-full -mr-12 lg:-mr-24 -mt-12 lg:-mt-24 group-hover:bg-primary/10 transition-colors" />
                        
                        <div className="flex flex-col items-center mb-2 lg:mb-8 relative z-10 w-full">
                          <div className="flex flex-wrap justify-center items-center gap-1.5 lg:gap-3 mb-2 lg:mb-6">
                            <Badge variant={job.status === 'Open' ? 'warning' : 'success'} className="px-1.5 lg:px-4 py-0.5 lg:py-1.5 text-[7px] lg:text-[10px] font-bold">
                              {job.status === 'Open' ? 'Abierto' : 'Completado'}
                            </Badge>
                            {job.isUrgent && (
                              <Badge variant="danger" className="px-1.5 lg:px-4 py-0.5 lg:py-1.5 text-[7px] lg:text-[10px] font-bold flex items-center gap-1 lg:gap-1.5">
                                <Clock className="w-2 lg:w-3.5 h-2 lg:h-3.5" /> URGENTE
                              </Badge>
                            )}
                            <span className="text-[7px] lg:text-[10px] font-black text-primary bg-primary/10 px-1.5 lg:px-4 py-0.5 lg:py-1.5 rounded-full uppercase tracking-wider lg:tracking-[0.15em]">
                              {job.category}
                            </span>
                          </div>
                          
                          <h3 className="font-bold text-base lg:text-3xl text-stone-900 group-hover:text-primary transition-colors leading-tight mb-1 lg:mb-4 max-w-[95%] lg:max-w-[90%]">{job.title}</h3>
                          
                          <div className="flex items-center justify-center gap-2 text-stone-400 text-[9px] lg:text-xs font-bold uppercase tracking-widest">
                            <span>{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true, locale: es })}</span>
                          </div>
                        </div>
                        
                        <p className="text-stone-500 line-clamp-1 lg:line-clamp-3 mb-3 lg:mb-10 text-xs lg:text-lg leading-relaxed relative z-10 max-w-[90%] lg:max-w-[85%]">{job.description}</p>
                        
                        <div className="flex flex-col items-center gap-2 lg:gap-6 w-full relative z-10 pt-3 lg:pt-8 border-t border-stone-100">
                          <div className="flex items-center justify-center gap-1.5 lg:gap-2 text-stone-500 text-[9px] lg:text-sm font-bold uppercase tracking-wider">
                            <MapPin className="w-3 lg:w-5 h-3 lg:h-5 text-primary" /> 
                            <span className="truncate max-w-[180px] lg:max-w-[400px]">{job.location.address}</span>
                          </div>
                          
                          <div className="flex items-center justify-center gap-2 lg:gap-3 text-primary group-hover:scale-110 transition-transform">
                            <span className="text-[9px] lg:text-sm font-black uppercase tracking-wider lg:tracking-[0.25em]">Ver Detalles</span>
                            <ChevronLeft className="w-3.5 lg:w-6 h-3.5 lg:h-6 rotate-180" />
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* Map Column */}
                {profile?.role === 'professional' && (
                  <div 
                    id="jobs-map"
                    className={cn(
                      "h-[500px] lg:h-full w-full rounded-3xl overflow-hidden border border-zinc-200 shadow-xl mb-8 z-0",
                      displayMode === 'list' ? "hidden lg:block" : "block"
                    )}
                  >
                    <MapContainer center={BUENOS_AIRES_CENTER} zoom={10} style={{ height: '100%', width: '100%' }}>
                      <TileLayer 
                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" 
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                      />
                      <MapController center={BUENOS_AIRES_CENTER} displayMode={displayMode} />
                      {filteredJobs.map(job => (
                        <Marker 
                          key={job.id} 
                          position={[job.location.lat, job.location.lng]}
                          icon={job.isUrgent ? redIcon : blueIcon}
                          eventHandlers={{
                            click: () => {
                              scrollToJob(job.id);
                            }
                          }}
                        >
                          <Popup>
                            <div className="p-2">
                              <h4 className="font-bold text-sm">{job.title}</h4>
                              <p className="text-xs text-zinc-500 mb-2">{job.category}</p>
                              <Button className="py-1 px-3 text-[10px] w-full" onClick={() => {
                                setSelectedJob(job);
                                setView('job-details');
                              }}>Ver Detalles</Button>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'create-job' && (
            <motion.div 
              key="create-job"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-6 max-w-2xl mx-auto w-full"
            >
              {profile?.role !== 'client' ? (
                <div className="text-center py-20 bg-white rounded-[2.5rem] border border-border shadow-xl flex flex-col items-center">
                  <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                    <Briefcase className="w-8 h-8 text-destructive" />
                  </div>
                  <h3 className="text-xl font-bold text-stone-900 mb-2">Acceso restringido</h3>
                  <p className="text-stone-500 text-sm max-w-[300px] mb-6">Solo los clientes pueden crear publicaciones de trabajo. Cambia tu rol para continuar.</p>
                  <Button onClick={() => setView('home')} variant="secondary">Volver al Inicio</Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" onClick={() => setView('home')} className="p-2 hover:bg-stone-100 rounded-xl">
                      <ChevronLeft className="w-6 h-6 text-stone-600" />
                    </Button>
                    <div>
                      <h2 className="text-2xl font-bold text-stone-900">Publicar Trabajo</h2>
                      <p className="text-stone-500 text-sm">Describe lo que necesitas para recibir presupuestos.</p>
                    </div>
                  </div>

                  <form onSubmit={createJob} className="space-y-8 bg-white p-8 rounded-[2.5rem] border border-border shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-primary" />
                    
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400 ml-1">Título del trabajo</label>
                      <Input name="title" placeholder="Ej: Plomero para arreglar filtración en cocina" required className="text-lg font-medium" />
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400 ml-1">Categoría</label>
                        <select name="category" className="w-full px-4 py-3 rounded-2xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-stone-50 text-sm font-medium appearance-none cursor-pointer" required>
                          {CATEGORIES.map(cat => (
                            <optgroup key={cat.group} label={cat.group}>
                              <option value={cat.name}>{cat.name}</option>
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400 ml-1">Descripción detallada</label>
                      <TextArea name="description" placeholder="Explica qué necesitas, materiales, urgencia, etc." required className="min-h-[150px]" maxLength={500} />
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-red-50 rounded-2xl border border-red-100">
                      <input 
                        type="checkbox" 
                        name="isUrgent" 
                        id="isUrgent"
                        className="w-5 h-5 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer"
                      />
                      <label htmlFor="isUrgent" className="flex items-center gap-2 cursor-pointer">
                        <Clock className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-bold text-red-700 uppercase tracking-wider">¿Es un pedido urgente?</span>
                      </label>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400 ml-1">Ubicación del servicio (dirección o barrio)</label>
                      <div className="relative">
                        <Input 
                          name="address" 
                          placeholder="Ingrese dirección o barrio" 
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowSuggestions(true);
                          }}
                          required
                        />
                        <AnimatePresence>
                          {showSuggestions && suggestions.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute z-[1002] w-full mt-1 bg-white border border-border rounded-xl shadow-xl overflow-hidden"
                            >
                              {suggestions.map((s, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => handleSelectSuggestion(s)}
                                  className="w-full text-left px-4 py-3 text-sm hover:bg-stone-50 border-b border-stone-50 last:border-0"
                                >
                                  {s.display_name}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      
                      <div className="h-[200px] rounded-2xl overflow-hidden border border-border shadow-inner mt-4 relative z-0">
                        <MapContainer center={mapCenter} zoom={10} style={{ height: '100%', width: '100%' }}>
                          <TileLayer 
                            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" 
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                          />
                          <LocationPicker onLocationSelect={(lat, lng) => setTempLocation({ lat, lng })} />
                          <MapController center={mapCenter} />
                          {tempLocation && (
                            <Marker position={[tempLocation.lat, tempLocation.lng]} />
                          )}
                        </MapContainer>
                        <Button 
                          type="button"
                          variant="secondary" 
                          onClick={handleGetCurrentLocation}
                          className="absolute bottom-4 right-4 z-[400] p-2 rounded-full shadow-lg"
                        >
                          <Navigation className="w-5 h-5" />
                        </Button>
                      </div>
                      {tempLocation && (
                        <p className="text-[10px] font-bold text-primary mt-2 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Ubicación seleccionada en el mapa
                        </p>
                      )}
                    </div>

                    <Button type="submit" className="w-full py-4 text-base font-bold uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 group">
                      Publicar Ahora
                      <Plus className="w-5 h-5 ml-2 group-hover:rotate-90 transition-transform" />
                    </Button>
                  </form>
                </>
              )}
            </motion.div>
          )}
          {view === 'job-details' && selectedJob && (
            <motion.div 
              key="job-details"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-6 max-w-4xl mx-auto w-full"
            >
              <div className="flex items-center gap-4 mb-8">
                <Button variant="ghost" onClick={() => {
                  if (selectedAppointment) {
                    setView('agenda');
                    setSelectedAppointment(null);
                    setSelectedJob(null);
                  } else if (selectedBid && view === 'job-details') {
                    setView('chat');
                  } else {
                    setView('home');
                  }
                }} className="p-2">
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <h2 className="text-2xl font-bold">Detalles</h2>
                {(profile?.isAdmin || (profile?.role === 'client' && selectedJob.clientId === profile.uid)) && (
                  <Button 
                    variant="danger" 
                    onClick={() => setShowDeleteConfirm(true)} 
                    disabled={isDeleting}
                    className="ml-auto flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar Pedido {profile?.isAdmin && '(Admin)'}
                  </Button>
                )}
              </div>

              <Modal 
                isOpen={showDeleteConfirm} 
                onClose={() => setShowDeleteConfirm(false)} 
                title="¿Eliminar pedido?"
                disabled={isDeleting}
              >
                <p className="text-zinc-600 mb-6">Esta acción no se puede deshacer. Se eliminarán todas las postulaciones asociadas.</p>
                <Button 
                  variant="danger" 
                  onClick={deleteJob} 
                  disabled={isDeleting}
                  className="w-full"
                >
                  {isDeleting ? 'Eliminando...' : 'Confirmar Eliminación'}
                </Button>
              </Modal>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                  <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
                    <Badge variant="warning" className="mb-2">{selectedJob.category}</Badge>
                    <h1 className="text-3xl font-bold mb-2">{selectedJob.title}</h1>
                    <div className="flex items-center gap-2 text-zinc-500 mb-6">
                      <MapPin className="w-4 h-4" /> {selectedJob.location.address}
                    </div>
                    <p className="text-zinc-700 leading-relaxed mb-8">{selectedJob.description}</p>
                    <div className="flex items-center gap-2 text-zinc-400 text-sm">
                      <Clock className="w-4 h-4" /> {formatDistanceToNow(new Date(selectedJob.createdAt), { addSuffix: true, locale: es })}
                    </div>
                  </div>

                  {selectedJob.clientId === profile?.uid && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold">Postulaciones</h3>
                      <BidsList 
                        jobId={selectedJob.id} 
                        clientId={selectedJob.clientId}
                        onSelectBid={openChat} 
                        onViewProfile={setViewingProfile}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {selectedAppointment?.otherUser && (
                    <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xl">
                      <h3 className="font-bold text-lg mb-4">
                        {profile?.role === 'client' ? 'Profesional' : 'Cliente'}
                      </h3>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden border border-stone-200">
                          <img 
                            src={selectedAppointment.otherUser.photoURL} 
                            alt="" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                          />
                        </div>
                        <div>
                          <h4 className="font-bold text-stone-900">{selectedAppointment.otherUser.displayName}</h4>
                          <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                            {selectedAppointment.status === 'Accepted' ? 'Encuentro Confirmado' : 'Encuentro Propuesto'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-stone-500 text-xs">
                          <Calendar className="w-3 h-3" />
                          {format(parseISO(selectedAppointment.startTime), "d 'de' MMMM", { locale: es })}
                        </div>
                        <div className="flex items-center gap-2 text-stone-500 text-xs">
                          <Clock className="w-3 h-3" />
                          {format(parseISO(selectedAppointment.startTime), "HH:mm")} - {format(parseISO(selectedAppointment.endTime), "HH:mm")}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        onClick={() => setViewingProfile(selectedAppointment.otherUser!)}
                        className="w-full mt-4 text-[10px] font-black uppercase tracking-widest border-stone-100"
                      >
                        Ver Perfil
                      </Button>
                    </div>
                  )}

                  {profile?.role === 'professional' && selectedJob.clientId !== profile.uid && (
                    <>
                      {!profile.isProfessionalProfileComplete ? (
                        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xl text-center">
                          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <UserIcon className="w-6 h-6 text-primary" />
                          </div>
                          <h3 className="font-bold text-lg mb-2">Perfil Incompleto</h3>
                          <p className="text-stone-500 text-sm mb-6 leading-relaxed">
                            Debes completar tu perfil profesional para poder enviar presupuestos.
                          </p>
                          <Button 
                            onClick={() => setShowProfRegistration(true)}
                            className="w-full py-3 text-xs font-black uppercase tracking-widest"
                          >
                            Completar Perfil
                          </Button>
                        </div>
                      ) : myBids.some(b => b.jobId === selectedJob.id) || (selectedBid && selectedBid.jobId === selectedJob.id) ? (
                        (() => {
                          const bid = myBids.find(b => b.jobId === selectedJob.id) || selectedBid;
                          if (bid?.isCancelled) {
                            return (
                              <div className="bg-red-50 p-6 rounded-3xl border border-red-200 text-center">
                                <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                <h3 className="font-bold text-lg mb-2 text-red-900">Postulación Cancelada</h3>
                                <p className="text-red-700 text-sm mb-4">Has cancelado tu postulación para este trabajo. No puedes volver a enviarla.</p>
                                <Button 
                                  variant="ghost"
                                  onClick={() => setView('home')}
                                  className="w-full text-xs font-black uppercase tracking-widest"
                                >
                                  Volver al Inicio
                                </Button>
                              </div>
                            );
                          }
                          return (
                            <div className="bg-orange-50 p-6 rounded-3xl border border-orange-200 text-center">
                              <CheckCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                              <h3 className="font-bold text-lg mb-2 text-orange-900">Ya te postulaste</h3>
                              <p className="text-orange-700 text-sm mb-6">Ya has enviado un presupuesto para este trabajo. Puedes seguir la conversación desde mensajes.</p>
                              <Button 
                                onClick={() => {
                                  if (bid) openChat(bid);
                                }} 
                                className="w-full"
                              >
                                Ir al Chat
                              </Button>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xl">
                          <h3 className="font-bold text-lg mb-4">Enviar Presupuesto (Postulación)</h3>
                          <form onSubmit={submitBid} className="space-y-4">
                            <Input name="price" type="number" placeholder="Precio Estimado ($)" required />
                            <TextArea name="message" placeholder="Mensaje de postulación..." rows={3} required maxLength={500} />
                            <Button type="submit" className="w-full">Enviar Postulación</Button>
                          </form>
                        </div>
                      )}
                    </>
                  )}
                  {profile?.role === 'professional' && selectedJob.clientId === profile.uid && (
                    <div className="bg-blue-50 p-6 rounded-3xl border border-blue-200">
                      <p className="text-blue-800 text-sm font-medium">Este es tu propio trabajo. Podés ver las postulaciones que recibiste a la izquierda.</p>
                    </div>
                  )}
                  {profile?.role === 'client' && selectedJob.clientId !== profile.uid && (
                    <div className="bg-orange-50 p-6 rounded-3xl border border-orange-200">
                      <p className="text-orange-800 text-sm font-medium">Estás viendo este trabajo como cliente. Solo los profesionales pueden postularse.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'messages' && (
            <motion.div 
              key="messages"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-6 max-w-4xl mx-auto w-full"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-black text-stone-900">Mensajes</h2>
                  <p className="text-stone-500 text-sm">Gestioná tus conversaciones y presupuestos.</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
              </div>
              
              <ConversationsList 
                profile={profile} 
                onSelectConversation={openChat} 
                onDeleteChat={(bidId) => setBidToDelete(bidId)}
                unreadBidIds={unreadBidIds}
                isDeleting={isDeleting}
              />

              <Modal 
                isOpen={!!bidToDelete} 
                onClose={() => setBidToDelete(null)} 
                title="¿Eliminar conversación?"
                disabled={isDeleting}
              >
                <p className="text-stone-600 mb-6">
                  {appointments.some(a => a.bidId === bidToDelete && a.status === 'Completed') 
                    ? "Esta acción eliminará la conversación de tu lista."
                    : "Esta acción eliminará la conversación de tu lista. Si eres el profesional, esto también retirará tu postulación."}
                </p>
                <Button 
                  variant="destructive" 
                  onClick={deleteChat} 
                  disabled={isDeleting}
                  className="w-full py-4 rounded-xl font-bold uppercase tracking-widest"
                >
                  {isDeleting ? 'Eliminando...' : 'Eliminar Conversación'}
                </Button>
              </Modal>
            </motion.div>
          )}

          {view === 'chat' && selectedBid && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="h-full flex flex-col bg-stone-50"
            >
              <div className="glass px-6 py-4 border-b border-border flex items-center justify-between z-10">
                <div className="flex items-center gap-4 min-w-0">
                  <Button variant="ghost" onClick={() => setView('messages')} className="p-2 hover:bg-stone-100 rounded-xl">
                    <ChevronLeft className="w-6 h-6 text-stone-600" />
                  </Button>
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="w-10 h-10 rounded-xl overflow-hidden border border-border flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setViewingProfile(selectedBid.otherUser || null)}
                    >
                      <img src={selectedBid.otherUser?.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0 cursor-pointer" onClick={() => setViewingProfile(selectedBid.otherUser || null)}>
                      <h3 className="font-bold text-stone-900 truncate hover:text-primary transition-colors">{selectedBid.otherUser?.displayName}</h3>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">${selectedBid.proposedPrice}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {profile?.role === 'professional' && (
                    <Button 
                      variant="ghost" 
                      onClick={() => setShowAppointmentModal(true)}
                      className="text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/5 px-3"
                    >
                      Agendar
                    </Button>
                  )}
                  {selectedBid.job && (
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setSelectedJob(selectedBid.job || null);
                        setView('job-details');
                      }}
                      className="text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/5 px-3"
                    >
                      Ver Trabajo
                    </Button>
                  )}
                </div>
              </div>

              {activeAppointment && (
                <div className="px-6 py-3 bg-primary/5 border-b border-primary/10 flex items-center justify-between z-10">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-xs font-bold text-stone-900">
                        {activeAppointment.status === 'Proposed' ? 'Encuentro propuesto' : 
                         activeAppointment.status === 'Accepted' ? 'Encuentro confirmado' : 
                         'Encuentro finalizado'}
                      </p>
                      <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                        {format(parseISO(activeAppointment.startTime), "d 'de' MMM, HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeAppointment.status === 'Accepted' && parseISO(activeAppointment.endTime) <= new Date() && (
                      <>
                        {((profile?.role === 'client' && !activeAppointment.clientConfirmedCompletion) || 
                          (profile?.role === 'professional' && !activeAppointment.professionalConfirmedCompletion)) ? (
                          <Button 
                            onClick={() => handleUpdateAppointmentStatus(activeAppointment.id, 'Completed')}
                            className="py-1.5 px-3 text-[9px] font-black uppercase tracking-widest bg-primary"
                          >
                            Confirmar Visita
                          </Button>
                        ) : (
                          <div className="px-3 py-1.5 bg-stone-100 rounded-lg border border-stone-200">
                            <p className="text-[8px] font-bold text-stone-500 uppercase tracking-widest">Esperando confirmación...</p>
                          </div>
                        )}
                      </>
                    )}

                    {activeAppointment.status === 'Completed' && (
                      <Button 
                        onClick={() => {
                          setRatingAppointment(activeAppointment);
                          setShowRatingModal(true);
                        }}
                        className="py-1.5 px-3 text-[9px] font-black uppercase tracking-widest bg-yellow-500 hover:bg-yellow-600 text-white"
                      >
                        Calificar
                      </Button>
                    )}

                    {activeAppointment.status === 'Proposed' && activeAppointment.proposedBy !== profile?.uid && (
                      <div className="flex gap-2">
                        <Button 
                          onClick={async () => {
                            try {
                              await updateDoc(doc(db, 'appointments', activeAppointment.id), { status: 'Accepted' });
                              
                              // Send automatic message
                              if (selectedBid && profile) {
                                const startTime = parseISO(activeAppointment.startTime);
                                const formattedDate = format(startTime, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
                                const systemMsg = `✅ ¡Encuentro confirmado! Nos vemos el ${formattedDate}. Recordá que no se puede cancelar con menos de 48hs de anticipación.`;
                                await sendSystemMessage(
                                  selectedBid.id,
                                  systemMsg,
                                  profile.uid,
                                  activeAppointment.proposedBy
                                );
                              }
                            } catch (err) {
                              handleFirestoreError(err, OperationType.UPDATE, `appointments/${activeAppointment.id}`);
                            }
                          }}
                          className="py-1.5 px-3 text-[9px] font-black uppercase tracking-widest bg-green-600 hover:bg-green-700"
                        >
                          Aceptar
                        </Button>
                        <Button 
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await updateDoc(doc(db, 'appointments', activeAppointment.id), { status: 'Rejected' });
                              
                              // Send automatic message
                              if (selectedBid && profile) {
                                const systemMsg = `❌ He rechazado la propuesta de encuentro.`;
                                await sendSystemMessage(
                                  selectedBid.id,
                                  systemMsg,
                                  profile.uid,
                                  activeAppointment.proposedBy
                                );
                              }
                            } catch (err) {
                              handleFirestoreError(err, OperationType.UPDATE, `appointments/${activeAppointment.id}`);
                            }
                          }}
                          className="py-1.5 px-3 text-[9px] font-black uppercase tracking-widest text-red-600"
                        >
                          Rechazar
                        </Button>
                      </div>
                    )}
                    <Button 
                      variant="ghost" 
                      onClick={() => setView('agenda')}
                      className="text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
                    >
                      Ver Agenda
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
                <div className="flex justify-center mb-8">
                  <div className="bg-stone-200/50 backdrop-blur-sm px-4 py-1.5 rounded-full text-[10px] font-bold text-stone-500 uppercase tracking-widest border border-stone-300/30">
                    Inicio de la conversación
                  </div>
                </div>
                {messages.map(msg => (
                  <div key={msg.id} className={cn('flex flex-col', msg.isSystem ? 'items-center my-4' : (msg.senderId === profile?.uid ? 'items-end' : 'items-start'))}>
                    <div className={cn(
                      'max-w-[85%] px-4 py-3 rounded-[1.5rem] text-sm shadow-sm leading-relaxed', 
                      msg.isSystem
                        ? 'bg-stone-100 text-stone-600 border border-stone-200 text-center italic text-xs rounded-2xl'
                        : (msg.senderId === profile?.uid 
                          ? 'bg-primary text-white rounded-tr-none shadow-primary/20' 
                          : 'bg-white text-stone-800 rounded-tl-none border border-border')
                    )}>
                      {msg.text}
                    </div>
                    {!msg.isSystem && (
                      <span className="text-[9px] font-bold text-stone-400 mt-1 px-1 uppercase">
                        {msg.timestamp ? formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true, locale: es }) : 'Ahora'}
                      </span>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 glass border-t border-border">
                <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex gap-2">
                  <Input 
                    name="message" 
                    placeholder={isSending ? "Enviando..." : "Escribe un mensaje..."}
                    autoComplete="off" 
                    disabled={isSending}
                    className="rounded-2xl bg-white border-border focus:ring-primary/10"
                  />
                  <Button 
                    type="submit" 
                    disabled={isSending}
                    className="p-3 rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                  >
                    <Send className={cn("w-5 h-5", isSending && "animate-pulse")} />
                  </Button>
                </form>
              </div>
            </motion.div>
          )}

          {view === 'agenda' && (
            <AgendaView 
              appointments={appointments} 
              profile={profile} 
              onUpdateStatus={handleUpdateAppointmentStatus}
              onViewJob={(job) => {
                setSelectedJob(job);
                // Find the appointment for this job to show other party info
                const appt = appointments.find(a => a.jobId === job.id);
                setSelectedAppointment(appt || null);
                setView('job-details');
              }}
              onViewProfile={setViewingProfile}
              onRate={(appt) => {
                setRatingAppointment(appt);
                setShowRatingModal(true);
              }}
            />
          )}
        </AnimatePresence>
      </main>

        {/* Tutorial Overlay */}
        <Tutorial 
          isOpen={showTutorial} 
          onClose={() => setShowTutorial(false)}
          onComplete={completeTutorial}
          role={profile?.role || 'client'}
        />

      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-border px-6 py-3 flex items-center justify-around z-[1001] pb-safe">
        <NavButton 
          active={view === 'home'} 
          onClick={() => setView('home')} 
          icon={<Briefcase />} 
          label="Trabajos" 
          badge={profile?.role === 'client' ? unreadBidsCount : 0} 
        />
        <NavButton 
          active={view === 'messages' || view === 'chat'} 
          onClick={() => setView('messages')} 
          icon={<MessageSquare />} 
          label="Mensajes" 
          badge={unreadCount + unreadContactedCount} 
        />
        <NavButton active={view === 'agenda'} onClick={() => setView('agenda')} icon={<Calendar />} label="Agenda" />
        <NavButton active={view === 'profile'} onClick={() => setView('profile')} icon={<UserIcon />} label="Perfil" />
      </nav>

      <AnimatePresence>
        {view === 'profile' && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-stone-50 z-[1002] flex flex-col"
          >
            <div className="glass px-6 py-4 border-b border-border flex items-center justify-between">
              <Button variant="ghost" onClick={() => setView('home')} className="p-2 hover:bg-stone-100 rounded-xl">
                <ChevronLeft className="w-6 h-6 text-stone-600" />
              </Button>
              <h2 className="text-xl font-bold text-stone-900">Mi Perfil</h2>
              <Button variant="ghost" onClick={handleLogout} className="text-destructive hover:bg-destructive/10 rounded-xl p-2">
                <LogOut className="w-6 h-6" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-md mx-auto">
                <div className="flex flex-col items-center text-center mb-12">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl mb-6 group-hover:scale-105 transition-transform duration-500">
                      <img src={profile?.photoURL || user.photoURL || ''} alt="Profile" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-primary text-white p-2 rounded-xl shadow-lg border-2 border-white">
                      <Camera className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-black text-stone-900 mb-1">{profile?.displayName}</h3>
                  <p className="text-stone-400 text-xs font-bold uppercase tracking-[0.2em] mb-1">@{profile?.username}</p>
                  <p className="text-stone-500 text-sm font-medium mb-6">{profile?.email}</p>
                  
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1.5 bg-yellow-400/10 px-4 py-2 rounded-2xl border border-yellow-400/20">
                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        <span className="font-black text-yellow-700 text-lg">{profile?.avgRating || 0}</span>
                      </div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase mt-2 tracking-widest">Calificación</span>
                    </div>
                    <div className="w-px h-10 bg-border" />
                    <div className="flex flex-col items-center">
                      <div className="bg-primary/10 px-4 py-2 rounded-2xl border border-primary/20">
                        <span className="font-black text-primary text-lg">{profile?.numReviews || 0}</span>
                      </div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase mt-2 tracking-widest">Reseñas</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white p-6 rounded-3xl border border-border shadow-sm">
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Información Personal</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-stone-500">Nombre completo</span>
                        <span className="text-sm font-bold text-stone-700">{profile?.firstName} {profile?.lastName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-stone-500">Celular</span>
                        <span className="text-sm font-bold text-stone-700">{profile?.phoneNumber}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-stone-500">Nacimiento</span>
                        <span className="text-sm font-bold text-stone-700">{profile?.birthDate}</span>
                      </div>
                    </div>
                  </div>

                  {profile?.role === 'professional' && (
                    <div className="bg-white p-6 rounded-3xl border border-border shadow-sm">
                      <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Perfil Profesional</h4>
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs text-stone-400 uppercase font-bold tracking-widest block mb-2">Especialidades</span>
                          <div className="flex flex-wrap gap-1.5">
                            {profile.specialties?.map(s => (
                              <Badge key={s} variant="info" className="text-[9px]">{s}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-stone-400 uppercase font-bold tracking-widest block mb-2">Descripción</span>
                          <p className="text-sm text-stone-600 leading-relaxed">{profile.professionalDescription}</p>
                        </div>
                        {profile.licenseNumber && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-stone-500">Matrícula</span>
                            <span className="text-sm font-bold text-stone-700">{profile.licenseNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="bg-white p-6 rounded-3xl border border-border shadow-sm">
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Información de cuenta</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-stone-500">Rol actual</span>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="default" className="capitalize">{profile?.role === 'client' ? 'Cliente' : 'Profesional'}</Badge>
                          <Button 
                            variant="ghost" 
                            onClick={toggleRole} 
                            className="text-[10px] font-bold text-primary uppercase tracking-widest p-0 h-auto hover:bg-transparent"
                          >
                            Cambiar a {profile?.role === 'client' ? 'Profesional' : 'Cliente'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    onClick={handleEditProfile}
                    className="w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-stone-600 border-stone-200 hover:bg-stone-50"
                  >
                    Editar Perfil
                  </Button>

                  {profile?.isAdmin && (
                    <Button 
                      variant="ghost" 
                      onClick={generateTestData}
                      disabled={isDeleting || isResetting}
                      className="w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-primary hover:bg-primary/5 border border-dashed border-primary/30"
                    >
                      {isDeleting ? 'Generando...' : 'Generar Demandas de Prueba'}
                    </Button>
                  )}

                  {profile?.isAdmin && (
                    <div className="space-y-4 mt-4">
                      <Button 
                        variant="ghost" 
                        onClick={() => setShowResetConfirm(true)}
                        disabled={isResetting || isDeleting}
                        className="w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-destructive hover:bg-destructive/5 border border-dashed border-destructive/30"
                      >
                        {isResetting ? 'Reseteando...' : 'Resetear Base de Datos'}
                      </Button>
                      
                      <a 
                        href="https://console.firebase.google.com/project/gen-lang-client-0333997530/authentication/users"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-[10px] font-bold text-stone-400 uppercase tracking-widest hover:text-primary transition-colors"
                      >
                        Ir a Consola de Firebase (Auth)
                      </a>
                    </div>
                  )}

                  <Button 
                    variant="ghost" 
                    onClick={() => setShowAccountDeleteConfirm(true)}
                    disabled={isDeleting || isResetting}
                    className="w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-stone-400 hover:text-destructive hover:bg-destructive/5 mt-8"
                  >
                    Eliminar mi cuenta
                  </Button>

                  <Modal 
                    isOpen={showResetConfirm} 
                    onClose={() => setShowResetConfirm(false)} 
                    title="¿Resetear Base de Datos?"
                    disabled={isResetting}
                  >
                    <p className="text-zinc-600 mb-6">
                      ¿ESTÁS SEGURO? Esto eliminará TODOS los perfiles, trabajos, ofertas y mensajes de la base de datos (Firestore).
                      <br /><br />
                      IMPORTANTE: Los usuarios de autenticación (emails/logins) NO se pueden borrar automáticamente desde aquí por seguridad de Firebase. Deberás borrarlos manualmente en la Consola de Firebase para que puedan volver a registrarse con el mismo email.
                    </p>
                    <Button 
                      variant="danger" 
                      onClick={resetDatabase} 
                      disabled={isResetting}
                      className="w-full"
                    >
                      {isResetting ? 'Reseteando...' : 'Confirmar Reset Total'}
                    </Button>
                  </Modal>

                  <Modal 
                    isOpen={showAccountDeleteConfirm} 
                    onClose={() => setShowAccountDeleteConfirm(false)} 
                    title="¿Eliminar tu cuenta?"
                    disabled={isDeleting}
                  >
                    <p className="text-zinc-600 mb-6">Esta acción es irreversible y borrará tu perfil y tu acceso.</p>
                    <Button 
                      variant="danger" 
                      onClick={deleteMyAccount} 
                      disabled={isDeleting}
                      className="w-full"
                    >
                      {isDeleting ? 'Eliminando...' : 'Eliminar Definitivamente'}
                    </Button>
                  </Modal>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showProfRegistration && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-stone-900 uppercase tracking-tight">Perfil Profesional</h2>
                <button onClick={() => setShowProfRegistration(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <Plus className="w-6 h-6 text-stone-400 rotate-45" />
                </button>
              </div>
              
              <p className="text-stone-500 mb-8 text-sm leading-relaxed">
                Para postularte a trabajos y ver las demandas, necesitamos conocer un poco más sobre tu oficio y experiencia.
              </p>

              <form onSubmit={completeProfessionalProfile} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-3">¿A qué oficios te dedicas?</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => {
                          if (profSpecialties.includes(cat.name)) {
                            setProfSpecialties(profSpecialties.filter(s => s !== cat.name));
                          } else {
                            setProfSpecialties([...profSpecialties, cat.name]);
                          }
                        }}
                        className={cn(
                          "px-4 py-3 rounded-2xl text-xs font-bold transition-all border-2 text-left flex items-center justify-between",
                          profSpecialties.includes(cat.name)
                            ? "bg-primary/10 border-primary text-primary shadow-sm"
                            : "bg-white border-stone-100 text-stone-500 hover:border-stone-200"
                        )}
                      >
                        {cat.name}
                        {profSpecialties.includes(cat.name) && <CheckCircle className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-3">Descripción de tu trabajo</label>
                  <TextArea
                    value={profDescription}
                    onChange={(e) => setProfDescription(e.target.value)}
                    placeholder="Contanos sobre tu experiencia, herramientas que usás, años en el rubro..."
                    className="min-h-[120px]"
                    required
                    maxLength={500}
                  />
                  <p className="text-[10px] text-stone-400 mt-2 font-medium">Mínimo 20 caracteres.</p>
                </div>

                <div>
                  <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-3">Número de Matrícula (Opcional)</label>
                  <Input
                    value={profLicense}
                    onChange={(e) => setProfLicense(e.target.value)}
                    placeholder="Ej: MAT-123456"
                  />
                </div>

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    disabled={isDeleting}
                    className="w-full py-4 text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                  >
                    {isDeleting ? 'Guardando...' : 'Completar Registro Profesional'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditProfile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-stone-900 uppercase tracking-tight">Editar Perfil</h2>
                <button onClick={() => setShowEditProfile(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <Plus className="w-6 h-6 text-stone-400 rotate-45" />
                </button>
              </div>

              <form onSubmit={updateProfileData} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-3">Nombre</label>
                    <Input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-3">Apellido</label>
                    <Input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-3">Nombre de Usuario</label>
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-3">Teléfono</label>
                  <Input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-3">URL Foto de Perfil</label>
                  <Input
                    type="url"
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                  />
                </div>

                {profile?.role === 'professional' && (
                  <>
                    <div className="border-t border-stone-100 pt-6">
                      <h3 className="text-sm font-bold text-stone-900 uppercase tracking-tight mb-4">Datos Profesionales</h3>
                      
                      <div className="mb-6">
                        <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-3">Oficios</label>
                        <div className="grid grid-cols-2 gap-2">
                          {CATEGORIES.map(cat => (
                            <button
                              key={cat.name}
                              type="button"
                              onClick={() => {
                                if (profSpecialties.includes(cat.name)) {
                                  setProfSpecialties(profSpecialties.filter(s => s !== cat.name));
                                } else {
                                  setProfSpecialties([...profSpecialties, cat.name]);
                                }
                              }}
                              className={cn(
                                "px-4 py-3 rounded-2xl text-[10px] font-bold transition-all border-2 text-left flex items-center justify-between",
                                profSpecialties.includes(cat.name)
                                  ? "bg-primary/10 border-primary text-primary shadow-sm"
                                  : "bg-white border-stone-100 text-stone-500 hover:border-stone-200"
                              )}
                            >
                              {cat.name}
                              {profSpecialties.includes(cat.name) && <CheckCircle className="w-3 h-3" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mb-6">
                        <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-3">Descripción Profesional</label>
                        <TextArea
                          value={profDescription}
                          onChange={(e) => setProfDescription(e.target.value)}
                          className="min-h-[100px]"
                          required
                          maxLength={500}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-3">Matrícula</label>
                        <Input
                          type="text"
                          value={profLicense}
                          onChange={(e) => setProfLicense(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                <Button 
                  type="submit" 
                  disabled={isCompletingProfile}
                  className="w-full py-4 rounded-2xl font-bold uppercase tracking-widest"
                >
                  {isCompletingProfile ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingProfile && (
          <UserProfileModal 
            profile={viewingProfile} 
            isOpen={!!viewingProfile} 
            onClose={() => setViewingProfile(null)} 
          />
        )}

        {showAppointmentModal && selectedBid && profile && (
          <AppointmentModal 
            isOpen={showAppointmentModal}
            onClose={() => setShowAppointmentModal(false)}
            bid={selectedBid}
            profile={profile}
            existingAppointments={appointments}
            onPropose={async (apptData) => {
              try {
                console.log('Proposing appointment with data:', apptData);
                await addDoc(collection(db, 'appointments'), {
                  ...apptData,
                  createdAt: new Date().toISOString()
                });
                
                // Send automatic message
                if (selectedBid) {
                  const startTime = parseISO(apptData.startTime);
                  const formattedDate = format(startTime, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
                  const systemMsg = `📅 He propuesto un encuentro para el ${formattedDate}.`;
                  await sendSystemMessage(
                    selectedBid.id,
                    systemMsg,
                    profile.uid,
                    selectedBid.clientId
                  );
                }

                setShowAppointmentModal(false);
              } catch (err) {
                console.error('Error proposing appointment:', err);
                if (err instanceof Error && err.message.includes('insufficient permissions')) {
                   setError('No tienes permisos para agendar este encuentro. Verifica que seas participante del chat.');
                } else {
                   setError('Error al agendar el encuentro. Por favor intenta de nuevo.');
                }
              }
            }}
          />
        )}

        {showRatingModal && ratingAppointment && profile && (
          <RatingModal 
            isOpen={showRatingModal}
            onClose={() => {
              setShowRatingModal(false);
              setRatingAppointment(null);
            }}
            appointment={ratingAppointment}
            profile={profile}
            onSubmit={submitRating}
          />
        )}
      </AnimatePresence>

      {error && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-full z-[3000] shadow-xl">{error}</div>}
    </div>
  );
}

function NavButton({ active, onClick, icon, label, badge }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badge?: number }) {
  return (
    <button onClick={onClick} className={cn('flex flex-col items-center gap-1 relative transition-all active:scale-90', active ? 'text-primary' : 'text-stone-400')}>
      <div className="relative p-1">
        {React.cloneElement(icon as React.ReactElement, { className: cn('w-6 h-6 transition-transform', active && 'scale-110') })}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-lg shadow-primary/20 animate-in zoom-in">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className={cn("text-[9px] font-bold uppercase tracking-widest transition-all", active ? "opacity-100 translate-y-0" : "opacity-60")}>{label}</span>
      {active && (
        <motion.div 
          layoutId="nav-active"
          className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full"
        />
      )}
    </button>
  );
}

function BidsList({ jobId, clientId, onSelectBid, onViewProfile }: { jobId: string, clientId: string, onSelectBid: (bid: Bid) => void, onViewProfile: (profile: UserProfile) => void }) {
  const [bids, setBids] = useState<(Bid & { professional?: UserProfile })[]>([]);
  const lastUpdateRef = useRef(0);
  const cacheRef = useRef<{ users: Record<string, UserProfile> }>({ users: {} });

  useEffect(() => {
    const q = query(
      collection(db, 'bids'), 
      where('jobId', '==', jobId), 
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const updateId = ++lastUpdateRef.current;
      const bData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Bid))
        .filter(bid => bid.isContacted !== true && bid.isCancelled !== true);
      
      // Mark as read by client if any are unread
      const unreadBids = bData.filter(b => b.isReadByClient === false);
      if (unreadBids.length > 0) {
        try {
          const batch = writeBatch(db);
          unreadBids.forEach(b => {
            batch.update(doc(db, 'bids', b.id), { isReadByClient: true });
          });
          await batch.commit();
        } catch (err) {
          console.error("Error marking bids as read by client:", err);
        }
      }

      try {
        const fullBids = await Promise.all(bData.map(async (bid) => {
          if (cacheRef.current.users[bid.professionalId]) {
            return { ...bid, professional: cacheRef.current.users[bid.professionalId] };
          }
          try {
            const profSnap = await getDoc(doc(db, 'users', bid.professionalId));
            const prof = { uid: profSnap.id, ...profSnap.data() } as UserProfile;
            cacheRef.current.users[bid.professionalId] = prof;
            return { ...bid, professional: prof };
          } catch (err) {
            console.error("Error fetching professional profile:", err);
            return { ...bid };
          }
        }));
        
        if (updateId === lastUpdateRef.current) {
          setBids(fullBids);
        }
      } catch (err) {
        console.error("Error processing bids snapshot:", err);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'bids');
    });
    return unsubscribe;
  }, [jobId]);

  if (bids.length === 0) return (
    <div className="text-center py-12 bg-stone-50 rounded-[2rem] border border-dashed border-border">
      <p className="text-stone-400 text-sm font-medium">Aún no hay postulaciones para este trabajo.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {bids.map(bid => (
        <div key={bid.id} className="bg-white p-4 rounded-[2rem] border border-border shadow-sm flex items-center justify-between card-hover group">
          <div className="flex items-center gap-4 min-w-0">
            <div 
              className="w-14 h-14 rounded-2xl overflow-hidden bg-stone-100 border border-border group-hover:border-primary/30 transition-colors flex-shrink-0 cursor-pointer hover:opacity-80"
              onClick={() => bid.professional && onViewProfile(bid.professional)}
            >
              <img src={bid.professional?.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="min-w-0 cursor-pointer" onClick={() => bid.professional && onViewProfile(bid.professional)}>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-stone-900 truncate group-hover:text-primary transition-colors">{bid.professional?.displayName}</h4>
                {bid.isReadByClient === false && (
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                )}
              </div>
              <p className="text-sm text-stone-500 truncate leading-tight">{bid.lastMessage || bid.message}</p>
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="text-[10px] font-bold text-stone-600">4.9 (12 trabajos)</span>
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0 pl-4">
            <p className="text-lg font-black text-primary mb-1">${bid.proposedPrice}</p>
            <Button onClick={() => onSelectBid(bid)} className="py-1.5 px-4 text-xs font-bold uppercase tracking-wider rounded-xl">
              Contactar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

const AppointmentModal = ({ isOpen, onClose, bid, profile, existingAppointments, onPropose }: { isOpen: boolean, onClose: () => void, bid: any, profile: UserProfile, existingAppointments: Appointment[], onPropose: (appt: any) => void }) => {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const checkConflicts = (start: Date, end: Date) => {
    return existingAppointments.some(appt => {
      if (appt.status === 'Rejected' || appt.status === 'Cancelled') return false;
      const apptStart = parseISO(appt.startTime);
      const apptEnd = parseISO(appt.endTime);
      return (
        (start >= apptStart && start < apptEnd) ||
        (end > apptStart && end <= apptEnd) ||
        (start <= apptStart && end >= apptEnd)
      );
    });
  };

  const handlePropose = () => {
    const start = parseISO(`${date}T${startTime}`);
    const end = addHours(start, duration);

    if (start < new Date()) {
      setError('No puedes agendar en el pasado.');
      return;
    }

    if (checkConflicts(start, end)) {
      setError('Ya tienes un compromiso en ese horario.');
      return;
    }

    onPropose({
      jobId: bid.jobId,
      bidId: bid.id,
      clientId: bid.clientId,
      professionalId: bid.professionalId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: 'Proposed',
      proposedBy: profile.uid
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[4000] flex justify-center items-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl relative"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black text-stone-900">Agendar Encuentro</h2>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
              <X className="w-6 h-6 text-stone-400" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Fecha</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={format(new Date(), 'yyyy-MM-dd')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Hora de Inicio</label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Duración (Horas)</label>
                  <select 
                    value={duration} 
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  >
                    <option value={1/60}>1 min (Test)</option>
                    <option value={0.5}>30 min</option>
                    <option value={1}>1 hora</option>
                    <option value={2}>2 horas</option>
                    <option value={3}>3 horas</option>
                    <option value={4}>4 horas</option>
                  </select>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2">
                <X className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-bold text-stone-600">Resumen del encuentro</span>
              </div>
              <p className="text-sm font-bold text-stone-900">
                {format(parseISO(`${date}T${startTime}`), "EEEE d 'de' MMMM", { locale: es })}
              </p>
              <p className="text-xs text-stone-500">
                De {startTime} a {format(addHours(parseISO(`${date}T${startTime}`), duration), 'HH:mm')}
              </p>
            </div>

            <Button onClick={handlePropose} className="w-full py-4 rounded-2xl shadow-lg shadow-primary/20">
              Proponer Horario
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const RatingModal = ({ isOpen, onClose, appointment, profile, onSubmit }: { isOpen: boolean, onClose: () => void, appointment: Appointment, profile: UserProfile, onSubmit: (stars: number, comment: string) => void }) => {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const otherUser = appointment.otherUser;

  return (
    <div className="fixed inset-0 z-[5000] flex justify-center items-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl relative"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-stone-900">Calificar Encuentro</h2>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
              <X className="w-6 h-6 text-stone-400" />
            </button>
          </div>

          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-2xl overflow-hidden mb-4 border-2 border-primary/20">
              <img src={otherUser?.photoURL} alt="" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-lg font-bold text-stone-900">{otherUser?.displayName}</h3>
            <p className="text-xs text-stone-500 font-medium">¿Cómo fue tu experiencia?</p>
          </div>

          <div className="flex justify-center gap-2 mb-8">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setStars(s)}
                className="p-1 transition-transform active:scale-90"
              >
                <Star 
                  className={cn(
                    "w-10 h-10 transition-colors",
                    s <= stars ? "text-yellow-400 fill-yellow-400" : "text-stone-200"
                  )} 
                />
              </button>
            ))}
          </div>

          <div className="space-y-4 mb-8">
            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">Tu comentario</label>
            <TextArea 
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Escribe algo sobre el servicio..."
              className="min-h-[100px]"
            />
          </div>

          <Button 
            onClick={async () => {
              setIsSubmitting(true);
              await onSubmit(stars, comment);
              setIsSubmitting(false);
            }} 
            disabled={isSubmitting}
            className="w-full py-4 rounded-2xl shadow-lg shadow-primary/20"
          >
            {isSubmitting ? 'Enviando...' : 'Enviar Calificación'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

const CalendarComponent = ({ selectedDate, onDateSelect, appointments }: { 
  selectedDate: Date, 
  onDateSelect: (date: Date) => void,
  appointments: Appointment[]
}) => {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));
  
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const hasAppointment = (date: Date) => {
    return appointments.some(a => isSameDay(parseISO(a.startTime), date));
  };

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-black text-stone-900 uppercase tracking-widest text-xs">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h3>
        <div className="flex gap-1">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-stone-50 rounded-full transition-colors hover:text-primary">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-stone-50 rounded-full transition-colors hover:text-primary">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => (
          <div key={d} className="text-center text-[10px] font-black text-stone-300 py-2">{d}</div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const hasAppt = hasAppointment(day);
          const isToday = isSameDay(day, new Date());
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={cn(
                "aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all",
                !isCurrentMonth && "opacity-20",
                isSelected 
                  ? "bg-primary text-white shadow-lg shadow-primary/20 scale-110 z-10" 
                  : isToday 
                    ? "bg-primary/5 text-primary border border-primary/20"
                    : "hover:bg-stone-50 text-stone-600"
              )}
            >
              <span className="text-xs font-bold">{format(day, 'd')}</span>
              {hasAppt && !isSelected && (
                <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const AgendaView = ({ appointments, profile, onUpdateStatus, onViewJob, onViewProfile, onRate }: { 
  appointments: Appointment[], 
  profile: UserProfile | null, 
  onUpdateStatus: (id: string, status: AppointmentStatus) => void,
  onViewJob: (job: Job) => void,
  onViewProfile: (profile: UserProfile) => void,
  onRate: (appt: Appointment) => void
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'upcoming' | 'completed'>('upcoming');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const filteredAppointments = useMemo(() => {
    let filtered = [...appointments];
    const now = new Date();

    if (profile?.role === 'professional' && filter === 'upcoming') {
      // For professionals in upcoming view, we filter by selected date
      filtered = filtered.filter(a => a.status === 'Accepted' && isSameDay(parseISO(a.startTime), selectedDate));
    } else {
      if (filter === 'pending') {
        filtered = filtered.filter(a => a.status === 'Proposed' && a.proposedBy !== profile?.uid);
      } else if (filter === 'upcoming') {
        filtered = filtered.filter(a => a.status === 'Accepted' && parseISO(a.endTime) > now);
      } else if (filter === 'completed') {
        filtered = filtered.filter(a => a.status === 'Completed' || (a.status === 'Accepted' && parseISO(a.endTime) <= now));
      }
    }

    return filtered.sort((a, b) => parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime());
  }, [appointments, filter, profile, selectedDate]);

  if (!profile) return null;

  const isProfessional = profile.role === 'professional';

  return (
    <motion.div 
      key="agenda"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-6xl mx-auto px-6 py-12 pb-12"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-4xl font-black text-stone-900 mb-2">Agenda</h2>
          <p className="text-stone-500 font-medium">Gestiona tus encuentros y servicios acordados.</p>
        </div>
        <div className="w-16 h-16 bg-primary/10 rounded-[2rem] flex items-center justify-center">
          <Calendar className="w-8 h-8 text-primary" />
        </div>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
        {[
          { id: 'upcoming', label: isProfessional ? 'Por Día' : 'Próximos' },
          { id: 'pending', label: 'Pendientes' },
          { id: 'completed', label: 'Finalizados' },
          { id: 'all', label: 'Todos' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={cn(
              "px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
              filter === f.id 
                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={cn(
        "grid gap-8",
        isProfessional && filter === 'upcoming' ? "md:grid-cols-[350px_1fr]" : "grid-cols-1"
      )}>
        {isProfessional && filter === 'upcoming' && (
          <div className="space-y-6">
            <CalendarComponent 
              selectedDate={selectedDate} 
              onDateSelect={setSelectedDate} 
              appointments={appointments.filter(a => a.status === 'Accepted')}
            />
            <div className="p-6 bg-stone-50 rounded-[2.5rem] border border-stone-100">
              <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Resumen del día</h4>
              <p className="text-sm font-bold text-stone-900">
                {filteredAppointments.length} {filteredAppointments.length === 1 ? 'encuentro programado' : 'encuentros programados'}
              </p>
              <p className="text-xs text-stone-500 mt-1">
                {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {filteredAppointments.length === 0 ? (
            <div className="text-center py-20 bg-stone-50 rounded-[3rem] border border-dashed border-stone-200 h-full flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-stone-300" />
              </div>
              <p className="text-stone-400 font-bold">No hay encuentros para esta fecha.</p>
              {isProfessional && filter === 'upcoming' && (
                <p className="text-[10px] text-stone-300 uppercase tracking-widest font-black mt-2">Selecciona otro día en el calendario</p>
              )}
            </div>
          ) : (
            filteredAppointments.map(appt => (
            <div key={appt.id} className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 flex flex-col items-center justify-center border border-stone-200 group-hover:border-primary/20 transition-colors">
                    <span className="text-[10px] font-black text-stone-400 uppercase leading-none mb-1">
                      {format(parseISO(appt.startTime), 'MMM', { locale: es })}
                    </span>
                    <span className="text-lg font-black text-stone-900 leading-none">
                      {format(parseISO(appt.startTime), 'd')}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                        appt.status === 'Accepted' ? "bg-green-50 text-green-600 border-green-100" :
                        appt.status === 'Proposed' ? "bg-orange-50 text-orange-600 border-orange-100" :
                        appt.status === 'Completed' ? "bg-blue-50 text-blue-600 border-blue-100" :
                        "bg-stone-50 text-stone-500 border-stone-100"
                      )}>
                        {appt.status === 'Proposed' ? 'Propuesto' : 
                         appt.status === 'Accepted' ? 'Confirmado' : 
                         appt.status === 'Completed' ? 'Finalizado' :
                         appt.status === 'Rejected' ? 'Rechazado' : appt.status}
                      </span>
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                        {format(parseISO(appt.startTime), 'HH:mm')} - {format(parseISO(appt.endTime), 'HH:mm')}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {appt.job ? (
                        <Button 
                          variant="ghost" 
                          onClick={() => onViewJob(appt.job!)}
                          className="text-stone-900 font-bold hover:text-primary p-0 h-auto justify-start"
                        >
                          Ver trabajo: {appt.job.title}
                        </Button>
                      ) : (
                        <h4 className="font-bold text-stone-900">Encuentro de Servicio</h4>
                      )}
                      
                      {appt.otherUser && (
                        <div 
                          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => onViewProfile(appt.otherUser!)}
                        >
                          <div className="w-4 h-4 rounded-full overflow-hidden border border-stone-200">
                            <img src={appt.otherUser.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <span className="text-[10px] font-bold text-stone-500">{appt.otherUser.displayName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {appt.status === 'Proposed' && appt.proposedBy !== profile.uid && (
                <div className="flex gap-2 mt-6">
                  <Button 
                    onClick={() => onUpdateStatus(appt.id, 'Accepted')}
                    className="flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20"
                  >
                    Aceptar
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={() => onUpdateStatus(appt.id, 'Rejected')}
                    className="flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50"
                  >
                    Rechazar
                  </Button>
                </div>
              )}

              {appt.status === 'Proposed' && appt.proposedBy === profile.uid && (
                <div className="mt-6 flex flex-col gap-2">
                  <Button 
                    variant="ghost"
                    onClick={() => onUpdateStatus(appt.id, 'Cancelled')}
                    className="w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 border border-red-100"
                  >
                    Cancelar Propuesta
                  </Button>
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100 text-center">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Esperando confirmación...</p>
                  </div>
                </div>
              )}

              {appt.status === 'Accepted' && (
                <div className="mt-6 space-y-2">
                  {parseISO(appt.endTime) <= new Date() && (
                    <>
                      {((profile.role === 'client' && !appt.clientConfirmedCompletion) || 
                        (profile.role === 'professional' && !appt.professionalConfirmedCompletion)) ? (
                        <Button 
                          onClick={() => onUpdateStatus(appt.id, 'Completed')}
                          className="w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-primary shadow-lg shadow-primary/20"
                        >
                          Confirmar Visita Realizada
                        </Button>
                      ) : (
                        <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100 text-center">
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Esperando confirmación de la otra parte...</p>
                        </div>
                      )}
                    </>
                  )}
                  {differenceInHours(parseISO(appt.startTime), new Date()) > 48 && parseISO(appt.endTime) > new Date() && (
                    <Button 
                      variant="ghost"
                      onClick={() => onUpdateStatus(appt.id, 'Cancelled')}
                      className="w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 border border-red-100"
                    >
                      Cancelar Encuentro
                    </Button>
                  )}
                  {differenceInHours(parseISO(appt.startTime), new Date()) <= 48 && parseISO(appt.endTime) > new Date() && (
                    <div className="p-3 bg-red-50 rounded-2xl border border-red-100 text-center">
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">
                        No se puede cancelar (faltan menos de 48hs)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {appt.status === 'Completed' && (
                <div className="mt-6">
                  {((profile.role === 'client' && !appt.clientRated) || (profile.role === 'professional' && !appt.professionalRated)) ? (
                    <Button 
                      onClick={() => onRate(appt)}
                      className="w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-yellow-500 hover:bg-yellow-600 text-white shadow-lg shadow-yellow-500/20"
                    >
                      Calificar Experiencia
                    </Button>
                  ) : (
                    <div className="p-3 bg-green-50 rounded-2xl border border-green-100 text-center">
                      <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">¡Ya calificaste este encuentro!</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  </motion.div>
);
};

function ConversationsList({ profile, onSelectConversation, onDeleteChat, unreadBidIds, isDeleting }: { profile: UserProfile | null, onSelectConversation: (bid: Bid) => void, onDeleteChat: (bidId: string) => void, unreadBidIds: Set<string>, isDeleting: boolean }) {
  const [profBids, setProfBids] = useState<(Bid & { otherUser?: UserProfile, job?: Job })[]>([]);
  const [clientBids, setClientBids] = useState<(Bid & { otherUser?: UserProfile, job?: Job })[]>([]);
  const lastUpdateProfRef = useRef(0);
  const lastUpdateClientRef = useRef(0);
  const cacheRef = useRef<{ users: Record<string, UserProfile>, jobs: Record<string, Job> }>({ users: {}, jobs: {} });

  useEffect(() => {
    if (!profile) return;

    const handleSnapshot = async (snapshot: any, updateRef: React.MutableRefObject<number>, setter: (data: any) => void) => {
      const updateId = ++updateRef.current;
      const bData = snapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() } as Bid))
        .filter((bid: Bid) => bid.isContacted === true && bid.isCancelled !== true);
      
      if (bData.length === 0) {
        if (updateId === updateRef.current) {
          setter([]);
        }
        return;
      }

      try {
        const enriched = await Promise.all(bData.map(async (bid: Bid) => {
          const otherUserId = bid.professionalId === profile.uid ? bid.clientId : bid.professionalId;
          
          try {
            let otherUser = cacheRef.current.users[otherUserId];
            let job = cacheRef.current.jobs[bid.jobId];

            if (!otherUser || !job) {
              const [otherUserSnap, jobSnap] = await Promise.all([
                !otherUser ? getDoc(doc(db, 'users', otherUserId)) : Promise.resolve(null),
                !job ? getDoc(doc(db, 'jobs', bid.jobId)) : Promise.resolve(null)
              ]);

              if (otherUserSnap && otherUserSnap.exists()) {
                otherUser = { uid: otherUserSnap.id, ...otherUserSnap.data() } as UserProfile;
                cacheRef.current.users[otherUserId] = otherUser;
              }
              if (jobSnap && jobSnap.exists()) {
                job = { id: jobSnap.id, ...jobSnap.data() } as Job;
                cacheRef.current.jobs[bid.jobId] = job;
              }
            }

            return { 
              ...bid, 
              otherUser,
              job
            };
          } catch (err) {
            console.error("Error enriching bid data:", bid.id, err);
            return { ...bid };
          }
        }));

        if (updateId === updateRef.current) {
          setter(enriched);
        }
      } catch (err) {
        console.error("Error processing snapshot:", err);
      }
    };

    const qProfessional = query(collection(db, 'bids'), where('professionalId', '==', profile.uid));
    const qClient = query(collection(db, 'bids'), where('clientId', '==', profile.uid));

    const unsubProf = onSnapshot(qProfessional, (snap) => handleSnapshot(snap, lastUpdateProfRef, setProfBids), (err) => {
      handleFirestoreError(err, OperationType.LIST, 'bids');
    });
    const unsubClient = onSnapshot(qClient, (snap) => handleSnapshot(snap, lastUpdateClientRef, setClientBids), (err) => {
      handleFirestoreError(err, OperationType.LIST, 'bids');
    });

    return () => {
      unsubProf();
      unsubClient();
    };
  }, [profile]);

  const conversations = useMemo(() => {
    const combined = [...profBids, ...clientBids];
    const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
    return unique.sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime());
  }, [profBids, clientBids]);

  if (conversations.length === 0) return (
    <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-border flex flex-col items-center justify-center">
      <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mb-4">
        <MessageSquare className="w-8 h-8 text-stone-300" />
      </div>
      <h3 className="text-lg font-bold text-stone-900 mb-1">Sin mensajes</h3>
      <p className="text-muted-foreground text-sm max-w-[250px]">Aún no tienes conversaciones activas. ¡Empieza a contactar para ver tus chats!</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {conversations.map(conv => (
          <motion.div 
            layout
            key={conv.id} 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={() => onSelectConversation(conv)}
            className={cn(
              "bg-white p-4 rounded-[2rem] border flex items-center gap-4 cursor-pointer transition-all card-hover group",
              (unreadBidIds.has(conv.id) || (profile?.role === 'professional' && conv.isReadByProfessional === false))
                ? "border-primary/30 shadow-md bg-primary/5 ring-1 ring-primary/20" 
                : "border-border shadow-sm hover:border-primary/20"
            )}
          >
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-stone-100 border border-border group-hover:border-primary/30 transition-colors">
                <img src={conv.otherUser?.photoURL} alt="" className="w-full h-full object-cover" />
              </div>
              {(unreadBidIds.has(conv.id) || (profile?.role === 'professional' && conv.isReadByProfessional === false)) && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-white shadow-sm animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <h4 className={cn("truncate text-base", (unreadBidIds.has(conv.id) || (profile?.role === 'professional' && conv.isReadByProfessional === false)) ? "font-bold text-stone-900" : "font-semibold text-stone-700")}>
                  {conv.otherUser?.displayName}
                </h4>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] font-bold uppercase tracking-wider", (unreadBidIds.has(conv.id) || (profile?.role === 'professional' && conv.isReadByProfessional === false)) ? "text-primary" : "text-stone-400")}>
                    {formatDistanceToNow(new Date(conv.lastMessageAt || conv.createdAt), { addSuffix: true, locale: es })}
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(conv.id);
                    }}
                    disabled={isDeleting}
                    aria-label="Eliminar chat"
                    className="p-1.5 text-stone-300 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <Briefcase className="w-3 h-3 text-primary/60" />
                <p className={cn("text-xs font-bold truncate uppercase tracking-tight", (unreadBidIds.has(conv.id) || (profile?.role === 'professional' && conv.isReadByProfessional === false)) ? "text-primary" : "text-stone-500")}>
                  {conv.job?.title}
                </p>
              </div>
              <p className={cn("text-sm truncate leading-tight", (unreadBidIds.has(conv.id) || (profile?.role === 'professional' && conv.isReadByProfessional === false)) ? "text-stone-900 font-medium" : "text-stone-500")}>
                {conv.lastMessage || conv.message}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
