export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
};

export type MainTabsParamList = {
  Dashboard: undefined;
  Profile: undefined;
  Coaches: undefined;
  Students: undefined;
  AudioCoaching?: undefined;
  FindCoach?: undefined;
  More?: undefined; // Add More tab
};

export type RootStackParamList = AuthStackParamList & {
  MainTabs: undefined;
  Profile: undefined;
  LegalHelper: undefined;
  LawyerSelection: { onSelectLawyer: (lawyerId: string) => void };
  Quiz?: undefined;
};