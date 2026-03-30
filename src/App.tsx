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
    primary: 'bg-orange-600 text-white hover:bg-orange-700',
    secondary: 'bg-zinc-800 text-white hover:bg-zinc-900',
    outline: 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50',
    ghost: 'text-zinc-600 hover:bg-zinc-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button 
      className={cn('px-4 py-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none', variants[variant], className)} 
      {...props} 
    />
  );
};

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className={cn('w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-white', className)} {...props} />
);

const TextArea = ({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={cn('w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-white resize-none', className)} {...props} />
);

const Badge = ({ children, className, variant = 'default' }: { children: React.ReactNode, className?: string, variant?: 'default' | 'success' | 'warning' | 'info' }) => {
  const variants = {
    default: 'bg-zinc-100 text-zinc-600',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-orange-100 text-orange-700',
    info: 'bg-blue-100 text-blue-700',
  };
  return <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', variants[variant], className)}>{children}</span>;
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
  }, [profile, myBids]);

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
      const bidRef = await addDoc(collection(db, 'bids'), newBid);
      
      // Also create the first message in the messages collection
      await addDoc(collection(db, 'messages'), {
        bidId: bidRef.id,
        senderId: profile.uid,
        recipientId: selectedJob.clientId,
        text: newBid.message,
        timestamp: newBid.createdAt,
        read: false
      });

      // Set the selected bid so the chat view can open it
      setSelectedBid({ id: bidRef.id, ...newBid } as Bid);
      setView('messages');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'bids');
    }
  };

  const sendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile || !selectedBid) return;
    const input = e.currentTarget.elements.namedItem('message') as HTMLInputElement;
    const text = input.value;
    if (!text.trim()) return;

    const recipientId = selectedBid.professionalId === profile.uid ? selectedBid.clientId : selectedBid.professionalId;
    const newMessage = {
      bidId: selectedBid.id,
      senderId: profile.uid,
      recipientId,
      text,
      timestamp: new Date().toISOString(),
      read: false
    };

    try {
      await addDoc(collection(db, 'messages'), newMessage);
      // Update bid with last message
      await updateDoc(doc(db, 'bids', selectedBid.id), {
        lastMessage: text,
        lastMessageAt: newMessage.timestamp
      });
      input.value = '';
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    }
  };

  const deleteJob = async () => {
    if (!selectedJob) return;
    try {
      await deleteDoc(doc(db, 'jobs', selectedJob.id));
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
      await deleteDoc(doc(db, 'bids', bidToDelete));
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
      <header className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between z-[1001]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">ServiceReady</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Estás como</span>
            <span className="text-xs font-bold text-orange-600 uppercase">{profile?.role === 'client' ? 'Cliente' : 'Profesional'}</span>
          </div>
          <Button 
            variant="outline" 
            onClick={toggleRole} 
            className="text-[10px] uppercase tracking-widest font-bold py-1 px-3 h-auto border-orange-200 text-orange-700 hover:bg-orange-50"
          >
            Cambiar a {profile?.role === 'client' ? 'Profesional' : 'Cliente'}
          </Button>
          <div 
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-zinc-100 cursor-pointer hover:border-orange-500 transition-colors"
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
                <h2 className="text-2xl font-bold">
                  {profile?.role === 'client' ? 'Mis Pedidos' : 'Trabajos Disponibles'}
                </h2>
                <div className="flex items-center gap-2">
                  {profile?.role === 'professional' && (
                    <div className="flex bg-white rounded-xl border border-zinc-200 p-1 mr-2">
                      <button 
                        onClick={() => setDisplayMode('list')}
                        className={cn('p-2 rounded-lg transition-all', displayMode === 'list' ? 'bg-orange-100 text-orange-600' : 'text-zinc-400')}
                      >
                        <ListIcon className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setDisplayMode('map')}
                        className={cn('p-2 rounded-lg transition-all', displayMode === 'map' ? 'bg-orange-100 text-orange-600' : 'text-zinc-400')}
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
                      "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                      selectedCategory === 'Todas' ? "bg-orange-600 text-white" : "bg-white border border-zinc-200 text-zinc-600 hover:border-orange-200"
                    )}
                  >
                    Todas
                  </button>
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.name}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                        selectedCategory === cat.name ? "bg-orange-600 text-white" : "bg-white border border-zinc-200 text-zinc-600 hover:border-orange-200"
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
                    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-300">
                      <Search className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                      <p className="text-zinc-500">No hay trabajos para mostrar.</p>
                    </div>
                  ) : (
                    filteredJobs.map(job => (
                      <motion.div 
                        key={job.id}
                        whileHover={{ scale: 1.01 }}
                        className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm cursor-pointer"
                        onClick={() => {
                          setSelectedJob(job);
                          setView('job-details');
                        }}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <Badge variant={job.status === 'Open' ? 'warning' : 'success'} className="mb-2">
                              {job.status}
                            </Badge>
                            <h3 className="font-bold text-xl">{job.title}</h3>
                          </div>
                          <span className="text-zinc-400 text-sm">
                            {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-zinc-600 line-clamp-2 mb-4">{job.description}</p>
                        <div className="flex items-center gap-4 text-zinc-500 text-sm">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" /> {job.location.address}
                          </div>
                          <div className="flex items-center gap-1">
                            <Filter className="w-4 h-4" /> {job.category}
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
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="p-6 max-w-2xl mx-auto w-full"
            >
              {profile?.role !== 'client' ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-zinc-200">
                  <p className="text-zinc-500">Solo los clientes pueden crear publicaciones.</p>
                  <Button onClick={() => setView('home')} className="mt-4">Volver al Inicio</Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" onClick={() => setView('home')} className="p-2">
                      <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <h2 className="text-2xl font-bold">Publicar Trabajo (Demanda)</h2>
                  </div>

                  <form onSubmit={createJob} className="space-y-6 bg-white p-8 rounded-3xl border border-zinc-200 shadow-xl">
                    <div className="space-y-2">
                      <label className="text-sm font-bold uppercase tracking-wider text-zinc-500">Título</label>
                      <Input name="title" placeholder="Ej: Plomero para arreglar filtración" required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold uppercase tracking-wider text-zinc-500">Categoría</label>
                      <select name="category" className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-white" required>
                        {CATEGORIES.map(cat => (
                          <optgroup key={cat.group} label={cat.group}>
                            <option value={cat.name}>{cat.name}</option>
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold uppercase tracking-wider text-zinc-500">Ubicación exacta en el mapa</label>
                      
                      <div className="flex gap-2 mb-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                          <Input 
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setShowSuggestions(true);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Buscar dirección..." 
                            className="pl-10"
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleGeocode())}
                            onFocus={(e) => {
                              e.stopPropagation();
                              setShowSuggestions(true);
                            }}
                          />
                          {showSuggestions && suggestions.length > 0 && (
                            <div 
                              className="absolute top-full left-0 right-0 bg-white border border-zinc-200 rounded-xl mt-1 shadow-xl z-[1010] overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {suggestions.map((s, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => handleSelectSuggestion(s)}
                                  className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-50 border-b border-zinc-100 last:border-0 transition-colors"
                                >
                                  {s.display_name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button type="button" variant="outline" onClick={handleGeocode} disabled={isGeocoding}>
                          {isGeocoding ? 'Buscando...' : 'Buscar'}
                        </Button>
                        <Button type="button" variant="outline" onClick={handleGetCurrentLocation} title="Usar mi ubicación actual">
                          <Navigation className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="h-64 w-full rounded-2xl overflow-hidden border border-zinc-200 z-0">
                        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          <LocationPicker onLocationSelect={(lat, lng) => setTempLocation({ lat, lng })} />
                          <MapController center={mapCenter} />
                          {tempLocation && <Marker position={[tempLocation.lat, tempLocation.lng]} />}
                        </MapContainer>
                      </div>
                      <Input name="address" placeholder="Dirección o referencia adicional" required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold uppercase tracking-wider text-zinc-500">Descripción</label>
                      <TextArea name="description" placeholder="Describe lo que necesitas..." rows={4} required />
                    </div>
                    <Button type="submit" className="w-full py-4 text-lg">Publicar Demanda</Button>
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-6 max-w-4xl mx-auto w-full"
            >
              <h2 className="text-2xl font-bold mb-8">Conversaciones</h2>
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
                <p className="text-zinc-600 mb-6">Esta acción eliminará la conversación de tu lista. Si eres el profesional, esto también retirará tu postulación.</p>
                <Button variant="danger" onClick={deleteChat} className="w-full">Eliminar Conversación</Button>
              </Modal>
            </motion.div>
          )}

          {view === 'chat' && selectedBid && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="h-full flex flex-col bg-white"
            >
              <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" onClick={() => setView('messages')} className="p-2">
                    <ChevronLeft className="w-6 h-6" />
                  </Button>
                  <div>
                    <h3 className="font-bold">Chat</h3>
                    <p className="text-xs text-zinc-500">${selectedBid.proposedPrice}</p>
                  </div>
                </div>
                {selectedBid.job && (
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setSelectedJob(selectedBid.job || null);
                      setView('job-details');
                    }}
                    className="text-orange-600 text-xs font-bold"
                  >
                    Ver Trabajo
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map(msg => (
                  <div key={msg.id} className={cn('flex flex-col', msg.senderId === profile?.uid ? 'items-end' : 'items-start')}>
                    <div className={cn('max-w-[80%] px-4 py-2 rounded-2xl text-sm', msg.senderId === profile?.uid ? 'bg-orange-600 text-white rounded-tr-none' : 'bg-zinc-100 text-zinc-800 rounded-tl-none')}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={sendMessage} className="p-4 border-t border-zinc-200 flex gap-2">
                <Input name="message" placeholder="Escribe..." autoComplete="off" />
                <Button type="submit" className="p-3"><Send className="w-5 h-5" /></Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-6 py-3 flex items-center justify-around z-[1001]">
        <NavButton active={view === 'home'} onClick={() => setView('home')} icon={<Briefcase />} label="Trabajos" />
        <NavButton active={view === 'messages'} onClick={() => setView('messages')} icon={<MessageSquare />} label="Mensajes" badge={unreadCount} />
        <NavButton active={view === 'profile'} onClick={() => setView('profile')} icon={<UserIcon />} label="Perfil" />
      </nav>

      <AnimatePresence>
        {view === 'profile' && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="fixed inset-0 bg-white z-[1002] p-6 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-12">
              <Button variant="ghost" onClick={() => setView('home')} className="p-2"><ChevronLeft className="w-6 h-6" /></Button>
              <h2 className="text-2xl font-bold">Mi Perfil</h2>
              <Button variant="ghost" onClick={handleLogout} className="text-red-600"><LogOut className="w-6 h-6" /></Button>
            </div>

            <div className="flex flex-col items-center text-center mb-12">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-orange-100 mb-6">
                <img src={user.photoURL || ''} alt="Profile" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-3xl font-bold mb-2">{profile?.displayName}</h3>
              <p className="text-zinc-500 mb-4">{profile?.email}</p>
              <div className="flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-full">
                <Star className="w-5 h-5 text-orange-500 fill-orange-500" />
                <span className="font-bold text-orange-700">{profile?.avgRating || 0}</span>
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
    <button onClick={onClick} className={cn('flex flex-col items-center gap-1 relative', active ? 'text-orange-600' : 'text-zinc-400')}>
      <div className="relative">
        {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className="text-[10px] font-bold uppercase">{label}</span>
    </button>
  );
}

function BidsList({ jobId, onSelectBid }: { jobId: string, onSelectBid: (bid: Bid) => void }) {
  const [bids, setBids] = useState<(Bid & { professional?: UserProfile })[]>([]);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    const q = query(collection(db, 'bids'), where('jobId', '==', jobId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const updateId = ++lastUpdateRef.current;
      const bData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bid));
      
      try {
        const fullBids = await Promise.all(bData.map(async (bid) => {
          try {
            const profSnap = await getDoc(doc(db, 'users', bid.professionalId));
            return { ...bid, professional: profSnap.data() as UserProfile };
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

  if (bids.length === 0) return <p className="text-zinc-400 text-center py-8">Sin postulaciones.</p>;

  return (
    <div className="space-y-4">
      {bids.map(bid => (
        <div key={bid.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-100">
              <img src={bid.professional?.photoURL} alt="" className="w-full h-full object-cover" />
            </div>
            <div>
              <h4 className="font-bold">{bid.professional?.displayName}</h4>
              <p className="text-sm text-zinc-500">{bid.lastMessage || bid.message}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-orange-600">${bid.proposedPrice}</p>
            <Button onClick={() => onSelectBid(bid)} className="py-1 px-3 text-xs">Contactar</Button>
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

  useEffect(() => {
    if (!profile) return;

    const handleSnapshot = async (snapshot: any, updateRef: React.MutableRefObject<number>, setter: (data: any) => void) => {
      const updateId = ++updateRef.current;
      const bData = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Bid));
      
      try {
        const enriched = await Promise.all(bData.map(async (bid: Bid) => {
          const otherUserId = bid.professionalId === profile.uid ? bid.clientId : bid.professionalId;
          try {
            const [otherUserSnap, jobSnap] = await Promise.all([
              getDoc(doc(db, 'users', otherUserId)),
              getDoc(doc(db, 'jobs', bid.jobId))
            ]);
            return { 
              ...bid, 
              otherUser: otherUserSnap.data() as UserProfile,
              job: jobSnap.data() as Job
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

  if (conversations.length === 0) return <p className="text-zinc-400 text-center py-20">No tienes conversaciones activas.</p>;

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {conversations.map(conv => (
          <motion.div 
            layout
            key={conv.id} 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3 }}
            onClick={() => onSelectConversation(conv)}
            className={cn(
              "bg-white p-6 rounded-3xl border flex items-center gap-4 cursor-pointer transition-all",
              unreadBidIds.has(conv.id) ? "border-orange-500 shadow-md bg-orange-50/30" : "border-zinc-200 shadow-sm hover:border-orange-200"
            )}
          >
            <div className="relative">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-zinc-100 flex-shrink-0">
                <img src={conv.otherUser?.photoURL} alt="" className="w-full h-full object-cover" />
              </div>
              {unreadBidIds.has(conv.id) && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full border-2 border-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h4 className={cn("truncate", unreadBidIds.has(conv.id) ? "font-black text-zinc-900" : "font-bold text-zinc-800")}>
                  {conv.otherUser?.displayName}
                </h4>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs", unreadBidIds.has(conv.id) ? "text-orange-600 font-bold" : "text-zinc-400")}>
                    {formatDistanceToNow(new Date(conv.lastMessageAt || conv.createdAt), { addSuffix: true })}
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(conv.id);
                    }}
                    className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className={cn("text-sm font-medium truncate", unreadBidIds.has(conv.id) ? "text-orange-700" : "text-orange-600")}>
                {conv.job?.title}
              </p>
              <p className={cn("text-sm truncate", unreadBidIds.has(conv.id) ? "text-zinc-900 font-bold" : "text-zinc-500")}>
                {conv.lastMessage || conv.message}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
