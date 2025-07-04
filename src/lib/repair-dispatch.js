/**
 * Smart Repair Dispatcher
 * Uses server-side API on Vercel, client-side tool on GitHub Pages/local
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
 * Smart repair function that chooses the best method based on environment
 */
export async function repairReportSmart(file) {
  // Use server-side API on Vercel for better accuracy
  if (isVercel()) {
    return await repairWithServerAPI(file);
  } else {
    // Use client-side tool on GitHub Pages/local
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