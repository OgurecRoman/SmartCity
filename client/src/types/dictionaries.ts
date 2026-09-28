export type DictionaryItem = {
  value: string;
  label: string;
};

export type Dictionaries = {
  categories: DictionaryItem[];
  statuses: DictionaryItem[];
  priorities: DictionaryItem[];
  residentTypes: DictionaryItem[];
  transitions: Record<string, string[]>;
};
