import {
  GraduationCap, BookOpen, Landmark, Building2, Library, School,
  Award, Trophy, Star, Users, FlaskConical, Microscope, Palette,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  GraduationCap,
  BookOpen,
  Landmark,
  Building2,
  Library,
  School,
  Award,
  Trophy,
  Star,
  Users,
  FlaskConical,
  Microscope,
  Palette,
};

export function getCampusIcon(name: string): LucideIcon {
  return iconMap[name] ?? GraduationCap;
}
