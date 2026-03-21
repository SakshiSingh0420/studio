import { collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { FactSheetData, RatingModel, RatingScale } from './rating-engine';

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

// For demo purposes, we will provide a way to use local storage if Firebase isn't set up
const IS_DEMO = true;

const LOCAL_STORAGE_KEY = 'sovereign_rating_hub_data';

function getLocalData() {
  if (typeof window === 'undefined') return { countries: [], ratings: [], factSheets: {} };
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  return data ? JSON.parse(data) : { countries: [], ratings: [], factSheets: {} };
}

function saveLocalData(data: any) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
}

export async function getCountries(): Promise<Country[]> {
  if (IS_DEMO) return getLocalData().countries;
  const snapshot = await getDocs(collection(db, 'countries'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Country));
}

export async function addCountry(country: Omit<Country, 'id'>) {
  if (IS_DEMO) {
    const data = getLocalData();
    const newCountry = { ...country, id: Math.random().toString(36).substr(2, 9) };
    data.countries.push(newCountry);
    saveLocalData(data);
    return newCountry;
  }
  const docRef = await addDoc(collection(db, 'countries'), country);
  return { id: docRef.id, ...country };
}

export async function getFactSheet(countryId: string): Promise<FactSheetData | null> {
  if (IS_DEMO) return getLocalData().factSheets[countryId] || null;
  const docRef = doc(db, 'factSheets', countryId);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() as FactSheetData : null;
}

export async function saveFactSheet(countryId: string, data: FactSheetData) {
  if (IS_DEMO) {
    const local = getLocalData();
    local.factSheets[countryId] = data;
    saveLocalData(local);
    return;
  }
  await setDoc(doc(db, 'factSheets', countryId), data);
}

export async function saveRating(rating: Omit<Rating, 'id' | 'createdAt'>) {
  if (IS_DEMO) {
    const local = getLocalData();
    const newRating = { ...rating, id: Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString() };
    local.ratings.push(newRating);
    saveLocalData(local);
    return newRating;
  }
  const ratingData = { ...rating, createdAt: serverTimestamp() };
  const docRef = await addDoc(collection(db, 'ratings'), ratingData);
  return { id: docRef.id, ...ratingData };
}

export async function getRatingHistory(countryId: string): Promise<Rating[]> {
  if (IS_DEMO) return getLocalData().ratings.filter((r: Rating) => r.countryId === countryId);
  const q = query(collection(db, 'ratings'), where('countryId', '==', countryId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Rating));
}

export async function updateRatingStatus(ratingId: string, status: string, overrideRating?: string, reason?: string) {
    if (IS_DEMO) {
        const local = getLocalData();
        const index = local.ratings.findIndex((r: Rating) => r.id === ratingId);
        if (index !== -1) {
            local.ratings[index] = { ...local.ratings[index], approvalStatus: status, overrideRating, reason };
            saveLocalData(local);
        }
        return;
    }
    await setDoc(doc(db, 'ratings', ratingId), { approvalStatus: status, overrideRating, reason }, { merge: true });
}