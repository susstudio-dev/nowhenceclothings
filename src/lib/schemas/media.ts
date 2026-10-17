import { z } from 'zod';
import { MediaRef } from './common';

// A9c media library: an index of every uploaded image so it can be reused
// across products, content and brand settings. Bytes live under media/{id}/.
export const MEDIA_LIBRARY_KEY = 'media-library.json';

export const MediaLibraryItem = MediaRef.extend({
  name: z.string().max(200).default(''),
  uploadedAt: z.string().default(''),
  uploadedBy: z.string().default(''),
});
export type MediaLibraryItem = z.infer<typeof MediaLibraryItem>;

export const MediaLibraryDoc = z.object({
  items: z.array(MediaLibraryItem).default([]),
});
export type MediaLibraryDoc = z.infer<typeof MediaLibraryDoc>;
