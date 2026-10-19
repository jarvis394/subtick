import { Popover } from '@base-ui/react/popover'
import { Tabs } from '@base-ui/react/tabs'
import { FlaskConical } from 'lucide-react'
import { useMatch } from '@tanstack/react-router'
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { IconButton } from '@/components/ui/button'
import { AutoHeight } from '@/components/ui/presence'

// Each tab loads when first opened.
const DevMatchesTab = lazy(() => import('./matches-tab').then((m) => ({ default: m.DevMatchesTab })))
const DevHighlightsTab = lazy(() =>
  import('./highlights-tab').then((m) => ({ default: m.DevHighlightsTab })),
)

/**
 * Sections of the menu; each is a tab. `close` dismisses the menu, e.g. before navigating;
 * `matchId` is the match open now, or the last one that was.
 */
const TABS = [
  {
    value: 'matches',
    label: 'Matches',
    panel: (close: () => void) => <DevMatchesTab onNavigate={close} />,
  },
  {
    value: 'highlights',
    label: 'Highlights',
    panel: (close: () => void, matchId: string | null) => (
      <DevHighlightsTab matchId={matchId} onNavigate={close} />
    ),
  },
] as const

/** Same switcher as Manage instance. */
const tabClass =
  'relative z-10 flex h-7 cursor-pointer items-center rounded-md px-2.5 text-[13px] whitespace-nowrap text-muted transition-colors outline-none select-none hover:text-foreground data-active:text-foreground focus-visible:ring-2 focus-visible:ring-ring'

/**
 * Dev builds only (app-shell leaves it out of production bundles): a floating button that opens
 * local helpers. Black and on the dark tokens in both themes, so it reads as tooling rather than
 * part of the app.
 */
export default function DevMenu() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const lastMatch = useRef<string | null>(null)
  const onMatchPage = useMatch({ from: '/_app/matches/$id', shouldThrow: false })
  const matchId = onMatchPage?.params.id ?? lastMatch.current

  useEffect(() => {
    if (onMatchPage) lastMatch.current = onMatchPage.params.id
  }, [onMatchPage])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className="theme-dark fixed right-4 bottom-4 z-50 [view-transition-class:chrome] [view-transition-name:dev-menu]">
        <Popover.Trigger
          render={
            <IconButton
              label="Developer tools"
              tooltip={false}
              className="size-10 rounded-full border border-border-strong shadow-lg shadow-black/30 [--bg:black]"
            />
          }
        >
          <FlaskConical />
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Positioner
          side="top"
          align="end"
          sideOffset={8}
          positionMethod="fixed"
          className="z-50"
        >
          <Popover.Popup className="theme-dark w-80 origin-(--transform-origin) rounded-2xl border border-border-strong bg-black text-foreground shadow-2xl shadow-black/40 outline-none transition-[scale,opacity] duration-200 ease-out-quart data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-starting-style:scale-[0.96] data-starting-style:opacity-0">
            <Tabs.Root defaultValue={TABS[0].value}>
              <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5">
                <Popover.Title className="text-[12px] font-medium text-muted">
                  Developer tools
                </Popover.Title>
                <Tabs.List className="relative flex gap-0.5" aria-label="Sections">
                  {TABS.map((tab) => (
                    <Tabs.Tab key={tab.value} value={tab.value} className={tabClass}>
                      {tab.label}
                    </Tabs.Tab>
                  ))}
                  <Tabs.Indicator className="absolute top-0 left-0 z-0 h-7 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-md bg-surface-2 transition-[translate,width] duration-200 ease-out-quart motion-reduce:transition-none" />
                </Tabs.List>
              </div>
              {/* Within a range: the menu neither collapses while a tab's code loads nor outgrows the
                screen, and its height eases as a tab's content or the tab itself changes. */}
              <div className="max-h-[min(28rem,60dvh)] overflow-y-auto">
                <AutoHeight innerClassName="min-h-56">
                  {TABS.map((tab) => (
                    <Tabs.Panel key={tab.value} value={tab.value} className="outline-none">
                      <Suspense fallback={null}>{tab.panel(close, matchId)}</Suspense>
                    </Tabs.Panel>
                  ))}
                </AutoHeight>
              </div>
            </Tabs.Root>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
