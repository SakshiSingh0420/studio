
import { collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, serverTimestamp, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';
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
export const saveParameter = (p: Parameter) => setDoc(doc(db, 'parameters', p.id || doc(collection(db, 'parameters')).id), p, { merge: true });
export const deleteParameter = (id: string) => deleteDoc(doc(db, 'parameters', id));

// MODELS
export const getModels = () => getAll<RatingModel>('models');
export const saveModel = (m: RatingModel) => setDoc(doc(db, 'models', m.id || doc(collection(db, 'models')).id), m, { merge: true });

// SCALES
export const getScales = () => getAll<RatingScale>('scales');
export const saveScale = (s: RatingScale) => setDoc(doc(db, 'scales', s.id || doc(collection(db, 'scales')).id), s, { merge: true });

// COUNTRIES
export interface Country { id: string; name: string; region: string; incomeGroup: string; currency: string; population: number; gdp: number; }
export const getCountries = () => getAll<Country>('countries');
export const addCountry = (c: any) => addDoc(collection(db, 'countries'), c);

// RATINGS
export const saveRating = (r: any) => addDoc(collection(db, 'ratings'), { ...r, createdAt: serverTimestamp() });
export const getRatingHistory = (countryId: string) => {
  const q = query(collection(db, 'ratings'), where('countryId', '==', countryId), orderBy('createdAt', 'desc'));
  return getDocs(q).then(s => s.docs.map(d => ({ id: d.id, ...d.data() })));
};

// FACT SHEETS
export const getFactSheet = (id: string) => getDoc(doc(db, 'factSheets', id)).then(s => s.exists() ? s.data() : null);
export const saveFactSheet = (id: string, data: any) => setDoc(doc(db, 'factSheets', id), data, { merge: true });
