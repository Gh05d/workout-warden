interface Navigation {
  /** Go to another screen, figures out the action it needs to take to do it */
  navigate: (path: string, config?: object, merge?: boolean) => void;
  /**  Wipe the navigator state and replace it with a new route */
  reset: () => void;
  /** Close active screen and move back in the stack */
  goBack: () => void;
  /**  Make changes to route's params */
  setParams: (params: {[prop: string]: any}) => void;
  /**  Send an action object to update the navigation state */
  dispatch: () => void;
  /** Update the screen's options */
  setOptions: ({title: string}) => void;
  /** Check whether the screen is focused */
  isFocused: () => void;
  /** Subscribe to updates to events from the navigators */
  addListener: (event: string, callback: Function) => void;
  canGoBack: () => boolean;
  jumpTo: () => void;
  push: (path: string, config?: object) => void;
  replace: (path: string, config?: object) => void;
  getParent: () => Navigation;
}

interface Route {
  /**  Unique key of the screen. Created automatically or added while navigating to this screen. */
  key: string;
  /** Name of the screen. Defined in navigator component hierarchy. */
  name: string;
  /** An optional string containing the path that opened the screen, exists when the screen was opened via a deep link. */
  path?: string;
  params?: {[prop: string]: any};
}

interface BaseProps {
  navigation: Navigation;
  /** Contains the routes parameters */
  route: Route;
}

interface ExerciseSet {
  id: number;
  reps: number;
  weight: number | null;
  training_day_exercise_id: number;
}

// Define a type for the exercises
interface Exercise {
  id: number;
  finished: 0 | 1;
  name: string;
  sled?: boolean;
  time?: number;
  sets: ExerciseSet[];
  hint?: string;
  video: string;
  next?: boolean;
  training_day_exercise_id: number;
}

interface TrainingDay {
  id: number;
  day: string;
  finished?: 0 | 1;
  exercises?: Exercise[];
  workout_program_id: id;
}

interface Week {
  id: number;
  start_date: string;
  end_date: string;
  type: 'A' | 'B';
  finished: 0 | 1;
  sessions: TrainingDay[];
}
