export interface Reminder {
  reminder: string;
  source: string;
  hadith: string;
  category: string;
}

export const remindersData: Reminder[] = [
  { 
    reminder: "Avoid backbiting today", 
    source: "Sahih Bukhari",
    hadith: "The believer is not one who eats his fill while his neighbor goes hungry.",
    category: "Speech"
  },
  { 
    reminder: "Be kind to your parents today", 
    source: "Quran 17:23",
    hadith: "And your Lord has decreed that you not worship except Him, and to parents, good treatment.",
    category: "Family"
  },
  { 
    reminder: "Pray your prayers on time today", 
    source: "Sahih Muslim",
    hadith: "The deed most beloved to Allah is the prayer offered on time.",
    category: "Worship"
  },
  { 
    reminder: "Smile in the face of others today", 
    source: "Sunan Tirmidhi",
    hadith: "Your smile for your brother is a charity.",
    category: "Character"
  },
  { 
    reminder: "Do not waste food today", 
    source: "Quran 7:31",
    hadith: "Indeed, He likes not those who commit excess.",
    category: "Manners"
  },
  { 
    reminder: "Say 'Alhamdulillah' often today", 
    source: "Sahih Muslim",
    hadith: "Allah is pleased with His servant who, when he eats something, praises Him for it.",
    category: "Gratitude"
  },
  { 
    reminder: "Keep your promises today", 
    source: "Quran 16:91",
    hadith: "And fulfill the covenant of Allah when you have taken it.",
    category: "Honesty"
  },
  { 
    reminder: "Make sincere dua today", 
    source: "Sunan Tirmidhi",
    hadith: "Dua is the essence of worship.",
    category: "Worship"
  },
  { 
    reminder: "Lower your gaze today", 
    source: "Quran 24:30",
    hadith: "Tell the believing men to lower their gaze and guard their modesty.",
    category: "Purity"
  },
  { 
    reminder: "Visit the sick if possible today", 
    source: "Sahih Muslim",
    hadith: "Feed the hungry, visit the sick, and free the captives.",
    category: "Community"
  }
];
