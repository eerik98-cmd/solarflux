// import { storage } from './firebase';
// import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';

// export const uploadFile = async (file: File, bucket: string, path: string): Promise<string> => {
//   try {
//     // In Firebase, we can treat 'bucket' as a root folder in the default bucket
//     const storageRef = ref(storage, `${bucket}/${path}`);
    
//     await uploadBytes(storageRef, file);
//     const publicUrl = await getDownloadURL(storageRef);

//     return publicUrl;
//   } catch (error) {
//     console.error("Upload error:", error);
//     throw error;
//   }
// };

// export const uploadBase64 = async (base64Data: string, bucket: string, path: string): Promise<string> => {
//   try {
//     const storageRef = ref(storage, `${bucket}/${path}`);
    
//     // uploadString handles base64 data URLs automatically if format is 'data_url'
//     await uploadString(storageRef, base64Data, 'data_url');
    
//     const publicUrl = await getDownloadURL(storageRef);

//     return publicUrl;
//   } catch (error) {
//     console.error("Base64 Upload error:", error);
//     throw error;
//   }
// };