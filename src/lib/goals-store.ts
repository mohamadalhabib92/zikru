import { normalizeGoals, DEFAULT_GOALS, type GoalPrefs, type Milestone } from './goals';
import { shared } from './shared-state';

/** Objectifs du jour et étapes atteintes : stockage local uniquement (jamais synchronisé, jamais partagé). */
export const goalPrefs = shared<GoalPrefs>('goals', DEFAULT_GOALS, (v) => normalizeGoals(v));
export const milestones = shared<Milestone[]>('goal-milestones', [], (v) => (Array.isArray(v) ? v.slice(-50) : []));
