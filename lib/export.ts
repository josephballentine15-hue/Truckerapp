import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Logbook } from './types';
import { buildHtml } from './sheet-html';

// Open the OS print dialog (AirPrint / Android print -> can also save as PDF).
export async function printLogbook(book: Logbook): Promise<void> {
  await Print.printAsync({ html: buildHtml(book) });
}

// Generate a PDF and hand it to the OS share sheet (text, email, etc.).
// Returns false if sharing isn't available on this platform.
export async function shareLogbook(book: Logbook): Promise<boolean> {
  const { uri } = await Print.printToFileAsync({ html: buildHtml(book) });
  if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Send logbook',
    UTI: 'com.adobe.pdf',
  });
  return true;
}
