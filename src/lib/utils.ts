import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Recursively removes keys with `undefined` values from an object.
 * This is useful for preparing data to be sent to Firestore, which
 * does not support `undefined` field values.
 * @param obj The object to sanitize.
 * @returns A new object with `undefined` values removed.
 */
export function sanitizeDataForFirestore(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeDataForFirestore(item)).filter(item => item !== undefined);
  }

  const newObj: { [key: string]: any } = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== undefined) {
        newObj[key] = sanitizeDataForFirestore(value);
      }
    }
  }
  return newObj;
}
