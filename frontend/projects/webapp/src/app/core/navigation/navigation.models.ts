export interface NavigationItem {
  readonly label: string;
  readonly route: string;
  readonly icon: string;
}

export interface NavigationSection {
  readonly title: string;
  readonly items: readonly NavigationItem[];
}

export type NavigationConfig = readonly NavigationSection[];
