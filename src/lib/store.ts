
import { collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, serverTimestamp, orderBy, updateDoc, deleteDoc, Timestamp, writeBatch } from 'firebase/firestore';
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

export const getActiveModels = async () => {
  const q = query(collection(db, 'models'), where('isActive', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as RatingModel));
};

export const saveModel = async (m: any) => {
    const id = m.id || doc(collection(db, 'models')).id;
    const data = { 
      ...m,
      version: m.version ?? 1,
      status: m.status ?? 'draft',
      isActive: m.isActive ?? false,
      isDefault: m.isDefault ?? false
    };
    delete data.id;
    await setDoc(doc(db, 'models', id), data, { merge: true });
    return id;
};

export const setActiveModel = async (modelId: string, name: string) => {
  const batch = writeBatch(db);
  
  const q = query(collection(db, 'models'), where('name', '==', name));
  const snap = await getDocs(q);
  snap.docs.forEach(d => {
    batch.update(d.ref, { isActive: false });
  });

  batch.update(doc(db, 'models', modelId), { isActive: true });
  await batch.commit();
};

export const setDefaultModel = async (modelId: string) => {
  const batch = writeBatch(db);
  
  const snap = await getDocs(collection(db, 'models'));
  snap.docs.forEach(d => {
    if (d.data().isDefault) {
      batch.update(d.ref, { isDefault: false });
    }
  });

  batch.update(doc(db, 'models', modelId), { isDefault: true });
  await batch.commit();
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
  year?: number; 
  primaryDataSource: string;
  equityIndex?: string;
  bondYield10Y?: number;
  fxRate?: number;
  scenarioName?: string;
  lastUpdated?: Timestamp;
  gdpSnapshot?: number;
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
  year: number; 
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

export const getRatingHistory = (countryId: string) => {
  const q = query(collection(db, 'ratings'), where('countryId', '==', countryId));
  return getDocs(q).then(s => {
    const results = s.docs.map(d => ({ id: d.id, ...d.data() } as Rating));
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

/**
 * Resets ONLY rating execution data.
 * Does NOT touch master data (countries, parameters, models, scales).
 */
export const resetAllRatings = async () => {
  const collectionsToClear = ['ratings', 'ratingExecutions', 'ratingResults'];
  for (const collName of collectionsToClear) {
    try {
      const snap = await getDocs(collection(db, collName));
      if (snap.empty) continue;
      
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        batch.delete(d.ref);
      });
      await batch.commit();
    } catch (e) {
      console.warn(`Could not clear collection ${collName}:`, e);
    }
  }
};

// FACT SHEETS
export const getFactSheet = (id: string) => getDoc(doc(db, 'factSheets', id)).then(s => s.exists() ? s.data() : null);
export const saveFactSheet = (id: string, data: any) => setDoc(doc(db, 'factSheets', id), data, { merge: true });
