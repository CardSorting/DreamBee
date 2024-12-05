import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL environment variable')
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
}

// Create Supabase client for client-side operations
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  }
)

// Create Supabase client with service role key for admin access
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
)

// Custom error for Supabase operations
export class SupabaseError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'SupabaseError';
  }
}

// Helper function to handle Supabase errors
export const handleSupabaseError = (error: any, customMessage?: string): never => {
  console.error('Supabase operation failed:', error);
  throw new SupabaseError(customMessage || 'Database operation failed', error);
};

// Helper function to check if a bucket exists and create it if it doesn't
export const ensureBucket = async (bucketName: string) => {
  try {
    const { data: bucket, error } = await supabase.storage.getBucket(bucketName);
    
    if (error && error.message.includes('not found')) {
      const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
        public: false,
        allowedMimeTypes: ['audio/mpeg', 'audio/wav', 'audio/mp3']
      });
      
      if (createError) {
        handleSupabaseError(createError, `Failed to create bucket: ${bucketName}`);
      }
      return data;
    } else if (error) {
      handleSupabaseError(error, `Failed to check bucket: ${bucketName}`);
    }
    
    return bucket;
  } catch (error) {
    handleSupabaseError(error, `Unexpected error while managing bucket: ${bucketName}`);
  }
};

// Helper function to upload a file to Supabase storage
export const uploadFile = async (
  bucketName: string,
  filePath: string,
  file: File | Buffer,
  contentType?: string
) => {
  try {
    await ensureBucket(bucketName);
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        contentType,
        upsert: true
      });
      
    if (error) {
      handleSupabaseError(error, `Failed to upload file to ${bucketName}/${filePath}`);
    }
    
    return data;
  } catch (error) {
    handleSupabaseError(error, `Unexpected error while uploading file to ${bucketName}/${filePath}`);
  }
};

// Helper function to get a public URL for a file
export const getPublicUrl = (bucketName: string, filePath: string) => {
  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);
    
  return data.publicUrl;
};

// Helper function to delete a file from storage
export const deleteFile = async (bucketName: string, filePath: string) => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);
      
    if (error) {
      handleSupabaseError(error, `Failed to delete file: ${bucketName}/${filePath}`);
    }
    
    return data;
  } catch (error) {
    handleSupabaseError(error, `Unexpected error while deleting file: ${bucketName}/${filePath}`);
  }
};
