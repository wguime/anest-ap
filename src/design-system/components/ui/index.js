export { Button, buttonVariants } from './button';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './card';
export { Badge, badgeVariants } from './badge';
export { Avatar, AvatarImage, AvatarFallback, avatarVariants } from './avatar';
export { Input } from './input';
export { Skeleton } from './skeleton';

export { WidgetCard } from './widget-card';
export { AppIcon } from './app-icon';
export { WidgetGrid } from './widget-grid';
export { QuickLinksCard } from './quick-links-card';
// NOTE: ListItem ANEST oficial vive em `components/anest/` para suportar light/dark specs.

// Form Components (v3.0)
export { Select } from './select';
export { Checkbox } from './checkbox';
export { RadioGroup, RadioItem } from './radio';
export { Textarea } from './textarea';
export { Switch } from './switch';
export { DatePicker } from './date-picker';
export { FileUpload } from './file-upload';
export { FormField } from './form-field';

// Feedback Components
export { ToastProvider, Toast, useToast } from './toast';
export { Modal } from './modal';
export { Alert } from './alert';
export { Progress } from './progress';
export { Spinner } from './spinner';
export { EmptyState, EmptySearch, EmptyList, EmptyNotifications, EmptyDocuments } from './empty-state';
export { FadeIn } from './fade-in';
export { ConfirmDialog } from './confirm-dialog';

// Navigation Components
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
export { 
  Breadcrumb, 
  BreadcrumbList, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbPage, 
  BreadcrumbSeparator,
  BreadcrumbEllipsis 
} from './breadcrumb';
export { 
  DropdownMenu, 
  DropdownTrigger, 
  DropdownContent, 
  DropdownItem,
  DropdownCheckboxItem,
  DropdownRadioGroup,
  DropdownRadioItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownShortcut
} from './dropdown';
export { 
  Sidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarItem,
  SidebarTrigger
} from './sidebar';
export { NavLink } from './nav-link';
export { Pagination } from './pagination';
export { Stepper } from './stepper';

// Responsive Components
export {
  ResponsiveContainer,
  ResponsiveGrid,
  ResponsiveStack,
  ShowAt,
  HideAt,
  MobileOnly,
  TabletOnly,
  DesktopOnly,
  MobileAndTablet,
  TabletAndDesktop,
} from "./responsive-container"

// Data Display Components (Phase 6)
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './table'
export { DataGrid } from './data-grid'
export { Calendar } from './calendar'
export { Timeline, TimelineItem } from './timeline'
export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
} from './lazy-chart'
export { DonutChart, COLOR_PALETTE } from './lazy-donut-chart'
// StatCard foi removido - usar KPICard de /anest/ em vez disso

// Utility Components (Phase 7)
export { Tooltip, TooltipProvider } from './tooltip'
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverClose } from './popover'
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './accordion'
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from './collapsible'
export { ScrollArea, ScrollAreaViewport } from './scroll-area'
export { Separator } from './separator'
export { AspectRatio } from './aspect-ratio'

// Media & Content Components (Phase 8)
export { AudioPlayer, AudioPlayerMini } from './audio-player'
export { VideoPlayer } from './video-player'
export { PDFViewer, PDFThumbnail, PDFThumbnailList, ViewModeToggle } from './pdf-viewer'
export { QRCode, QRCodeCard, QRCodeMini } from './qr-code'

// Gamification Components (Phase 8)
export { Quiz, QuizCard } from './quiz'
export { Leaderboard, LeaderboardMini } from './leaderboard'
export { Achievement, AchievementGrid, AchievementToast, AchievementSummary } from './achievement'
export { Checklist, ChecklistInline, ChecklistItem } from './checklist'

export { StaggerList, StaggerItem } from './stagger-list';

// Decorative Components
export {
  AnimatedBackground,
  CirclesAnimation,
  DotsAnimation,
  GradientAnimation,
  MeshAnimation,
} from './animated-background'

// Carousel Components
export {
  Carousel,
  CarouselSlide,
  CarouselItem,
  CarouselContent,
  CarouselPrevButton,
  CarouselNextButton,
  CarouselIndicators,
  useCarousel,
} from './carousel'
