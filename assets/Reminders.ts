export interface Reminder {
  reminder: string;
  source: string;
  hadith: string;
  category: string;
}

export const remindersData: Reminder[] = [
  { 
    reminder: "Avoid backaddadd the biting today", 
    source: "Sahih Bukhari",
    hadith: "The believer is not one who eats his fill while his neighbor goes hungry.",
    category: "Speech"
  },
  {
    reminder: "I love you babe",
    source: "Wiame",
    hadith: "Wiame",
    category: "Love"
  }
];
  