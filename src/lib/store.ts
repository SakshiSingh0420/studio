
import { collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, serverTimestamp, orderBy, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { Parameter, RatingModel, RatingScale } from './rating-engine';

const { firestore: db } = initializeFirebase();

// GENERIC CRUD
async function getAll<T>(coll: string): Promise<T[]> {
  const snap = await getDocs(collection(db, coll));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as T));
}

async function getOne<T>(coll: string, id: string): Promise<T | null> {
  const snap = await getDoc(doc(db, coll, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
}

// PARAMETERS
export const getParameters = () => getAll<Parameter>('parameters');
export const saveParameter = async (p: any) => {
    const id = p.id || doc(collection(db, 'parameters')).id;
    const data = { ...p };
    delete data.id;
    await setDoc(doc(db, 'parameters', id), data, { merge: true });
    return id;
};
export const deleteParameter = (id: string) => deleteDoc(doc(db, 'parameters', id));

// MODELS
export const getModels = () => getAll<RatingModel>('models');
export const saveModel = async (m: any) => {
    const id = m.id || doc(collection(db, 'models')).id;
    const data = { ...m };
    delete data.id; // Ensure ID is not stored inside the document data
    await setDoc(doc(db, 'models', id), data, { merge: true });
    return id;
};
export const deleteModel = (id: string) => deleteDoc(doc(db, 'models', id));

// SCALES
export const getScales = () => getAll<RatingScale>('scales');
export const saveScale = async (s: any) => {
    const id = s.id || doc(collection(db, 'scales')).id;
    const data = { ...s };
    delete data.id;
    await setDoc(doc(db, 'scales', id), data, { merge: true });
    return id;
};
export const deleteScale = (id: string) => deleteDoc(doc(db, 'scales', id));

// COUNTRIES
export interface Country { 
  id: string; 
  name: string; 
  region: string; 
  incomeGroup: 'Advanced' | 'Emerging' | 'Frontier'; 
  currency: string; 
  population: number; 
  nominalGdp: number; 
  gdpPerCapita: number;
  inflation: number;
  dataYear: number;
  primaryDataSource: string;
  equityIndex?: string;
  bondYield10Y?: number;
  fxRate?: number;
  scenarioName?: string;
  lastUpdated?: Timestamp;
}
export const getCountries = () => getAll<Country>('countries');
export const addCountry = (c: any) => addDoc(collection(db, 'countries'), {
  ...c,
  lastUpdated: serverTimestamp()
});
export const deleteCountry = (id: string) => deleteDoc(doc(db, 'countries', id));

// RATINGS
export interface Rating {
  id: string;
  countryId: string;
  modelId: string;
  scaleId: string;
  finalScore: number;
  initialRating: string;
  adjustedRating?: string;
  overrideRating?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  reason?: string;
  committeeComments?: string;
  createdAt: any;
  isSandbox?: boolean;
}

export const saveRating = (r: any) => addDoc(collection(db, 'ratings'), { ...r, createdAt: serverTimestamp() });

/**
 * Fetches rating history for a specific country.
 * Fixed: Removed server-side orderBy to avoid the need for composite indexes in the prototype.
 * Sorting is now performed client-side.
 */
export const getRatingHistory = (countryId: string) => {
  const q = query(collection(db, 'ratings'), where('countryId', '==', countryId));
  return getDocs(q).then(s => {
    const results = s.docs.map(d => ({ id: d.id, ...d.data() } as Rating));
    // Client-side sort to avoid composite index requirement
    return results.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  });
};

export const updateRatingStatus = async (id: string, status: 'approved' | 'rejected', approvedBy?: string, reason?: string) => {
  const docRef = doc(db, 'ratings', id);
  return updateDoc(docRef, {
    approvalStatus: status,
    approvedBy: approvedBy || 'system',
    committeeComments: reason || '',
    updatedAt: serverTimestamp()
  });
};

// FACT SHEETS
export const getFactSheet = (id: string) => getDoc(doc(db, 'factSheets', id)).then(s => s.exists() ? s.data() : null);
export const saveFactSheet = (id: string, data: any) => setDoc(doc(db, 'factSheets', id), data, { merge: true });
