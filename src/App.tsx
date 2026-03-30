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
import { 
  UserProfile, 
  Job, 
  Bid, 
  Message, 
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
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
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

const MapController = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15);
  }, [center, map]);
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

const Button = ({ className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }) => {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm',
    outline: 'border border-border text-stone-700 hover:bg-stone-50 hover:text-stone-900',
    ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
  };
  return (
    <button 
      className={cn(
        'inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none', 
        variants[variant], 
        className
      )} 
      {...props} 
    />
  );
};

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    className={cn(
      'flex h-12 w-full px-4 py-3 rounded-xl border border-input bg-white text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all', 
      className
    )} 
    {...props} 
  />
);

const TextArea = ({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea 
    className={cn(
      'flex min-h-[80px] w-full px-4 py-3 rounded-xl border border-input bg-white text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all resize-none', 
      className
    )} 
    {...props} 
  />
);

const Badge = ({ children, className, variant = 'default' }: { children: React.ReactNode, className?: string, variant?: 'default' | 'success' | 'warning' | 'info' }) => {
  const variants = {
    default: 'bg-stone-100 text-stone-600 border-stone-200',
    success: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-orange-50 text-orange-700 border-orange-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border', 
      variants[variant], 
      className
    )}>
      {children}
    </span>
  );
};

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
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
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'home' | 'jobs' | 'messages' | 'profile' | 'create-job' | 'job-details' | 'chat'>('home');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'list' | 'map'>('list');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bidToDelete, setBidToDelete] = useState<string | null>(null);
  const [tempLocation, setTempLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-34.6037, -58.3816]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadBidIds, setUnreadBidIds] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredJobs = useMemo(() => {
    if (selectedCategory === 'Todas') return jobs;
    return jobs.filter(j => j.category === selectedCategory);
  }, [jobs, selectedCategory]);

  // Auth & Profile Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: u.uid,
              displayName: u.displayName || 'User',
              email: u.email || '',
              photoURL: u.photoURL || '',
              role: 'client',
              avgRating: 0,
              numReviews: 0
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${u.uid}`);
        }
      } else {
        setProfile(null);
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
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
      const ids = new Set(snapshot.docs.map(doc => doc.data().bidId as string));
      setUnreadBidIds(ids);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'messages');
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

  const openChat = async (bid: Bid) => {
    // If job details are missing, fetch them
    let enrichedBid = { ...bid };
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
  };

  const toggleRole = async () => {
    if (!profile) return;
    const newRole = profile.role === 'client' ? 'professional' : 'client';
    try {
      await setDoc(doc(db, 'users', profile.uid), { ...profile, role: newRole });
      setProfile({ ...profile, role: newRole });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
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
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setTempLocation({ lat: latitude, lng: longitude });
        setMapCenter([latitude, longitude]);
      }, (error) => {
        console.error('Geolocation error:', error);
      });
    }
  };

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
      setView('messages');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'bids');
      setError('Error al enviar la postulación. Por favor, intenta de nuevo.');
    }
  };

  const sendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile || !selectedBid) return;
    const input = e.currentTarget.elements.namedItem('message') as HTMLInputElement;
    const text = input.value;
    if (!text.trim()) return;

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
    }
  };

  const deleteJob = async () => {
    if (!selectedJob) return;
    try {
      // Delete associated bids and messages first
      const bidsQuery = query(collection(db, 'bids'), where('jobId', '==', selectedJob.id));
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
      handleFirestoreError(err, OperationType.DELETE, `jobs/${selectedJob.id}`);
    }
  };

  const deleteChat = async () => {
    if (!bidToDelete) return;
    try {
      // Delete associated messages first to clear notifications
      const msgsQuery = query(collection(db, 'messages'), where('bidId', '==', bidToDelete));
      const msgsSnap = await getDocs(msgsQuery);
      
      const batch = writeBatch(db);
      msgsSnap.docs.forEach(m => batch.delete(m.ref));
      batch.delete(doc(db, 'bids', bidToDelete));
      
      await batch.commit();

      setBidToDelete(null);
      if (selectedBid?.id === bidToDelete) {
        setSelectedBid(null);
        setView('messages');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `bids/${bidToDelete}`);
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
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
              <Input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="tu@email.com" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Contraseña</label>
              <Input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••" 
                required 
              />
            </div>
            {authError && <p className="text-red-500 text-xs mt-1">{authError}</p>}
            <Button type="submit" className="w-full py-3">
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
      <header className="glass sticky top-0 z-[1001] px-6 py-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('home')}>
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">ServiceReady</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Estás como</span>
              <span className="text-[10px] font-bold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-md">{profile?.role === 'client' ? 'Cliente' : 'Profesional'}</span>
            </div>
            <Button 
              variant="ghost" 
              onClick={toggleRole} 
              className="text-[9px] uppercase tracking-widest font-bold py-0 h-auto text-stone-500 hover:text-primary p-0"
            >
              Cambiar a {profile?.role === 'client' ? 'Profesional' : 'Cliente'}
            </Button>
          </div>
          <div 
            className="w-10 h-10 rounded-xl overflow-hidden border-2 border-border cursor-pointer hover:border-primary transition-all shadow-sm active:scale-95"
            onClick={() => setView('profile')}
          >
            <img src={user.photoURL || ''} alt="Profile" className="w-full h-full object-cover" />
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
              className="p-6 max-w-4xl mx-auto w-full"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-stone-900">
                    {profile?.role === 'client' ? 'Mis Pedidos' : 'Trabajos Disponibles'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {profile?.role === 'client' ? 'Gestiona tus solicitudes de servicio' : 'Encuentra nuevas oportunidades de trabajo'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {profile?.role === 'professional' && (
                    <div className="flex bg-white rounded-xl border border-border p-1 shadow-sm">
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
                    <Button onClick={() => setView('create-job')} className="flex items-center gap-2">
                      <Plus className="w-5 h-5" /> Nuevo Trabajo
                    </Button>
                  )}
                </div>
              </div>

              {profile?.role === 'professional' && (
                <div className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
                  <button
                    onClick={() => setSelectedCategory('Todas')}
                    className={cn(
                      "px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border shadow-sm",
                      selectedCategory === 'Todas' 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-white border-border text-stone-600 hover:border-primary/30 hover:bg-stone-50"
                    )}
                  >
                    Todas
                  </button>
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.name}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={cn(
                        "px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border shadow-sm whitespace-nowrap",
                        selectedCategory === cat.name 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : "bg-white border-border text-stone-600 hover:border-primary/30 hover:bg-stone-50"
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}

              {displayMode === 'map' && profile?.role === 'professional' ? (
                <div className="h-[500px] w-full rounded-3xl overflow-hidden border border-zinc-200 shadow-xl mb-8 z-0">
                  <MapContainer center={[-34.6037, -58.3816]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {filteredJobs.map(job => (
                      <Marker 
                        key={job.id} 
                        position={[job.location.lat, job.location.lng]}
                        eventHandlers={{
                          click: () => {
                            setSelectedJob(job);
                            setView('job-details');
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
              ) : (
                <div className="grid gap-4">
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
                        whileHover={{ y: -4 }}
                        className="bg-white p-6 rounded-[2.5rem] border border-border shadow-sm cursor-pointer card-hover group relative overflow-hidden"
                        onClick={() => {
                          setSelectedJob(job);
                          setView('job-details');
                        }}
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
                        
                        <div className="flex justify-between items-start mb-4 relative z-10">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={job.status === 'Open' ? 'warning' : 'success'} className="px-2 py-0.5 text-[9px]">
                                {job.status === 'Open' ? 'Abierto' : 'Completado'}
                              </Badge>
                              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                {job.category}
                              </span>
                            </div>
                            <h3 className="font-bold text-xl text-stone-900 group-hover:text-primary transition-colors leading-tight">{job.title}</h3>
                          </div>
                          <div className="text-right">
                            <span className="text-stone-400 text-[10px] font-bold uppercase tracking-wider block mb-1">
                              {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                            </span>
                            <div className="flex items-center justify-end gap-1 text-primary">
                              <span className="text-xs font-bold uppercase tracking-widest">Ver</span>
                              <ChevronLeft className="w-4 h-4 rotate-180" />
                            </div>
                          </div>
                        </div>
                        
                        <p className="text-stone-500 line-clamp-2 mb-6 text-sm leading-relaxed relative z-10">{job.description}</p>
                        
                        <div className="flex flex-wrap items-center gap-4 text-stone-400 text-[11px] font-bold uppercase tracking-wider relative z-10 border-t border-stone-50 pt-4">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-primary/60" /> 
                            <span className="truncate max-w-[200px]">{job.location.address}</span>
                          </div>
                          <div className="flex items-center gap-1.5 ml-auto">
                            <Clock className="w-3.5 h-3.5 text-primary/60" /> 
                            <span>Urgente</span>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              )}
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
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400 ml-1">Presupuesto estimado</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                          <Input name="budget" type="number" placeholder="Opcional" className="pl-8" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400 ml-1">Descripción detallada</label>
                      <TextArea name="description" placeholder="Explica qué necesitas, materiales, urgencia, etc." required className="min-h-[150px]" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400 ml-1">Ubicación del servicio</label>
                      <div className="relative">
                        <Input 
                          name="address" 
                          placeholder="Ingresa la dirección o selecciona en el mapa" 
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
                        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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
                  if (selectedBid && view === 'job-details') {
                    setView('chat');
                  } else {
                    setView('home');
                  }
                }} className="p-2">
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <h2 className="text-2xl font-bold">Detalles</h2>
                {profile?.role === 'client' && selectedJob.clientId === profile.uid && (
                  <Button 
                    variant="danger" 
                    onClick={() => setShowDeleteConfirm(true)} 
                    className="ml-auto flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar Pedido
                  </Button>
                )}
              </div>

              <Modal 
                isOpen={showDeleteConfirm} 
                onClose={() => setShowDeleteConfirm(false)} 
                title="¿Eliminar pedido?"
              >
                <p className="text-zinc-600 mb-6">Esta acción no se puede deshacer. Se eliminarán todas las postulaciones asociadas.</p>
                <Button variant="danger" onClick={deleteJob} className="w-full">Confirmar Eliminación</Button>
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
                      <Clock className="w-4 h-4" /> {formatDistanceToNow(new Date(selectedJob.createdAt), { addSuffix: true })}
                    </div>
                  </div>

                  {profile?.role === 'client' && selectedJob.clientId === profile.uid && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold">Postulaciones</h3>
                      <BidsList jobId={selectedJob.id} onSelectBid={openChat} />
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {profile?.role === 'professional' && (
                    <>
                      {myBids.some(b => b.jobId === selectedJob.id) || (selectedBid && selectedBid.jobId === selectedJob.id) ? (
                        <div className="bg-orange-50 p-6 rounded-3xl border border-orange-200 text-center">
                          <CheckCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                          <h3 className="font-bold text-lg mb-2 text-orange-900">Ya te postulaste</h3>
                          <p className="text-orange-700 text-sm mb-6">Ya has enviado un presupuesto para este trabajo. Puedes seguir la conversación desde mensajes.</p>
                          <Button 
                            onClick={() => {
                              const bid = myBids.find(b => b.jobId === selectedJob.id) || selectedBid;
                              if (bid) openChat(bid);
                            }} 
                            className="w-full"
                          >
                            Ir al Chat
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xl">
                          <h3 className="font-bold text-lg mb-4">Enviar Presupuesto (Postulación)</h3>
                          <form onSubmit={submitBid} className="space-y-4">
                            <Input name="price" type="number" placeholder="Precio Estimado ($)" required />
                            <TextArea name="message" placeholder="Mensaje de postulación..." rows={3} required />
                            <Button type="submit" className="w-full">Enviar Postulación</Button>
                          </form>
                        </div>
                      )}
                    </>
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
              />

              <Modal 
                isOpen={!!bidToDelete} 
                onClose={() => setBidToDelete(null)} 
                title="¿Eliminar conversación?"
              >
                <p className="text-stone-600 mb-6">Esta acción eliminará la conversación de tu lista. Si eres el profesional, esto también retirará tu postulación.</p>
                <Button variant="destructive" onClick={deleteChat} className="w-full py-4 rounded-xl font-bold uppercase tracking-widest">Eliminar Conversación</Button>
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
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-border flex-shrink-0">
                      <img src={selectedBid.otherUser?.photoURL} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-stone-900 truncate">{selectedBid.otherUser?.displayName}</h3>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">${selectedBid.proposedPrice}</p>
                    </div>
                  </div>
                </div>
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

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
                <div className="flex justify-center mb-8">
                  <div className="bg-stone-200/50 backdrop-blur-sm px-4 py-1.5 rounded-full text-[10px] font-bold text-stone-500 uppercase tracking-widest border border-stone-300/30">
                    Inicio de la conversación
                  </div>
                </div>
                {messages.map(msg => (
                  <div key={msg.id} className={cn('flex flex-col', msg.senderId === profile?.uid ? 'items-end' : 'items-start')}>
                    <div className={cn(
                      'max-w-[85%] px-4 py-3 rounded-[1.5rem] text-sm shadow-sm leading-relaxed', 
                      msg.senderId === profile?.uid 
                        ? 'bg-primary text-white rounded-tr-none shadow-primary/20' 
                        : 'bg-white text-stone-800 rounded-tl-none border border-border'
                    )}>
                      {msg.text}
                    </div>
                    <span className="text-[9px] font-bold text-stone-400 mt-1 px-1 uppercase">
                      {msg.createdAt ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true }) : 'Ahora'}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 glass border-t border-border">
                <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex gap-2">
                  <Input 
                    name="message" 
                    placeholder="Escribe un mensaje..." 
                    autoComplete="off" 
                    className="rounded-2xl bg-white border-border focus:ring-primary/10"
                  />
                  <Button type="submit" className="p-3 rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-transform">
                    <Send className="w-5 h-5" />
                  </Button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-border px-6 py-3 flex items-center justify-around z-[1001] pb-safe">
        <NavButton active={view === 'home'} onClick={() => setView('home')} icon={<Briefcase />} label="Trabajos" />
        <NavButton active={view === 'messages' || view === 'chat'} onClick={() => setView('messages')} icon={<MessageSquare />} label="Mensajes" badge={unreadCount} />
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
                      <img src={user.photoURL || ''} alt="Profile" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-primary text-white p-2 rounded-xl shadow-lg border-2 border-white">
                      <Camera className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-black text-stone-900 mb-1">{profile?.displayName}</h3>
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
                        <span className="font-black text-primary text-lg">24</span>
                      </div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase mt-2 tracking-widest">Trabajos</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white p-6 rounded-3xl border border-border shadow-sm">
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Información de cuenta</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-stone-500">Rol actual</span>
                        <Badge variant="default" className="capitalize">{profile?.role === 'client' ? 'Cliente' : 'Profesional'}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-stone-500">Miembro desde</span>
                        <span className="text-sm font-bold text-stone-700">Marzo 2024</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button variant="outline" className="w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-stone-600 border-stone-200 hover:bg-stone-50">
                    Editar Perfil
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-full z-[1005] shadow-xl">{error}</div>}
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

function BidsList({ jobId, onSelectBid }: { jobId: string, onSelectBid: (bid: Bid) => void }) {
  const [bids, setBids] = useState<(Bid & { professional?: UserProfile })[]>([]);
  const lastUpdateRef = useRef(0);
  const cacheRef = useRef<{ users: Record<string, UserProfile> }>({ users: {} });

  useEffect(() => {
    const q = query(collection(db, 'bids'), where('jobId', '==', jobId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const updateId = ++lastUpdateRef.current;
      const bData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bid));
      
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
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-stone-100 border border-border group-hover:border-primary/30 transition-colors flex-shrink-0">
              <img src={bid.professional?.photoURL} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-stone-900 truncate">{bid.professional?.displayName}</h4>
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

function ConversationsList({ profile, onSelectConversation, onDeleteChat, unreadBidIds }: { profile: UserProfile | null, onSelectConversation: (bid: Bid) => void, onDeleteChat: (bidId: string) => void, unreadBidIds: Set<string> }) {
  const [profBids, setProfBids] = useState<(Bid & { otherUser?: UserProfile, job?: Job })[]>([]);
  const [clientBids, setClientBids] = useState<(Bid & { otherUser?: UserProfile, job?: Job })[]>([]);
  const lastUpdateProfRef = useRef(0);
  const lastUpdateClientRef = useRef(0);
  const cacheRef = useRef<{ users: Record<string, UserProfile>, jobs: Record<string, Job> }>({ users: {}, jobs: {} });

  useEffect(() => {
    if (!profile) return;

    const handleSnapshot = async (snapshot: any, updateRef: React.MutableRefObject<number>, setter: (data: any) => void) => {
      const updateId = ++updateRef.current;
      const bData = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Bid));
      
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

    const unsubProf = onSnapshot(qProfessional, (snap) => handleSnapshot(snap, lastUpdateProfRef, setProfBids));
    const unsubClient = onSnapshot(qClient, (snap) => handleSnapshot(snap, lastUpdateClientRef, setClientBids));

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
              unreadBidIds.has(conv.id) 
                ? "border-primary/30 shadow-md bg-primary/5 ring-1 ring-primary/20" 
                : "border-border shadow-sm hover:border-primary/20"
            )}
          >
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-stone-100 border border-border group-hover:border-primary/30 transition-colors">
                <img src={conv.otherUser?.photoURL} alt="" className="w-full h-full object-cover" />
              </div>
              {unreadBidIds.has(conv.id) && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-white shadow-sm animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <h4 className={cn("truncate text-base", unreadBidIds.has(conv.id) ? "font-bold text-stone-900" : "font-semibold text-stone-700")}>
                  {conv.otherUser?.displayName}
                </h4>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] font-bold uppercase tracking-wider", unreadBidIds.has(conv.id) ? "text-primary" : "text-stone-400")}>
                    {formatDistanceToNow(new Date(conv.lastMessageAt || conv.createdAt), { addSuffix: true })}
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(conv.id);
                    }}
                    aria-label="Eliminar chat"
                    className="p-1.5 text-stone-300 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <Briefcase className="w-3 h-3 text-primary/60" />
                <p className={cn("text-xs font-bold truncate uppercase tracking-tight", unreadBidIds.has(conv.id) ? "text-primary" : "text-stone-500")}>
                  {conv.job?.title}
                </p>
              </div>
              <p className={cn("text-sm truncate leading-tight", unreadBidIds.has(conv.id) ? "text-stone-900 font-medium" : "text-stone-500")}>
                {conv.lastMessage || conv.message}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
