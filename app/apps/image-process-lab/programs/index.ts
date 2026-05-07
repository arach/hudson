import type { ImageProcessProgramId } from '../types';
import { fieldDitherProgram } from './fieldDither';
import { signalMosaicProgram } from './signalMosaic';
import { softScanProgram } from './softScan';

export const imageProcessPrograms = [
  signalMosaicProgram,
  fieldDitherProgram,
  softScanProgram,
] as const;
export const defaultImageProcessProgram = signalMosaicProgram;

export function getImageProcessProgram(programId: ImageProcessProgramId) {
  return imageProcessPrograms.find(program => program.id === programId) ?? defaultImageProcessProgram;
}
