import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ArrowClockwise";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { BookOpenIcon } from "@phosphor-icons/react/dist/ssr/BookOpen";
import { BooksIcon } from "@phosphor-icons/react/dist/ssr/Books";
import { BrainIcon } from "@phosphor-icons/react/dist/ssr/Brain";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CaretUpIcon } from "@phosphor-icons/react/dist/ssr/CaretUp";
import { ChalkboardTeacherIcon } from "@phosphor-icons/react/dist/ssr/ChalkboardTeacher";
import { ChartBarIcon } from "@phosphor-icons/react/dist/ssr/ChartBar";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/ssr/ChatCircle";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/ssr/ClipboardText";
import { ConfettiIcon } from "@phosphor-icons/react/dist/ssr/Confetti";
import { GraduationCapIcon } from "@phosphor-icons/react/dist/ssr/GraduationCap";
import { HandshakeIcon } from "@phosphor-icons/react/dist/ssr/Handshake";
import { HouseIcon } from "@phosphor-icons/react/dist/ssr/House";
import { LightbulbIcon } from "@phosphor-icons/react/dist/ssr/Lightbulb";
import { ListChecksIcon } from "@phosphor-icons/react/dist/ssr/ListChecks";
import { LockIcon } from "@phosphor-icons/react/dist/ssr/Lock";
import { MagicWandIcon } from "@phosphor-icons/react/dist/ssr/MagicWand";
import { MedalIcon } from "@phosphor-icons/react/dist/ssr/Medal";
import { NotePencilIcon } from "@phosphor-icons/react/dist/ssr/NotePencil";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/ssr/PencilSimple";
import { PlantIcon } from "@phosphor-icons/react/dist/ssr/Plant";
import { PushPinIcon } from "@phosphor-icons/react/dist/ssr/PushPin";
import { RocketLaunchIcon } from "@phosphor-icons/react/dist/ssr/RocketLaunch";
import { SealCheckIcon } from "@phosphor-icons/react/dist/ssr/SealCheck";
import { SmileyIcon } from "@phosphor-icons/react/dist/ssr/Smiley";
import { SparkleIcon } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { SpinnerIcon } from "@phosphor-icons/react/dist/ssr/Spinner";
import { SquareIcon } from "@phosphor-icons/react/dist/ssr/Square";
import { StudentIcon } from "@phosphor-icons/react/dist/ssr/Student";
import { TargetIcon } from "@phosphor-icons/react/dist/ssr/Target";
import { TrophyIcon } from "@phosphor-icons/react/dist/ssr/Trophy";
import { UsersIcon } from "@phosphor-icons/react/dist/ssr/Users";
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning";
import { XCircleIcon } from "@phosphor-icons/react/dist/ssr/XCircle";
import type { ComponentProps } from "react";

const icons = {
  refresh: ArrowClockwiseIcon, back: ArrowLeftIcon, next: ArrowRightIcon,
  book: BookOpenIcon, books: BooksIcon, brain: BrainIcon,
  up: CaretUpIcon, down: CaretDownIcon, teacher: ChalkboardTeacherIcon,
  chart: ChartBarIcon, chat: ChatCircleIcon, success: CheckCircleIcon,
  check: CheckIcon, list: ClipboardTextIcon, celebrate: ConfettiIcon,
  graduate: GraduationCapIcon, handshake: HandshakeIcon, home: HouseIcon,
  idea: LightbulbIcon, checklist: ListChecksIcon, lock: LockIcon,
  magic: MagicWandIcon, medal: MedalIcon, note: NotePencilIcon,
  pencil: PencilSimpleIcon, plant: PlantIcon, pin: PushPinIcon,
  rocket: RocketLaunchIcon, verified: SealCheckIcon, smile: SmileyIcon,
  sparkle: SparkleIcon, loading: SpinnerIcon, empty: SquareIcon,
  student: StudentIcon, target: TargetIcon, trophy: TrophyIcon,
  users: UsersIcon, warning: WarningIcon, error: XCircleIcon,
} as const;

type Props = Omit<ComponentProps<typeof PlantIcon>, "children"> & {
  name: keyof typeof icons;
};

export function AppIcon({ name, size = "1.2em", weight = "duotone", className = "", ...props }: Props) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" size={size} weight={weight} className={`inline-block align-[-0.12em] shrink-0 ${className}`} {...props} />;
}
