export type ScriptMode = 'english' | 'roman-urdu' | 'urdu-script';
export type TtsLang = 'en' | 'ur';

export interface DetectedLanguageInfo {
  scriptMode: ScriptMode;
  ttsLang: TtsLang;
  isRtl: boolean;
}

const URDU_SCRIPT_REGEX = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

// Distinct Roman Urdu / conversational Pakistani Urdu-English terms (matched on word boundaries)
const STRONG_ROMAN_URDU_TOKENS = new Set([
  'mujhe',
  'mujy',
  'mjhe',
  'mujhko',
  'aap',
  'aapko',
  'apko',
  'tumhe',
  'hamain',
  'humein',
  'kya',
  'kia',
  'kaise',
  'kesy',
  'kesi',
  'kaisa',
  'hain',
  'hoon',
  'hun',
  'chahiye',
  'chaheye',
  'chahye',
  'dikhao',
  'dikhaen',
  'dikhaiye',
  'dikha',
  'batao',
  'bataen',
  'bataiye',
  'btao',
  'pehno',
  'pehnoon',
  'pehnna',
  'pehnu',
  'shaadi',
  'shadi',
  'mehndi',
  'walima',
  'baraat',
  'barat',
  'kapray',
  'kapde',
  'jora',
  'jori',
  'sasta',
  'sasti',
  'saste',
  'mehnga',
  'mehngi',
  'qeemat',
  'kimat',
  'daam',
  'kitne',
  'kitna',
  'kitni',
  'nahi',
  'nhi',
  'naheen',
  'haan',
  'shukriya',
  'mehrbani',
  'pasand',
  'kaala',
  'kala',
  'kali',
  'safed',
  'sufaid',
  'sunehri',
  'sunahri',
  'sabz',
  'neela',
  'neeli',
  'acha',
  'achay',
  'acchi',
  'behtareen',
  'khubsurat',
  'bohat',
  'boht',
  'bahut',
  'madad',
  'karo',
  'karen',
  'karain',
  'rakho',
  'dalo',
  'nikalo',
  'aaj',
  'parson',
  'subah',
  'sardi',
  'garmi',
  'barish',
  'mausam',
  'libas',
  'saath',
  'sath',
  'liye',
  'wale',
  'wali',
  'wala',
  'konsa',
  'konsi',
  'kaun',
  'koi',
  'kuch',
  'mera',
  'meri',
  'mere',
  'hamara',
  'humara',
  'tumhara',
  'iska',
  'iski',
  'iske',
  'ye',
  'yeh',
  'woh',
  'wo',
  'aur',
  'mein',
  'rahi',
  'raha',
  'rahe',
  'sakht',
  'khareedna',
  'mangwana',
  'bhejo',
  'bhejdo',
  'jaldi',
  'tasveer',
  'jootay',
  'jooti',
  'zewar',
  'jhumke',
  'thora',
  'zyada',
]);

// Supporting connectors/particles that reinforce Roman Urdu when paired with another token
const SUPPORTING_ROMAN_URDU_TOKENS = new Set([
  'ke',
  'ki',
  'ka',
  'ko',
  'se',
  'mein',
  'main',
  'pe',
  'par',
  'bhi',
  'hi',
  'toh',
  'tou',
  'hai',
  'ho',
  'ji',
  'kal',
  'din',
  'raat',
  'ya',
  'na',
  'ap',
  'hum',
]);

export function containsUrduScript(text: string): boolean {
  return URDU_SCRIPT_REGEX.test(text || '');
}

export function detectConversationLanguage(text: string): DetectedLanguageInfo {
  const input = (text || '').trim();
  if (!input) {
    return { scriptMode: 'english', ttsLang: 'en', isRtl: false };
  }

  if (URDU_SCRIPT_REGEX.test(input)) {
    return { scriptMode: 'urdu-script', ttsLang: 'ur', isRtl: true };
  }

  const words = input
    .toLowerCase()
    .replace(/[^a-z\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let strongHits = 0;
  let supportingHits = 0;

  for (const w of words) {
    if (STRONG_ROMAN_URDU_TOKENS.has(w)) {
      strongHits += 1;
    } else if (SUPPORTING_ROMAN_URDU_TOKENS.has(w)) {
      supportingHits += 1;
    }
  }

  if (strongHits >= 2 || (strongHits >= 1 && supportingHits >= 1) || (words.length <= 3 && strongHits >= 1)) {
    return { scriptMode: 'roman-urdu', ttsLang: 'ur', isRtl: false };
  }

  return { scriptMode: 'english', ttsLang: 'en', isRtl: false };
}
