/**
 * PNG download (UI layer): renders the artwork at the chosen scale on a
 * canvas and hands the browser a file to save.
 * @module download
 */

import { exportFileName, renderRGBA } from './export.js';

/** Time before the temporary file URL is released (some browsers read it late). */
const REVOKE_DELAY_MS = 40000;

/**
 * Saves a project as a PNG file, every art pixel becoming a scale x scale block.
 * @param {import('./project.js').Project} project
 * @param {number} scale 1..16
 * @returns {Promise<string>} the file name
 */
export function downloadPng(project, scale) {
  const image = renderRGBA(project.pixels, project.width, project.height, scale);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d').putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  const fileName = exportFileName(project.width, project.height, scale);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('The browser could not encode the PNG'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
      resolve(fileName);
    }, 'image/png');
  });
}
