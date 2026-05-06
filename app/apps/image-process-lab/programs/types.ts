import type { ImageProcessProgramId, SignalMosaicParams } from '../types';

export interface ImageProcessProgram {
  id: ImageProcessProgramId;
  name: string;
  description: string;
  process: (input: ImageData, params: SignalMosaicParams) => ImageData;
}
