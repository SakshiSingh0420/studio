import { collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, serverTimestamp, orderBy, updateDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { FactSheetData } from './rating-engine';

const { firestore: db } = initializeFirebase();

export interface Country {
  id: string;
  name: string;
  region: string;
  incomeGroup: string;
  currency: string;
  population: number;
  gdp: number;
}

export interface Rating {
  id?: string;
  countryId: string;
  modelId: string;
  scaleId: string;
  rawData: FactSheetData;
  derivedMetrics: any;
  transformedScores: any;
  weightedScores: any;
  finalScore: number;
  initialRating: string;
  adjustedRating?: string;
  overrideRating?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  reason?: string;
  createdAt: any;
}

export async function getCountries(): Promise<Country[]> {
  const snapshot = await getDocs(collection(db, 'countries'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Country));
}

export async function addCountry(country: Omit<Country, 'id'>) {
  const docRef = await addDoc(collection(db, 'countries'), country);
  return { id: docRef.id, ...country };
}

export async function getFactSheet(countryId: string): Promise<FactSheetData | null> {
  const docRef = doc(db, 'factSheets', countryId);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() as FactSheetData : null;
}

export async function saveFactSheet(countryId: string, data: FactSheetData) {
  await setDoc(doc(db, 'factSheets', countryId), data);
}

export async function saveRating(rating: Omit<Rating, 'id' | 'createdAt'>) {
  const ratingData = { ...rating, createdAt: serverTimestamp() };
  const docRef = await addDoc(collection(db, 'ratings'), ratingData);
  return { id: docRef.id, ...ratingData };
}

export async function getRatingHistory(countryId: string): Promise<Rating[]> {
  const q = query(collection(db, 'ratings'), where('countryId', '==', countryId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Rating));
}

export async function updateRatingStatus(ratingId: string, status: string, overrideRating?: string, reason?: string) {
    const docRef = doc(db, 'ratings', ratingId);
    await updateDoc(docRef, { 
      approvalStatus: status, 
      overrideRating: overrideRating || null, 
      reason: reason || null 
    });
}
