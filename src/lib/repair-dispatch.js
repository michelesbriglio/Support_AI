/**
 * Smart Repair Dispatcher
 * Uses server-side API on Vercel and locally, client-side tool on GitHub Pages
 */

import { repairXMLFile } from './xml-repair';

/**
 * Detect if we're running on Vercel
 */
function isVercel() {
  return typeof window !== 'undefined' && 
         (window.location.hostname.includes('vercel.app') || 
          process.env.VERCEL === '1');
}

/**
 * Detect if we're running locally
 */
function isLocal() {
  return typeof window !== 'undefined' && 
         (window.location.hostname === 'localhost' || 
          window.location.hostname === '127.0.0.1');
}

/**
 * Smart repair function that chooses the best method based on environment
 */
export async function repairReportSmart(file) {
  // Use server-side API on Vercel and locally for better accuracy
  if (isVercel() || isLocal()) {
    return await repairWithServerAPI(file);
  } else {
    // Use client-side tool on GitHub Pages
    return await repairXMLFile(file);
  }
}

/**
 * Repair using server-side API
 */
async function repairWithServerAPI(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/repair-report', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  const data = await response.json();
  
  return {
    file: data.file,
    results: data.results,
    analysis: data.analysis,
    filename: data.filename
  };
} 