import { HugeiconsIcon, type IconSvgElement, type HugeiconsProps } from "@hugeicons/react";
import {
  Archive01Icon,
  ArrowUpRight01Icon,
  BookOpen01Icon,
  Briefcase01Icon,
  Calendar01Icon,
  CalendarDaysIcon,
  Cancel01Icon,
  CheckIcon,
  CheckmarkSquare01Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleIcon,
  Clock01Icon,
  CornerDownRightIcon,
  Delete01Icon,
  ExternalLinkIcon,
  File01Icon,
  Flag01Icon,
  GripVerticalIcon,
  HashIcon,
  Image01Icon,
  InboxIcon,
  InformationCircleIcon,
  KeyboardIcon,
  DashboardSquare01Icon,
  Link01Icon,
  ListViewIcon,
  LoaderPinwheelIcon,
  Maximize01Icon,
  Minimize01Icon,
  MinusSignIcon,
  MoonIcon,
  MoreHorizontalIcon,
  Notebook01Icon,
  PanelLeftIcon,
  PauseIcon,
  PencilEdit01Icon,
  PinIcon,
  PinOffIcon,
  PlayIcon,
  PlusSignIcon,
  RotateLeft01Icon,
  SaveIcon,
  Search01Icon,
  SendingOrderIcon,
  Settings01Icon,
  Settings02Icon,
  SparklesIcon,
  Square01Icon,
  Sun01Icon,
  Target01Icon,
  Timer01Icon,
} from "@hugeicons/core-free-icons";
function hi(iconData: IconSvgElement) {
  return function Icon({ className, strokeWidth = 1.5, size, ...props }: HugeiconsProps) {
    return (
      <HugeiconsIcon
        icon={iconData}
        className={className}
        strokeWidth={strokeWidth}
        size={size ? Number(size) : 24}
        {...props}
      />
    );
  };
}

export const ArchiveIcon = hi(Archive01Icon);
export const ArrowUpRightIcon = hi(ArrowUpRight01Icon);
export const BookOpenIcon = hi(BookOpen01Icon);
export const BriefcaseIcon = hi(Briefcase01Icon);
export const CalendarIcon = hi(Calendar01Icon);
export const CalendarDays = hi(CalendarDaysIcon);
export const CancelIcon = hi(Cancel01Icon);
export const CheckmarkIcon = hi(CheckIcon);
export const CheckmarkSquareIcon = hi(CheckmarkSquare01Icon);
export const ChevronDown = hi(ChevronDownIcon);
export const ChevronLeft = hi(ChevronLeftIcon);
export const ChevronRight = hi(ChevronRightIcon);
export const CircleOutlineIcon = hi(CircleIcon);
export const ClockIcon = hi(Clock01Icon);
export const CornerDownRight = hi(CornerDownRightIcon);
export const DeleteIcon = hi(Delete01Icon);
export const ExternalLink = hi(ExternalLinkIcon);
export const FileIcon = hi(File01Icon);
export const FlagIcon = hi(Flag01Icon);
export const GripVertical = hi(GripVerticalIcon);
export const Hash = hi(HashIcon);
export const ImageIcon = hi(Image01Icon);
export const InboxIcon2 = hi(InboxIcon);
export const InfoIcon = hi(InformationCircleIcon);
export const KeyboardIconComp = hi(KeyboardIcon);
export const LayoutDashboard = hi(DashboardSquare01Icon);
export const LinkIcon = hi(Link01Icon);
export const ListIcon = hi(ListViewIcon);
export const Loader = hi(LoaderPinwheelIcon);
export const MaximizeIcon = hi(Maximize01Icon);
export const MinimizeIcon = hi(Minimize01Icon);
export const MinusIcon = hi(MinusSignIcon);
export const MoonIconComp = hi(MoonIcon);
export const MoreHorizontal = hi(MoreHorizontalIcon);
export const NotebookPen = hi(Notebook01Icon);
export const PanelLeft = hi(PanelLeftIcon);
export const Pause = hi(PauseIcon);
export const PencilIcon = hi(PencilEdit01Icon);
export const Pin = hi(PinIcon);
export const PinOff = hi(PinOffIcon);
export const Play = hi(PlayIcon);
export const PlusIcon = hi(PlusSignIcon);
export const RotateCcw = hi(RotateLeft01Icon);
export const Save = hi(SaveIcon);
export const Search = hi(Search01Icon);
export const SendHorizontal = hi(SendingOrderIcon);
export const SettingsIcon = hi(Settings01Icon);
export const Settings2 = hi(Settings02Icon);
export const Sparkles = hi(SparklesIcon);
export const SquareIcon = hi(Square01Icon);
export const SunIconComp = hi(Sun01Icon);
export const Target = hi(Target01Icon);
export const TimerIcon = hi(Timer01Icon);

export const Icons = {
  archive: ArchiveIcon,
  book: BookOpenIcon,
  briefcase: BriefcaseIcon,
  calendar: CalendarIcon,
  check: CheckmarkIcon,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  circle: CircleOutlineIcon,
  clock: ClockIcon,
  cornerDownRight: CornerDownRight,
  file: FileIcon,
  flag: FlagIcon,
  image: ImageIcon,
  inbox: InboxIcon2,
  info: InfoIcon,
  keyboard: KeyboardIconComp,
  layout: LayoutDashboard,
  link: LinkIcon,
  minus: MinusIcon,
  moreHorizontal: MoreHorizontal,
  pencil: PencilIcon,
  panel: PanelLeft,
  plus: PlusIcon,
  rotate: RotateCcw,
  search: Search,
  settings: SettingsIcon,
  sparkles: Sparkles,
  square: SquareIcon,
  target: Target,
  trash: DeleteIcon,
  x: CancelIcon,
};
